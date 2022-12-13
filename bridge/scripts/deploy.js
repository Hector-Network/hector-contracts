const hre = require("hardhat");
const BigNumber = require("bignumber.js");
const { boolean } = require("hardhat/internal/core/params/argumentTypes");
const { helpers } = require("../helper");
const { ethers } = require("hardhat");
const exec = require("child_process").exec;
const abiDecoder = require("abi-decoder");
const abi = require("../artifacts/contracts/HecBridgeSplitter.sol/HecBridgeSplitter.json");
const { Signer } = require("ethers");
require("dotenv").config();

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const HecBridgeSplitterAddress = "0xF02B88082Ab9B0830277F4fA9d1bcc49339Ea820";
  const testHecBridgeSplitterContract = new ethers.Contract(HecAddress, abi.abi, deployer)


  const _trasactionId =
    "0xb8bb1285fed837cdb888f0e5b896ae1b4cab27b3e16a807880b233575d66ce47";
  const _integrator = "staging.transferto.xyz";
  const _referrer = "0x0000000000000000000000000000000000000000";
  const _receiver = "0xDa13E5D0d3E300B0Af9E5994fB411a5d231De4Dc";
  const _minAmount = "79158078";

  const _swapData = [
    {
      callTo: "0x7a250d5630b4cf539739df2c5dacb4c659f2488d",
      approveTo: "0x7a250d5630b4cf539739df2c5dacb4c659f2488d",
      sendingAssetId: "0x0000000000000000000000000000000000000000",
      receivingAssetId: "0x07865c6e87b9f70255377e024ace6630c1eaa37f",
      fromAmount: "100000000000000",
      callData:
        "0xfb3bdb410000000000000000000000000000000000000000000000000000000004b7db3e00000000000000000000000000000000000000000000000000000000000000800000000000000000000000001231deb6f5749ef6ce6943a275a1d3e7486f4eae00000000000000000000000000000000000000000000000000000002540be3ff0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000b4fbf271143f4fbf7b91a5ded31805e42b2208d600000000000000000000000007865c6e87b9f70255377e024ace6630c1eaa37f",
    },
  ];

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
