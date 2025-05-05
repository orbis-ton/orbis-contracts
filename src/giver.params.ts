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
import { createClient, delay, keyPairFromEnv, openWalletV5, waitForDeployment } from './common';
import { NftCollectionTemplate } from './output/orbis_NftCollectionTemplate';
import { JettonWallet } from './JettonWallet';
import { text } from '@clack/prompts';

async function calcAddress(nftCollectionAddress: Address, nextItemIndex: bigint) {
  let init = await OMGiver.init(BigInt(1), nftCollectionAddress, nextItemIndex);
  return contractAddress(0, init);
}

async function deployContract(
  wallet: OpenedContract<WalletContractV5R1>,
  secretKey: Buffer,
  deployAmount: bigint,
  nftCollection: OpenedContract<NftCollectionTemplate>,
  giverJettonWalletAddress: Address,
  jwBalance: bigint
) {
  const nextItemIndex = (await nftCollection.getGetCollectionData()).nextItemIndex;
  console.log('Next item index: ', nextItemIndex);
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

async function changeGiverParameters(
  client: TonClient,
  wallet: OpenedContract<WalletContractV5R1>,
  secretKey: Buffer,
  giverAddress: Address,
  parameters: SetParameters
) {
  const giver = client.open(OMGiver.fromAddress(giverAddress));
  await giver.send(
    wallet.sender(secretKey),
    {
      value: toNano('0.1'),
      bounce: true,
    },
    parameters
  );
}

(async () => {
  const client = createClient();
  const wallet = await openWalletV5(client, 'distribution');
  const secretKey = (await keyPairFromEnv('distribution')).secretKey;
  const collOwner = await openWalletV5(client, 'collection');
  const collOwnerSK = (await keyPairFromEnv('collection')).secretKey;
  console.log('Wallet address: ', wallet.address);

  let balance: bigint = await wallet.getBalance();
  console.log('Current deployment wallet balance: ', fromNano(balance).toString(), '💎TON');

  const giverAddress = Address.parse('EQD903ZwzXzOsmVCBw_zlYje0NwKIfvffc9Nlb2ZcynGJc5v');
  const giver = client.open(OMGiver.fromAddress(giverAddress));
  console.log(await giver.getGetGiverData());

  await text({ message: 'doublecheck and press enter' });
  await changeGiverParameters(client, wallet, secretKey, giver.address, {
    newCollectionAddress: null,
    newPriceInTokens: toNano('10000'),
    lastRewardDistribution: null,
    $$type: 'SetParameters',
  });

  await delay(10000);
  console.log(await giver.getGetGiverData());
})();
