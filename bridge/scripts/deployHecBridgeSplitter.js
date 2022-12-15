const hre = require("hardhat");
const BigNumber = require("bignumber.js");
const { boolean } = require("hardhat/internal/core/params/argumentTypes");
const { helpers } = require("../helper");
const exec = require("child_process").exec;

async function main() {
  const prodMode = false;
  const [deployer] = await hre.ethers.getSigners();
  const _countDest = 2; // Count of the destination wallets, default: 2
  const _bridge = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE";

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const gas = await ethers.provider.getGasPrice();
  console.log("Gas Price: ", gas);

  const hecBridgeSplitterFactory = await ethers.getContractFactory("HecBridgeSplitter");
  console.log("Deploying HecBridgeSplitter Contract...");

  // const hecBridgeSplitterContract = await hre.upgrades.deployProxy(hecBridgeSplitterFactory, [_countDest, _bridge], {
  //   gas: gas,
  //   initializer: "initialize",
  // });

  const hecBridgeSplitterContract = await hecBridgeSplitterFactory.deploy();
  console.log("HecBridgeSplitter contract deployed to:", hecBridgeSplitterContract.address);

  await helpers.waitSeconds(10);

  const tx = await hecBridgeSplitterContract.initialize(_countDest, _bridge);
  await tx.wait();
  console.log("Done initialization");

  const cmdForVerify = `npx hardhat verify --contract "contracts/HecBridgeSplitter.sol:HecBridgeSplitter" ${hecBridgeSplitterContract.address} --network ftm`;
  exec(cmdForVerify, (error, stdout, stderr) => {
    if (error !== null) {
      console.log(`exec error: ${error}`);
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
