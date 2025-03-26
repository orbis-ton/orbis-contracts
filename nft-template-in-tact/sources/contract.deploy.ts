import { contractAddress, toNano, internal, fromNano, SendMode } from "@ton/ton";

import { NftCollectionTemplate } from "./output/sample_NftCollectionTemplate";
import { createClient, delay, keyPairFromEnv, openWalletV5, waitForDeployment } from "./common";

(async () => {
  const client = createClient();
  const wallet = await openWalletV5(client);
  const owner = wallet.address;
  console.log("Collection owner wallet address: ", wallet.address);

  // Prepare the initial code and data for the contract
  const init = await NftCollectionTemplate.init(
    owner,
    {
      $$type: "Tep64TokenData",
      flag: BigInt("1"),
      content: "https://s3.laisky.com/uploads/2024/09/nft-sample-collection.json",
    },
    "3",
    null
  );

  let deployContract = contractAddress(0, init);
  let deployAmount = toNano("0.1");

  let seqno: number = await wallet.getSeqno();
  let balance: bigint = await wallet.getBalance();

  console.log("Current deployment wallet balance: ", fromNano(balance).toString(), "💎TON");
  console.log("Deploying contract to address: ", deployContract);

  await wallet.sendTransfer({
    seqno,
    secretKey: (await keyPairFromEnv()).secretKey,
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
  await delay(30000); // wait for indexing

  let collection = client.open(NftCollectionTemplate.fromAddress(deployContract));
  let nextItemIndex = (await collection.getGetCollectionData()).nextItemIndex;
  console.log("Next indexID:[", nextItemIndex, "]");
})();
