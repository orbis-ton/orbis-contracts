//Huge thanks to Howard Peng for the original code of deploy script. https://github.com/howardpen9/jetton-implementation-in-tact

import {
  beginCell,
  contractAddress,
  toNano,
  TonClient,
  WalletContractV5R1,
  internal,
  fromNano,
  SendMode,
  Address,
} from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { buildOnchainMetadata, createClient, keyPairFromEnv, openWalletV5 } from "./common";

import { JettonMinter, storeMint } from "./output/sample_JettonMinter";

import * as dotenv from "dotenv";
dotenv.config();

/*
    (Remember to install dependencies by running "yarn install" in the terminal)
    Here are the instructions to deploy the contract:
    1. Create new walletV4r2 or use existing one.
    2. Enter your mnemonics in .env file.
    3. On line 33 select the network you want to deploy the contract.
    (// - comments out the line, so you can switch between networks)
    (testnet is chosen by default, if you are not familiar with it, read https://tonkeeper.helpscoutdocs.com/article/100-how-switch-to-the-testnet)

    4. On lines 48-52 specify the parameters of the Jetton. (Ticker, description, image, etc.)
    5. On line 65 specify the total supply of the Jetton. It will be automatically converted to nano - jettons.
    Note: All supply will be automatically minted to your wallet.

    5. Run "yarn build" to compile the contract.
    6. Run this script by "yarn deploy"
 */
(async () => {
  const client = createClient()
  const wallet = await openWalletV5(client);
  const secretKey = (await keyPairFromEnv()).secretKey;
  console.log("Wallet address: ", wallet.address);


  const jettonParams = {
    name: "QQQ1",
    description: "qwadratic-test",
    symbol: "QQQ",
    image: "https://raw.githubusercontent.com/tact-lang/tact/refs/heads/main/docs/public/logomark-light.svg",
  };

  // Create content Cell
  const content = buildOnchainMetadata(jettonParams);

  // Compute init data for deployment
  // NOTICE: the parameters inside the init functions were the input for the contract address
  // which means any changes will change the smart contract address as well
  const init = await JettonMinter.init(0n, wallet.address, content, true);
  const jettonMaster = contractAddress(0, init);
  const deployAmount = toNano("0.15");

  const supply = toNano(42000000); // 🔴 Specify total supply in nano
  const packed_msg = beginCell()
    .store(
      storeMint({
        $$type: "Mint",
        queryId: 0n,
        mintMessage: {
          $$type: "JettonTransferInternal",
          amount: supply,
          sender: wallet.address,
          responseDestination: wallet.address,
          queryId: 0n,
          forwardTonAmount: 0n,
          forwardPayload: beginCell().storeUint(0, 1).asSlice(),
        },
        receiver: wallet.address,
        tonAmount: supply,
      })
    )
    .endCell();

  // send a message on new address contract to deploy it
  const seqno: number = await wallet.getSeqno();
  console.log("🛠️Preparing new outgoing massage from deployment wallet. \n" + wallet.address);
  console.log("Seqno: ", seqno + "\n");

  // Get deployment wallet balance
  const balance: bigint = await wallet.getBalance();

  console.log("Current deployment wallet balance = ", fromNano(balance).toString(), "💎TON");
  console.log("Minting:: ", fromNano(supply));

  await wallet.sendTransfer({
    seqno,
    secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY,
    messages: [
      internal({
        to: jettonMaster,
        value: deployAmount,
        init: {
          code: init.code,
          data: init.data,
        },
        body: packed_msg,
      }),
    ],
  });
  console.log("====== Deployment message sent to =======\n", jettonMaster);

})();
