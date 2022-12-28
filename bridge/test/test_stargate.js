const hre = require("hardhat");
const { ethers } = require("hardhat");
const abi = require("../artifacts/contracts/HecBridgeSplitter.sol/HecBridgeSplitter.json");
const erc20Abi = require("../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json");
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

  const Bridge = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE";
  const HecBridgeSplitterAddress = "0x19Fc4D72A9D400A19540f41D3728027B89f5Ccd0";

  const testHecBridgeSplitterContract = new ethers.Contract(
    HecBridgeSplitterAddress,
    abi.abi,
    deployer
  );

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const ONE_ADDRESS = "0x0000000000000000000000000000000000000001";
  const ETH_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

  const mockBridgeDatas = [];
  const mockSwapDatas = [];
  const mockStargateDatas = [];

  console.log("HecBridgeSplitter:", HecBridgeSplitterAddress);

  const originSteps = tempData.steps[0];
  const originStargateData = tempStepData.includedSteps.find((element) => element.type == "cross")
    .estimate.data.stargateData;

  const isNativeFrom = tempData.fromToken.address == ZERO_ADDRESS;
  const enableSwap = originSteps.includedSteps[0].type == "swap" ? true : false;
  const destinationCall =
    originStargateData.callTo != Bridge && originStargateData.callTo != tempData.toAddress
      ? true
      : false;

  console.log("Mode:", mode);
  console.log("SwapEnable:", enableSwap);
  console.log("DestinationCall:", destinationCall);

  const mockBridgeData1 = {
    transactionId: "0x1eddd3c2b895ad225d6d2f4fb68c36a5ca1c73f8dfa9a3158e595f9209bd0a86",
    bridge: originSteps.tool,
    integrator: originSteps.integrator,
    referrer: originSteps.referrer == "" ? ZERO_ADDRESS : ONE_ADDRESS,
    sendingAssetId: enableSwap
      ? originSteps.estimate.data.toToken.address
      : tempData.fromToken.address,
    receiver: tempData.toAddress,
    minAmount: enableSwap ? originSteps.estimate.data.toTokenAmount : tempData.fromAmount,
    destinationChainId: tempData.toChainId,
    hasSourceSwaps: enableSwap,
    hasDestinationCall: destinationCall,
  };

  const mockBridgeData2 = {
    transactionId: "0x1eddd3c2b895ad225d6d2f4fb68c36a5ca1c73f8dfa9a3158e595f9209bd0a87",
    bridge: originSteps.tool,
    integrator: originSteps.integrator,
    referrer: originSteps.referrer == "" ? ZERO_ADDRESS : ONE_ADDRESS,
    sendingAssetId: enableSwap
      ? originSteps.estimate.data.toToken.address
      : tempData.fromToken.address,
    receiver: tempData.toAddress,
    minAmount: enableSwap ? originSteps.estimate.data.toTokenAmount : tempData.fromAmount,
    destinationChainId: tempData.toChainId,
    hasSourceSwaps: enableSwap,
    hasDestinationCall: destinationCall,
  };

  const mockStargateData1 = {
    dstPoolId: originStargateData.dstPoolId,
    minAmountLD: originStargateData.minAmountLD,
    dstGasForCall: originStargateData.dstGasForCall,
    lzFee: originStargateData.lzFee,
    refundAddress: deployer.address,
    callTo: destinationCall ? originStargateData.callTo : tempData.toAddress,
    callData: originStargateData.callData,
  };

  const originSwapData = tempStepData.includedSteps[0].estimate;
  const mockSwapData1 = mockBridgeData1.hasSourceSwaps && [
    {
      callTo: originSwapData.approvalAddress,
      approveTo: originSwapData.approvalAddress,
      sendingAssetId:
        (enableSwap && originSwapData.data.fromToken.address == ETH_ADDRESS) || isNativeFrom
          ? ZERO_ADDRESS
          : originSwapData.data.fromToken.address,
      receivingAssetId: tempStepData.includedSteps[0].action.toToken.address,
      fromAmount: tempStepData.includedSteps[0].action.fromAmount,
      callData: tempStepData.includedSteps[0].transactionRequest && tempStepData.includedSteps[0].transactionRequest.data
        ? tempStepData.includedSteps[0].transactionRequest.data
        : "0x",
      requiresDeposit: true,
    },
  ];



  const fees = [];

  if (isNativeFrom) {
    fees.push(
      BigNumber.from(mockStargateData1.lzFee).add(BigNumber.from(mockSwapData1[0].fromAmount))
    );
    mode == "multi" &&
      fees.push(
        BigNumber.from(mockStargateData1.lzFee).add(BigNumber.from(mockSwapData1[0].fromAmount))
      );
  } else {
    fees.push(BigNumber.from(mockStargateData1.lzFee));
    mode == "multi" && fees.push(BigNumber.from(mockStargateData1.lzFee));
  }

  let fee = BigNumber.from(0);

  fees.map((item) => {
    fee = fee.add(item);
  });



  mockBridgeDatas.push(mockBridgeData1);
  mockStargateDatas.push(mockStargateData1);
  mockBridgeData1.hasSourceSwaps && mockSwapDatas.push(mockSwapData1);

  if (mode == "multi") {
    mockBridgeDatas.push(mockBridgeData2);
    mockStargateDatas.push(mockStargateData1);
    mockBridgeData1.hasSourceSwaps && mockSwapDatas.push(mockSwapData1);
  }

  console.log("mockBridgeData1:", mockBridgeData1);
  console.log("mockStargateData1:", mockStargateData1);
  console.log("mockSwapData1:", mockSwapData1);

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

  console.log({ fee, fees });

  mockBridgeData1.hasSourceSwaps
    ? console.log("Executing swapAndStartBridgeTokensViaStargate...")
    : console.log("Executing startBridgeTokensViaStargate...")

  try {
    const result = mockBridgeData1.hasSourceSwaps
      ? await testHecBridgeSplitterContract.swapAndStartBridgeTokensViaStargate(
        mockBridgeDatas,
        mockSwapDatas,
        mockStargateDatas,
        fees,
        {
          value: fee,
        }
      )
      : await testHecBridgeSplitterContract.startBridgeTokensViaStargate(
        mockBridgeDatas,
        mockStargateDatas,
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
