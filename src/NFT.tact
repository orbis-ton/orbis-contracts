import "./traits.tact";

contract OMCollection with NftCollection {
    owner: Address;
    exchanger: Address?;
    staticTax: Int as coins = ton("0");
    lockedValue: Int as coins = ton("0.05");

    nextItemIndex: Int as uint256 = 367;
    collectionContent: Cell;
    // itemContentUrlPrefix is the prefix of the individual NFT's content url.
    // the full url should be: `${itemContentUrlPrefix}${individualContent}.json`
    itemContentUrlPrefix: String;
    royalty: RoyaltyParams;

    init(
        owner: Address,
        collectionContent: Tep64TokenData,
        itemContentUrlPrefix: String,
        royalty: RoyaltyParams?,
    ) {
        self.owner = owner;
        self.collectionContent = collectionContent.toCell();
        self.itemContentUrlPrefix = itemContentUrlPrefix;

        if (royalty != null) {
            self.royalty = royalty!!;
        } else {
            self.royalty = RoyaltyParams {
                numerator: 0,
                denominator: 10,
                destination: owner,
            };
        }

        nativeThrowUnless(
            codeRoyaltyNumInvalid,
            self.royalty.numerator < self.royalty.denominator,
        );
        nativeThrowUnless(
            codeRoyaltyNumInvalid,
            self.royalty.denominator > 0,
        );
    }

    receive(msg: MintNFTWithIndex) {
        self.receiveMintNFTWithIndex(msg);
    }

    receive(msg: UpdateExchanger) {
        require(sender() == self.owner, "Only owner can update exchanger");
        require(self.exchanger == null, "Cannot change the exchanger");
        self.exchanger = msg.exchanger;
        self.reserveValue(0);
        send(SendParameters {
            to: sender(),
            value: 0,
            mode: SendRemainingBalance,
            bounce: false,
        });
    }

    receive(msg: ChangeCollectionOwner) {
        require(sender() == self.owner, "Only owner can change collection owner");
        self.owner = msg.newOwner;
        self.reserveValue(0);
        send(SendParameters {
            to: sender(),
            value: 0,
            mode: SendRemainingBalance,
            bounce: false,
        });
    }

    get fun get_exchanger(): Address? {
        return self.exchanger;
    }
}

contract OM with NftItem {
    owner: Address;
    staticTax: Int as coins = ton("0");
    lockedValue: Int as coins = ton("0.05");

    initialized: Bool = false;
    collection: Address;
    itemIndex: Int as uint256;
    individualContent: Cell;

    init(collection: Address, index: Int) {
        nativeThrowUnless(codeUnauthorized, sender() == collection);

        self.owner = sender();
        self.collection = collection;
        self.individualContent = emptyCell();
        self.itemIndex = index;
    }
}

// =====================================
// Traits
//
// https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md
// =====================================

trait NftCollection with Common {
    owner: Address;
    exchanger: Address?;
    staticTax: Int as coins;
    lockedValue: Int as coins;

    nextItemIndex: Int as uint256;
    collectionContent: Cell;
    // itemContentUrlPrefix is the prefix of the individual NFT's content url.
    // the full url should be: `${itemContentUrlPrefix}${individualContent}.json`
    itemContentUrlPrefix: String;
    royalty: RoyaltyParams;

    // -------------------------------------
    // TEP-062 standard interfaces
    // -------------------------------------

    // collection's owner can mint NFTs

    receive() {
        self.reserveValue(0);
        send(SendParameters {
            to: sender(),
            value: 0,
            mode: SendRemainingBalance,
            bounce: false,
        });
    }

    receive(msg: MintNFT) {
        self.receiveMintNFT(msg);
    }

    receive(msg: GetRoyaltyParams) {
        self.receiveGetRoyaltyParams(msg);
    }

    get fun get_collection_data(): CollectionData {
        return self.getCollectionData();
    }

    get fun get_nft_address_by_index(index: Int): Address {
        return self.getNftAddressByIndex(index);
    }

    get fun get_nft_content(index: Int, individualContent: Cell): Cell {
        return self.getNftContent(index, individualContent);
    }

    get fun royalty_params(): RoyaltyParams {
        return self.royaltyParams();
    }

    // -------------------------------------
    // Non standard methods
    // -------------------------------------

    // update collection's content and itemContentUrlPrefix
    receive(msg: UpdateCollection) {
        self.receiveUpdateCollection(msg);
    }

    bounced(msg: bounced<NFTTransfer>) {
        self.receiveBouncedNFTTransfer();
    }

    virtual fun receiveUpdateCollection(msg: UpdateCollection) {
        nativeThrowUnless(codeUnauthorized, sender() == self.owner);

        if (msg.collectionContent != null) {
            self.collectionContent = msg.collectionContent!!.toCell();
        }

        if (msg.itemContentUrlPrefix != null) {
            self.itemContentUrlPrefix = msg.itemContentUrlPrefix!!;
        }

        if (msg.royalty != null) {
            self.royalty = msg.royalty!!;
        }

        // refund
        self.reserveValue(0);
        send(SendParameters {
            to: msg.responseDestination,
            value: 0,
            mode: SendRemainingBalance,
            bounce: false,
            body: Excesses {
                queryId: msg.queryId,
            }.toCell(),
        });
    }

    virtual fun receiveBouncedNFTTransfer() {
        self.nextItemIndex = self.nextItemIndex - 1;
    }

