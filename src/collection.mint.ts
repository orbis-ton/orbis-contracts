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
import { NftCollectionTemplate, storeMintNFT } from './output/orbis_NftCollectionTemplate';
import { createClient, delay, keyPairFromEnv, openWalletV5, waitForDeployment } from './common';


async function batchMint(wallet: OpenedContract<WalletContractV5R1>, secretKey: Buffer, collectionAddress: Address, amount: number) {
  const msgBody = beginCell().store(storeMintNFT({
    $$type: 'MintNFT',
    queryId: 0n,
    receiver: wallet.address,
    responseDestination: wallet.address,
    forwardAmount: 1n,
    forwardPayload: beginCell().endCell(),
  })).endCell();
  
  const batchSize = 255;
  const chunks = Math.ceil(amount / batchSize);
  for (let i = 0; i < chunks; i++) {
    const start = i * batchSize;
    const end = Math.min(start + batchSize, amount);
    const messages = Array.from({length: end - start}, () => internal({to: collectionAddress, value: toNano('0.1'), body: msgBody}));
    const seqno: number = await wallet.getSeqno();
    await wallet.sendTransfer({secretKey, seqno, sendMode: SendMode.IGNORE_ERRORS, messages});
    await delay(1000);
  }
}


(async () => {
  const client = createClient();
  const wallet = await openWalletV5(client, 'collection');
  const secretKey = (await keyPairFromEnv('collection')).secretKey;
  console.log('Wallet address: ', wallet.address);

  const collectionAddress = Address.parse('EQCTyTzHbndt6ZYpZAyf6rZav2sG4KRuU6iw-F95nAnOzJEB');
  let balance: bigint = await wallet.getBalance();
  console.log('Current deployment wallet balance: ', fromNano(balance).toString(), '💎TON');

  const countNfts = 105n;
  if (balance < toNano('0.1')  * countNfts) {
    console.log('Not enough balance to mint, expected', fromNano(toNano('0.1') * countNfts).toString(), '💎TON, but have', fromNano(balance).toString(), '💎TON');
    return
  }
  await batchMint(wallet, secretKey, collectionAddress, Number(countNfts));
})();
