import "./NFTCollection";
import "./messages";

struct GiverData {
    owner: Address;
    myJettonWalletAddress: Address?;
    nftCollectionAddress: Address;
    nftPriceInTokens: Int;
    lastRewardDistribution: Int;
    nextItemIndex: Int;
    toDistribute: map<Int as uint16, Int as coins>;
    balance: Int as coins;
    balanceFree: Int as coins;
}

fun calcItemAddress(nftCollectionAddress: Address, nftItemCode: Cell, itemIndex: Int): Address {
    let i = initOf NftItemTemplate(nftCollectionAddress, itemIndex);
    return contractAddress(StateInit {
        code: nftItemCode,
        data: i.data,
    });
}

// sync giver balance - can only increase giver balance
// send message with wallet address and initial balance on deployment
// remove ability to change collection address and next item index
// remove ability to change jettonwallet address
// calc distribution logic:
// state:
//   - lastDistributionDate. 
//     - can only execute calc distribution logic if currentDate is > lastDistributionDate + 7 days. 
//     - updates to +7 days after calc distribution logic is executed
//   - balance
//     - try to keep in sync with jetton wallet balance by incrementing on each jetton transfer notification
//     - balanceDiff parameter - can increment balance with a value out of sync (only if diff >0)
//       (this is a secure solution to sync balance with jetton wallet in case of tokens arriving without notification or with notification but no gas)
//     - balance can only be decreased when nft holder came to get reward.
//   - balanceFree: used to calculate toDistribute. initialized with balanceFree = balance. 
//     - only increment when balanceDiff is applied.
//     - toDistribute = balanceFree * 0.314%
//     - balanceFree = balance - toDistribute
//   - distribution map: map of nft item index to amount of tokens to distribute. initialized with zeroes.
//     - on each calculation, all map items are incremented by toDistribute / totalItems

