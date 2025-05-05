import { delay } from './common';

import { Address, fromNano } from '@ton/core';

import { toNano } from '@ton/core';
import { createClient, keyPairFromEnv, openWalletV5 } from './common';
import { NftCollectionTemplate } from './output/orbis_NftCollectionTemplate';
import { NftItemTemplate } from './output/orbis_NftItemTemplate';

(async () => {
  const client = createClient();
  const wallet = await openWalletV5(client, 'admin');
  const secretKey = (await keyPairFromEnv('admin')).secretKey;
  console.log('Wallet address: ', wallet.address);

  let deployAmount = toNano('0.1');

  let balance: bigint = await wallet.getBalance();
  console.log('Current deployment wallet balance: ', fromNano(balance).toString(), '💎TON');
  const collectionAddress = Address.parse('EQDbSrTqn4Kev-F-1VCYkWoDT6pT073C-ZIDpszn7UH8hob4');
  const collection = client.open(NftCollectionTemplate.fromAddress(collectionAddress));
  const collData = await collection.getGetCollectionData();
  console.log('Collection data: ', collData);
  const nftAddress = await collection.getGetNftAddressByIndex(0n);
  console.log('NFT address: ', nftAddress);
  const nft = client.open(NftItemTemplate.fromAddress(nftAddress));
  const data = await nft.getGetNftData();
  console.log('NFT data: ', data);
})();
