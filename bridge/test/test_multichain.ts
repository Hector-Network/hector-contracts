import { BigNumber } from '@ethersproject/bignumber';
const hre = require('hardhat');
const { ethers } = require('hardhat');
const abi = require('../artifacts/contracts/HecBridgeSplitter.sol/HecBridgeSplitter.json');
const erc20Abi = require('../artifacts/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol/IERC20Upgradeable.json');
const tempData = require('./tempData.json');
const tempStepData = require('./tempStepData.json');
require('dotenv').config();

/**
 * Multichain bridge only has single swap
 * After bridged user can use swapgeneric function on the other chain
 */

async function main() {
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

	const originSteps = tempData.steps[0];
	const isNativeFrom = tempData.fromToken.address == ZERO_ADDRESS;
	const enableSwap = originSteps.includedSteps[0].type == 'swap' ? true : false;
	const originIncludedStepSwapData =
		enableSwap && tempStepData.includedSteps.find((element: any) => element.type == 'swap');

	console.log('SwapEnable:', enableSwap);
	console.log('isNativeFrom:', isNativeFrom);

	const mockBridgeData1 = {
		sendingAssetId: tempData.fromToken.address,
		minAmount: tempData.fromAmount,
	};

	type swapData = {
		sendingAssetId: string;
		fromAmount: BigNumber;
	};

	const mockSwapData1: any = enableSwap && [
		{
			sendingAssetId:
				(enableSwap && originIncludedStepSwapData.action.fromToken.address == ETH_ADDRESS) ||
				isNativeFrom
					? ZERO_ADDRESS
					: originIncludedStepSwapData.action.fromToken.address,
			fromAmount: BigNumber.from(tempStepData.includedSteps[0].action.fromAmount),
		},
	];

	const mockMultichainCallData1 = tempStepData.transactionRequest.data;

	const fees: BigNumber[] = [];

	if (isNativeFrom && enableSwap) {
		fees.push(BigNumber.from(mockSwapData1[0].fromAmount));
	}

	let fee = BigNumber.from(0);

	fees.map((item) => {
		fee = fee.add(item);
	});

	mockBridgeDatas.push(mockBridgeData1);
	enableSwap && mockSwapDatas.push(mockSwapData1);
	mockCallDatas.push(mockMultichainCallData1);

	console.log('mockBridgeData1:', mockBridgeData1);
	console.log('mockSwapData1:', mockSwapData1);
	console.log({ fee, fees });

	if (!isNativeFrom) {
		console.log('Approve the ERC20 token to HecBridgeSplitter...');
		let approveAmount;

		if (enableSwap) {
			approveAmount = BigNumber.from(mockSwapData1[0].fromAmount);
		}

		if (!enableSwap) {
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

	enableSwap
		? console.log('Executing swapAndStartBridgeTokensViaMultichain...')
		: console.log('Executing startBridgeTokensViaMultichain...');

	try {
		const result = enableSwap
			? await testHecBridgeSplitterContract.swapAndStartBridgeTokensViaMultichain(
					mockBridgeDatas,
					mockSwapDatas,
					fees,
					mockCallDatas,
					{
						value: fee,
					}
			  )
			: await testHecBridgeSplitterContract.startBridgeTokensViaMultichain(
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
