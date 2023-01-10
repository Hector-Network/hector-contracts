const hre = require("hardhat");
const { ethers } = require("hardhat");
const abi = require("../artifacts/contracts/HecBridgeSplitter.sol/HecBridgeSplitter.json");
const erc20Abi = require("../artifacts/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol/IERC20Upgradeable.json");
const { BigNumber } = require("@ethersproject/bignumber");
require("dotenv").config();

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Testing account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const USDC = "0x04068da6c83afcfa0e13ba15a6696662335d5b75";
  const DAI = "0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e";
  const HecBridgeSplitterAddress = process.env.SPLITTER_ADDRESS;

  const testHecBridgeSplitterContract = new ethers.Contract(
    HecBridgeSplitterAddress,
    abi.abi,
    deployer
  );

  console.log("Withdrawing...")
  const txWithdraw = await testHecBridgeSplitterContract.withdraw(USDC);
  await txWithdraw.wait();

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
