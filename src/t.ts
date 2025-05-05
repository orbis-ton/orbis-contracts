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
  const giverAddress = Address.parse("EQASWEiKY4tmhT-nmUpkBMLhcxksmEbBW8bBYdFzYv76OUpd")
  console.log("Giver address: ", giverAddress);
  const giver = client.open(OMGiver.fromAddress(giverAddress));
  console.log(await giver.getGetGiverData());
})();
