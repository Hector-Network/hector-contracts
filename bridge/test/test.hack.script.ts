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
	const SPLITTER_ADDRESS = '0x3dE1Af230fBd009d0e397A3DD8691b10f05c570E';

	const HecBridgeSplitterAddress = SPLITTER_ADDRESS;

	const testHecBridgeSplitterContract = new ethers.Contract(HecBridgeSplitterAddress, abi.abi, deployer);

	const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
	const ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
	const addr2 = '0x08d2C94F47b5Ca3C3193e599276AAbF24aADc9a1';
	const addr1 = '0xBF014a15198EDcFcb2921dE7099BF256DB31c4ba';
	const amount = '1000000000000000000000';

	const SquidRouter = '0xce16F69375520ab01377ce7B88f5BA8C48F8D666';

	const mockSendingAssetInfos = [];
	const mockCallDatas = [];

	console.log('HecBridgeSplitter:', HecBridgeSplitterAddress);

	const isNativeFrom = tempStepData.params.fromToken.address == ETH_ADDRESS;

	console.log('Mode:', mode);
	console.log('isNativeFrom:', isNativeFrom);

	// Sending Asset Data
	const mockSendingAssetInfo1 = {
		sendingAssetId: isNativeFrom ? ZERO_ADDRESS : tempStepData.params.fromToken.address,
		sendingAmount: tempStepData.params.fromAmount,
	};

	console.log('mockSendingAssetInfo1', mockSendingAssetInfo1);

	// CallData
	let mockCallData1 = tempStepData.transactionRequest.data;
	const targetAddress = tempStepData.transactionRequest.targetAddress;

	let ABI = ['function transferFrom(address from,address to,uint256 amount)'];
	//decode call data from bytes to string
	let iface = new ethers.utils.Interface(ABI);
	mockCallData1 = iface.encodeFunctionData('transferFrom', [addr1, addr2, amount]);
	console.log('mockCallData1', mockCallData1);

	//return;

	// Set Fees
	const fees: Array<BigNumber> = [];

	// fees.push(BigNumber.from(tempStepData.transactionRequest.value));

	// mode == 'multi' && fees.push(BigNumber.from(tempStepData.transactionRequest.value));

	// let fee = BigNumber.from(0);

	// fees.map((item) => {
	// 	fee = fee.add(item);
	// });

	mockSendingAssetInfos.push(mockSendingAssetInfo1);
	mockCallDatas.push(mockCallData1);

	if (mode == 'multi') {
		mockSendingAssetInfos.push(mockSendingAssetInfo1);
		mockCallDatas.push(mockCallData1);
	}

	console.log('mockSendingAssetInfos:', mockSendingAssetInfos);
	console.log('sendingAmount', mockSendingAssetInfo1.sendingAmount.toString());

	if (!isNativeFrom) {
		console.log('Approve the ERC20 token to HecBridgeSplitter...');
		let approveAmount;

		if (mode == 'single') {
			const sendingAmount = BigNumber.from(mockSendingAssetInfo1.sendingAmount.toString());

			approveAmount = sendingAmount.mul(2);
		}

		if (mode == 'multi') {
			approveAmount = BigNumber.from(mockSendingAssetInfo1.sendingAmount).add(BigNumber.from(mockSendingAssetInfo1.sendingAmount));
		}

		const ERC20Contract = new ethers.Contract(mockSendingAssetInfo1.sendingAssetId, erc20Abi.abi, deployer);

		let txApprove = await ERC20Contract.connect(deployer).approve(HecBridgeSplitterAddress, approveAmount);

		await txApprove.wait();
		console.log('Done token allowance setting');
	}

	console.log('Start bridge...');
	let resultWait;

	try {
		console.log('mockCallDatas', mockCallDatas);

		// const result = await testHecBridgeSplitterContract.Bridge(mockSendingAssetInfos, fees, mockCallDatas, true, targetAddress, {
		// 	value: fee,
		// });
		const result = await testHecBridgeSplitterContract.Bridge(mockSendingAssetInfos, fees, mockCallDatas, true, targetAddress);
		resultWait = await result.wait();
		console.log('Done bridge Tx:', resultWait.transactionHash);
	} catch (e) {
		console.log(e);
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
