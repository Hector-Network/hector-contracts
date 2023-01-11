import { BigNumber } from '@ethersproject/bignumber';
const hre = require('hardhat');
const { ethers } = require('hardhat');
const abi = require('../artifacts/contracts/HecBridgeSplitter.sol/HecBridgeSplitter.json');
const erc20Abi = require('../artifacts/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol/IERC20Upgradeable.json');
const tempData = require('./tempData.json');
const tempStepData = require('./tempStepData.json');
require('dotenv').config();

async function main() {
	let mode = 'single'; // mode: single, multi
	const [deployer] = await hre.ethers.getSigners();
	console.log('Testing account:', deployer.address);
	console.log('Account balance:', (await deployer.getBalance()).toString());

	const HecBridgeSplitterAddress = process.env.SPLITTER_ADDRESS;

	const testHecBridgeSplitterContract = new ethers.Contract(
		HecBridgeSplitterAddress,
		abi.abi,
		deployer
	);

	const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
	const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

	const mockBridgeDatas = [];
	const mockSwapDatas = [];
	const mockCallDatas = [];

	console.log('HecBridgeSplitter:', HecBridgeSplitterAddress);

	// Router Data
	const originSteps = tempData.steps[0];
	const isNativeFrom = tempData.fromToken.address == ZERO_ADDRESS;
	const enableSwap = originSteps.includedSteps[0].type == 'swap' ? true : false;
	// Step Data
	const originSwapData =
		enableSwap && tempStepData.includedSteps.find((element: any) => element.type == 'swap');

	console.log('Mode:', mode);
	console.log('isNativeFrom:', isNativeFrom)
	console.log('SwapEnable:', enableSwap);

	// BridgeData
	const mockBridgeData1 = {
		sendingAssetId: enableSwap ? originSwapData.action.toToken.address : tempData.fromToken.address,
		minAmount: enableSwap ? originSteps.estimate.toAmountMin : tempData.fromAmount,
	};
	// SwapData
	const mockSwapData1: any = enableSwap && [
		{
			sendingAssetId:
				(enableSwap && originSwapData.action.fromToken.address == ETH_ADDRESS) || isNativeFrom
					? ZERO_ADDRESS
					: originSwapData.action.fromToken.address,
			fromAmount: tempStepData.includedSteps[0].action.fromAmount,
		},
	];
	// CallData
	const mockCallData1 = tempStepData.transactionRequest.data;

	// Special Data
	let bridgeTool = originSteps.tool;
	let specialData: any;

	console.log('Bridge:', bridgeTool);

	if (bridgeTool == 'stargate') {
		specialData = tempStepData.includedSteps.find((element: any) => element.type == 'cross')
			.estimate.data.stargateData;
	}

	// Set Fees
	const fees: Array<BigNumber> = [];

	if (isNativeFrom) {
		if (bridgeTool == 'stargate') {
			fees.push(BigNumber.from(specialData.lzFee).add(BigNumber.from(mockSwapData1[0].fromAmount)));
			mode == 'multi' &&
				fees.push(
					BigNumber.from(specialData.lzFee).add(BigNumber.from(mockSwapData1[0].fromAmount))
				);
		} else if (bridgeTool == 'connext') {
			fees.push(BigNumber.from(mockSwapData1[0].fromAmount));
			mode == 'multi' && fees.push(BigNumber.from(mockSwapData1[0].fromAmount));
		}
	} else {
		if (bridgeTool == 'stargate') {
			fees.push(BigNumber.from(specialData.lzFee));
			mode == 'multi' && fees.push(BigNumber.from(specialData.lzFee));
		}
	}

	let fee = BigNumber.from(0);

	fees.map((item) => {
		fee = fee.add(item);
	});

	mockBridgeDatas.push(mockBridgeData1);
	enableSwap && mockSwapDatas.push(mockSwapData1);
	mockCallDatas.push(mockCallData1);

	if (mode == 'multi') {
		mockBridgeDatas.push(mockBridgeData1);
		enableSwap && mockSwapDatas.push(mockSwapData1);
		mockCallDatas.push(mockCallData1);
	}

	console.log('mockBridgeData1:', mockBridgeData1);
	console.log('mockSwapData1:', mockSwapData1);

	if (!isNativeFrom) {
		console.log('Approve the ERC20 token to HecBridgeSplitter...');
		let approveAmount;
		if (mode == 'multi' && enableSwap) {
			approveAmount = BigNumber.from(mockSwapData1[0].fromAmount).add(
				BigNumber.from(mockSwapData1[0].fromAmount)
			);
		}

		if (mode == 'single' && enableSwap) {
			approveAmount = BigNumber.from(mockSwapData1[0].fromAmount);
		}

		if (mode == 'multi' && !enableSwap) {
			approveAmount = BigNumber.from(mockBridgeData1.minAmount).add(
				BigNumber.from(mockBridgeData1.minAmount)
			);
		}

		if (mode == 'single' && !enableSwap) {
			approveAmount = BigNumber.from(mockBridgeData1.minAmount);
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
		console.log('Done token allowance setting');
	}

	console.log({ fee, fees });

	enableSwap
		? console.log('Executing swapAndStartBridgeTokens...')
		: console.log('Executing startBridgeTokens...');

	try {
		const result = enableSwap
			? await testHecBridgeSplitterContract.swapAndStartBridgeTokens(
					mockBridgeDatas,
					mockSwapDatas,
					fees,
					mockCallDatas,
					{
						value: fee,
					}
			  )
			: await testHecBridgeSplitterContract.startBridgeTokens(
					mockBridgeDatas,
					fees,
					mockCallDatas,
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
