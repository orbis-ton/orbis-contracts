import {
  Address,
  contractAddress,
  toNano,
  internal,
  fromNano,
  SendMode,
  Cell,
} from "@ton/ton";
import { OMGiver } from "./output/orbis_OMGiver";
import { JettonMinter } from "./JettonMinter";
import { createClient, delay, keyPairFromEnv, openWalletV5, waitForDeployment } from "./common";

(async () => {
  const client = createClient();
  const wallet = await openWalletV5(client);
  const secretKey = (await keyPairFromEnv()).secretKey;
  console.log("Wallet address: ", wallet.address);

  const jettonMasterAddress = Address.parse("EQB89FTAizozyZ6WYCAF9yxG-0oQYdS87dxSfrC34oCyP5X0");
  const nftCollectionAddress = Address.parse("EQBdoYSmiwYHMDae1_iDEKXGeufCCpeh-vmXQxFsoa5vsKnd");
  const reserveOwnerAddress = Address.parse("UQDWNbrOWiegJoQ7CqYiIwN5Kb1nRtFH_QXKTKAavomFvwYa");
  let deployAmount = toNano("1");

  // Prepare the initial code and data for the contract
  let init = await OMGiver.init(BigInt(1), nftCollectionAddress, reserveOwnerAddress);
  let deployContract = contractAddress(0, init);
  
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

  await delay(10000);
  console.log(`Changing collection ${nftCollectionAddress} owner to ${deployContract}`);
  seqno = await wallet.getSeqno();
  wallet.sendTransfer({
    seqno,
    secretKey,
    messages: [
      internal({
        to: nftCollectionAddress,
        value: toNano("0.1"),
        body: (new Cell()).asBuilder().storeUint(3, 32).storeUint(0, 64).storeAddress(deployContract).asCell(),
      }),
    ],
    sendMode: SendMode.PAY_GAS_SEPARATELY,
  });
  await waitForDeployment(client, deployContract);

  const jettonMaster = client.open(JettonMinter.fromAddress(jettonMasterAddress));
  const giverJettonWalletAddress = await jettonMaster.getGetWalletAddress(deployContract);
  console.log("Set giver jetton wallet address: ", giverJettonWalletAddress);

  const giver = client.open(OMGiver.fromAddress(deployContract));
  await giver.send(wallet.sender(secretKey), {
    value: toNano("0.1"),
    bounce: true,
  }, {
    $$type: "SetParameters",
    newJettonWalletAddress: giverJettonWalletAddress,
    newCollectionAddress: null,
    newPriceInTokens: null,
    newReserveOwnerAddress: null,
    lastRewardDistribution: 0n
  });

  await delay(10000);
  console.log(await giver.getGetGiverData());
})();
