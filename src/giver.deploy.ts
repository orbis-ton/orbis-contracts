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
import { OMGiver, SetParameters, storeInitDistributionMap, storeInitJettonWallet } from './output/orbis_OMGiver';
import { JettonMinter } from './JettonMinter';
import { client, createClient, delay, keyPairFromEnv, openWalletV5, waitForDeployment } from './common';
import { NftCollectionTemplate } from './output/orbis_NftCollectionTemplate';
import { JettonWallet } from './JettonWallet';
import { text } from '@clack/prompts';

async function calcGiverAddress(nftCollectionAddress: Address, nextItemIndex: bigint) {
  let init = await OMGiver.init(BigInt(1), nftCollectionAddress, nextItemIndex);
  return contractAddress(0, init);
}

async function deployGiver(
  wallet: OpenedContract<WalletContractV5R1>,
  secretKey: Buffer,
  deployAmount: bigint,
  nftCollection: OpenedContract<NftCollectionTemplate>,
  giverJettonWalletAddress: Address,
  jwBalance: bigint,
  nextItemIndex: bigint
) {
  let init = await OMGiver.init(BigInt(1), nftCollection.address, nextItemIndex);
  let address = contractAddress(0, init);

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
            storeInitJettonWallet({ $$type: 'InitJettonWallet', address: giverJettonWalletAddress, balance: jwBalance })
          )
          .endCell(),
        bounce: true,
      }),
    ],
    sendMode: SendMode.PAY_GAS_SEPARATELY,
  });
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


(async () => {
  const wallet = await openWalletV5('distribution');
  const secretKey = (await keyPairFromEnv('distribution')).secretKey;

  const collOwner = await openWalletV5('collection');
  const collOwnerSK = (await keyPairFromEnv('collection')).secretKey;
  console.log('Wallet address: ', wallet.address);

  const jettonMasterAddress = Address.parse('EQBe0QNN5u45TL8h1QHZUOxl69QhoJLMyhQzjCenxxL2ZInd');
  const nftCollectionAddress = Address.parse('EQCTyTzHbndt6ZYpZAyf6rZav2sG4KRuU6iw-F95nAnOzJEB');
  let deployAmount = toNano('2');
  let deployedAddress;

  let balance: bigint = await wallet.getBalance();
  console.log('Current deployment wallet balance: ', fromNano(balance).toString(), '💎TON');

  const nftCollection = client.open(NftCollectionTemplate.fromAddress(nftCollectionAddress));
  const nextItemIndex = (await nftCollection.getGetCollectionData()).nextItemIndex;
  deployedAddress = await calcGiverAddress(nftCollectionAddress, nextItemIndex);

  await text({
    message: `Please send tokens to the giver address and press enter: ${deployedAddress.toString()}`,
  });
  const itemIndex = 367n;

  const jettonMaster = client.open(JettonMinter.fromAddress(jettonMasterAddress));
  const giverJettonWalletAddress = await jettonMaster.getGetWalletAddress(deployedAddress);
  const jettonWallet = client.open(JettonWallet.fromAddress(giverJettonWalletAddress));
  const jwBalance = (await jettonWallet.getGetWalletData()).balance;
  console.log('Giver jetton wallet address and balance: ', giverJettonWalletAddress, jwBalance);

  deployedAddress = await deployGiver(wallet, secretKey, deployAmount, nftCollection, giverJettonWalletAddress, jwBalance, itemIndex);
  await waitForDeployment(deployedAddress);
  await delay(10000);

  await changeCollectionOwner(collOwner, collOwnerSK, nftCollectionAddress, deployedAddress);
  await delay(10000);

  const giver = client.open(OMGiver.fromAddress(deployedAddress));
  console.log(await giver.getGetGiverData());
})();
