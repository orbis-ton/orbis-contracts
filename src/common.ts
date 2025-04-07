
import {Sha256} from "@aws-crypto/sha256-js"
import { KeyPair, mnemonicToPrivateKey } from "@ton/crypto";
import { Address, beginCell, Cell, Dictionary, OpenedContract, TonClient, WalletContractV5R1 } from "@ton/ton";
import * as dotenv from "dotenv";

dotenv.config();
const TESTNET = process.env.TESTNET === "false";
console.log(`Testnet mode: ${TESTNET}`);

const ONCHAIN_CONTENT_PREFIX = 0x00
const SNAKE_PREFIX = 0x00
const CELL_MAX_SIZE_BYTES = Math.floor((1023 - 8) / 8)

export async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomInt(): bigint {
  return BigInt(Math.floor(Math.random() * 10000));
}

export function createClient() {
  const endpoint = `https://${TESTNET ? "testnet." : ""}toncenter.com/api/v2/jsonRPC`;
  const apiKey = TESTNET ? process.env.TESTNET_TONCENTER_APIKEY : process.env.MAINNET_TONCENTER_APIKEY;
  return new TonClient({ endpoint, apiKey });
}

export async function keyPairFromEnv(): Promise<KeyPair> {
  const mnemonic = TESTNET ? process.env.MNEMONIC_TESTNET! : process.env.MNEMONIC_MAINNET!;
  return await mnemonicToPrivateKey(mnemonic.split(" "));
}

export async function openWalletV5(client: TonClient): Promise<OpenedContract<WalletContractV5R1>> {
  const kp = await keyPairFromEnv();
  return client.open(WalletContractV5R1.create({ workchain: 0, publicKey: kp.publicKey }));
}

export async function waitForDeployment(client: TonClient, address: Address) {
  for (let i = 0; i < 30; i++) {
    const isDeployed = await client.isContractDeployed(address);
    await delay(1000);
    if (isDeployed) {
      console.log(`Contract deployed at ${address}`);
      return;
    }
  }
  throw new Error(`Contract was not deployed at ${address} after 30 seconds`);
}

export function makeSnakeCell(data: Buffer) {
  // Create a cell that package the data
  const chunks = bufferToChunks(data, CELL_MAX_SIZE_BYTES)

  const b = chunks.reduceRight((curCell, chunk, index) => {
      if (index === 0) {
          curCell.storeInt(SNAKE_PREFIX, 8)
      }
      curCell.storeBuffer(chunk)
      if (index > 0) {
          const cell = curCell.endCell()
          return beginCell().storeRef(cell)
      } else {
          return curCell
      }
  }, beginCell())
  return b.endCell()
}

export function buildOnchainMetadata(data: {
  name: string
  description: string
  image: string
}): Cell {
  const dict = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell())

  // Store the on-chain metadata in the dictionary
  Object.entries(data).forEach(([key, value]) => {
      dict.set(toKey(key), makeSnakeCell(Buffer.from(value, "utf8")))
  })

  return beginCell().storeInt(ONCHAIN_CONTENT_PREFIX, 8).storeDict(dict).endCell()
}

function bufferToChunks(buff: Buffer, chunkSize: number) {
  const chunks: Buffer[] = []
  while (buff.byteLength > 0) {
      chunks.push(buff.slice(0, chunkSize))
      buff = buff.slice(chunkSize)
  }
  return chunks
}

const sha256 = (str: string) => {
  const sha = new Sha256()
  sha.update(str)
  return Buffer.from(sha.digestSync())
}

const toKey = (key: string) => {
  return BigInt(`0x${sha256(key).toString("hex")}`)
}
