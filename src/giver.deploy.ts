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
import { OMGiver } from './output/orbis_OMGiver';
import { JettonMinter } from './JettonMinter';
import { createClient, delay, keyPairFromEnv, openWalletV5, waitForDeployment } from './common';

async function calcAddress(nftCollectionAddress: Address, reserveOwnerAddress: Address) {
  let init = await OMGiver.init(BigInt(1), nftCollectionAddress, reserveOwnerAddress);
  return contractAddress(0, init);
}

async function deployContract(
  wallet: OpenedContract<WalletContractV5R1>,
  secretKey: Buffer,
  deployAmount: bigint,
  nftCollectionAddress: Address,
  reserveOwnerAddress: Address
) {
  let init = await OMGiver.init(BigInt(1), nftCollectionAddress, reserveOwnerAddress);
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
  parameters: {
    newJettonWalletAddress: Address | null;
    newCollectionAddress: Address | null;
    newPriceInTokens: bigint | null;
    newReserveOwnerAddress: Address | null;
    lastRewardDistribution: bigint | null;
  }
) {
  const giver = client.open(OMGiver.fromAddress(giverAddress));
  await giver.send(
    wallet.sender(secretKey),
    {
      value: toNano('0.1'),
      bounce: true,
    },
    {
      $$type: 'SetParameters',
      newJettonWalletAddress: parameters.newJettonWalletAddress || null,
      newCollectionAddress: parameters.newCollectionAddress || null,
      newPriceInTokens: parameters.newPriceInTokens || null,
      newReserveOwnerAddress: parameters.newReserveOwnerAddress || null,
      lastRewardDistribution: parameters.lastRewardDistribution || null,
    }
  );
}

(async () => {
  const client = createClient();
  const wallet = await openWalletV5(client);
  const secretKey = (await keyPairFromEnv()).secretKey;
  console.log('Wallet address: ', wallet.address);

  const jettonMasterAddress = Address.parse('EQB89FTAizozyZ6WYCAF9yxG-0oQYdS87dxSfrC34oCyP5X0');
  const nftCollectionAddress = Address.parse('EQCsw_i-GG-LfuJjNlqnGlaziQV8Z-QcgDD5Amk8vDRZpxen');
  const reserveOwnerAddress = Address.parse('UQDWNbrOWiegJoQ7CqYiIwN5Kb1nRtFH_QXKTKAavomFvwYa');
  let deployAmount = toNano('0.2');
  // const deployedAddress = await calcAddress(nftCollectionAddress, reserveOwnerAddress);

  let balance: bigint = await wallet.getBalance();
  console.log('Current deployment wallet balance: ', fromNano(balance).toString(), '💎TON');

  const deployedAddress = await deployContract(
    wallet,
    secretKey,
    deployAmount,
    nftCollectionAddress,
    reserveOwnerAddress
  );
  await waitForDeployment(client, deployedAddress);
  await delay(10000);

  console.log(`Changing collection ${nftCollectionAddress} owner to ${deployedAddress}`);
  await changeCollectionOwner(wallet, secretKey, nftCollectionAddress, deployedAddress);
  await delay(10000);

  const jettonMaster = client.open(JettonMinter.fromAddress(jettonMasterAddress));
  const giverJettonWalletAddress = await jettonMaster.getGetWalletAddress(deployedAddress);
  console.log('Set giver jetton wallet address: ', giverJettonWalletAddress);

  await changeGiverParameters(client, wallet, secretKey, deployedAddress, {
    newJettonWalletAddress: giverJettonWalletAddress,
    newCollectionAddress: null,
    newPriceInTokens: null,
    newReserveOwnerAddress: null,
    lastRewardDistribution: null,
  });
  await delay(15000);

  const giver = client.open(OMGiver.fromAddress(deployedAddress));
  console.log(await giver.getGetGiverData());
})();
