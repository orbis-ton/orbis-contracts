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
} from '@ton/ton';
import { NftCollectionTemplate } from './output/orbis_NftCollectionTemplate';
import { createClient, delay, keyPairFromEnv, openWalletV5, waitForDeployment } from './common';
import { tep64TokenData, itemPrefix } from './constants';

async function deployCollection(wallet: OpenedContract<WalletContractV5R1>, secretKey: Buffer, deployAmount: bigint) {
  let init = await NftCollectionTemplate.init(wallet.address, tep64TokenData, itemPrefix, {
    $$type: 'RoyaltyParams',
    numerator: 0n,
    denominator: 11n,
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
        value: toNano('0.2'),
        body: new Cell().asBuilder().storeUint(3, 32).storeUint(0, 64).storeAddress(ownerAddress).asCell(),
      }),
    ],
    sendMode: SendMode.PAY_GAS_SEPARATELY,
  });
}

(async () => {
  const client = createClient();
  const wallet = await openWalletV5(client, 'collection');
  const secretKey = (await keyPairFromEnv('collection')).secretKey;
  console.log('Wallet address: ', wallet.address);

  let deployAmount = toNano('0.2');

  let balance: bigint = await wallet.getBalance();
  console.log('Current deployment wallet balance: ', fromNano(balance).toString(), '💎TON');
  const deployedAddress = await deployCollection(wallet, secretKey, deployAmount);
  await waitForDeployment(client, deployedAddress);
  await delay(10000);
})();
