import "./traits";
import "./jetton/jetton-minter";


fun calculateJettonWalletAddress(
    ownerAddress: Address,
    jettonMasterAddress: Address
): Address {
    return contractAddress(initOf JettonWallet(0, ownerAddress, jettonMasterAddress));
}

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

message(1337) Withdraw {

}

struct GiverData {
    owner: Address;
    myJettonWalletAddress: Address;
    myJettonAmount: Int as coins = 0;
    nftCollectionAddress: Address;
}

contract OMGiver {//with Common {
    owner: Address;
    myJettonWalletAddress: Address;
    myJettonAmount: Int as coins = 0;
    nftCollectionAddress: Address;

    init(id: Int, jettonMasterAddress: Address, nftCollectionAddress: Address) {
        self.owner = sender();
        self.myJettonWalletAddress = calculateJettonWalletAddress(
            myAddress(),
            jettonMasterAddress
        );
        self.nftCollectionAddress = nftCollectionAddress;
    }

    get fun get_giver_data(): GiverData {
        return GiverData{
            owner: self.owner,
            myJettonWalletAddress: self.myJettonWalletAddress,
            myJettonAmount: self.myJettonAmount,
            nftCollectionAddress: self.nftCollectionAddress
        }
    }

    receive() { }

    receive(msg: Withdraw) {
        require(sender() == self.owner, "Only owner can withdraw");
        nativeReserve(ton("1.5"), ReserveExact);
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
        self.myJettonAmount += msg.amount;

        if (msg.amount == 10000) {
            nativeReserve(ton("0.5"), ReserveAllExcept);
            send(SendParameters{
                value: 0,
                to: self.nftCollectionAddress,
                bounce: true,
                mode: SendRemainingBalance,
                body: MintNFT{
                    queryId: msg.queryId,
                    receiver: msg.sender,
                    responseDestination: myAddress(),
                    forwardAmount: ton("0.000000001"),
                    forwardPayload: null,
                }.toCell()
            });
        }
        // Forward excesses
        self.forward(msg.sender, null, false, null);
    }
}