    virtual fun receiveMintNFT(msg: MintNFT) {
        let ctx: Context = context();
        nativeThrowUnless(codeUnauthorized, (ctx.sender == self.owner));
        nativeThrowUnless(codeInflowValueNotSufficient, ctx.value >= self.staticTax + msg.forwardAmount);

        let nftItemContract: StateInit = self.getNftItemContract(self.nextItemIndex);

        // create NFT item contract
        self.reserveValue(0);
        send(SendParameters {
            to: contractAddress(nftItemContract),
            value: 0,
            bounce: true,
            mode: SendRemainingBalance,
            body: NFTTransfer {
                queryId: msg.queryId,
                newOwner: msg.receiver,
                responseDestination: msg.responseDestination,
                forwardAmount: msg.forwardAmount,
                forwardPayload: msg.forwardPayload,
                customPayload: beginString().toCell(),
            }.toCell(),
            code: nftItemContract.code,
            data: nftItemContract.data,
        });

        self.nextItemIndex += 1;
    }

    virtual fun receiveMintNFTWithIndex(msg: MintNFTWithIndex) {
        let ctx: Context = context();
        nativeThrowUnless(codeUnauthorized, (ctx.sender == self.exchanger));
        nativeThrowUnless(codeInflowValueNotSufficient, ctx.value >= self.staticTax + msg.forwardAmount);

        let nftItemContract: StateInit = self.getNftItemContract(msg.itemIndex);

        // create NFT item contract
        self.reserveValue(0);
        send(SendParameters {
            to: contractAddress(nftItemContract),
            value: 0,
            bounce: true,
            mode: SendRemainingBalance,
            body: NFTTransfer {
                queryId: msg.queryId,
                newOwner: msg.receiver,
                responseDestination: msg.responseDestination,
                forwardAmount: msg.forwardAmount,
                forwardPayload: msg.forwardPayload,
                customPayload: beginString().toCell(),
            }.toCell(),
            code: nftItemContract.code,
            data: nftItemContract.data,
        });
    }

    virtual fun receiveGetRoyaltyParams(msg: GetRoyaltyParams) {
        send(SendParameters {
            to: sender(),
            value: 0,
            mode: SendRemainingValue,
            bounce: false,
            body: ReportRoyaltyParams {
                queryId: msg.queryId,
                numerator: self.royalty.numerator,
                denominator: self.royalty.denominator,
                destination: self.royalty.destination,
            }.toCell(),
        });
    }

    virtual fun getNftItemContract(nextItemIndex: Int): StateInit {
        return initOf OM(myAddress(), nextItemIndex);
    }

    virtual fun getCollectionData(): CollectionData {
        return CollectionData {
            nextItemIndex: self.nextItemIndex,
            collectionContent: self.collectionContent,
            ownerAddress: self.owner,
        };
    }

    virtual fun getNftAddressByIndex(index: Int): Address {
        nativeThrowUnless(codeNftIndexNotExists, index < self.nextItemIndex);
        return contractAddress(self.getNftItemContract(index));
    }

    virtual fun getNftContent(index: Int, individualContent: Cell): Cell {
        return Tep64TokenData {
            flag: 1,
            content: beginString()
                .concat(self.itemContentUrlPrefix)
                .concat(individualContent.asSlice().asString())
                .toString(),
        }.toCell();
    }

    virtual fun royaltyParams(): RoyaltyParams {
        return self.royalty;
    }
}

trait NftItem with Common {
    owner: Address;
    staticTax: Int as coins;
    lockedValue: Int as coins;

    initialized: Bool;
    collection: Address;
    itemIndex: Int as uint256;
    individualContent: Cell;

    receive(msg: NFTTransfer) {
        self.receiveNFTTransfer(msg);
    }

    receive(msg: GetStaticData) {
        self.receiveGetStaticData(msg);
    }

    get fun get_nft_data(): GetNftData {
        return self.getNftData();
    }

    virtual fun receiveNFTTransfer(msg: NFTTransfer) {
        let ctx: Context = context();

        nativeThrowUnless(codeInflowValueNotSufficient, ctx.value >= msg.forwardAmount);
        nativeThrowUnless(codeUnauthorized, ctx.sender == self.owner);

        let prevOwner: Address = self.owner;
        self.owner = msg.newOwner;
        if (self.initialized == false) {
            // only the collection contract can initialize the NFT
            nativeThrowUnless(codeUnauthorized, ctx.sender == self.collection);
            nativeThrowUnless(codeNftCustomPayloadInvalid, msg.customPayload != null);

            self.individualContent = msg.customPayload!!;
            self.initialized = true;
        }

        // forward
        if (msg.forwardAmount > 0) {
            send(SendParameters {
                to: msg.newOwner,
                value: msg.forwardAmount,
                bounce: false,
                mode: SendDefaultMode + SendPayGasSeparately,
                body: OwnershipAssigned {
                    queryId: msg.queryId,
                    prevOwner: prevOwner,
                    forwardPayload: msg.forwardPayload,
                }.toCell(),
            });
        }

        // refund the remaining balance to the responseDestination
        self.reserveValue(0);
        send(SendParameters {
            to: msg.responseDestination,
            value: 0,
            mode: SendRemainingBalance,
            bounce: false,
            body: Excesses {
                queryId: msg.queryId,
            }.toCell(),
        });
    }

    virtual fun receiveGetStaticData(msg: GetStaticData) {
        let ctx: Context = context();

        self.reserveValue(0);
        send(SendParameters {
            to: ctx.sender,
            value: 0,
            mode: SendRemainingBalance,
            bounce: true,
            body: ReportStaticData {
                queryId: msg.queryId,
                index: self.itemIndex,
                collection: self.collection,
            }.toCell(),
        });
    }

    virtual fun getNftData(): GetNftData {
        return GetNftData {
            init: self.initialized,
            index: self.itemIndex,
            collectionAddress: self.collection,
            ownerAddress: self.owner,
            individualContent: self.individualContent,
        };
    }
}
