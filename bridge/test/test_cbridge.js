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
  const HecBridgeSplitterAddress = "0x19Fc4D72A9D400A19540f41D3728027B89f5Ccd0";
  const Bridge = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE";

  const testHecBridgeSplitterContract = new ethers.Contract(
    HecBridgeSplitterAddress,
    abi.abi,
    deployer
  );
  const USDCContract = new ethers.Contract(USDC, erc20Abi.abi, deployer);
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  const mockBridgeDatas = [];
  const mockSwapDatas = [];

  const mockStargateDatas = [];

  console.log("HecBridgeSplitter:", HecBridgeSplitterAddress);

  console.log("Approve the USDC token to HecBridgeSplitter...");
  let tx = await USDCContract.connect(deployer).approve(HecBridgeSplitterAddress, "20000");
  await tx.wait();
  console.log("Done token allowance setting");

  const mockBridgeData1 = {
    transactionId: "0xbd44f3be0b56c7a402b72b2740499c6dd4615d0fe04998fb6dcaa71fe2415c66",
    bridge: "stargate",
    integrator: "transferto.xyz",
    referrer: ZERO_ADDRESS,
    sendingAssetId: "0x04068da6c83afcfa0e13ba15a6696662335d5b75",
    receiver: "0xda66b6206bbaea5213A5065530858a3fD6ee1ec4",
    minAmount: "233664",
    destinationChainId: "137",
    hasSourceSwaps: true,
    hasDestinationCall: false,
  };

  const mockStargateData1 = {
    dstPoolId: "1",
    minAmountLD: "232732",
    dstGasForCall: "0",
    lzFee: "287141759563724761",
    refundAddress: "0xDa13E5D0d3E300B0Af9E5994fB411a5d231De4Dc",
    callTo: "0xda66b6206bbaea5213A5065530858a3fD6ee1ec4",
    callData: "0x",
  };

  const mockSwapData1 = [
    {
      callTo: "0x1111111254fb6c44bac0bed2854e76f90643097d",
      approveTo: "0x1111111254fb6c44bac0bed2854e76f90643097d",
      sendingAssetId: "0x0000000000000000000000000000000000000000",
      receivingAssetId: "0x04068da6c83afcfa0e13ba15a6696662335d5b75",
      fromAmount: "1000000000000000000",
      callData:
        "0x7c02520000000000000000000000000093131efee501d5721737c32576238f619548edda00000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000180000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee00000000000000000000000004068da6c83afcfa0e13ba15a6696662335d5b7500000000000000000000000093131efee501d5721737c32576238f619548edda0000000000000000000000001231deb6f5749ef6ce6943a275a1d3e7486f4eae0000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000000000000000390bf00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001d600000000000000000000000000000000000000000000019800016a00001a404121be370d5312f44cb42ce377bc9b8a0cef1a4c83d0e30db05126a38cd27185a464914d3046f0ab9d43356b34829d21be370d5312f44cb42ce377bc9b8a0cef1a4c830004f41766d800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000038c2900000000000000000000000000000000000000000000000000000000000000a000000000000000000000000093131efee501d5721737c32576238f619548edda0000000000000000000000000000000000000000000000000000000063a1f02c000000000000000000000000000000000000000000000000000000000000000100000000000000000000000021be370d5312f44cb42ce377bc9b8a0cef1a4c8300000000000000000000000004068da6c83afcfa0e13ba15a6696662335d5b75000000000000000000000000000000000000000000000000000000000000000080a06c4eca2704068da6c83afcfa0e13ba15a6696662335d5b751111111254fb6c44bac0bed2854e76f90643097d0000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000002e9b3012",
      requiresDeposit: true,
    },
  ];

  // const mockBridgeData2 = {
  //   transactionId:
  //     "0xbd44f3be0b56c7a402b72b2740499c6dd4615d0fe04998fb6dcaa71fe2415c66",
  //   bridge: "stargate",
  //   integrator: "transferto.xyz",
  //   referrer: ZERO_ADDRESS,
  //   sendingAssetId: "0x04068da6c83afcfa0e13ba15a6696662335d5b75",
  //   receiver: "0xDa13E5D0d3E300B0Af9E5994fB411a5d231De4Dc",
  //   minAmount: "10000",
  //   destinationChainId: "137",
  //   hasSourceSwaps: false,
  //   hasDestinationCall: false,
  // };

  // const mockStargateData2 = {
  //   dstPoolId: "1",
  //   minAmountLD: "9944",
  //   dstGasForCall: "0",
  //   lzFee: "287141759563724761",
  //   refundAddress: "0xDa13E5D0d3E300B0Af9E5994fB411a5d231De4Dc",
  //   callTo: "0xDa13E5D0d3E300B0Af9E5994fB411a5d231De4Dc",
  //   callData: "0x",
  // };

  // const fee = BigNumber.from(mockStargateData1.lzFee).add(BigNumber.from(mockStargateData2.lzFee));
  const fee = mockStargateData1.lzFee;

  mockBridgeDatas.push(mockBridgeData1);
  mockStargateDatas.push(mockStargateData1);

  mockSwapDatas.push(mockSwapData1);

  // mockBridgeDatas.push(mockBridgeData2);
  // mockStargateDatas.push(mockStargateData2);

  console.log("Executing startBridgeTokensViaStargate...");

  const result = await testHecBridgeSplitterContract.swapAndStartBridgeTokensViaStargate(
    mockBridgeDatas,
    mockSwapDatas,
    mockStargateDatas,
    {
      value: fee,
    }
  );

  console.log(await result.wait());

  // Withdraw
  // const withdraw = await testHecBridgeSplitterContract.withdraw(USDC);
  // await withdraw.wait();
  // console.log("Done withdraw");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
