const hre = require("hardhat");
const { ethers } = require("hardhat");
const abi = require("../artifacts/contracts/HecBridgeSplitter.sol/HecBridgeSplitter.json");
const erc20Abi = require("../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json");
const { BigNumber } = require("@ethersproject/bignumber");
const tempData = require("./tempData.json");
const { toNamespacedPath } = require("path");
require("dotenv").config();

async function main() {
  const mode = "single"; // mode: single, multi
  const [deployer] = await hre.ethers.getSigners();
  console.log("Testing account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const Bridge = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE";
  const HecBridgeSplitterAddress = "0x19Fc4D72A9D400A19540f41D3728027B89f5Ccd0";
  const USDC = "0x04068da6c83afcfa0e13ba15a6696662335d5b75";
  const DAI = "0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e";

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
  const enableSwap = originSteps.estimate.data.fromToken ? true : false;
  const destinationCall =
    originSteps.includedSteps[0].action.toAddress &&
    originSteps.includedSteps[0].action.toAddress != Bridge
      ? true
      : false;
      
  const mockBridgeData1 = {
    transactionId: tempData.id,
    bridge: originSteps.tool,
    integrator: originSteps.integrator,
    referrer: originSteps.referrer == "" ? ZERO_ADDRESS : ONE_ADDRESS,
    sendingAssetId: originSteps.estimate.data.fromToken
      ? originSteps.estimate.data.toToken.address
      : tempData.fromToken.address,
    receiver: tempData.toAddress,
    minAmount: originSteps.estimate.data.fromToken
      ? originSteps.estimate.data.toTokenAmount
      : tempData.fromAmount,
    destinationChainId: tempData.toChainId,
    hasSourceSwaps: enableSwap,
    hasDestinationCall: destinationCall,
  };

  const originStargateData = originSteps.estimate.data.fromToken
    ? originSteps.includedSteps[originSteps.includedSteps.length - 1].estimate.data.stargateData
    : originSteps.includedSteps[0].estimate.data.stargateData;

  const mockStargateData1 = {
    dstPoolId: originStargateData.dstPoolId,
    minAmountLD: originStargateData.minAmountLD,
    dstGasForCall: originStargateData.dstGasForCall,
    lzFee: originStargateData.lzFee,
    refundAddress: deployer.address,
    callTo: destinationCall ? originSteps.includedSteps[0].action.toAddress : tempData.toAddress,
    callData: originStargateData.callData,
  };

  const originSwapData = originSteps.includedSteps[0].estimate;
  const mockSwapData1 = mockBridgeData1.hasSourceSwaps && [
    {
      callTo: originSwapData.approvalAddress,
      approveTo: originSwapData.approvalAddress,
      sendingAssetId:
        originSwapData.data.fromToken.address == ETH_ADDRESS
          ? ZERO_ADDRESS
          : originSwapData.data.fromToken.address,
      receivingAssetId: originSwapData.data.toToken.address,
      fromAmount: originSwapData.fromAmount,
      callData: originSteps.includedSteps[0].transactionRequest.data
        ? originSteps.includedSteps[0].transactionRequest.data
        : "",
      requiresDeposit: true,
    },
  ];

  const isNativeFrom = tempData.fromToken.address == ZERO_ADDRESS;
  const isNativeTo = false;

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

  console.log("fee:", fee);

  mockBridgeDatas.push(mockBridgeData1);
  mockStargateDatas.push(mockStargateData1);
  mockBridgeData1.hasSourceSwaps && mockSwapDatas.push(mockSwapData1);

  if (mode == "multi") {
    mockBridgeDatas.push(mockBridgeData1);
    mockStargateDatas.push(mockStargateData1);
    mockBridgeData1.hasSourceSwaps && mockSwapDatas.push(mockSwapData1);
  }

  console.log("Mode:", mode);
  console.log("SwapEnable:", enableSwap);
  console.log("DestinationCall:", destinationCall);

  console.log("mockBridgeData1:", mockBridgeData1);
  console.log("mockStargateData1:", mockStargateData1);
  console.log("mockSwapData1:", mockSwapData1);

  return;

  if (!isNativeFrom) {
    console.log("Approve the ERC20 token to HecBridgeSplitter...");
    const approveAmount =
      mode == "multi"
        ? BigNumber.from(mockBridgeData1.minAmount).add(BigNumber.from(mockBridgeData1.minAmount))
        : BigNumber.from(mockBridgeData1.minAmount);
    const ERC20Contract = new ethers.Contract(
      mockBridgeData1.sendingAssetId,
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

  console.log("Executing startBridgeTokensViaStargate...");

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
