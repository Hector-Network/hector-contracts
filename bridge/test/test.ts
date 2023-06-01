import { BigNumber } from '@ethersproject/bignumber';
const hre = require('hardhat');
const { ethers } = require('hardhat');
const abi = require('../artifacts/contracts/HecBridgeSplitter.sol/HecBridgeSplitter.json');
const erc20Abi = require('../artifacts/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol/IERC20Upgradeable.json');
const tempStepData = require('./tempStepData.json');
require('dotenv').config();

async function main() {
	let mode = 'single'; // mode: single, multi
	const [deployer] = await hre.ethers.getSigners();
	console.log('Testing account:', deployer.address);
	console.log('Account balance:', (await deployer.getBalance()).toString());
	const SPLITTER_ADDRESS = "0x33239FE64E6CECb364e6A42f66bbdB714Fe89d7b";

	const HecBridgeSplitterAddress = SPLITTER_ADDRESS;

	const testHecBridgeSplitterContract = new ethers.Contract(
		HecBridgeSplitterAddress,
		abi.abi,
		deployer
	);

	const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
	const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

	const mockSendingAssetInfos = [];
	const mockCallDatas = [];

	console.log('HecBridgeSplitter:', HecBridgeSplitterAddress);

	const isNativeFrom = tempStepData.action.fromToken.address == ZERO_ADDRESS;
	const enableSwap = tempStepData.includedSteps[0].type == 'swap' ? true : false;

	// Step Data
	const originSwapData =
		enableSwap && tempStepData.includedSteps.find((element: any) => element.type == 'swap');

	console.log('Mode:', mode);
	console.log('isNativeFrom:', isNativeFrom);
	console.log('SwapEnable:', enableSwap);

	// Sending Asset Data
	const mockSendingAssetInfo1 = {
		sendingAssetId: enableSwap
			? originSwapData.action.fromToken.address == ETH_ADDRESS || isNativeFrom
				? ZERO_ADDRESS
				: originSwapData.action.fromToken.address
			: tempStepData.action.fromToken.address,
		sendingAmount: enableSwap ? originSwapData.action.fromAmount : tempStepData.action.fromAmount,
		totalAmount: enableSwap
			? BigNumber.from(originSwapData.action.fromAmount).mul(100000).div(100000 - 75)
			: BigNumber.from(tempStepData.action.fromAmount).mul(100000).div(100000 - 75),
		feePercentage: 75
	};
	// CallData
	const mockCallData1 = tempStepData.transactionRequest.data;

	// Special Data
	let bridgeTool = tempStepData.tool;
	let specialData: any;

	console.log('Bridge:', bridgeTool);

	if (bridgeTool == 'stargate') {
		specialData = tempStepData.estimate.feeCosts.find((element: any) => element.name == 'LayerZero fees');
	}

	// Set Fees
	const fees: Array<BigNumber> = [];

	if (isNativeFrom) {
		if (bridgeTool == 'stargate') {
			fees.push(
				BigNumber.from(specialData.amount).add(BigNumber.from(mockSendingAssetInfo1.sendingAmount))
			);
			mode == 'multi' &&
				fees.push(
					BigNumber.from(specialData.amount).add(BigNumber.from(mockSendingAssetInfo1.sendingAmount))
				);
		} else {
			fees.push(BigNumber.from(mockSendingAssetInfo1.sendingAmount));
			mode == 'multi' && fees.push(BigNumber.from(mockSendingAssetInfo1.sendingAmount));
		}
	} else {
		if (bridgeTool == 'stargate') {
			fees.push(BigNumber.from(specialData.amount));
			mode == 'multi' && fees.push(BigNumber.from(specialData.amount));
		}
	}

	let feesForNative: Array<BigNumber> = [];
	if (isNativeFrom) {
		feesForNative.push(BigNumber.from(mockSendingAssetInfo1.totalAmount).mul(mockSendingAssetInfo1.feePercentage).div(1000));
		mode == 'multi' &&
			feesForNative.push(BigNumber.from(mockSendingAssetInfo1.totalAmount).mul(mockSendingAssetInfo1.feePercentage).div(1000));
	}

	let fee = BigNumber.from(0);

	fees.map((item) => {
		fee = fee.add(item);
	});

	feesForNative.map((item) => {
		fee = fee.add(item);
	})

	mockSendingAssetInfos.push(mockSendingAssetInfo1);
	mockCallDatas.push(mockCallData1);

	if (mode == 'multi') {
		mockSendingAssetInfos.push(mockSendingAssetInfo1);
		mockCallDatas.push(mockCallData1);
	}

	console.log('mockSendingAssetInfo1:', mockSendingAssetInfo1);

	if (!isNativeFrom) {
		console.log('Approve the ERC20 token to HecBridgeSplitter...');
		let approveAmount;
		if (mode == 'multi' && enableSwap) {
			approveAmount = BigNumber.from(mockSendingAssetInfo1.totalAmount).add(
				BigNumber.from(mockSendingAssetInfo1.totalAmount)
			);
		}

		if (mode == 'single' && enableSwap) {
			approveAmount = BigNumber.from(mockSendingAssetInfo1.totalAmount);
		}

		if (mode == 'multi' && !enableSwap) {
			approveAmount = BigNumber.from(mockSendingAssetInfo1.totalAmount).add(
				BigNumber.from(mockSendingAssetInfo1.totalAmount)
			);
		}

		if (mode == 'single' && !enableSwap) {
			approveAmount = BigNumber.from(mockSendingAssetInfo1.totalAmount);
		}

		const ERC20Contract = new ethers.Contract(
			mockSendingAssetInfo1.sendingAssetId,
			erc20Abi.abi,
			deployer
		);

		let txApprove = await ERC20Contract.connect(deployer).approve(
			HecBridgeSplitterAddress,
			approveAmount
		);
		await txApprove.wait();
		console.log('Done token allowance setting');
	}

	console.log({ fee, fees });
	console.log('Start bridge...');

	try {
		const result = await testHecBridgeSplitterContract.Bridge(
			mockSendingAssetInfos,
			fees,
			mockCallDatas,
			false,
			ZERO_ADDRESS,
			{
				value: fee,
			}
		);
		const resultWait = await result.wait();
		console.log('Done bridge Tx:', resultWait.transactionHash);
	} catch (e) {
		console.log(e);
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
