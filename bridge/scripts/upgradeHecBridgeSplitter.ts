import { BigNumber } from 'ethers';
import { waitSeconds } from '../helper';
const { ethers, upgrades } = require("hardhat");
require("dotenv").config();

// const UPGRADEABLE_PROXY = process.env.FTM_MAIN_SPLITTER_ADDRESS;
const UPGRADEABLE_PROXY = "0x33239FE64E6CECb364e6A42f66bbdB714Fe89d7b";
const feePercentage = 75;
const DAO = "0x677d6EC74fA352D4Ef9B1886F6155384aCD70D90";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const gas = await ethers.provider.getGasPrice();
  const UpgradeContract = await ethers.getContractFactory("HecBridgeSplitter");
  console.log("Upgrading HecBridgeSplitter...");
  let upgrade = await upgrades.upgradeProxy(UPGRADEABLE_PROXY, UpgradeContract, {
    gasPrice: gas,
  });

  // Set Parameter
  console.log("Setting parameters...");
  await upgrade.setMinFeePercentage(feePercentage);
  await waitSeconds(3);
  await upgrade.setDAOWallet(DAO);

  console.log("HecBridgeSplitter contract upgraded to:", upgrade.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
