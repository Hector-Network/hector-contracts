import { BigNumber } from '@ethersproject/bignumber';
const hre = require('hardhat');
const { ethers } = require('hardhat');
const abi = require('../artifacts/contracts/HecBridgeSplitter.sol/HecBridgeSplitter.json');
const erc20Abi = require('../artifacts/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol/IERC20Upgradeable.json');
const tempStepData = require('./tempStepData.json');
require('dotenv').config();

const calcFee = () => {

}

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
	const ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

	const mockSendingAssetInfos = [];
	const mockCallDatas = [];

	console.log('HecBridgeSplitter:', HecBridgeSplitterAddress);

	const isNativeFrom = tempStepData.params.fromToken.address == ETH_ADDRESS;

	console.log('Mode:', mode);
	console.log('isNativeFrom:', isNativeFrom);

	// Sending Asset Data
	const mockSendingAssetInfo1 = {
		sendingAssetId: isNativeFrom
			? ZERO_ADDRESS
			: tempStepData.params.fromToken.address,
		sendingAmount: tempStepData.params.fromAmount, // This is calculated amount except fee for using Bridge 
		totalAmount: BigNumber.from(tempStepData.params.fromAmount).mul(100000).div(100000 - 75), // Mock Total Amount
		feePercentage: 75 // MockFee - 0.075%
	};

	// CallData
	const mockCallData1 = tempStepData.transactionRequest.data;
	const targetAddress = tempStepData.transactionRequest.targetAddress;

	// Set Fees
	const fees: Array<BigNumber> = [];

	fees.push(
		BigNumber.from(tempStepData.transactionRequest.value)
	);

	mode == 'multi' &&
		fees.push(
			BigNumber.from(tempStepData.transactionRequest.value)
		);

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

	console.log('mockSendingAssetInfos:', mockSendingAssetInfos);

	if (!isNativeFrom) {
		console.log('Approve the ERC20 token to HecBridgeSplitter...');
		let approveAmount;

		if (mode == 'single') {
			approveAmount = BigNumber.from(mockSendingAssetInfo1.totalAmount);
		}

		if (mode == 'multi') {
			approveAmount = BigNumber.from(mockSendingAssetInfo1.totalAmount).add(
				BigNumber.from(mockSendingAssetInfo1.totalAmount)
			);
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
	console.log({ useSquid: true, targetAddress });
	console.log('Start bridge...');

	try {
		const result = await testHecBridgeSplitterContract.Bridge(
			mockSendingAssetInfos,
			fees,
			mockCallDatas,
			true,
			targetAddress,
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
