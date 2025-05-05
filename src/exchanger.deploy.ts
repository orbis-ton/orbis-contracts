import {
  Address,
  contractAddress,
  toNano,
  internal,
  fromNano,
  SendMode,
  Cell,
  OpenedContract,
  WalletContractV5R1,
  TonClient,
  beginCell,
} from '@ton/ton';
import { Exchanger, storeInitExchangerJettonWallets } from './output/orb_Exchanger';
import { JettonMinter } from './JettonMinter';
import { client, delay, keyPairFromEnv, openWalletV5, waitForDeployment } from './common';
import { OMCollection } from './output/orb_OMCollection';
import { JettonWallet } from './JettonWallet';
import { text } from '@clack/prompts';
import { OMGiver, storeInitJettonWallet } from './output/orbis_OMGiver';
import { itemPrefix, tep64TokenData } from './constants';

async function deployCollection(wallet: OpenedContract<WalletContractV5R1>, secretKey: Buffer, deployAmount: bigint) {
  let init = await OMCollection.init(wallet.address, tep64TokenData, itemPrefix, {
    $$type: 'RoyaltyParams',
    numerator: 0n,
    denominator: 2n,
    destination: wallet.address,
  });
  let address = contractAddress(0, init);

  console.log('Deploying collection to address: ', address);
  const seqno: number = await wallet.getSeqno();

  await wallet.sendTransfer({
    seqno,
    secretKey,
    messages: [
      internal({
        to: address,
        value: deployAmount,
        init: { code: init.code, data: init.data },
        bounce: true,
      }),
    ],
    sendMode: SendMode.PAY_GAS_SEPARATELY,
  });
  return address;
}
async function getNftItemCode(collectionAddress: Address): Promise<Cell | null> {
  const collection = client.open(OMCollection.fromAddress(collectionAddress));
  const nftAddress = await collection.getGetNftAddressByIndex(0n);
  console.log('NFT address: ', nftAddress);
  const nftCodeBuffer = (await client.getContractState(nftAddress)).code;
  if (!nftCodeBuffer) return null;
  return Cell.fromBoc(nftCodeBuffer)[0];
}

async function deployExchanger(
  wallet: OpenedContract<WalletContractV5R1>,
  secretKey: Buffer,
  deployAmount: bigint,
  nftCollectionAddress: Address,
  nftCollectionAddressOld: Address,
  exchangerJettonWalletAddress: Address | null,
  jwBalance: bigint,
  exchangerJettonWalletAddressOld: Address | null,
  jwBalanceOld: bigint,
  nftItemCode: Cell
) {
  const calcOnly = exchangerJettonWalletAddressOld === null && exchangerJettonWalletAddress === null;

  const nextItemIndex = 367n;
  let init = await Exchanger.init(BigInt(2), nftCollectionAddress, nftCollectionAddressOld, nextItemIndex, nftItemCode);
  let address = contractAddress(0, init);
  if (calcOnly) return address;
  if (!exchangerJettonWalletAddress || !exchangerJettonWalletAddressOld) throw new Error('Should set or unset both');

  console.log('Deploying contract to address: ', address);
  const seqno: number = await wallet.getSeqno();

  await wallet.sendTransfer({
    seqno,
    secretKey,
    messages: [
      internal({
        to: address,
        value: deployAmount,
        init: { code: init.code, data: init.data },
        body: beginCell()
          .store(
            storeInitExchangerJettonWallets({
              $$type: 'InitExchangerJettonWallets',
              address: exchangerJettonWalletAddress,
              balance: jwBalance,
              addressOld: exchangerJettonWalletAddressOld,
              balanceOld: jwBalanceOld,
            })
          )
          .endCell(),
        bounce: true,
      }),
    ],
    sendMode: SendMode.PAY_GAS_SEPARATELY,
  });
  return address;
}

async function calcGiverAddress(nftCollectionAddress: Address, nextItemIndex: bigint, nftItemCode: Cell) {
  let init = await OMGiver.init(BigInt(1), nftCollectionAddress, nextItemIndex, nftItemCode);
  return contractAddress(0, init);
}

async function deployGiver(
  wallet: OpenedContract<WalletContractV5R1>,
  secretKey: Buffer,
  deployAmount: bigint,
  nftCollectionAddress: Address,
  giverJettonWalletAddress: Address,
  jwBalance: bigint,
  nextItemIndex: bigint,
  nftItemCode: Cell
) {
  let init = await OMGiver.init(BigInt(1), nftCollectionAddress, nextItemIndex, nftItemCode);
  let address = contractAddress(0, init);

  console.log('Deploying giver to address: ', address);
  const seqno: number = await wallet.getSeqno();

  const tx = await wallet.sendTransfer({
    seqno,
    secretKey,
    messages: [
      internal({
        to: address,
        value: deployAmount,
        init: { code: init.code, data: init.data },
        body: beginCell()
          .store(
            storeInitJettonWallet({ $$type: 'InitJettonWallet', address: giverJettonWalletAddress, balance: jwBalance })
          )
          .endCell(),
        bounce: true,
      }),
    ],
    sendMode: SendMode.PAY_GAS_SEPARATELY,
  });
  tx;
  return address;
}

