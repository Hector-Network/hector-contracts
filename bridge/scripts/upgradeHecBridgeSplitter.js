const { ethers, upgrades } = require("hardhat");
const { helpers } = require("../helper");
const exec = require("child_process").exec;

const UPGRADEABLE_PROXY = "0x19Fc4D72A9D400A19540f41D3728027B89f5Ccd0";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const gas = await ethers.provider.getGasPrice();
  const UpgradeContract = await ethers.getContractFactory("HecBridgeSplitter");
  console.log("Upgrading HecBridgeSplitter...");
  let upgrade = await upgrades.upgradeProxy(
    UPGRADEABLE_PROXY,
    UpgradeContract,
    {
      gasPrice: gas,
    }
  );

  // await helpers.waitSeconds(10);

  // const cmdForVerify = `npx hardhat verify --contract "contracts/HecBridgeSplitter.sol:HecBridgeSplitter" ${upgrade.address} --network ftm`;
  // exec(cmdForVerify, (error, stdout, stderr) => {
  //   if (error !== null) {
  //     console.log(`exec error: ${error}`);
  //   }
  // });

  console.log("HecBridgeSplitter contract upgraded to:", upgrade.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
