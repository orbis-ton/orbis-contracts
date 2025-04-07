import {
  Address,
  toNano,
} from "@ton/ton";
import { OMGiver } from "./output/orbis_OMGiver";
import { createClient, keyPairFromEnv, openWalletV5 } from "./common";

(async () => {
  const client = createClient();
  const wallet = await openWalletV5(client);
  const secretKey = (await keyPairFromEnv()).secretKey;
  console.log("Wallet address: ", wallet.address);

  const giver = client.open(OMGiver.fromAddress(Address.parse("EQC5cexfIIfLrXyg0SS-aNUeSJ2nwaEZfKo73zIocYmknkg5")));
  await giver.send(wallet.sender(secretKey), {
    value: toNano("0.1"),
    bounce: true,
  }, {
      $$type: "Withdraw",
    });

  console.log("Withdraw sent");
})();
