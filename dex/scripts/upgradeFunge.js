const { ethers, upgrades } = require("hardhat");

const UPGRADEABLE_PROXY = "0xbd8A726bE5440e27440AFa10f97aeFDCabEA7539";

async function main() {

   const [deployer] = await ethers.getSigners();

   console.log("Deploying contracts with the account:", deployer.address);
  
   console.log("Account balance:", (await deployer.getBalance()).toString());


   const gas = await ethers.provider.getGasPrice()
   const V2Contract = await ethers.getContractFactory("V2");
   console.log("Upgrading V1Contract...");
   let upgrade = await upgrades.upgradeProxy(UPGRADEABLE_PROXY, V2Contract, {
      gasPrice: gas
   });
   console.log("V1 Upgraded to V2");
   console.log("V2 Contract Deployed To:", upgrade.address)
}

main().catch((error) => {
   console.error(error);
   process.exitCode = 1;
 });