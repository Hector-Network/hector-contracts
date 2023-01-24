import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai';
import {
	FNFT,
	LockFarm,
	Voting,
	IERC20Upgradeable,
	IERC20Upgradeable__factory,
	LockFarm__factory,
	FNFT__factory,
} from '../types';
import { deployVoting } from '../helper';

const erc20Abi = require('../artifacts/@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol/IERC20Upgradeable.json');
const lockFarmAbi = require('./LockFarmAbi.json');

describe('Voting Test', async () => {
	let deployer: SignerWithAddress; // owner
	let alice: SignerWithAddress;
	let bob: SignerWithAddress;

	let fnft: FNFT;
	let fnft2: FNFT;
	let farm1: LockFarm;
	let farm2: LockFarm;

	let hec: IERC20Upgradeable;
	let Voting: Voting;

	let _version = '2.0';
	let _hec = '0x55639b1833Ddc160c18cA60f5d0eC9286201f525';
	let _sHec = '0x71264c23604fa78D1eFcc32af1c73714F33dCdb4';
	let _wsHec = '0x6225eeA79a0baF0c7e368Db4de1e8066589815B1';
	let _hecUsdc = '0x9C4Ee29CD1C219623eBEA40A42b5af11414D7C90';
	let _hecTor = '0xd02a80B4A58308B1aD8652abe348Ae2Ca241E636';
	let _lockAddressRegistry = '0x2D86a40Ff217493cCE3a23627F6A749dAe1f9018';
	let _tokenVault = '0x4b7dC9E2Cc8B97Fe6073d03667Aed96c071c532B';
	let NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
	let MAX_VALUE = '0xffffffffffffffffffffffffffffffffffffffff';
	const _maxPercentage = 100;
	const _voteDelay = 5;

	let _fnft = '0x7b88137d10394537F1EEa6cEd3ec4f778EEfAAc3';

	let _farm1 = '0xC464e6d45004Bf56772E70e22d9cF61C5Ae63970';
	let _farm2 = '0x55869De94AB1F18295C1C5aC3C1c80995F2D5a2E';

	let _fakeFarm = '0x44E867C51146932ac10728E86107bF488F38fA1e';

	let VotingsData = [_farm1];
	let votingWeightsData = ['100'];

	let votingFakeFarmsData = [_fakeFarm];
	let votingFakeFarmsData1 = [_farm1, _farm2, _fakeFarm];
	let votingFakeWeightsData = ['59'];
	let votingFakeWeightsData1 = ['30', '70', '10'];

	let fnftIds: any = [];

	let locKFarmAbi = before(async () => {
		const signers: SignerWithAddress[] = await ethers.getSigners();

		deployer = signers[0];
		alice = signers[1];
		bob = signers[2];

		// FNFT
		fnft = FNFT__factory.connect(_fnft, deployer);
		console.log('FNFT: ', fnft.address);

		// HEC
		hec = IERC20Upgradeable__factory.connect(_hec, deployer);
		console.log('HEC: ', hec.address);

		// Farm1
		farm1 = LockFarm__factory.connect(_farm1, deployer);
		console.log('Farm1: ', farm1.address);

		// Farm2
		farm2 = LockFarm__factory.connect(_farm2, deployer);
		console.log('Farm2: ', farm2.address);

		// Stake Hec and Get FNFT balance
		const hecContract = new ethers.Contract(_hec, erc20Abi.abi, deployer);
		console.log('Approve HEC to tokenVault');
		const txApprove = await hecContract.connect(deployer).approve(_tokenVault, MAX_VALUE);
		await txApprove.wait();

		console.log('Stake HEC to lockFarm 20 times');
		for (let i = 0; i < 20; i++) {
			let lockFarmContract = new ethers.Contract(_farm1, lockFarmAbi, deployer);
			let stakeMinTime = await lockFarmContract.lockedStakeMinTime();
			const txStake = await lockFarmContract.connect(deployer).stake('100000', stakeMinTime);
			await txStake.wait();
			const txWaitStake = await txStake.wait();
			const eventStaked = txWaitStake.events.filter((param: any) => param.address == _fnft);
			const stakedFNFTId = eventStaked[0].topics[eventStaked[0].topics.length - 1];
			fnftIds.push(stakedFNFTId);
			console.log(i + 1, 'FNFTID #', stakedFNFTId);
		}
		console.log('Stake Done and Got 20 FNFTs!');

		// Voting
		Voting = await deployVoting(
			_version,
			_hec,
			_sHec,
			_wsHec,
			_tokenVault,
			_maxPercentage,
			_voteDelay
		);
		console.log('Voting: ', Voting.address);

		console.log('Deployer: ', deployer.address);
		console.log('Alice: ', alice.address);

		const txAddLockFarm = await Voting.connect(deployer).addLockFarmForOwner(
			farm1.address,
			_fnft,
			_lockAddressRegistry
		);
		await txAddLockFarm.wait();
		const txSetMaxPercentage = await Voting.connect(deployer).setMaxPercentageFarm(200);
		await txSetMaxPercentage.wait();
	});

	describe('#initalize', async () => {
		it('Revert initialize', async function () {
			await expect(
				Voting.connect(deployer).initialize(
					_version,
					_hec,
					_sHec,
					_wsHec,
					_tokenVault,
					_maxPercentage,
					_voteDelay
				)
			).to.be.reverted;
		});
	});

	describe('#addLockFarmForOwner', async () => {
		it('Should set the right owner', async function () {
			await expect(
				Voting.connect(alice).addLockFarmForOwner(farm1.address, _fnft, _lockAddressRegistry)
			).to.be.revertedWith('Ownable: caller is not the owner');
		});

		it('Should set the non-existed farm', async function () {
			await expect(
				Voting.connect(deployer).addLockFarmForOwner(farm1.address, _fnft, _lockAddressRegistry)
			).to.be.revertedWith('Already existed farm');
		});
	});

	describe('#deprecateFarm', async () => {
		it('Should set the right owner', async function () {
			await expect(Voting.connect(alice).deprecateFarm(farm1.address)).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);
		});

		it('Deprecate farm by owner', async function () {
			await expect(Voting.connect(deployer).deprecateFarm(farm1.address)).to.not.be.reverted;
		});
	});

	describe('#resurrectFarm', async () => {
		it('Should set the right owner', async function () {
			await expect(Voting.connect(alice).deprecateFarm(farm1.address)).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);
		});

		it('Resurrect farm by owner', async function () {
			await expect(Voting.connect(deployer).resurrectFarm(farm1.address)).to.not.be.reverted;
		});
	});

	describe('#setConfiguration', async () => {
		it('Failed - only admin can set configuration', async function () {
			await expect(
				Voting.connect(alice).setConfiguration(hec.address, _sHec, _wsHec, _tokenVault)
			).to.be.revertedWith('Ownable: caller is not the owner');
		});

		it('Compare - configurations after set', async function () {
			const thec = hec.address;
			await Voting.connect(deployer).setConfiguration(hec.address, _sHec, _wsHec, _tokenVault);

			expect(thec).to.equal(await Voting.connect(deployer).HEC());
		});
	});

	describe('#setMaxPercentageFarm', async () => {
		it('Failed - only admin can set max percentage of the farms', async function () {
			await expect(Voting.connect(alice).setMaxPercentageFarm('60')).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);
		});

		it('Compare - max percentage after set', async function () {
			const maxPercentage = 60;
			await Voting.connect(deployer).setMaxPercentageFarm(maxPercentage);
			const maxPercentage1 = await Voting.connect(deployer).maxPercentage();
			expect(maxPercentage).to.equal(maxPercentage1);
		});
	});

	describe('#setStatusFNFT', async () => {
		it('Should set the right owner', async function () {
			await expect(
				Voting.connect(alice).addLockFarmForOwner(farm1.address, _fnft, _lockAddressRegistry)
			).to.be.revertedWith('Ownable: caller is not the owner');
		});
	});

	describe('#setVoteDelay', async () => {
		it('Failed - only admin can set vote delay time', async function () {
			const voteDelay = 60;
			await expect(Voting.connect(alice).setVoteDelay(voteDelay)).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);
		});

		it('Compare - vote delay time after set', async function () {
			const voteDelay = 60;
			await Voting.connect(deployer).setVoteDelay(voteDelay);
			const voteDelay1 = await Voting.connect(deployer).voteDelay();
			expect(voteDelay).to.equal(voteDelay1);
		});
	});

	describe('#addLPToken', async () => {
		it('Failed - only admin can add lp token', async function () {
			const voteDelay = 60;
			await expect(Voting.connect(alice).addLPTokens(_hecTor, true)).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);
		});

		it('Compare - check status after added lpToken', async function () {
			await Voting.connect(deployer).addLPTokens(_hecTor, true);
			const status = await Voting.checkLPTokens(_hecTor);
			expect(status).to.equal(true);
		});
	});

	describe('#Vote', async () => {
		it("Failed - user can't vote", async function () {
			expect(true).to.equal(await Voting.connect(deployer).canVote(deployer.address));
		});

		it('Failed - inputted weights total percentage is not 100%', async function () {
			await expect(
				Voting.connect(deployer).vote(VotingsData, votingFakeWeightsData, NULL_ADDRESS, [])
			).to.be.revertedWith('Weights total percentage is not 100%');
		});

		it('Failed - inputted one of weights exceeded max limit', async function () {
			await Voting.connect(deployer).setMaxPercentageFarm(30);
			await expect(
				Voting.connect(deployer).vote(VotingsData, votingWeightsData, NULL_ADDRESS, [])
			).to.be.revertedWith('One of Weights exceeded max limit');
			await Voting.connect(deployer).setMaxPercentageFarm(200);
		});

		it('Failed - inputted farms and weights length size are difference', async function () {
			await expect(
				Voting.connect(deployer).vote(votingFakeFarmsData1, votingWeightsData, NULL_ADDRESS, [])
			).to.be.revertedWith('Farms and Weights length size are difference');
		});

		it('Failed - inputted invalid farms', async function () {
			await expect(
				Voting.connect(deployer).vote(votingFakeFarmsData, votingWeightsData, NULL_ADDRESS, [])
			).to.be.revertedWith('Invalid Farms');
		});

		it('Successed - voting with 20 FNFTs', async function () {
			await expect(
				Voting.connect(deployer).vote(VotingsData, votingWeightsData, NULL_ADDRESS, fnftIds)
			).to.be.not.reverted;
		});
	});

	describe('#transferOwnership', async () => {
		it('Failed - only admin can set vote delay time', async function () {
			const voteDelay = 60;
			await expect(Voting.connect(alice).transferOwnership(alice.address)).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);
		});

		it('Compare - owner address after set', async function () {
			await Voting.connect(deployer).transferOwnership(alice.address);
			const owner = await Voting.connect(deployer).owner();
			expect(owner.toLowerCase()).to.equal(alice.address.toLowerCase());
		});
	});
});
