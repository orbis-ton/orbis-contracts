import { NetworkProvider } from '@ton/blueprint';
import { KeyPair, mnemonicToPrivateKey, mnemonicNew } from "@ton/crypto";
import { Address, WalletContractV5R1 } from "@ton/ton"


async function run(provider: NetworkProvider) {
    const owner = provider.sender().address!!;
    const jettonMasterContract = await provider.open(
        await JettonMasterTemplate.fromInit(
            receiverAddr,
            {
                $$type: "Tep64TokenData",
                flag: BigInt("1"),
                content: "https://s3.laisky.com/uploads/2024/09/jetton-sample.json",
            }
        )
    );
    const jettonWalletContract = await provider.open(
        await JettonWalletTemplate.fromInit(
            jettonMasterContract.address,
            receiverAddr,
        )
    );
}   

main()