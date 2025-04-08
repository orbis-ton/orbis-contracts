import {
  Address,
  beginCell,
  fromNano,
  internal,
  OpenedContract,
  SendMode,
  toNano,
  TonClient,
  WalletContractV5R1,
} from '@ton/ton';
import { JettonMinter } from './JettonMinter';
import { JettonWallet, storeJettonTransfer } from './JettonWallet';
import { createClient, delay, keyPairFromEnv, openWalletV5 } from './common';
import { OMGiver } from './output/orbis_OMGiver';
import { NftItem, TonApiClient } from '@ton-api/client';

const DISTRIBUTION_FREQ = BigInt(1000 * 60 * 60 * 24 * 7); // 1 week
const GAS_PER_TRANSFER = toNano('0.035');

async function getJettonBalance(client: TonClient, address: Address, jettonMaster: OpenedContract<JettonMinter>) {
  const jettonWalletAddress = await jettonMaster.getGetWalletAddress(address);
  const jettonWallet = client.open(JettonWallet.fromAddress(jettonWalletAddress!));
  const balance = (await jettonWallet.getGetWalletData()).balance;
  return balance;
}

async function sendBatches(
  wallet: OpenedContract<WalletContractV5R1>,
  secretKey: Buffer,
  jettonWalletAddress: Address,
  sendList: Map<Address, bigint>,
  batchSize: number
) {
  const sendListEntries = Array.from(sendList.entries());
  for (let i = 0; i < sendListEntries.length; i += batchSize) {
    const batch = sendListEntries.slice(i, i + batchSize);
    const bodies = batch.map(([address, amount]) =>
      beginCell()
        .store(
          storeJettonTransfer({
            $$type: 'JettonTransfer',
            queryId: 0n,
            amount: amount,
            destination: address,
            responseDestination: address,
            customPayload: null,
            forwardTonAmount: 1n,
            forwardPayload: beginCell().storeUint(0, 1).asSlice(),
          })
        )
        .endCell()
    );
    const seqno: number = await wallet.getSeqno();
    await wallet.sendTransfer({
      seqno,
      secretKey,
      messages: bodies.map(body =>
        internal({
          to: jettonWalletAddress,
          body,
          value: GAS_PER_TRANSFER,
          bounce: true,
        })
      ),
      sendMode: SendMode.IGNORE_ERRORS,
    });
  }
}

async function getNextDistributionTime(giver: OpenedContract<OMGiver>) {
  const lastDistributionTime = (await giver.getGetGiverData()).lastRewardDistribution;
  const timeNow = BigInt(Date.now());
  const ONE_MINUTE = 1000n * 60n;
  const nextDistributionTime =
    lastDistributionTime === 0n ? timeNow - ONE_MINUTE : lastDistributionTime + DISTRIBUTION_FREQ; // 1 week
  return nextDistributionTime;
}

async function saveLastDistributionTime(
  wallet: OpenedContract<WalletContractV5R1>,
  secretKey: Buffer,
  giver: OpenedContract<OMGiver>,
  lastDistributionTime: bigint
) {
  await giver.send(
    wallet.sender(secretKey),
    {
      value: toNano('0.1'),
      bounce: true,
    },
    {
      $$type: 'SetParameters',
      lastRewardDistribution: lastDistributionTime,
      newJettonWalletAddress: null,
      newCollectionAddress: null,
      newPriceInTokens: null,
      newReserveOwnerAddress: null,
    }
  );
}

async function getOMHolderList(collectionAddress: Address): Promise<Record<string, number>> {
  const tonApi = new TonApiClient({
    apiKey: process.env.TONAPI_APIKEY,
  });
  let offset = 0;
  let limit = 1000;
  let allItems: NftItem[] = [];
  while (true) {
    const items = (await tonApi.nft.getItemsFromCollection(collectionAddress, { offset, limit })).nftItems;
    if (items.length === 0) break;
    allItems = allItems.concat(items);
    offset += allItems.length;
    await delay(1000);
  }
  const holders = allItems.reduce((acc: Record<string, number>, item) => {
    const owner = item.owner ? item.owner.address.toRawString() : '0';
    acc[owner] = (acc[owner] || 0) + 1;
    return acc;
  }, {});
  return holders;
}

async function calcDistributionTable(holders: Record<string, number>, balance: bigint): Promise<Map<string, bigint>> {
  const toDistribute = (balance * 314n) / 100000n; // 0.314% of total balance
  const totalNftCount = Object.values(holders).reduce((acc, count) => acc + count, 0);
  const perNft = toDistribute / BigInt(totalNftCount);
  console.log('Distribution Calculation:');
  console.log('Balance =', balance);
  console.log('To distribute (0.314% of balance) =', toDistribute);
  console.log('Total NFT count =', totalNftCount);
  console.log('ORBC per NFT =', perNft);
  const distributionTable: Map<string, bigint> = new Map(
    Object.entries(holders).map(([address, count]) => [address, perNft * BigInt(count)])
  );
  return distributionTable;
}

(async () => {
  const client = createClient();
  const wallet = await openWalletV5(client);
  const secretKey = (await keyPairFromEnv()).secretKey;

  const giverAddress = Address.parse('EQCGBNeuMuS69Nui_ZbpTyz0Ox4_o-oVAZGnEuG8uANNd5h9');
  const jettonMasterAddress = Address.parse('EQB89FTAizozyZ6WYCAF9yxG-0oQYdS87dxSfrC34oCyP5X0');
  const collectionAddress = Address.parse('EQCsw_i-GG-LfuJjNlqnGlaziQV8Z-QcgDD5Amk8vDRZpxen');

  const giver = client.open(OMGiver.fromAddress(giverAddress));
  const jettonMaster = client.open(JettonMinter.fromAddress(jettonMasterAddress));

  const balance = await getJettonBalance(client, wallet.address, jettonMaster);
  const tonBalance = await wallet.getBalance();

  console.log('Distribution wallet address: ', wallet.address);
  console.log('Collection address: ', collectionAddress);
  console.log('Jetton Master address: ', jettonMasterAddress);
  console.log('Giver address: ', giverAddress);
  console.log('Distribution wallet balance: ', balance, 'ORBC', fromNano(tonBalance), 'TON');

  const nextDistributionTime = await getNextDistributionTime(giver);
  console.log('Next distribution time: ', new Date(Number(nextDistributionTime)));
  if (nextDistributionTime > BigInt(Date.now())) {
    console.log('Next distribution time is in the future, skipping');
    return;
  }

  const holders = await getOMHolderList(Address.parse('EQAPpJOA7BJPDJw9d7Oy7roElafFzsIkjaPoKPe9nmNBKaOZ'));
  const table = await calcDistributionTable(holders, balance);
  const minTonAmount = GAS_PER_TRANSFER * BigInt(table.size);

  // if (tonBalance < minTonAmount) {
  //   console.log('Not enough TON balance to distribute, need ', fromNano(minTonAmount), 'TON');
  //   return;
  // }

  const totalNftCount = Object.values(holders).reduce((acc, count) => acc + count, 0);
  if (balance < totalNftCount * 100) {
    console.log('There are less than 100 ORBC per NFT, lets distribute the rest manually');
  }

  // console.log('Holders: ', JSON.stringify(holders, null, 2));
  // console.log(
  //   'Distribution Table: ',
  //   JSON.stringify(Object.fromEntries([...table.entries()].map(([k, v]) => [k, v.toString()])), null, 2)
  // );
})();
