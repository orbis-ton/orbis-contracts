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

message(0xe535b616) MintNFT {
    queryId: Int as uint64;
    receiver: Address;
    responseDestination: Address;
    forwardAmount: Int as coins = 0;
    forwardPayload: Cell?;
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

message(1337) Withdraw {}

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

    init(id: Int, nftCollectionAddress: Address, reserveOwnerAddress: Address) {
        self.owner = sender();
        self.nftCollectionAddress = nftCollectionAddress;
        self.reserveOwnerAddress = reserveOwnerAddress;
    }

    get fun get_giver_data(): GiverData {
        return GiverData{
            owner: self.owner,
            myJettonWalletAddress: self.myJettonWalletAddress,
            nftCollectionAddress: self.nftCollectionAddress,
            nftPriceInTokens: self.nftPriceInTokens,
            reserveOwnerAddress: self.reserveOwnerAddress,
            lastRewardDistribution: self.lastRewardDistribution
        }
    }

    receive() { }

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
    }

    receive(msg: Withdraw) {
        require(sender() == self.owner, "Only owner can withdraw");
        nativeReserve(ton("0.5"), ReserveExact);
        send(SendParameters{
            value: 0,
            bounce: true,
            to: sender(),
            mode: SendRemainingBalance
        });
    }

    receive(msg: JettonTransferNotification) {
        require(
            sender() == self.myJettonWalletAddress,
            "Notification not from your jetton wallet!",
        );
        require(context().value >= ton("0.5"), "Not enough gas to mint NFT");
        require(msg.amount >= self.nftPriceInTokens, "Not enough tokens to mint NFT");

        nativeReserve(ton("0.4"), ReserveAllExcept);

        if (msg.amount > self.nftPriceInTokens) {
            send(SendParameters{
                value: ton("0.1"),
                to: self.myJettonWalletAddress!!,
                bounce: true,
                mode: SendDefaultMode,
                body: JettonTransfer{
                    queryId: msg.queryId,
                    amount: msg.amount - self.nftPriceInTokens,
                    destination: self.reserveOwnerAddress,
                    responseDestination: msg.sender,
                    customPayload: null,
                    forwardTonAmount: ton("0.000000001"),
                    forwardPayload: rawSlice("F"),
                }.toCell()
            });
        }
        
        send(SendParameters{
            value: 0,
            to: self.nftCollectionAddress,
            bounce: true,
            mode: SendRemainingBalance,
            body: MintNFT{
                queryId: msg.queryId,
                receiver: msg.sender,
                responseDestination: msg.sender,
                forwardAmount: ton("0.000000001"),
                forwardPayload: null,
            }.toCell()
        });

        
        // Forward excesses
        self.forward(msg.sender, null, false, null);
    }
}
