import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
  printTransactionFees,
  prettyLogTransactions,
} from '@ton/sandbox';

import '@ton/test-utils';
import { OMGiver } from './output/orbis_OMGiver';
import { NftCollectionTemplate } from './output/orbis_NftCollectionTemplate';
import { NftItemTemplate } from './output/orbis_NftItemTemplate';
import { JettonMinter } from './JettonMinter';
import { JettonWallet } from './JettonWallet';
import { Address, beginCell, internal, Sender, SendMode, toNano } from '@ton/core';
import { tep64TokenData, itemPrefix } from './constants';
import { OMCollection, storeMintNFT } from './output/orb_OMCollection';
import { OM } from './output/orb_OM';
import { Exchanger } from './output/orb_Exchanger';

describe('contract', () => {
  let blockchain: Blockchain;
  let treasury: SandboxContract<TreasuryContract>;
  let jettonMaster1: SandboxContract<JettonMinter>, jettonMaster2: SandboxContract<JettonMinter>;
  let treasuryJW1: SandboxContract<JettonWallet>, treasuryJW2: SandboxContract<JettonWallet>;
  let giverJW: SandboxContract<JettonWallet>;
  let exchangerJW1: SandboxContract<JettonWallet>, exchangerJW2: SandboxContract<JettonWallet>;
  let collection1: SandboxContract<NftCollectionTemplate>, collection2: SandboxContract<OMCollection>;
  let giver: SandboxContract<OMGiver>;
  let exchanger: SandboxContract<Exchanger>;

  async function createJetton(i: bigint, mintAmount: bigint): Promise<SandboxContract<JettonMinter>> {
    const jettonMaster = blockchain.openContract(
      await JettonMinter.fromInit(0n, treasury.address, beginCell().storeUint(i, 64).endCell(), true)
    );
    await jettonMaster.send(
      treasury.getSender(),
      { value: toNano('1'), bounce: true },
      {
        $$type: 'Mint',
        queryId: 0n,
        receiver: treasury.address,
        tonAmount: 0n,
        mintMessage: {
          $$type: 'JettonTransferInternal',
          queryId: 0n,
          sender: jettonMaster.address,
          amount: mintAmount,
          responseDestination: treasury.address,
          forwardTonAmount: 0n,
          forwardPayload: beginCell().asSlice(),
        },
      }
    );
    return jettonMaster;
  }

  async function jw1(owner: Address) {
    return blockchain.openContract(await JettonWallet.fromInit(0n, owner, jettonMaster1.address));
  }

  async function jw2(owner: Address) {
    return blockchain.openContract(await JettonWallet.fromInit(0n, owner, jettonMaster2.address));
  }

  async function createOldCollection(itemsOld: number) {
    const collection = blockchain.openContract(
      await NftCollectionTemplate.fromInit(treasury.address, tep64TokenData, itemPrefix, null)
    );
    const txDeploy = await collection.send(
      treasury.getSender(),
      { value: toNano('1') },
      {
        $$type: 'ChangeCollectionOwner',
        queryId: 0n,
        newOwner: treasury.address,
      }
    );
    const msgBody = beginCell()
      .store(
        storeMintNFT({
          $$type: 'MintNFT',
          queryId: 0n,
          receiver: treasury.address,
          responseDestination: treasury.address,
          forwardAmount: 1n,
          forwardPayload: beginCell().endCell(),
        })
      )
      .endCell();

    const chunkSize = 255;
    const chunks = Math.ceil(itemsOld / chunkSize);
    for (let i = 0; i < chunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, itemsOld);
      const messages = Array.from({ length: end - start }, () =>
        internal({ to: collection.address, value: toNano('0.2'), body: msgBody })
      );
      const tx = await treasury.sendMessages(messages, SendMode.IGNORE_ERRORS);
      // console.log('tx', tx.events);
      // console.log('--------------------------------')
    }
    return collection;
  }

  async function createNewCollection() {
    return blockchain.openContract(
      await OMCollection.fromInit(treasury.address, tep64TokenData, itemPrefix, {
        $$type: 'RoyaltyParams',
        numerator: 0n,
        denominator: 100n,
        destination: treasury.address,
      })
    );
  }

  async function createGiver(initialItems: number) {
    const g = blockchain.openContract(await OMGiver.fromInit(1n, collection2.address, BigInt(initialItems)));
    const gJW = await jettonMaster2.getGetWalletAddress(g.address);
    // console.log(treasury.address, treasuryJW2.address, gJW)
    // console.log((await treasuryJW2.getGetWalletData()).owner)
    const balance = 10000000n;
    // const jwTx = await treasuryJW2.send(
    //   treasury.getSender(),
    //   { value: toNano('1') },
    //   {
    //     $$type: 'JettonTransfer',
    //     queryId: 0n,
    //     amount: balance,
    //     destination: g.address,
    //     responseDestination: null,
    //     customPayload: null,
    //     forwardTonAmount: 0n,
    //     forwardPayload: beginCell().asSlice(),
    //   }
    // );
    // console.log('jw tx', jwTx.events);
    // giverJW = blockchain.openContract(await JettonWallet.fromInit(0n, g.address, jettonMaster2.address));
    const deploytx = await g.send(
      treasury.getSender(),
      { value: toNano('1') },
      {
        $$type: 'InitJettonWallet',
        address: gJW,
        balance: balance,
      }
    );
    return g;
  }

  async function createExchanger(initialItems: number) {
    const item1 = await blockchain.openContract(await NftItemTemplate.fromInit(collection1.address, 0n));
    const e = blockchain.openContract(
      await Exchanger.fromInit(0n, collection2.address, collection1.address, BigInt(initialItems), item1.init!.code)
    );
    exchangerJW1 = blockchain.openContract(await JettonWallet.fromInit(0n, e.address, jettonMaster1.address));
    exchangerJW2 = blockchain.openContract(await JettonWallet.fromInit(0n, e.address, jettonMaster2.address));
    console.log('exchangerJW1', exchangerJW1.address);
    console.log('exchangerJW2', exchangerJW2.address);
    await e.send(
      treasury.getSender(),
      { value: toNano('1'), bounce: true },
      {
        $$type: 'InitExchangerJettonWallets',
        address: exchangerJW2.address,
        balance: 10000000n,
        addressOld: exchangerJW1.address,
        balanceOld: 0n,
      }
    );

    await collection2.send(
      treasury.getSender(),
      { value: toNano('1') },
      {
        $$type: 'UpdateExchanger',
        exchanger: e.address,
      }
    );

    const jw2balance = (await treasuryJW2.getGetWalletData()).balance;

    const tx = await treasuryJW2.send(
      treasury.getSender(),
      { value: toNano('0.1') },
      {
        $$type: 'JettonTransfer',
        queryId: 0n,
        amount: toNano('42000000'),
        destination: e.address,
        responseDestination: treasury.address,
        customPayload: null,
        forwardTonAmount: 0n,
        forwardPayload: null,
      }
    );

    return e;
  }

  beforeAll(async () => {
    const initialItems = 5;
    blockchain = await Blockchain.create();
    treasury = await blockchain.treasury('treasury');
    jettonMaster1 = await createJetton(0n, 42000000000000000n);
    jettonMaster2 = await createJetton(1n, 42000000000000000n);
    treasuryJW1 = await jw1(treasury.address);
    treasuryJW2 = await jw2(treasury.address);
    collection1 = await createOldCollection(initialItems);
    collection2 = await createNewCollection();
    giver = await createGiver(initialItems);
    exchanger = await createExchanger(initialItems);

    console.log(`
      treasury: ${treasury.address}
      collection1: ${collection1.address}
      collection2: ${collection2.address}
      exchanger: ${exchanger.address}
      giver: ${giver.address}
    `);

    
  });

  it('calculates distribution', async () => {
    const tx = await giver.send(
      treasury.getSender(),
      { value: toNano('2') },
      {
        $$type: 'CalculateDistribution',
        currentBalance: null,
      }
    );

    const giverData = await giver.getGetGiverData();
  });

  it('exchanges old nft for new nft', async () => {
    const initialExchangerBalance = (await blockchain.getContract(exchanger.address)).balance;
    const nftIndex = 2n;
    const nft = await blockchain.openContract(await NftItemTemplate.fromInit(collection1.address, nftIndex));
    const om = await OM.fromInit(collection2.address, nftIndex);
    const nft2 = await blockchain.openContract(om);
    const { ownerAddress, index } = await nft.getGetNftData();
    console.log(`
nft old: ${nft.address}
nft new: ${nft2.address}
owner before: ${ownerAddress}`);

    expect(ownerAddress.toRawString()).toBe(treasury.address.toRawString());
    const tx = await nft.send(
      treasury.getSender(),
      { value: toNano('1') },
      {
        $$type: 'NFTTransfer',
        queryId: 0n,
        newOwner: exchanger.address,
        responseDestination: treasury.address,
        forwardAmount: toNano('0.1'),
        forwardPayload: beginCell().storeUint(index, 256).endCell(),
        customPayload: null,
      }
    );
    // console.log("tx", tx.events)

    const { ownerAddress: ownerAfter } = await nft.getGetNftData();
    const { ownerAddress: ownerAfter2 } = await nft2.getGetNftData();

    expect(ownerAfter.toRawString()).toBe(exchanger.address.toRawString());
    expect(ownerAfter2.toRawString()).toBe(treasury.address.toRawString());
    expect((await blockchain.getContract(exchanger.address)).balance).toBe(initialExchangerBalance);
  });

  it('exchanges old tokens for new tokens', async () => {
    const initialExchangerBalance = (await blockchain.getContract(exchanger.address)).balance;
    const toSend = 42n;
    const balance1before = (await treasuryJW1.getGetWalletData()).balance;
    console.log('jw2 exchanger', (await exchanger.getGetExchangerData()).myJettonWallet);
    const tx = await treasuryJW1.send(
      treasury.getSender(),
      { value: toNano('1') },
      {
        $$type: 'JettonTransfer',
        queryId: 0n,
        amount: toSend,
        destination: exchanger.address,
        responseDestination: treasury.address,
        customPayload: null,
        forwardTonAmount: toNano('0.2'),
        forwardPayload: null,
      }
    );
    console.log("tx", tx.events)
    // for (const t of tx.transactions) {
    //   console.log(t.description)
    // }
    const balance1after = (await treasuryJW1.getGetWalletData()).balance;
    const balance2 = (await treasuryJW2.getGetWalletData()).balance;
    expect(balance2).toBe(toSend);
    expect(balance1after).toBe(balance1before - toSend);
    expect((await blockchain.getContract(exchanger.address)).balance).toBe(initialExchangerBalance);
  });
});
