const hre = require("hardhat");
const { ethers } = require("hardhat");
const abi = require("../artifacts/contracts/HecBridgeSplitter.sol/HecBridgeSplitter.json");
const erc20Abi = require("../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json");
const { BigNumber } = require("@ethersproject/bignumber");
require("dotenv").config();

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Testing account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const USDC = "0x04068da6c83afcfa0e13ba15a6696662335d5b75";
  const DAI = "0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e";
  const HecBridgeSplitterAddress = "0x19Fc4D72A9D400A19540f41D3728027B89f5Ccd0";

  const testHecBridgeSplitterContract = new ethers.Contract(
    HecBridgeSplitterAddress,
    abi.abi,
    deployer
  );
  
  console.log("Withdrawing...")
  const txWithdraw = await testHecBridgeSplitterContract.withdraw(DAI);
  await txWithdraw.wait();

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
