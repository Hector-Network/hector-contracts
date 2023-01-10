const hre = require("hardhat");
const { ethers } = require("hardhat");
const abi = require("../artifacts/contracts/HecBridgeSplitter.sol/HecBridgeSplitter.json");
const erc20Abi = require("../artifacts/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol/IERC20Upgradeable.json");
const { BigNumber } = require("@ethersproject/bignumber");
const tempData = require("./tempData.json");
const tempStepData = require("./tempStepData.json");
require("dotenv").config();

/**
 * When native => native trasactionrequest.data is needed
 * When native => erc20 trasactionrequest.data is needed
 */

async function main() {
  const mode = "single"; // mode: single, multi
  const [deployer] = await hre.ethers.getSigners();
  console.log("Testing account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const HecBridgeSplitterAddress = process.env.SPLITTER_ADDRESS;

  const testHecBridgeSplitterContract = new ethers.Contract(
    HecBridgeSplitterAddress,
    abi.abi,
    deployer
  );

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const ETH_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

  const mockBridgeDatas = [];
  const mockSwapDatas = [];
  const mockCallDatas = [];

  console.log("HecBridgeSplitter:", HecBridgeSplitterAddress);

  const originSteps = tempData.steps[0];

  const isNativeFrom = tempData.fromToken.address == ZERO_ADDRESS;
  const enableSwap = originSteps.includedSteps[0].type == "swap" ? true : false;

  const originIncludedStepSwapData = enableSwap && tempStepData.includedSteps.find((element) => element.type == "swap")

  console.log("Mode:", mode);
  console.log("SwapEnable:", enableSwap);
  console.log("isNativeFrom:", isNativeFrom);

  const mockBridgeData1 = {
    sendingAssetId: enableSwap
      ? originIncludedStepSwapData.action.toToken.address
      : tempData.fromToken.address,
    minAmount: enableSwap ? originIncludedStepSwapData.estimate.toAmountMin : tempData.fromAmount,
  };

  const mockSwapData1 = enableSwap && [
    {
      sendingAssetId:
        (enableSwap && originIncludedStepSwapData.action.fromToken.address == ETH_ADDRESS) || isNativeFrom
          ? ZERO_ADDRESS
          : originIncludedStepSwapData.action.fromToken.address,
      fromAmount: tempStepData.includedSteps[0].action.fromAmount,
    },
  ];

  const mockCallData1 = tempStepData.transactionRequest.data;

  const fees = [];

  if (isNativeFrom) {
    fees.push(
      BigNumber.from(mockSwapData1[0].fromAmount)
    );
    mode == "multi" &&
      fees.push(
        BigNumber.from(mockSwapData1[0].fromAmount)
      );
  } 

  let fee = BigNumber.from(0);

  fees.map((item) => {
    fee = fee.add(item);
  });

  mockBridgeDatas.push(mockBridgeData1);
  enableSwap && mockSwapDatas.push(mockSwapData1);
  mockCallDatas.push(mockCallData1);

  if (mode == "multi") {
    mockBridgeDatas.push(mockBridgeData1);
    enableSwap && mockSwapDatas.push(mockSwapData1);
    mockCallDatas.push(mockCallData1);
  }

  console.log("mockBridgeData1:", mockBridgeData1);
  console.log("mockSwapData1:", mockSwapData1);
  
  console.log({ fee, fees });

  if (!isNativeFrom) {
    console.log("Approve the ERC20 token to HecBridgeSplitter...");
    let approveAmount;
    if (mode == "multi" && enableSwap) {
      approveAmount = BigNumber.from(mockSwapData1[0].fromAmount).add(BigNumber.from(mockSwapData1[0].fromAmount))
    }

    if (mode == "single" && enableSwap) {
      approveAmount = BigNumber.from(mockSwapData1[0].fromAmount)
    }

    if (mode == "multi" && !enableSwap) {
      approveAmount = BigNumber.from(mockBridgeData1.minAmount).add(BigNumber.from(mockBridgeData1.minAmount))
    }

    if (mode == "single" && !enableSwap) {
      approveAmount = BigNumber.from(mockBridgeData1.minAmount)
    }

    const ERC20Contract = new ethers.Contract(
      enableSwap ? mockSwapData1[0].sendingAssetId : mockBridgeData1.sendingAssetId,
      erc20Abi.abi,
      deployer
    );

    let txApprove = await ERC20Contract.connect(deployer).approve(
      HecBridgeSplitterAddress,
      approveAmount
    );
    await txApprove.wait();
    console.log("Done token allowance setting");
  }

  enableSwap
    ? console.log("Executing swapAndStartBridgeTokensViaNXTP...")
    : console.log("Executing startBridgeTokensViaNXTP...")

  try {
    const result = enableSwap
      ? await testHecBridgeSplitterContract.swapAndStartBridgeTokensViaNXTP(
        mockBridgeDatas,
        mockSwapDatas,
        fees,
        mockCallDatas,
        {
          value: fee,
        }
      )
      : await testHecBridgeSplitterContract.startBridgeTokensViaNXTP(
        mockBridgeDatas,
        fees,
        mockCallDatas,
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
