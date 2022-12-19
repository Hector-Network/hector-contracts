const { ethers, upgrades } = require("hardhat");
const { helpers } = require("../helper");
const { waitSeconds } = require("../helper/helpers");
const exec = require("child_process").exec;

const UPGRADEABLE_PROXY = "0x19Fc4D72A9D400A19540f41D3728027B89f5Ccd0";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const selector = [
    "swapTokensGeneric",
    "startBridgeTokensViaMultichain",
    "swapAndStartBridgeTokensViaMultichain",
    "startBridgeTokensViaStargate",
    "swapAndStartBridgeTokensViaStargate",
    "startBridgeTokensViaCBridge",
    "swapAndStartBridgeTokensViaCBridge",
  ];

  const selectorHec = [
    "0x4630a0d8",
    "0xef55f6dd",
    "0xa342d3ff",
    "0x3b00e807",
    "0xd7556c1e",
    "0xae0b91e5",
    "0x482c6a85",
  ];

  const gas = await ethers.provider.getGasPrice();
  const UpgradeContract = await ethers.getContractFactory("HecBridgeSplitter");
  console.log("Upgrading HecBridgeSplitter...");
  let upgrade = await upgrades.upgradeProxy(UPGRADEABLE_PROXY, UpgradeContract, {
    gasPrice: gas,
  });

  console.log("HecBridgeSplitter contract upgraded to:", upgrade.address);

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
