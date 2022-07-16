const hardhat = require("hardhat");

async function main() {
    const sUSDFactory = await hardhat.starknet.getContractFactory("sUSD");
    const sUSD = await sUSDFactory.deploy();
    console.log("sUSD Deployed to:", sUSD.address);

    const CollateralFactory = await hardhat.ethers.getContractFactory("Collateral");
    const Collateral = await CollateralFactory.deploy("0xde29d060D45901Fb19ED6C6e959EB22d8626708e"); // Starknet Core Address
    console.log("Collateral deployed to:", Collateral.address);

    const BorrowFactory = await hardhat.starknet.getContractFactory("Borrow");
    const Borrow = await BorrowFactory.deploy({_susd_address: sUSD.address, _l1_address: Collateral.address});
    console.log("Borrow deployed to:", Borrow.address);

    await Collateral.setBorrowContract(hardhat.ethers.BigNumber.from(Borrow.address).toString());
    console.log("Borrow contract set on L1");

    await sUSD.invoke("transferOwnership", { newOwner: Borrow.address }, {
        maxFee: hardhat.ethers.BigNumber.from(10000000000), // Not working yet
    });
    console.log("sUSD ownership transferred to Borrow");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });