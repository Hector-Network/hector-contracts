import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai';

import {
  FNFT,
  LockFarm,
  VotingFarm,
  IERC20,
  IERC20__factory,
  LockFarm__factory,
  SpookyLP__factory,
  FNFT__factory,
  SpookyLP,
} from '../types';

import {
  deployVotingFarm,
} from '../helper';

describe('VotingFarm Test', async () => {
  let deployer: SignerWithAddress; // owner
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let fnft: FNFT;
  let lockFarm: LockFarm;
  let hec: IERC20;
  let farm1: SpookyLP;
  let farm2: SpookyLP;
  let votingFarm: VotingFarm;

  let _fnft = '0xD13B8382fF3c1628547c91C001f8d97c21413671';
  let _hec = '0x55639b1833Ddc160c18cA60f5d0eC9286201f525';
  let _lockFarm = '0x3b503F665039d532bef21E6Df3Ed474f4d810eF6';

  let _lp1 = '0x1E6D7ecCB5981AA700789Af7541c0E9aE5deCA43';
  let _lp2 = '0xeF08AaA32a53a7C892d912fc37282ebC8c21316c';
  let _fakeFarm = '0x3b503F665039d532bef21E6Df3Ed474f4d810eF6';

  let votingFarmsData = [_lp1, _lp2];
  let votingWeightsData = ['30', '70'];

  let votingFakeFarmsData = [_lp1, _lp1];
  let votingFakeFarmsData1 = [_lp1, _lp2, _fakeFarm];
  let votingFakeWeightsData = ['20', '70'];
  let votingFakeWeightsData1 = ['30', '70', '10'];

  before(async () => {
    const signers: SignerWithAddress[] = await ethers.getSigners();

    deployer = signers[0];
    alice = signers[1];
    bob = signers[2];

    // FNFT
    fnft = FNFT__factory.connect(_fnft, deployer);
    console.log('FNFT: ', fnft.address);

    // HEC
    hec = IERC20__factory.connect(_hec, deployer);
    console.log('HEC: ', hec.address);

    // LockFarm
    lockFarm = LockFarm__factory.connect(_lockFarm, deployer);
    console.log('LockFarm: ', lockFarm.address);

    // Farm1
    farm1 = SpookyLP__factory.connect(_lp1, deployer);
    console.log('Farm1: ', farm1.address);

    // Farm2
    farm2 = SpookyLP__factory.connect(_lp2, deployer);
    console.log('Farm2: ', farm2.address);

    // VotingFarm
    votingFarm = await deployVotingFarm(_fnft, _hec, _lockFarm);
    console.log('VotingFarm: ', votingFarm.address);
  });

  describe('#1: AddFarmForOwner', async () => {
    it('Should set the right owner', async function () {
      await expect(
        votingFarm.connect(deployer).addFarmForOwner(farm1.address)
      ).to.be.not.revertedWith('!admin');
    });

    it('Should set the valid farm', async function () {
      await expect(votingFarm.connect(deployer).addFarmForOwner(_fakeFarm)).to
        .be.reverted;
    });

    it('Should set the non-existed farm', async function () {
      await expect(
        votingFarm.connect(deployer).addFarmForOwner(farm1.address)
      ).to.be.revertedWith('Already existed farm');
    });
  });

  describe('#2: Vote', async () => {
    it('Failed - inputted weights total percentage is not 100%', async function () {
      await votingFarm.connect(deployer).addFarmForOwner(farm2.address);
      await expect(
        votingFarm
          .connect(deployer)
          .vote(votingFarmsData, votingFakeWeightsData)
      ).to.be.revertedWith('Weights total percentage is not 100%');
    });

    it('Failed - inputted one of weights exceeded max limit', async function () {
      await votingFarm.connect(deployer).setMaxPercentageFarm(30);
      await expect(
        votingFarm.connect(deployer).vote(votingFarmsData, votingWeightsData)
      ).to.be.revertedWith('One of Weights exceeded max limit');
      await votingFarm.connect(deployer).setMaxPercentageFarm(80);
    });

    it('Failed - inputted farms and weights length size are difference', async function () {
      await expect(
        votingFarm
          .connect(deployer)
          .vote(votingFakeFarmsData1, votingWeightsData)
      ).to.be.revertedWith('Farms and Weights length size are difference');
    });

    it('Failed - inputted invalid farms', async function () {
      await expect(
        votingFarm
          .connect(deployer)
          .vote(votingFakeFarmsData, votingWeightsData)
      ).to.be.revertedWith('Invalid Farms');
    });

    it("Failed - can't vote in voting delay duration", async function () {
      await votingFarm
        .connect(deployer)
        .vote(votingFarmsData, votingWeightsData);
      await expect(
        votingFarm.connect(deployer).vote(votingFarmsData, votingWeightsData)
      ).to.be.revertedWith('You voted in the last 7 days');
    });
  });

  describe('#3: setAdmin', async () => {
    it('Failed - only admin can change admin', async function () {
      await expect(
        votingFarm.connect(deployer).setAdmin(deployer.address)
      ).to.be.not.revertedWith('!admin');
    });

    it('Compare - admin after set', async function () {
      await votingFarm.connect(deployer).setAdmin(deployer.address);
      expect(deployer.address).to.equal(
        await votingFarm.connect(deployer).admin()
      );
    });
  });

  describe('#4: setConfiguration', async () => {
    it('Failed - only admin can set configuration', async function () {
      await expect(
        votingFarm
          .connect(alice)
          .setConfiguration(fnft.address, hec.address, lockFarm.address)
      ).to.be.not.revertedWith('!admin');
    });

    it('Compare - configurations after set', async function () {
      const tfnft = fnft.address;
      const thec = hec.address;
      const tlockFarm = lockFarm.address;
      await votingFarm
        .connect(deployer)
        .setConfiguration(fnft.address, hec.address, lockFarm.address);

      expect(tfnft).to.equal(await votingFarm.connect(deployer).fNFT());
      expect(thec).to.equal(await votingFarm.connect(deployer).HEC());
      expect(tlockFarm).to.equal(await votingFarm.connect(deployer).lockFarm());
    });
  });

  describe('#5: setMaxPercentageFarm', async () => {
    it('Failed - only admin can set max percentage of the farms', async function () {
      await expect(
        votingFarm.connect(alice).setMaxPercentageFarm('60')
      ).to.be.not.revertedWith('!admin');
    });

    it('Compare - max percentage after set', async function () {
      const maxPercentage = 60;
      await votingFarm.connect(deployer).setMaxPercentageFarm(maxPercentage);
      const maxPercentage1 = await votingFarm.connect(deployer).maxPercentage();
      expect(maxPercentage).to.equal(maxPercentage1);
    });
  });

  describe('#6: setVoteDelay', async () => {
    it('Failed - only admin can set vote delay time', async function () {
      const voteDelay = 60;
      await expect(
        votingFarm.connect(alice).setVoteDelay(voteDelay)
      ).to.be.not.revertedWith('!admin');
    });

    it('Compare - vote delay time after set', async function () {
      const voteDelay = 60;
      await votingFarm.connect(deployer).setVoteDelay(voteDelay);
      const voteDelay1 = await votingFarm.connect(deployer).voteDelay();
      expect(voteDelay).to.equal(voteDelay1);
    });
  });
});
