const hre = require("hardhat");
const { ethers } = require("hardhat");
const abi = require("../artifacts/contracts/HecBridgeSplitter.sol/HecBridgeSplitter.json");
const erc20Abi = require("../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json");
const { BigNumber } = require("@ethersproject/bignumber");
const tempData = require("./tempData.json");
require("dotenv").config();

async function main() {
  const mode = "single"; // mode: single, multi
  const [deployer] = await hre.ethers.getSigners();
  console.log("Testing account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  const isNativeFrom = tempData.action.fromToken.address == ZERO_ADDRESS;
  const isNativeTo = tempData.action.toToken.address == ZERO_ADDRESS;

  const HecBridgeSplitterAddress = "0x19Fc4D72A9D400A19540f41D3728027B89f5Ccd0";

  const testHecBridgeSplitterContract = new ethers.Contract(
    HecBridgeSplitterAddress,
    abi.abi,
    deployer
  );

  console.log("HecBridgeSplitter:", HecBridgeSplitterAddress);

  const includedSteps0 = tempData.includedSteps[0];

  const _transactionId1 = "0x640632755c04dc3f43d3026270fbed4bf2a67ad0c7e41c2a6c88944f5c2f55b1";
  const _integrator1 = tempData.integrator;
  const _referrer1 = tempData.referrer;
  const _receiver1 = tempData.action.toAddress;
  const _minAmount1 = tempData.estimate.toAmountMin;

  const _swapData1 = [
    {
      callTo: includedSteps0.estimate.approvalAddress,
      approveTo: includedSteps0.estimate.approvalAddress,
      sendingAssetId: includedSteps0.action.fromToken.address,
      receivingAssetId: includedSteps0.action.toToken.address,
      fromAmount: includedSteps0.action.fromAmount,
      callData: includedSteps0.transactionRequest.data,
      requiresDeposit: true,
    },
  ];

  const _transactionIds = [];
  const _integrators = [];
  const _referrers = [];
  const _receivers = [];
  const _minAmounts = [];
  const _swapDatas = [];

  _transactionIds.push(_transactionId1);
  _integrators.push(_integrator1);
  _referrers.push(_referrer1);
  _receivers.push(_receiver1);
  _minAmounts.push(_minAmount1);
  _swapDatas.push(_swapData1);

  if (mode == "multi") {
    _transactionIds.push(_transactionId1);
    _integrators.push(_integrator1);
    _referrers.push(_referrer1);
    _receivers.push(_receiver1);
    _minAmounts.push(_minAmount1);
    _swapDatas.push(_swapData1);
  }

  console.log("_transactionId1:", _transactionId1);
  console.log("_integrator1:", _integrator1);
  console.log("_referrer1:", _referrer1);
  console.log("_receiver1:", _receiver1);
  console.log("_minAmount1:", _minAmount1);
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
      _transactionIds,
      _integrators,
      _referrers,
      _receivers,
      _minAmounts,
      _swapDatas,
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