contract OMGiver {
    owner: Address;
    myJettonWalletAddress: Address?;
    balance: Int as coins = 0;
    balanceFree: Int as coins = 0;

    nftCollectionAddress: Address;
    nftPriceInTokens: Int = ton("10000");
    lastRewardDistribution: Int = 0;

    nextItemIndex: Int = 0;
    toDistribute: map<Int as uint16, Int as coins> = emptyMap();

    nftItemCode: Cell;

    init(id: Int, nftCollectionAddress: Address, nextItemIndex: Int, nftItemCode: Cell) {
        self.owner = sender();
        self.nftCollectionAddress = nftCollectionAddress;
        self.nextItemIndex = nextItemIndex;
        self.nftItemCode = nftItemCode;
    }

    get fun get_giver_data(): GiverData {
        return GiverData {
            owner: self.owner,
            myJettonWalletAddress: self.myJettonWalletAddress,
            nftCollectionAddress: self.nftCollectionAddress,
            nftPriceInTokens: self.nftPriceInTokens,
            lastRewardDistribution: self.lastRewardDistribution,
            nextItemIndex: self.nextItemIndex,
            toDistribute: self.toDistribute,
            balance: self.balance,
            balanceFree: self.balanceFree,
        };
    }

    receive() {}

    receive(msg: InitJettonWallet) {
        require(sender() == self.owner, "Only owner can init jetton wallet");
        require(self.myJettonWalletAddress == null, "Jetton wallet already initialized");
        nativeReserve(ton("0.1"), ReserveExact);
        self.myJettonWalletAddress = msg.address;
        self.balance = msg.balance;
        self.balanceFree = msg.balance;
        send(SendParameters {
            value: 0,
            to: myAddress(),
            bounce: true,
            mode: SendRemainingBalance,
            body: InitDistributionMap {
                nextItemIndex: 0,
                chunkSize: 100,
            }.toCell(),
        });
    }

    receive(msg: InitDistributionMap) {
        require(sender() == myAddress(), "Only my address can init distribution map");

        if msg.nextItemIndex == 0 {
            require(self.toDistribute.isEmpty(), "Distribution map already initialized");
        }
        require(msg.nextItemIndex < self.nextItemIndex, "Next item index is out of bounds");
        let startItemIndex = msg.nextItemIndex;

        let countItems = self.nextItemIndex - startItemIndex;

        let countChunks = countItems / msg.chunkSize;
        if countItems % msg.chunkSize != 0 {
            countChunks += 1;
        }

        let repeatAmount = msg.chunkSize;
        if countItems < msg.chunkSize {
            repeatAmount = countItems;
        }

        repeat (repeatAmount) {
            self.toDistribute.set(startItemIndex, 0);
            startItemIndex += 1;
        }

        if countChunks > 1 {
            send(SendParameters {
                value: 0,
                to: myAddress(),
                bounce: true,
                mode: SendRemainingBalance,
                body: InitDistributionMap {
                    nextItemIndex: startItemIndex,
                    chunkSize: msg.chunkSize,
                }.toCell(),
            });
        } else {
            nativeReserve(ton("0.1"), ReserveExact);
            send(SendParameters {
                value: 0,
                to: self.owner,
                bounce: true,
                mode: SendRemainingBalance,
            });
        }
    }

    receive(msg: JettonTransferNotification) {
        require(
            sender() == self.myJettonWalletAddress,
            "Notification not from your jetton wallet!",
        );
        self.balance += msg.amount;
        if (context().value < ton("0.1") || msg.amount < self.nftPriceInTokens) {
            return;
        }

        nativeReserve(ton("0.1"), ReserveExact);

        self.toDistribute.set(self.nextItemIndex, 0);
        self.nextItemIndex += 1;
        // getgems
        // let itemMsg: Cell = beginCell()
        //     .storeAddress(msg.sender)
        //     .storeRef(
        //         beginString().concat("nft.json").toCell(),
        //     )
        //     .endCell();

        // send(SendParameters {
        //     value: 0,
        //     to: self.nftCollectionAddress,
        //     bounce: true,
        //     mode: SendRemainingBalance,
        //     body: MintNFT {
        //         queryId: msg.queryId,
        //         itemIndex: self.nextItemIndex,
        //         amountTon: ton("0.05"),
        //         itemMsg: itemMsg,
        //     }.toCell(),
        // });

        send(SendParameters {
            value: 0,
            to: self.nftCollectionAddress,
            bounce: true,
            mode: SendRemainingBalance,
            body: MintNFT {
                queryId: msg.queryId,
                receiver: msg.sender,
                responseDestination: msg.sender,
                forwardAmount: 1,
                forwardPayload: emptyCell(),
            }.toCell(),
        });
    }

    receive(msg: OwnershipAssigned) {
        let itemIndex = msg.forwardPayload.beginParse().loadUint(256);
        let itemAddress = calcItemAddress(self.nftCollectionAddress, self.nftItemCode, itemIndex);
        require(itemAddress == sender(), "Item address mismatch");
        require(context().value > ton("0.1"), "Not enough balance to send");

        nativeReserve(ton("0.1"), ReserveExact);

        let toSend = self.toDistribute.get(itemIndex)!!;
        self.toDistribute.set(itemIndex, 0);
        self.balance -= toSend;

        send(SendParameters {
            value: ton("0.04"),
            to: self.myJettonWalletAddress!!,
            bounce: true,
            mode: SendPayGasSeparately,
            body: JettonTransfer1 {
                queryId: msg.queryId,
                amount: toSend,
                destination: msg.prevOwner,
                responseDestination: msg.prevOwner,
                customPayload: null,
                forwardTonAmount: 1,
                forwardPayload: null,
            }.toCell(),
        });
        send(SendParameters {
            value: 0,
            to: sender(),
            bounce: true,
            mode: SendRemainingBalance,
            body: NFTTransfer {
                queryId: msg.queryId,
                newOwner: msg.prevOwner,
                responseDestination: sender(),
                customPayload: null,
                forwardAmount: 1,
                forwardPayload: emptyCell(),
            }.toCell(),
        });
    }

    receive(msg: CalculateDistributionChunk) {
        require(sender() == myAddress(), "Only my address can calculate distribution chunk");

        let startItemIndex = msg.nextItemIndex;

        let countItems = self.nextItemIndex - startItemIndex;

        let countChunks = countItems / msg.chunkSize;
        if countItems % msg.chunkSize != 0 {
            countChunks += 1;
        }

        let repeatAmount = msg.chunkSize;
        if countItems < msg.chunkSize {
            repeatAmount = countItems;
        }

        repeat (repeatAmount) {
            let prev = self.toDistribute.get(startItemIndex)!!;
            self.toDistribute.set(startItemIndex, prev + msg.portion);
            startItemIndex += 1;
        }

        if countChunks > 1 {
            send(SendParameters {
                value: 0,
                to: myAddress(),
                bounce: true,
                mode: SendRemainingBalance,
                body: CalculateDistributionChunk {
                    nextItemIndex: startItemIndex,
                    chunkSize: msg.chunkSize,
                    portion: msg.portion,
                }.toCell(),
            });
        } else {
            nativeReserve(ton("0.1"), ReserveExact);
            send(SendParameters {
                value: 0,
                to: self.owner,
                bounce: true,
                mode: SendRemainingBalance,
            });
        }
    }

    receive(msg: CalculateDistribution) {
        require(sender() == self.owner, "Only admin can calculate distribution");
        require(now() > self.lastRewardDistribution + 7 * 24 * 60 * 60, "Last reward distribution is less than 7 days ago");
        require(msg.currentBalance == null || msg.currentBalance!! > self.balance, "Current balance is less than balance");
        require(context().value > self.nextItemIndex * ton("0.3") / 100, "Not enough balance to calculate distribution");
        nativeReserve(ton("0.1"), ReserveExact);
        // optional wallet balance correction from offchain. can only correct balance in upper direction.
        if msg.currentBalance != null {
            self.balanceFree += msg.currentBalance!! - self.balance;
            self.balance = msg.currentBalance!!;
        }

        let distribution = self.balanceFree * 314 / 100000;
        let portion = distribution / self.nextItemIndex;
        self.balanceFree -= distribution;
        self.lastRewardDistribution = now();

        send(SendParameters {
            value: 0,
            to: myAddress(),
            bounce: true,
            mode: SendRemainingBalance,
            body: CalculateDistributionChunk {
                nextItemIndex: 0,
                chunkSize: 100,
                portion: portion,
            }.toCell(),
        });
    }
}
