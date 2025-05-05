// -------------------------------------
// TEP-62: NFT standard messages
//
// https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md
// -------------------------------------

message(0xd53276db) Excesses {
    queryId: Int as uint64;
}

message(0x693d3950) GetRoyaltyParams {
    queryId: Int as uint64;
}

message(0xa8cb00ad) ReportRoyaltyParams {
    queryId: Int as uint64;
    numerator: Int as uint16;
    denominator: Int as coins;
    destination: Address;
}

// https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md#1-transfer
message(0x5fcc3d14) NFTTransfer {
    queryId: Int as uint64;
    // newOwner is address of the new owner of the NFT item.
    newOwner: Address;
    // responseDestination is the address where to send a response
    // with confirmation of a successful transfer and the rest of
    // the incoming message coins.
    responseDestination: Address;
    // customPayload is the optional custom data.
    customPayload: Cell?;
    // forwardAmount is the amount of nanotons to be sent to the new owner.
    forwardAmount: Int as coins;
    // forwardPayload is the optional custom data that should be
    // sent to the new owner.
    forwardPayload: Cell as remaining;
}

message(0x05138d91) OwnershipAssigned {
    queryId: Int as uint64;
    prevOwner: Address;
    forwardPayload: Cell as remaining;
}

message(0x2fcb26a2) GetStaticData {
    queryId: Int as uint64;
}

message(0x8b771735) ReportStaticData {
    queryId: Int as uint64;
    index: Int as uint256;
    collection: Address;
}

struct GetNftData {
    init: Bool;
    index: Int as uint256;
    collectionAddress: Address;
    ownerAddress: Address;
    individualContent: Cell;
}

struct CollectionData {
    nextItemIndex: Int;
    collectionContent: Cell;
    ownerAddress: Address;
}

// https://github.com/ton-blockchain/TEPs/blob/master/text/0066-nft-royalty-standard.md#get-methods
struct RoyaltyParams {
    numerator: Int;
    denominator: Int;
    destination: Address;
}

// https://github.com/ton-blockchain/TEPs/blob/master/text/0064-token-data-standard.md#content-representation
struct Tep64TokenData {
    // flag is the flag of the content type.
    // 0 means on-chain, 1 means off-chain.
    flag: Int as uint8;
    content: String;
}

// -------------------------------------
// Custom messages
// -------------------------------------

// SetStaticTax is the message that used to set the static tax fee.
message(0x1509a420) SetStaticTax {
    staticTax: Int as coins;
}

message(0x112a9509) UpgradeContract {
    queryId: Int;
    code: Cell?;
    data: Cell?;
    responseDestination: Address;
}

struct MerkleProof {
    data: Cell;
    root: Int as uint256;
    proof: map<Int as uint32, Int as uint256>;
    proofLen: Int as uint32;
}

// -------------------------------------
// Non-standard messages
// -------------------------------------

message(0xe535b616) MintNFT {
    queryId: Int as uint64;
    receiver: Address;
    responseDestination: Address;
    forwardAmount: Int as coins = 0;
    forwardPayload: Cell as remaining;
}

message(3000) MintNFTWithIndex {
    queryId: Int as uint64;
    itemIndex: Int as uint256;
    receiver: Address;
    responseDestination: Address;
    forwardAmount: Int as coins = 0;
    forwardPayload: Cell as remaining;
    
}

message(0x48a60907) UpdateCollection {
    queryId: Int as uint64;
    responseDestination: Address;
    collectionContent: Tep64TokenData?;
    itemContentUrlPrefix: String?;
    royalty: RoyaltyParams?;
}

message(3001) UpdateExchanger {
    exchanger: Address;
}
// =====================================
// Responsed structures
// =====================================

struct NftItemInitForwardPayload {
    index: Int as uint256;
}

message(3) ChangeCollectionOwner {
    queryId: Int as uint64;
    newOwner: Address;
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

message(0xf8a7ea5) JettonTransfer {
    queryId: Int as uint64;
    amount: Int as coins;
    destination: Address;
    responseDestination: Address;
    customPayload: Cell?;
    forwardTonAmount: Int as coins;
    forwardPayload: Cell as remaining;
}

message(0xf8a7ea5) JettonTransfer1 {
    queryId: Int as uint64;
    amount: Int as coins;
    destination: Address;
    responseDestination: Address;
    customPayload: Cell?;
    forwardTonAmount: Int as coins;
    forwardPayload: Cell?;
}

// getgems
// message(1) MintNFT {
//     queryId: Int as uint64;
//     itemIndex: Int as uint64;
//     amountTon: Int as coins;
//     itemMsg: Cell;
// }

message(1337) Withdraw {
    queryId: Int as uint64;
    tokenAmount: Int;
}

message(1338) SetParameters {
    newCollectionAddress: Address?;
    newPriceInTokens: Int?;
    lastRewardDistribution: Int?;
}

message(1339) InitJettonWallet {
    address: Address;
    balance: Int as coins;
}

message(1340) CalculateDistribution {
    // table: map<Int, Int>;
    currentBalance: Int? as coins;
}

message(1341) CalculateDistributionChunk {
    nextItemIndex: Int as uint256;
    chunkSize: Int as uint16;
    portion: Int as coins;
}

message(1342) InitDistributionMap {
    nextItemIndex: Int as uint256;
    chunkSize: Int as uint16;
}


message(2000) InitExchangerJettonWallets {
    address: Address;
    balance: Int as coins;
    addressOld: Address;
    balanceOld: Int as coins;
}