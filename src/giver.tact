message(0x7362d09c) JettonTransferNotification {
    // Unique identifier used to trace transactions across multiple contracts
    // Defaults to 0, which means we don't mark messages to trace their chains
    queryId: Int as uint64 = 0;

    // Amount of Jettons transferred
    amount: Int as coins;

    // Address of the sender of the Jettons
    sender: Address;

    // Optional custom payload
    forwardPayload: Slice as remaining;
}

message(0xf8a7ea5) JettonTransfer {
    queryId: Int as uint64;
    amount: Int as coins;
    destination: Address;
    responseDestination: Address?;
    customPayload: Cell?;
    forwardTonAmount: Int as coins;
    forwardPayload: Slice as remaining;
}

message(1) MintNFT {
    queryId: Int as uint64;
    itemIndex: Int as uint64;
    amountTon: Int as coins;
    itemMsg: Cell;
}

message(3) ChangeCollectionOwner {
    queryId: Int as uint64;
    newOwner: Address;
}

message(1337) Withdraw {
    queryId: Int as uint64;
    tokenAmount: Int;
}

message SetParameters {
    newJettonWalletAddress: Address?;
    newCollectionAddress: Address?;
    newPriceInTokens: Int?;
    newReserveOwnerAddress: Address?;
    lastRewardDistribution: Int?;
}

struct GiverData {
    owner: Address;
    myJettonWalletAddress: Address?;
    nftCollectionAddress: Address;
    nftPriceInTokens: Int;
    reserveOwnerAddress: Address;
    lastRewardDistribution: Int;
}

contract OMGiver {
    owner: Address;
    myJettonWalletAddress: Address?;
    reserveOwnerAddress: Address;
    nftCollectionAddress: Address;
    nftPriceInTokens: Int = 10000;
    lastRewardDistribution: Int = 0;
    nextItemIndex: Int = 0;

    init(id: Int, nftCollectionAddress: Address, reserveOwnerAddress: Address) {
        self.owner = sender();
        self.nftCollectionAddress = nftCollectionAddress;
        self.reserveOwnerAddress = reserveOwnerAddress;
    }

    get fun get_giver_data(): GiverData {
        return GiverData {
            owner: self.owner,
            myJettonWalletAddress: self.myJettonWalletAddress,
            nftCollectionAddress: self.nftCollectionAddress,
            nftPriceInTokens: self.nftPriceInTokens,
            reserveOwnerAddress: self.reserveOwnerAddress,
            lastRewardDistribution: self.lastRewardDistribution,
        };
    }

    receive() {}

    receive(msg: ChangeCollectionOwner) {
        require(sender() == self.owner, "Only owner can change collection owner");
        send(SendParameters {
            value: 0,
            mode: SendRemainingValue,
            to: self.nftCollectionAddress,
            body: ChangeCollectionOwner {
                queryId: 0,
                newOwner: msg.newOwner,
            }.toCell(),
        });
        self.forward(context().sender, null, false, null);
    }

    receive(msg: SetParameters) {
        require(sender() == self.owner, "Only owner can set parameters");
        if msg.newJettonWalletAddress != null {
            self.myJettonWalletAddress = msg.newJettonWalletAddress;
        }
        if msg.newCollectionAddress != null {
            self.nftCollectionAddress = msg.newCollectionAddress!!;
        }
        if msg.newPriceInTokens != null {
            self.nftPriceInTokens = msg.newPriceInTokens!!;
        }
        if msg.newReserveOwnerAddress != null {
            self.reserveOwnerAddress = msg.newReserveOwnerAddress!!;
        }
        if msg.lastRewardDistribution != null {
            self.lastRewardDistribution = msg.lastRewardDistribution!!;
        }
        self.forward(context().sender, null, false, null);
    }

    receive(msg: Withdraw) {
        require(sender() == self.owner, "Only owner can withdraw");
        nativeReserve(ton("0.1"), ReserveExact);

        if (msg.tokenAmount > 0) {
            send(SendParameters {
                value: ton("0.1"),
                to: self.myJettonWalletAddress!!,
                bounce: true,
                mode: SendDefaultMode,
                body: JettonTransfer {
                    queryId: msg.queryId,
                    amount: msg.tokenAmount,
                    destination: self.reserveOwnerAddress,
                    responseDestination: self.reserveOwnerAddress,
                    customPayload: null,
                    forwardTonAmount: ton("0.000000001"),
                    forwardPayload: rawSlice("F"),
                }.toCell(),
            });
        }

        send(SendParameters {
            value: 0,
            bounce: true,
            to: sender(),
            mode: SendRemainingBalance,
        });
    }

    receive(msg: JettonTransferNotification) {
        require(
            sender() == self.myJettonWalletAddress,
            "Notification not from your jetton wallet!",
        );
        if (context().value < ton("0.2") || msg.amount < self.nftPriceInTokens) {
            send(SendParameters {
                value: 0,
                to: self.myJettonWalletAddress!!,
                bounce: true,
                mode: SendRemainingValue,
                body: JettonTransfer {
                    queryId: msg.queryId,
                    amount: msg.amount,
                    destination: self.reserveOwnerAddress,
                    responseDestination: msg.sender,
                    customPayload: null,
                    forwardTonAmount: ton("0.000000001"),
                    forwardPayload: rawSlice("F"),
                }.toCell(),
            });
            return;
        }

        nativeReserve(ton("0.2"), ReserveAllExcept);

        send(SendParameters {
            value: ton("0.1"),
            to: self.myJettonWalletAddress!!,
            bounce: true,
            mode: SendDefaultMode,
            body: JettonTransfer {
                queryId: msg.queryId,
                amount: msg.amount,
                destination: self.reserveOwnerAddress,
                responseDestination: msg.sender,
                customPayload: null,
                forwardTonAmount: ton("0.000000001"),
                forwardPayload: rawSlice("F"),
            }.toCell(),
        });

        let itemMsg: Cell = beginCell()
            .storeAddress(msg.sender)
            .storeRef(
                beginString().concat("0/meta.json").toCell(),
            )
            .endCell();

        send(SendParameters {
            value: ton("0.06"),
            to: self.nftCollectionAddress,
            bounce: true,
            body: MintNFT {
                queryId: msg.queryId,
                itemIndex: self.nextItemIndex,
                amountTon: ton("0.05"),
                itemMsg: itemMsg,
            }.toCell(),
        });

        self.nextItemIndex += 1;
        // Forward excesses
        // self.forward(msg.sender, null, false, null);
    }
}
