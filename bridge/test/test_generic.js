const hre = require("hardhat");
const { ethers } = require("hardhat");
const abi = require("../artifacts/contracts/HecBridgeSplitter.sol/HecBridgeSplitter.json");
const erc20Abi = require("../artifacts/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol/IERC20Upgradeable.json");
const { BigNumber } = require("@ethersproject/bignumber");
const tempStepData = require("./tempStepData.json");
require("dotenv").config();

async function main() {
  const mode = "single"; // mode: single, multi
  const [deployer] = await hre.ethers.getSigners();
  console.log("Testing account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  const isNativeFrom = tempStepData.action.fromToken.address == ZERO_ADDRESS;
  const isNativeTo = tempStepData.action.toToken.address == ZERO_ADDRESS;

  const HecBridgeSplitterAddress = process.env.SPLITTER_ADDRESS;

  const testHecBridgeSplitterContract = new ethers.Contract(
    HecBridgeSplitterAddress,
    abi.abi,
    deployer
  );

  console.log("HecBridgeSplitter:", HecBridgeSplitterAddress);

  const includedSteps0 = tempStepData.includedSteps[0];

  const _swapData1 = [
    {
      sendingAssetId: includedSteps0.action.fromToken.address,
      fromAmount: includedSteps0.action.fromAmount,
    },
  ];

  const _callData1 = tempStepData.transactionRequest.data;

  const _swapDatas = [];
  const _callDatas = [];

  _swapDatas.push(_swapData1);
  _callDatas.push(_callData1);

  if (mode == "multi") {
    _swapDatas.push(_swapData1);
    _callDatas.push(_callData1);
  }

  console.log("_swapData1:", _swapData1);

  const fee = !isNativeFrom
    ? 0
    : mode == "multi"
      ? BigNumber.from(_swapData1[0].fromAmount).add(BigNumber.from(_swapData1[0].fromAmount))
      : BigNumber.from(_swapData1[0].fromAmount);

  console.log("fee:", fee);

  if (!isNativeFrom) {
    const ERC20Contract = new ethers.Contract(_swapData1[0].sendingAssetId, erc20Abi.abi, deployer);
    console.log("Approve the ERC20 token to HecBridgeSplitter...");
    const approveAmount =
      mode == "multi"
        ? BigNumber.from(_swapData1[0].fromAmount).add(BigNumber.from(_swapData1[0].fromAmount))
        : BigNumber.from(_swapData1[0].fromAmount);
    console.log("Approve amount:", approveAmount);

    let txApprove = await ERC20Contract.connect(deployer).approve(
      HecBridgeSplitterAddress,
      approveAmount
    );

    await txApprove.wait();
    console.log("Done token allowance setting");
  }

  console.log("Mode:", mode);
  console.log("NativeFrom:", isNativeFrom);
  console.log("NativeTo:", isNativeTo);
  console.log("Executing swapTokensGeneric...");

  try {
    const result = await testHecBridgeSplitterContract.swapTokensGeneric(
      _swapDatas,
      _callDatas,
      {
        value: fee,
      }
    );

    const resultWait = await result.wait();
    console.log("Done bridge Tx:", resultWait.transactionHash);
  } catch (e) {
    console.log(e);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
