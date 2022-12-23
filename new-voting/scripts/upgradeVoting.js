const { ethers, upgrades } = require("hardhat");
const { helpers } = require("../helper");
const { waitSeconds } = require("../helper/helpers");
const exec = require("child_process").exec;

const UPGRADEABLE_PROXY = "0x19Fc4D72A9D400A19540f41D3728027B89f5Ccd0";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const gas = await ethers.provider.getGasPrice();
  const UpgradeContract = await ethers.getContractFactory("Voting");
  console.log("Upgrading Voting...");
  let upgrade = await upgrades.upgradeProxy(UPGRADEABLE_PROXY, UpgradeContract, {
    gasPrice: gas,
  });

  console.log("Voting contract upgraded to:", upgrade.address);

  // Set selector
  // console.log("Setting selectors...");
  // await waitSeconds(10);
  // const txSetSelectors = await upgrade.setSelectors(selector, selectorHec);
  // await txSetSelectors.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
