import {
  Address,
  beginCell,
  contractAddress,
  toNano,
  TonClient,
  internal,
  fromNano,
  WalletContractV5R1,
  SendMode,
  Sender,
  comment,
} from "@ton/ton";
import { deploy } from "./utils/deploy";
import { printAddress, printDeploy, printHeader, printSeparator } from "./utils/print";
import { mnemonicToPrivateKey } from "@ton/crypto";
import * as dotenv from "dotenv";
import { NftCollectionTemplate } from "./output/sample_NftCollectionTemplate";
import { NftItemTemplate } from "./output/sample_NftItemTemplate";
dotenv.config();

const randomInt = (): number => {
  return Math.floor(Math.random() * 10000);
};

(async () => {
  const client4 = new TonClient({
    // endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC", // Test-net
    // apiKey: "526291d4aec60bca91cc93aa178c528eef6a55e734b465a99be7afd5da1f929c"
    endpoint: "https://toncenter.com/api/v2/jsonRPC",
    apiKey: "27a6ce42f70bf2d3bd5827f382c3061f8a826a213f4271fad3f14357153e4754",
  });
  let mnemonics = (process.env.mnemonics_2 || "").toString(); // 🔴 Change to your own, by creating .env file!
  let keyPair = await mnemonicToPrivateKey(mnemonics.split(" "));
  let secretKey = keyPair.secretKey;
  let workchain = 0;
  let wallet = WalletContractV5R1.create({ workchain, publicKey: keyPair.publicKey });
  let wallet_contract = client4.open(wallet);
  console.log("Wallet address: ", wallet_contract.address);

  const mintAmount = toNano("1");

  let seqno: number = await wallet_contract.getSeqno();
  let balance: bigint = await wallet_contract.getBalance();
  // ========================================
  console.log("Current deployment wallet balance: ", fromNano(balance).toString(), "💎TON");
  printSeparator();

  const nftAddress = Address.parse("EQBwPjzY1xzPhK1fiqbyC1X5ympy8JQafyX2G_lpjK6IMs79");
  const nftContract = client4.open(NftCollectionTemplate.fromAddress(nftAddress));
  await nftContract.send(wallet_contract.sender(secretKey), {
      value: mintAmount,
      bounce: true
  }, {
      $$type: "MintNFT",
      queryId: BigInt(randomInt()),
      receiver: wallet_contract.address,
      responseDestination: wallet_contract.address,
      forwardAmount: toNano("0.1"),
      forwardPayload: comment("forward payload"),
  })

  for (let i=0; i<5; i++) {
      const seqnoNew = await wallet_contract.getSeqno();
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (seqnoNew > seqno) {
          console.log("Mint message sent")
          break
      }
  }
  await new Promise(resolve => setTimeout(resolve, 10000));

  let collection_client = client4.open(NftCollectionTemplate.fromAddress(nftAddress));

  let latest_indexId = (await collection_client.getGetCollectionData()).nextItemIndex;
  console.log("Next indexID:[", latest_indexId, "]");
  const itemAddress = await collection_client.getGetNftAddressByIndex(latest_indexId - BigInt(1));
  console.log("Minted NFT Item: ", itemAddress);

  const itemContract = client4.open(NftItemTemplate.fromAddress(itemAddress));
  console.log("Item Owner: ", await itemContract.getGetNftData());
})();
