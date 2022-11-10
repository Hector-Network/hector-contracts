const { ethers, upgrades } = require("hardhat");
const BigNumber =  require("bignumber.js");

async function main() {

   const funge = "0x65CF1241F6d891346263a3F3EE5096a5527C90Af";

   const [deployer] = await ethers.getSigners();

   console.log("Deploying contracts with the account:", deployer.address);
  
   console.log("Account balance:", (await deployer.getBalance()).toString());

   const gas = await ethers.provider.getGasPrice();
   console.log("Gas Price: ", gas.toNumber());

   const V1contract = await ethers.getContractFactory("HectorSwapper");
   console.log("Deploying HectorSwapper V1 Contract...");
   const v1contract = await upgrades.deployProxy(V1contract, [funge], {
      initializer: "initialize",
   });

   await v1contract.deployed();
   console.log("HectorSwapper V1 Contract deployed to:", v1contract.address);
}

main().catch((error) => {
   console.error(error);
   process.exitCode = 1;
 });