//Huge thanks to Howard Peng for the original code of deploy script. https://github.com/howardpen9/jetton-implementation-in-tact

import {
  beginCell,
  toNano,
  fromNano,
  Address,
} from "@ton/ton";
import { JettonWallet } from "./JettonWallet";
import { createClient, keyPairFromEnv, openWalletV5 } from "./common";

const randomInt = (): number => {
  return Math.floor(Math.random() * 10000);
};

(async () => {
  const client = createClient();
  const wallet = await openWalletV5(client);
  const secretKey = (await keyPairFromEnv()).secretKey;
  console.log("Wallet address: ", wallet.address);


  const jettonSenderWallet = Address.parse("EQD5PIWFgyAxQSWx3vVX_7gcLc9HBwBBEm7A4_fziUAL-28w");
  const giverAddress = Address.parse("EQCYzK5lj4tlM09fdyDxqY7NvX1EBEg6UkPxK2tluEvF4kVb");
  // send a message on new address contract to deploy it
  const seqno: number = await wallet.getSeqno();
  console.log("🛠️Preparing new outgoing massage from deployment wallet. \n" + wallet.address);
  console.log("Seqno: ", seqno + "\n");

  // Get deployment wallet balance
  const balance: bigint = await wallet.getBalance();

  console.log("Current deployment wallet balance = ", fromNano(balance).toString(), "💎TON");

  const jetton = client.open(JettonWallet.fromAddress(jettonSenderWallet));
  jetton.send(
    wallet.sender(secretKey),
    {
      value: toNano("0.2"),
      bounce: true,
    },
    {
      $$type: "JettonTransfer",
      queryId: BigInt(randomInt()),
      amount: BigInt(10000),
      destination: giverAddress,
      responseDestination: wallet.address,
      customPayload: null,
      forwardPayload: beginCell().storeUint(0, 1).asSlice(),
      forwardTonAmount: toNano("0.1"),
    }
  );
})();
