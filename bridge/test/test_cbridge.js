const hre = require("hardhat");
const { ethers } = require("hardhat");
const abi = require("../artifacts/contracts/HecBridgeSplitter.sol/HecBridgeSplitter.json");
const erc20Abi = require("../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json");
const { BigNumber } = require("@ethersproject/bignumber");
const tempData = require("./tempData.json");
const tempStepData = require("./tempStepData.json");
require("dotenv").config();

async function main() {
  const mode = "single"; // mode: single, multi
  const [deployer] = await hre.ethers.getSigners();
  console.log("Testing account:", deployer.address);
  // console.log("Account balance:", (await deployer.getBalance()).toString());

  const LifiBridge = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE";
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
  const mockCBridgeDatas = [];

  console.log("HecBridgeSplitter:", HecBridgeSplitterAddress);

  const originSteps = tempData.steps[0];

  const isNativeFrom = tempData.fromToken.address == ZERO_ADDRESS;
  const enableSwap = originSteps.includedSteps[0].type == "swap" ? true : false;
  const destinationCall = false

  const originCBridgeData = originSteps.includedSteps.find((element) => element.type == "cross")
    .estimate.data;
  const originSwapData = enableSwap && tempStepData.includedSteps[0];



  const mockBridgeData1 = {
    transactionId: tempData.id,
    bridge: originSteps.tool,
    integrator: originSteps.integrator,
    referrer: originSteps.referrer == "" ? ZERO_ADDRESS : ONE_ADDRESS,
    sendingAssetId: enableSwap
      ? (enableSwap && originSwapData.estimate.data.contractAddress)
        ? originSteps.estimate.data.destToken : originSteps.estimate.data.buyTokenAddress
      : tempData.fromToken.address,
    receiver: tempData.toAddress,
    minAmount: enableSwap
      ? (enableSwap && originSwapData.estimate.data.contractAddress)
        ? originSteps.estimate.data.destAmount : originSwapData.estimate.toAmountMin
      : tempData.fromToken.address,
    destinationChainId: tempData.toChainId,
    hasSourceSwaps: enableSwap,
    hasDestinationCall: destinationCall,
  };

  const mockCBridgeData1 = {
    maxSlippage: originCBridgeData.max_slippage,
    nonce: new Date().getTime()
  };

  const mockSwapData1 = (enableSwap && originSwapData.estimate.data.contractAddress)
    ? [
      {
        callTo: originSwapData.estimate.data.contractAddress,
        approveTo: originSwapData.estimate.data.tokenTransferProxy,
        sendingAssetId:
          (enableSwap && originSwapData.estimate.data.srcToken == ETH_ADDRESS) || isNativeFrom
            ? ZERO_ADDRESS
            : originSwapData.estimate.data.srcToken,
        receivingAssetId: originSwapData.estimate.data.destToken,
        fromAmount: originSwapData.estimate.data.srcAmount,
        callData: originSwapData.transactionRequest.data,
        requiresDeposit: true,
      },
    ] : [
      {
        callTo: originSwapData.estimate.approvalAddress,
        approveTo: originSwapData.estimate.approvalAddress,
        sendingAssetId:
          (enableSwap && originSwapData.estimate.data.sellTokenAddress == ETH_ADDRESS) || isNativeFrom
            ? ZERO_ADDRESS
            : originSwapData.estimate.data.sellTokenAddress,
        receivingAssetId: originSwapData.estimate.data.buyTokenAddress,
        fromAmount: originSwapData.estimate.fromAmount,
        callData: originSwapData.transactionRequest.data
          ? originSwapData.transactionRequest.data
          : "0x",
        requiresDeposit: true,
      },
    ];

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

  console.log("fee:", fee);

  mockBridgeDatas.push(mockBridgeData1);
  mockCBridgeDatas.push(mockCBridgeData1);
  mockBridgeData1.hasSourceSwaps && mockSwapDatas.push(mockSwapData1);

  if (mode == "multi") {
    mockBridgeDatas.push(mockBridgeData1);
    mockCBridgeDatas.push(mockCBridgeData1);
    mockBridgeData1.hasSourceSwaps && mockSwapDatas.push(mockSwapData1);
  }

  console.log("Mode:", mode);
  console.log("SwapEnable:", enableSwap);
  console.log("DestinationCall:", destinationCall);

  console.log("mockBridgeData1:", mockBridgeData1);
  console.log("mockCBridgeData1:", mockCBridgeData1);
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
        mockCBridgeDatas,
        fees,
        {
          value: fee,
        }
      )
      : await testHecBridgeSplitterContract.startBridgeTokensViaStargate(
        mockBridgeDatas,
        mockCBridgeDatas,
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
