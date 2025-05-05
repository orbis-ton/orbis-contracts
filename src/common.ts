import { Sha256 } from '@aws-crypto/sha256-js';
import { KeyPair, mnemonicToPrivateKey } from '@ton/crypto';
import {
  Address,
  beginCell,
  Cell,
  contractAddress,
  Dictionary,
  internal,
  OpenedContract,
  SendMode,
  TonClient,
  WalletContractV5R1,
} from '@ton/ton';
import * as dotenv from 'dotenv';

dotenv.config();
const TESTNET = process.env.TESTNET === 'true';
console.log(`Testnet mode: ${TESTNET}`);

const ONCHAIN_CONTENT_PREFIX = 0x00;
const SNAKE_PREFIX = 0x00;
const CELL_MAX_SIZE_BYTES = Math.floor((1023 - 8) / 8);

export const client = createClient();

export async function delay(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

export function randomInt(): bigint {
  return BigInt(Math.floor(Math.random() * 10000));
}

export function createClient() {
  const endpoint = `https://${TESTNET ? 'testnet.' : ''}toncenter.com/api/v2/jsonRPC`;
  const apiKey = TESTNET ? process.env.TESTNET_TONCENTER_APIKEY : process.env.MAINNET_TONCENTER_APIKEY;
  return new TonClient({ endpoint, apiKey });
}

export async function keyPairFromEnv(type: 'giver' | 'collection' | 'distribution' | 'admin'): Promise<KeyPair> {
  const mnemonic = TESTNET
    ? type === 'giver'
      ? process.env.MNEMONIC_TESTNET_GIVER!
      : type === 'collection'
      ? process.env.MNEMONIC_TESTNET_COLLECTION!
      : process.env.MNEMONIC_TESTNET_DISTRIBUTION!
    : type === 'giver'
    ? process.env.MNEMONIC_MAINNET_GIVER!
    : type === 'collection'
    ? process.env.MNEMONIC_MAINNET_COLLECTION!
    : type === 'distribution'
    ? process.env.MNEMONIC_MAINNET_DISTRIBUTION!
    : process.env.MNEMONIC_MAINNET_ADMIN!;
  return await mnemonicToPrivateKey(mnemonic.split(' '));
}

export async function openWalletV5(
  type: 'giver' | 'collection' | 'distribution' | 'admin'
): Promise<OpenedContract<WalletContractV5R1>> {
  const kp = await keyPairFromEnv(type);
  return client.open(WalletContractV5R1.create({ workchain: 0, publicKey: kp.publicKey }));
}

export async function waitForDeployment(address: Address) {
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
  const chunks = bufferToChunks(data, CELL_MAX_SIZE_BYTES);

  const b = chunks.reduceRight((curCell, chunk, index) => {
    if (index === 0) {
      curCell.storeInt(SNAKE_PREFIX, 8);
    }
    curCell.storeBuffer(chunk);
    if (index > 0) {
      const cell = curCell.endCell();
      return beginCell().storeRef(cell);
    } else {
      return curCell;
    }
  }, beginCell());
  return b.endCell();
}

export function buildOnchainMetadata(data: { name: string; description: string; image: string }): Cell {
  const dict = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());

  // Store the on-chain metadata in the dictionary
  Object.entries(data).forEach(([key, value]) => {
    dict.set(toKey(key), makeSnakeCell(Buffer.from(value, 'utf8')));
  });

  return beginCell().storeInt(ONCHAIN_CONTENT_PREFIX, 8).storeDict(dict).endCell();
}

function bufferToChunks(buff: Buffer, chunkSize: number) {
  const chunks: Buffer[] = [];
  while (buff.byteLength > 0) {
    chunks.push(buff.slice(0, chunkSize));
    buff = buff.slice(chunkSize);
  }
  return chunks;
}

const sha256 = (str: string) => {
  const sha = new Sha256();
  sha.update(str);
  return Buffer.from(sha.digestSync());
};

const toKey = (key: string) => {
  return BigInt(`0x${sha256(key).toString('hex')}`);
};

export async function deployContract(
  wallet: OpenedContract<WalletContractV5R1>,
  secretKey: Buffer,
  deployAmount: bigint,
  init: { code: Cell; data: Cell },
  msgToContract: Cell,
  wait: boolean = true
) {
  let address = contractAddress(0, init);
  const seqno = await wallet.getSeqno();
  await wallet.sendTransfer({
    seqno,
    secretKey,
    messages: [
      internal({
        to: address,
        value: deployAmount,
        init: { code: init.code, data: init.data },
        body: msgToContract,
        bounce: true,
      }),
    ],
    sendMode: SendMode.PAY_GAS_SEPARATELY,
  });
  if (wait) {
    await waitForDeployment(address);
  }
}
