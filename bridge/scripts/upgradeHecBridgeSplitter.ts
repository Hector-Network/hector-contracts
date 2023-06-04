import { BigNumber } from 'ethers';
import { waitSeconds } from '../helper';
const { ethers, upgrades } = require("hardhat");
require("dotenv").config();

// const UPGRADEABLE_PROXY = process.env.FTM_MAIN_SPLITTER_ADDRESS;
const UPGRADEABLE_PROXY = "0x33239FE64E6CECb364e6A42f66bbdB714Fe89d7b";
const feePercentage = 75;
const DAO = "0xd73c5521B4917aE6c7Fa42Df5c8578f7f7638d50";
const version = "2.0";

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
  await waitSeconds(3);
  await upgrade.setVersion(version);

  console.log("HecBridgeSplitter contract upgraded to:", upgrade.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
