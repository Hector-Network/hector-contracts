import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { BigNumber, BigNumberish, utils } from 'ethers';
import { increaseTime, getTimeStamp } from '../helper';
import { RewardToken, HecBridgeSplitter } from '../types';
import tempStepData from './tempStepData.json';
//require('dotenv').config();

describe('Hector Bridge', function () {
	let deployer: SignerWithAddress;
	let bridge1: SignerWithAddress;
	let bridge2: SignerWithAddress;
	let owner: SignerWithAddress;
	let dao: SignerWithAddress;

	let testToken: RewardToken;
	let hectorBridge: HecBridgeSplitter;

	beforeEach(async function () {
		[deployer, bridge1, bridge2, owner, dao] = await ethers.getSigners();

		const TokenFactory = await ethers.getContractFactory('RewardToken');
		testToken = (await TokenFactory.deploy()) as RewardToken;

		const HectorBridge = await ethers.getContractFactory('HecBridgeSplitter');
		await upgrades.silenceWarnings();
		hectorBridge = (await upgrades.deployProxy(HectorBridge, [2], {
			unsafeAllow: ['delegatecall'],
		})) as HecBridgeSplitter;
	});

	describe('#Test Bridge Whitelisting', () => {
		it('Unable to add bridge if not owner', async function () {
			await expect(hectorBridge.connect(owner).addToWhiteList(bridge1.address)).to.be.revertedWith('Ownable: caller is not the owner');
		});

		it('Add duplicated bridge contract', async function () {
			await hectorBridge.connect(deployer).addToWhiteList(bridge1.address);
			await expect(hectorBridge.connect(deployer).addToWhiteList(bridge1.address)).to.be.revertedWith('Address already exists');
		});

		it('IsWhiteList to true after adding', async function () {
			await hectorBridge.connect(deployer).addToWhiteList(bridge1.address);
			expect(await hectorBridge.connect(deployer).isInWhiteList(bridge1.address)).equal(true);
		});

		it('IsWhiteList to false after removing', async function () {
			await hectorBridge.connect(deployer).addToWhiteList(bridge1.address);
			await hectorBridge.connect(deployer).removeFromWhiteList(bridge1.address);
			expect(await hectorBridge.connect(deployer).isInWhiteList(bridge1.address)).equal(false);
		});
	});

	describe('#Test Bridge Operation', () => {
		let mockSendingAssetInfos: any[] = [];
		let mockCallDatas: any[] = [];
		let fees: Array<BigNumber> = [];

		let mockSendingAssetInfo1: {
			sendingAssetId: string;
			sendingAmount: BigNumber;
			totalAmount: BigNumber;
			feeAmount: BigNumber;
		};

		beforeEach(async function () {
			mockSendingAssetInfo1 = {
				sendingAssetId: testToken.address, //tempStepData.params.fromToken.address,
				sendingAmount: BigNumber.from(tempStepData.params.fromAmount),
				totalAmount: BigNumber.from(tempStepData.params.totalAmount),
				feeAmount: BigNumber.from(tempStepData.params.feeAmount),
			};

			//console.log('mockSendingAssetInfo1', mockSendingAssetInfo1);

			let mockCallData1 = tempStepData.transactionRequest.data;
			const targetAddress = tempStepData.transactionRequest.targetAddress;

			let ABI = ['function transferFrom(address from,address to,uint256 amount)'];
			//decode call data from bytes to string
			let iface = new ethers.utils.Interface(ABI);
			const amount = '1000000000000000000000';
			mockCallData1 = iface.encodeFunctionData('transferFrom', [owner.address, deployer.address, amount]);
			//console.log('mockCallData1', mockCallData1);

			mockSendingAssetInfos.push(mockSendingAssetInfo1);
			mockCallDatas.push(mockCallData1);

			await testToken.mint(deployer.address, utils.parseEther('20000000000000000000000'));
			await testToken.connect(deployer).approve(hectorBridge.address, utils.parseEther('1000000000000000001000'));
		});

		it('DAO To Receive Fees', async function () {
			await hectorBridge.connect(deployer).addToWhiteList(bridge1.address);
			await hectorBridge.connect(deployer).setDAO(dao.address);

			const balanceBefore = await testToken.balanceOf(dao.address);

			const result = await hectorBridge.connect(deployer).bridge(mockSendingAssetInfos, fees, mockCallDatas, bridge1.address);
			const resultWait = await result.wait();

			const balanceAfter = await testToken.balanceOf(dao.address);
			const feeAmount = mockSendingAssetInfo1.feeAmount;
			expect(balanceAfter.sub(balanceBefore)).equal(feeAmount);
		});
	});
});
