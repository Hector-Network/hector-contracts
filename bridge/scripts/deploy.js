const hre = require("hardhat");
const BigNumber = require("bignumber.js");
const { boolean } = require("hardhat/internal/core/params/argumentTypes");
const { helpers } = require("../helper");
const { ethers } = require("hardhat");
const exec = require("child_process").exec;
const abiDecoder = require("abi-decoder");
const abi = require("../artifacts/contracts/HecBridgeSplitter.sol/HecBridgeSplitter.json");
const erc20Abi = require("../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json");
const { Signer } = require("ethers");
require("dotenv").config();

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Testing account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());
  const USDC = "0x04068da6c83afcfa0e13ba15a6696662335d5b75";
  // const HecBridgeSplitterAddress = "0x19Fc4D72A9D400A19540f41D3728027B89f5Ccd0";
  const HecBridgeSplitterAddress = "0xA8398Dcb0D049612e11cDA226B2145f1ee75Bf47";

  const Bridge = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE";

  const testHecBridgeSplitterContract = new ethers.Contract(
    HecBridgeSplitterAddress,
    abi.abi,
    deployer
  );
  const USDCContract = new ethers.Contract(USDC, erc20Abi.abi, deployer);
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  const mockBridgeDatas = [];
  const mockStargateDatas = [];

  console.log("HecBridgeSplitter:", HecBridgeSplitterAddress);

  console.log("Approve the USDC token to HecBridgeSplitter...");
  let tx = await USDCContract.connect(deployer).approve(HecBridgeSplitterAddress, "10000");
  await tx.wait();
  console.log("Done token allowance setting");

  // var nonce = await provider.getTransactionCount(deployer.address);

  const mockBridgeData1 = {
    transactionId:
      "0xdd82b80588cd7cd1774747ece9c56de633391a189b3d9fa241874d42cdf47a04",
    bridge: "stargate",
    integrator: "transferto.xyz",
    referrer: ZERO_ADDRESS,
    sendingAssetId: "0x04068da6c83afcfa0e13ba15a6696662335d5b75",
    receiver: "0xda66b6206bbaea5213A5065530858a3fD6ee1ec4",
    minAmount: "10000",
    destinationChainId: "137",
    hasSourceSwaps: false,
    hasDestinationCall: false,
  };

  const mockStargateData1 = {
    dstPoolId: "1",
    minAmountLD: "19888",
    dstGasForCall: "0",
    lzFee: "85814826586549789",
    refundAddress: "0x552008c0f6870c2f77e5cC1d2eb9bdff03e30Ea0",
    callTo: "0xda66b6206bbaea5213A5065530858a3fD6ee1ec4",
    callData: "0x",
  };

  const fee = "0x0130e0214f272e1d";

  mockBridgeDatas.push(mockBridgeData1);
  mockStargateDatas.push(mockStargateData1);

  console.log("Executing startBridgeTokensViaStargate...");
  const result = await testHecBridgeSplitterContract.startStargateBridgeSplit(
    mockBridgeDatas,
    mockStargateDatas,
    {
      value: fee,
    }
  );
  console.log(await result.wait());

  // withdraw
  // const withdraw = await testHecBridgeSplitterContract.withdraw(USDC);
  // console.log("Done withdraw");

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
