import "./messages";
import "./NFTCollection";

struct ExchangerData {
    myJettonWallet: Address?;
    myJettonWalletOld: Address?;
    collection: Address;
    collectionOld: Address;
    balance: Int? as coins;
    balanceOld: Int? as coins;
    maxItemIndex: Int;
    expectedNftItem0Address: Address;
}

fun calcItemAddress(nftCollectionAddress: Address, nftItemCode: Cell, itemIndex: Int): Address {
    let i = initOf NftItemTemplate(nftCollectionAddress, itemIndex);
    return contractAddress(StateInit {
        code: nftItemCode,
        data: i.data,
    });
}

contract Exchanger {
    initialized: Bool = false;
    myJettonWallet: Address?;
    myJettonWalletOld: Address?;
    collection: Address;
    collectionOld: Address;
    balance: Int as coins = 0;
    balanceOld: Int as coins = 0;
    maxItemIndex: Int;
    nftItemCode: Cell;

    init(id: Int, collection: Address, collectionOld: Address, maxItemIndex: Int, nftItemCode: Cell) {
        self.collection = collection;
        self.collectionOld = collectionOld;
        self.maxItemIndex = maxItemIndex;
        self.nftItemCode = nftItemCode;
    }

    get fun get_exchanger_data(): ExchangerData {
        return ExchangerData {
            collection: self.collection,
            collectionOld: self.collectionOld,
            maxItemIndex: self.maxItemIndex,
            balance: self.balance,
            balanceOld: self.balanceOld,
            expectedNftItem0Address: calcItemAddress(self.collectionOld, self.nftItemCode, 0),
            myJettonWallet: self.myJettonWallet,
            myJettonWalletOld: self.myJettonWalletOld,
        };
    }

    receive() {}

    receive(msg: InitExchangerJettonWallets) {
        require(self.initialized == false, "Exchanger can be initialized only once");
        nativeReserve(ton("0.1"), ReserveExact);

        self.myJettonWallet = msg.address;
        self.balance = msg.balance;
        self.myJettonWalletOld = msg.addressOld;
        self.balanceOld = msg.balanceOld;
        self.initialized = true;

        send(SendParameters {
            value: 0,
            to: sender(),
            bounce: true,
            mode: SendRemainingBalance,
        });
    }

    receive(msg: JettonTransferNotification) {
        require(
            sender() == self.myJettonWalletOld,
            "Notification not from ORBC wallet!",
        );
        self.balanceOld += msg.amount;
        if (context().value < ton("0.05")) {
            return;
        }

        send(SendParameters {
            value: ton("0.04"),
            to: self.myJettonWallet!!,
            bounce: true,
            body: JettonTransfer1 {
                queryId: msg.queryId,
                amount: msg.amount,
                destination: msg.sender,
                responseDestination: msg.sender,
                forwardTonAmount: 1,
                forwardPayload: null,
                customPayload: null,
            }.toCell(),
        });

        nativeReserve(ton("0.1"), ReserveExact);

        send(SendParameters {
            value: 0,
            to: msg.sender,
            bounce: true,
            mode: SendRemainingBalance,
        });
    }

    receive(msg: OwnershipAssigned) {
        let itemIndex = msg.forwardPayload.beginParse().loadUint(256);
        let itemAddress = calcItemAddress(self.collectionOld, self.nftItemCode, itemIndex);

        require(itemAddress == sender(), "Item address mismatch");

        nativeReserve(ton("0.1"), ReserveExact);

        send(SendParameters {
            value: 0,
            to: self.collection,
            bounce: true,
            mode: SendRemainingBalance,
            body: MintNFTWithIndex {
                queryId: msg.queryId,
                receiver: msg.prevOwner,
                responseDestination: msg.prevOwner,
                forwardAmount: 1,
                forwardPayload: emptyCell(),
                itemIndex: itemIndex,
            }.toCell(),
        });
    }
}
