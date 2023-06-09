import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { BigNumber, utils } from 'ethers';
import { increaseTime, getTimeStamp, waitSeconds } from '../helper';
import { HecBridgeSplitter } from '../types';
import tempStepDataForSquid from '../scripts/test/tempStepDataForSquid.json';
import erc20Abi from '../artifacts/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol/IERC20Upgradeable.json';

describe('Hector Bridge', function () {
	let deployer: SignerWithAddress;
	let alice: SignerWithAddress;

	let lifiBridge: string = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE";
	let squidRouter: string = "0xce16f69375520ab01377ce7b88f5ba8c48f8d666";
	let dao: string = "0x677d6EC74fA352D4Ef9B1886F6155384aCD70D90";
	let feePercentage: number = 950;
	let countDest: number = 2;

	let ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

	let hectorBridge: HecBridgeSplitter;

	before(async function () {
		[deployer, alice] = await ethers.getSigners();

		const HectorBridge = await ethers.getContractFactory('HecBridgeSplitter');
		hectorBridge = (await upgrades.deployProxy(
			HectorBridge,
			[2],
			{
				initializer: "initialize",
			}
		)) as HecBridgeSplitter;
	});

	describe('#Test Bridge Whitelisting', async () => {
		it('Unable to add bridge if not owner', async function () {
			await expect(hectorBridge.connect(alice).addToWhiteList(lifiBridge)).to.be.revertedWith('Ownable: caller is not the owner');
		});

		it('Add duplicated bridge contract', async function () {
			const result = await hectorBridge.connect(deployer).addToWhiteList(lifiBridge);
			await result.wait();
			await waitSeconds(3);
			await expect(hectorBridge.connect(deployer).addToWhiteList(lifiBridge)).to.be.revertedWith('Address already exists');
		});

		it('IsWhiteList to true after adding', async function () {
			expect(await hectorBridge.connect(deployer).isInWhiteList(lifiBridge)).equal(true);
		});

		it('Compare length of white list after adding', async function () {
			expect(await hectorBridge.connect(deployer).getWhiteListSize()).equal(1);
		});

		it('Get all white list after adding', async function () {
			expect((await hectorBridge.connect(deployer).getAllWhiteList() as Array<string>)[0]).equal(lifiBridge);
		});

		it('Get white list at index after adding', async function () {
			expect(await hectorBridge.connect(deployer).getWhiteListAtIndex(0)).equal(lifiBridge);
		});

		it('IsWhiteList to false after removing', async function () {
			const result = await hectorBridge.connect(deployer).removeFromWhiteList(lifiBridge);
			await result.wait();
			await waitSeconds(3);
			expect(await hectorBridge.connect(deployer).isInWhiteList(lifiBridge)).equal(false);
		});
	});

	describe('#Test DAO set', async () => {
		it('Unable to set DAO if not owner', async function () {
			await expect(hectorBridge.connect(alice).setDAO(dao)).to.be.revertedWith('Ownable: caller is not the owner');
		});

		it('Unable to add zero address', async function () {
			await expect(hectorBridge.connect(deployer).setDAO(ZERO_ADDRESS)).to.be.reverted;
		});

		it('Compare DAO after adding', async function () {
			const result = await hectorBridge.connect(deployer).setDAO(dao);
			await result.wait();
			await waitSeconds(3);
			expect(await hectorBridge.connect(deployer).DAO()).equal(dao);
		});
	});


	describe('#Test Minimum Fee Percentage Configuration', async () => {
		it('Unable to set Fee if not owner', async function () {
			await expect(hectorBridge.connect(alice).setMinFeePercentage(feePercentage)).to.be.revertedWith('Ownable: caller is not the owner');
		});

		it('Compare FeePercentage after adding', async function () {
			const result = await hectorBridge.connect(deployer).setMinFeePercentage(feePercentage);
			await result.wait();
			await waitSeconds(3);
			expect(await hectorBridge.connect(deployer).minFeePercentage()).equal(feePercentage);
		});
	});

	describe('#Test Count Destination Configuration', async () => {
		it('Unable to set Fee if not owner', async function () {
			await expect(hectorBridge.connect(alice).setCountDest(countDest)).to.be.revertedWith('Ownable: caller is not the owner');
		});

		it('Compare counts after adding', async function () {
			const result = await hectorBridge.connect(deployer).setCountDest(countDest);
			await result.wait();
			await waitSeconds(3);
			expect(await hectorBridge.connect(deployer).CountDest()).equal(countDest);
		});
	});


	describe('#Test Bridge Operation Using Squid', () => {

		let ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

		let mockSendingAssetInfos: any[] = [];
		let fees: Array<BigNumber> = [];
		let feesForNative: Array<BigNumber> = [];
		let fee: BigNumber = BigNumber.from(0);

		let mockSendingAssetInfo1: {
			callData: string,
			sendingAmount: string,
			totalAmount: string, // Mock Total Amount
			feeAmount: string,
			bridgeFee: string,
		};

		let sendingAsset: string;
		let targetAddress: string;

		let callData = tempStepDataForSquid.transactionRequest.data;
		let sendingAmount = tempStepDataForSquid.params.fromAmount; // This is calculated amount except fee for using Bridge 
		let totalAmount = BigNumber.from('11000').toString(); // Mock Total Amount
		let feeAmount = BigNumber.from('11000').sub(BigNumber.from(tempStepDataForSquid.params.fromAmount)).toString(); // MockFee - 0.075%
		let bridgeFee = BigNumber.from(tempStepDataForSquid.transactionRequest.value).toString();

		let isNativeFrom = tempStepDataForSquid.params.fromToken.address == ETH_ADDRESS;

		before(async function () {

			mockSendingAssetInfo1 = {
				callData: callData,
				sendingAmount: sendingAmount,
				totalAmount: totalAmount, // Mock Total Amount
				feeAmount: feeAmount,
				bridgeFee: bridgeFee,
			};
			// Sending Asset Id
			sendingAsset = isNativeFrom
				? ZERO_ADDRESS
				: tempStepDataForSquid.params.fromToken.address;

			targetAddress = tempStepDataForSquid.transactionRequest.targetAddress;

			fees.push(
				BigNumber.from(bridgeFee)
			);

			if (isNativeFrom) {
				feesForNative.push(BigNumber.from(feeAmount));
			}

			fees.map((item) => {
				fee = fee.add(item);
			});

			feesForNative.map((item) => {
				fee = fee.add(item);
			})

			mockSendingAssetInfos.push(mockSendingAssetInfo1);

			if (!isNativeFrom) {
				let approveAmount = BigNumber.from(totalAmount);

				const ERC20Contract = new ethers.Contract(
					sendingAsset,
					erc20Abi.abi,
					deployer
				);

				await waitSeconds(3);

				let txApprove = await ERC20Contract.connect(deployer).approve(
					hectorBridge.address,
					approveAmount
				);

				await txApprove.wait();
			}
			const txAddWhiteList = await hectorBridge.connect(deployer).addToWhiteList(squidRouter);
			await txAddWhiteList.wait();
			const txSetDao = await hectorBridge.connect(deployer).setDAO(dao);
			await txSetDao.wait();

		});

		it('Success Tx For Squid Bridge', async function () {
			const result = await hectorBridge.bridge(
				sendingAsset,
				mockSendingAssetInfos,
				targetAddress,
				{
					value: fee,
				}
			);
			await expect(result.wait()).not.to.be.reverted;
		});

		it('Failed Tx when call fake targetAddress', async function () {
			const result = await hectorBridge.connect(deployer).bridge(
				sendingAsset,
				mockSendingAssetInfos,
				"0xbf014a15198edcfcb2921de7099bf256db31c4ba",
				{
					value: fee,
					gasLimit: 1000000
				}
			);

			await expect(result.wait()).to.be.reverted;
		});

		it('Failed Tx when send fake asset', async function () {
			const result = await hectorBridge.connect(deployer).bridge(
				"0xbf014a15198edcfcb2921de7099bf256db31c4ba",
				mockSendingAssetInfos,
				targetAddress,
				{
					value: fee,
					gasLimit: 1000000
				}
			);
			await expect(result.wait()).to.be.reverted;
		});

		it('Failed Tx when send fake assetInfos', async function () {
			const result = await hectorBridge.connect(deployer).bridge(
				sendingAsset,
				[{
					callData: "0xadde0800",
					sendingAmount: sendingAmount,
					totalAmount: totalAmount, // Mock Total Amount
					feeAmount: feeAmount,
					bridgeFee: bridgeFee,
				}],
				targetAddress,
				{
					value: fee,
					gasLimit: 1000000
				}
			);
			await expect(result.wait()).to.be.reverted;
		});

		describe('#pausable', () => {
			it('Failed Bridge Tx when paused', async function () {
				const txPause = await hectorBridge.pause();
				await txPause.wait();
				await expect(hectorBridge.connect(deployer).bridge(
					sendingAsset,
					mockSendingAssetInfos,
					targetAddress,
					{
						value: fee,
					}
				)).to.be.revertedWith('Pausable: paused');
			});

			it('Success Tx when unpause', async function () {
				const unpauseTx = await hectorBridge.unpause();
				await unpauseTx.wait();
				if (!isNativeFrom) {
					let approveAmount = BigNumber.from(totalAmount);
	
					const ERC20Contract = new ethers.Contract(
						sendingAsset,
						erc20Abi.abi,
						deployer
					);
	
					await waitSeconds(3);
	
					let txApprove = await ERC20Contract.connect(deployer).approve(
						hectorBridge.address,
						approveAmount
					);
	
					await txApprove.wait();
				}
				const result = await hectorBridge.bridge(
					sendingAsset,
					mockSendingAssetInfos,
					targetAddress,
					{
						value: fee,
					}
				);
				await expect(result.wait()).not.to.be.reverted;
			});
		});

	});
});