async function changeCollectionOwner(
  wallet: OpenedContract<WalletContractV5R1>,
  secretKey: Buffer,
  nftCollectionAddress: Address,
  ownerAddress: Address
) {
  const seqno = await wallet.getSeqno();
  wallet.sendTransfer({
    seqno,
    secretKey,
    messages: [
      internal({
        to: nftCollectionAddress,
        value: toNano('0.1'),
        body: new Cell().asBuilder().storeUint(3, 32).storeUint(0, 64).storeAddress(ownerAddress).asCell(),
      }),
    ],
    sendMode: SendMode.PAY_GAS_SEPARATELY,
  });
}

async function changeCollectionExchanger(
  wallet: OpenedContract<WalletContractV5R1>,
  secretKey: Buffer,
  nftCollectionAddress: Address,
  exchangerAddress: Address
) {
  const collection = client.open(OMCollection.fromAddress(nftCollectionAddress));
  await collection.send(
    wallet.sender(secretKey),
    {
      value: toNano('0.1'),
    },
    {
      $$type: 'UpdateExchanger',
      exchanger: exchangerAddress,
    }
  );
}

(async () => {
  const wallet = await openWalletV5('admin');
  const secretKey = (await keyPairFromEnv('admin')).secretKey;
  const collOwner = await openWalletV5('collection');
  const collOwnerSK = (await keyPairFromEnv('collection')).secretKey;
  console.log('Wallet address: ', wallet.address);
  const toExecute = {
    collection: true,
    exchanger: true,
    giver: true,
    changeExchanger: true,
    changeOwner: true
  }
  const oldCollectionAddress = Address.parse('EQCTyTzHbndt6ZYpZAyf6rZav2sG4KRuU6iw-F95nAnOzJEB');
  const oldJettonMasterAddress = Address.parse('EQBe0QNN5u45TL8h1QHZUOxl69QhoJLMyhQzjCenxxL2ZInd');
  const jettonMasterAddress = Address.parse('EQCjJox4acmu7UGD19RSOdym8aXxdXyXzKeSq5VR6gNqI6k4');

  let collectionAddress = Address.parse('EQA99W9EfL9WnekqxH5AKKE5LjnwHraud3IjAt4xeWAJEZix');
  if (toExecute.collection) {
    collectionAddress = await deployCollection(collOwner, collOwnerSK, toNano('0.05'));
    await waitForDeployment(collectionAddress);
  }
  console.log('new Collection address: ', collectionAddress);

  const jettonMasterOld = client.open(await JettonMinter.fromAddress(oldJettonMasterAddress));
  const jettonMaster = client.open(await JettonMinter.fromAddress(jettonMasterAddress));
  const nftItemCode = await getNftItemCode(oldCollectionAddress);
  if (!nftItemCode) return null;

  let exchangerAddress = await deployExchanger(
    wallet,
    secretKey,
    toNano('0.12'),
    collectionAddress,
    oldCollectionAddress,
    null,
    0n,
    null,
    0n,
    nftItemCode
  );
  const exchangerJW = await jettonMaster.getGetWalletAddress(exchangerAddress!);
  const exchangerJWold = await jettonMasterOld.getGetWalletAddress(exchangerAddress!);
  if (toExecute.exchanger) {
    exchangerAddress = await deployExchanger(
      wallet,
      secretKey,
      toNano('0.12'),
      collectionAddress,
      oldCollectionAddress,
      exchangerJW,
      0n,
      exchangerJWold,
      0n,
      nftItemCode
    );
    await waitForDeployment(exchangerAddress);
  }
  console.log('Exchanger address: ', exchangerAddress);

  if (toExecute.changeExchanger) {
    await changeCollectionExchanger(collOwner, collOwnerSK, collectionAddress, exchangerAddress);
    await delay(10000);
  }
  let giverAddress = await calcGiverAddress(collectionAddress, 367n, nftItemCode);
  const giverJettonWalletAddress = await jettonMaster.getGetWalletAddress(giverAddress);

  await text({
    message: `Please send tokens to the giver address and press enter: ${giverAddress.toString()}`,
  });
  const itemIndex = 367n;

  const jettonWallet = client.open(JettonWallet.fromAddress(giverJettonWalletAddress));
  const acc = await client.getContractState(giverJettonWalletAddress);
  const jwBalance = acc.state === 'uninitialized' ? 0n : (await jettonWallet.getGetWalletData()).balance;
  if (toExecute.giver) {
    giverAddress = await deployGiver(
      wallet,
      secretKey,
      toNano('1.5'),
      collectionAddress,
      giverJettonWalletAddress,
      jwBalance,
      itemIndex,
      nftItemCode
    );
    await waitForDeployment(giverAddress);
    await delay(10000);
  }

  const coll = client.open(OMCollection.fromAddress(collectionAddress));
  console.log('exchanger in collection set to: ', await coll.getGetExchanger());

  if (toExecute.changeOwner) {
    await text({ message: 'Press enter to change collection owner' });
    await changeCollectionOwner(collOwner, collOwnerSK, collectionAddress, giverAddress);
    await delay(10000);
  }

  const giver = client.open(OMGiver.fromAddress(giverAddress));
  console.log(await giver.getGetGiverData());

  console.log(`
NEXT_PUBLIC_EXCHANGER_ADDRESS=${exchangerAddress}
NEXT_PUBLIC_OMGIVER_ADDRESS=${giverAddress}
NEXT_PUBLIC_NFT_COLLECTION_ADDRESS=${collectionAddress}
`);
})();
