const { ethers, upgrades } = require("hardhat");

const UPGRADEABLE_PROXY = "0x71D05b8Ea8e4c8eB5659E3cf44D81E25d1565EA1";

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
  
  const cmdForVerify = `npx hardhat verify --contract "contracts/HecBridgeSplitter.sol:HecBridgeSplitter" ${upgrade.address} --network mumbai`;
  exec(cmdForVerify, (error, stdout, stderr) => {
    if (error !== null) {
      console.log(`exec error: ${error}`);
    }
  });

  console.log("HecBridgeSplitter contract upgraded to:", upgrade.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
