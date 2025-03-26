import {
  Address,
  contractAddress,
  toNano,
  TonClient,
  internal,
  fromNano,
  WalletContractV5R1,
  SendMode,
  Cell,
  Contract,
} from "@ton/ton";
import { OMGiver } from "./output/sample_OMGiver";
import { JettonMinter } from "../../jetton/src/output/Jetton_JettonMinter";
import { NftCollectionTemplate } from "./output/sample_NftCollectionTemplate";
import { createClient, keyPairFromEnv, openWalletV5, randomInt, waitForDeployment } from "./common";

(async () => {
  const client = createClient();
  const wallet = await openWalletV5(client);
  const secretKey = (await keyPairFromEnv()).secretKey;
  console.log("Wallet address: ", wallet.address);

  const jettonMasterAddress = Address.parse("EQDGy90w8A2F6DN5_Xefy0FSBobMes_kh5MYuLq06O0VMQM6");
  const nftCollectionAddress = Address.parse("EQBtsnOa_ECJY09GAg0VUdDguB5bmHdor7l4BkJ0augq56sw");
  // Prepare the initial code and data for the contract
  let init = await OMGiver.init(BigInt(1), jettonMasterAddress, nftCollectionAddress);
  let deployContract = contractAddress(0, init);
  let deployAmount = toNano("1.5");

  let seqno: number = await wallet.getSeqno();
  let balance: bigint = await wallet.getBalance();
  console.log("Current deployment wallet balance: ", fromNano(balance).toString(), "💎TON");
  console.log("Deploying contract to address: ", deployContract);
  await wallet.sendTransfer({
    seqno,
    secretKey,
    messages: [
      internal({
        to: deployContract,
        value: deployAmount,
        init: { code: init.code, data: init.data },
        bounce: true,
      }),
    ],
    sendMode: SendMode.PAY_GAS_SEPARATELY,
  });
  await waitForDeployment(client, deployContract);

  console.log(`Changing collection ${nftCollectionAddress} minter to ${deployContract}`);
  const collection = client.open(NftCollectionTemplate.fromAddress(nftCollectionAddress));
  await collection.send(
    wallet.sender(secretKey),
    {
      value: toNano("0.1"),
      bounce: true,
    },
    { $$type: "SetMinter", newMinter: deployContract }
  );

  const giver = client.open(OMGiver.fromAddress(deployContract));
  console.log(await giver.getGetGiverData());
})();
