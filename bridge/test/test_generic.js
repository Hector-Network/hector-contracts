const hre = require("hardhat");
const { ethers } = require("hardhat");
const abi = require("../artifacts/contracts/HecBridgeSplitter.sol/HecBridgeSplitter.json");
const erc20Abi = require("../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json");
const { BigNumber } = require("@ethersproject/bignumber");
require("dotenv").config();

async function main() {
  const mode = "multi"; // mode: single, multi
  const isNativeFrom = false;
  const isNativeTo = true;
  const [deployer] = await hre.ethers.getSigners();
  console.log("Testing account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const USDC = "0x04068da6c83afcfa0e13ba15a6696662335d5b75";
  const DAI = "0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e";
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const ONE_ADDRESS = "0x0000000000000000000000000000000000000001";

  const HecBridgeSplitterAddress = "0x19Fc4D72A9D400A19540f41D3728027B89f5Ccd0";

  const testHecBridgeSplitterContract = new ethers.Contract(
    HecBridgeSplitterAddress,
    abi.abi,
    deployer
  );

  console.log("HecBridgeSplitter:", HecBridgeSplitterAddress);

  const _transactionId1 = "0xa8965892da93856105fbc199540b9094f4d117ccd734292fd4c8ea1b03dfb19a";
  const _integrator1 = "transferto.xyz";
  const _referrer1 = ONE_ADDRESS;
  const _receiver1 = "0xda66b6206bbaea5213a5065530858a3fd6ee1ec4";
  const _minAmount1 = isNativeTo
    ? "42832903188171412"
    : isNativeFrom
    ? "22950344068863093"
    : "9925";

  const _swapData1 = [
    {
      callTo: "0xF491e7B69E4244ad4002BC14e878a34207E38c29",
      approveTo: "0xF491e7B69E4244ad4002BC14e878a34207E38c29",
      sendingAssetId: isNativeFrom ? ZERO_ADDRESS : USDC,
      receivingAssetId: isNativeTo ? ZERO_ADDRESS : isNativeFrom ? DAI : USDC,
      fromAmount: isNativeTo ? "10000" : isNativeFrom ? "100000000000000000" : "10000000000000000",
      callData: isNativeTo
        ? "0x18cbafe5000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000982c4c6b3aca9400000000000000000000000000000000000000000000000000000000000000a00000000000000000000000001231deb6f5749ef6ce6943a275a1d3e7486f4eae00000000000000000000000000000000000000000000000000000000639c2933000000000000000000000000000000000000000000000000000000000000000200000000000000000000000004068da6c83afcfa0e13ba15a6696662335d5b7500000000000000000000000021be370d5312f44cb42ce377bc9b8a0cef1a4c83"
        : isNativeFrom
        ? "0x7ff36ab50000000000000000000000000000000000000000000000000051893761b2947500000000000000000000000000000000000000000000000000000000000000800000000000000000000000001231deb6f5749ef6ce6943a275a1d3e7486f4eae00000000000000000000000000000000000000000000000000000000639c200c000000000000000000000000000000000000000000000000000000000000000200000000000000000000000021be370d5312f44cb42ce377bc9b8a0cef1a4c830000000000000000000000008d11ec38a3eb5e956b052f67da8bdc9bef8abf3e"
        : "0x38ed1739000000000000000000000000000000000000000000000000002386f26fc1000000000000000000000000000000000000000000000000000000000000000026c500000000000000000000000000000000000000000000000000000000000000a00000000000000000000000001231deb6f5749ef6ce6943a275a1d3e7486f4eae00000000000000000000000000000000000000000000000000000000639c12c100000000000000000000000000000000000000000000000000000000000000020000000000000000000000008d11ec38a3eb5e956b052f67da8bdc9bef8abf3e00000000000000000000000004068da6c83afcfa0e13ba15a6696662335d5b75",
      requiresDeposit: true,
    },
  ];

  const _transactionId2 = "0xa8965892da93856105fbc199540b9094f4d117ccd734292fd4c8ea1b03dfb19a";
  const _integrator2 = "transferto.xyz";
  const _referrer2 = ONE_ADDRESS;
  const _receiver2 = "0xda66b6206bbaea5213a5065530858a3fd6ee1ec4";
  const _minAmount2 = isNativeTo
    ? "42832903188171412"
    : isNativeFrom
    ? "22950344068863093"
    : "9925";

  const _swapData2 = [
    {
      callTo: "0xF491e7B69E4244ad4002BC14e878a34207E38c29",
      approveTo: "0xF491e7B69E4244ad4002BC14e878a34207E38c29",
      sendingAssetId: isNativeFrom ? ZERO_ADDRESS : USDC,
      receivingAssetId: isNativeTo ? ZERO_ADDRESS : isNativeFrom ? DAI : USDC,
      fromAmount: isNativeTo ? "10000" : isNativeFrom ? "100000000000000000" : "10000000000000000",
      callData: isNativeTo
        ? "0x18cbafe5000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000982c4c6b3aca9400000000000000000000000000000000000000000000000000000000000000a00000000000000000000000001231deb6f5749ef6ce6943a275a1d3e7486f4eae00000000000000000000000000000000000000000000000000000000639c2933000000000000000000000000000000000000000000000000000000000000000200000000000000000000000004068da6c83afcfa0e13ba15a6696662335d5b7500000000000000000000000021be370d5312f44cb42ce377bc9b8a0cef1a4c83"
        : isNativeFrom
        ? "0x7ff36ab50000000000000000000000000000000000000000000000000051893761b2947500000000000000000000000000000000000000000000000000000000000000800000000000000000000000001231deb6f5749ef6ce6943a275a1d3e7486f4eae00000000000000000000000000000000000000000000000000000000639c200c000000000000000000000000000000000000000000000000000000000000000200000000000000000000000021be370d5312f44cb42ce377bc9b8a0cef1a4c830000000000000000000000008d11ec38a3eb5e956b052f67da8bdc9bef8abf3e"
        : "0x38ed1739000000000000000000000000000000000000000000000000002386f26fc1000000000000000000000000000000000000000000000000000000000000000026c500000000000000000000000000000000000000000000000000000000000000a00000000000000000000000001231deb6f5749ef6ce6943a275a1d3e7486f4eae00000000000000000000000000000000000000000000000000000000639c12c100000000000000000000000000000000000000000000000000000000000000020000000000000000000000008d11ec38a3eb5e956b052f67da8bdc9bef8abf3e00000000000000000000000004068da6c83afcfa0e13ba15a6696662335d5b75",
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
    _transactionIds.push(_transactionId2);
    _integrators.push(_integrator2);
    _referrers.push(_referrer2);
    _receivers.push(_receiver2);
    _minAmounts.push(_minAmount2);
    _swapDatas.push(_swapData2);
  }

  const fee = !isNativeFrom
    ? 0
    : mode == "multi"
    ? BigNumber.from(_swapData1[0].fromAmount).add(BigNumber.from(_swapData2[0].fromAmount))
    : BigNumber.from(_swapData1[0].fromAmount);

  console.log("fee:", fee);

  if (!isNativeFrom) {
    console.log("Approve the ERC20 token to HecBridgeSplitter...");
    const ERC20Contract = new ethers.Contract(_swapData1[0].sendingAssetId, erc20Abi.abi, deployer);
    const approveAmount =
      mode == "multi"
        ? BigNumber.from(_swapData1[0].fromAmount).add(BigNumber.from(_swapData2[0].fromAmount))
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
    console.log("Done bridge Tx:", resultWait);
  } catch (e) {
    console.log(e);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
