import {
  Address,
  Dictionary,
  toNano,
} from "@ton/ton";
import { OMGiver } from "./output/orbis_OMGiver";
import { createClient, delay, keyPairFromEnv, openWalletV5 } from "./common";

(async () => {
  const client = createClient();
  const wallet = await openWalletV5(client, 'admin');
  const secretKey = (await keyPairFromEnv('admin')).secretKey;
  console.log("Wallet address: ", wallet.address);
  const giverAddress = Address.parse("EQBBn6UJS6-jC68gaxabM52yqa1RzM4SjVkoVxs6V-NTb565")
  console.log("Giver address: ", giverAddress);
  const giver = client.open(OMGiver.fromAddress(giverAddress));

  const table = Dictionary.empty(Dictionary.Keys.BigInt(256), Dictionary.Values.BigInt(256));
  table.set(0n, 1n);
  table.set(1n, 1n);
  table.set(2n, 2n);
  table.set(3n, 3n);
  table.set(4n, 4n);
  table.set(5n, 5n);
  table.set(6n, 6n);
  table.set(7n, 7n);
  table.set(8n, 8n);
  table.set(9n, 9n);
  table.set(10n, 10n);
  table.set(11n, 12n);
  table.set(12n, 13n);
  table.set(13n, 14n);
  table.set(14n, 15n);
  table.set(15n, 16n);
  table.set(16n, 17n);
  table.set(17n, 18n);
  table.set(18n, 18n);

  // await giver.send(wallet.sender(secretKey), {
  //   value: toNano("0.1"),
  //   bounce: true,
  // }, {
  //     $$type: "CalculateDistribution",
  //     table,
  //   });

  // console.log("Calc sent");
  // await delay(15000);

  console.log(await giver.getGetGiverData());
})();
