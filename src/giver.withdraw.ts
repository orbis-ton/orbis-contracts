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
  const giverAddress = Address.parse("EQCGBNeuMuS69Nui_ZbpTyz0Ox4_o-oVAZGnEuG8uANNd5h9")
  console.log("Giver address: ", giverAddress);
  const giver = client.open(OMGiver.fromAddress(giverAddress));
  await giver.send(wallet.sender(secretKey), {
    value: toNano("0.1"),
    bounce: true,
  }, {
      queryId: 0n,
      tokenAmount: 0n,
      $$type: "Withdraw",
    });

  console.log("Withdraw sent");
})();
