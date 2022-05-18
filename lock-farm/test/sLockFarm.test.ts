import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai';

import {
  FNFT,
  TokenVault,
  LockAddressRegistry,
  SLockFarm,
  Emissionor,
  StakingToken,
  RewardToken,
  Treasury,
} from '../types';

import {
  increaseTime,
  getTimeStamp,
  ether,
  deployStakingToken,
  deployRewardToken,
  deployLockAddressRegistry,
  deployTokenVault,
  deployFNFT,
  deploySLockFarm,
  deployTreasury,
  deployEmissionor,
} from '../helper';

describe('sLockFarm test', async () => {
  let deployer: SignerWithAddress; // owner
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let stakingToken: StakingToken;
  let rewardToken: RewardToken;
  let treasury: Treasury;
  let lockAddressRegistry: LockAddressRegistry;
  let fnft: FNFT;
  let tokenVault: TokenVault;
  let emissionor: Emissionor;
  let lockFarm: SLockFarm;

  // LockFarm Stake Info
  let depositAmount = ether(10);
  let lockSecs = 3600 * 24 * 7;
  let lockEndTime: number;

  // Emissionor Info
  let rewardStartTimestamp: number;
  let rewardAmounts = [ether(1), ether(2), ether(3), ether(4), ether(5)];
  let rewardCheckSum = ether(15);

  before(async () => {
    const signers: SignerWithAddress[] = await ethers.getSigners();

    deployer = signers[0];
    alice = signers[1];
    bob = signers[2];

    // StakingToken
    stakingToken = await deployStakingToken();
    await stakingToken.connect(alice).mint();
    await stakingToken.connect(bob).mint();
    console.log('StakingToken: ', stakingToken.address);

    // RewardToken
    rewardToken = await deployRewardToken();
    console.log('RewardToken: ', rewardToken.address);

    // Treasury
    treasury = await deployTreasury(rewardToken.address);
    console.log('Treasury: ', treasury.address);

    // LockAddressRegistry
    lockAddressRegistry = await deployLockAddressRegistry();
    console.log('LockAddressRegistry: ', lockAddressRegistry.address);

    // FNFT
    fnft = await deployFNFT(lockAddressRegistry.address);
    console.log('FNFT: ', fnft.address);

    // TokenVault
    tokenVault = await deployTokenVault(lockAddressRegistry.address);
    console.log('TokenVault: ', tokenVault.address);

    // LockFarm
    lockFarm = await deploySLockFarm(
      lockAddressRegistry.address,
      stakingToken.address,
      rewardToken.address
    );
    console.log('sLockFarm: ', lockFarm.address);

    // Emissionor
    emissionor = await deployEmissionor(
      treasury.address,
      lockFarm.address,
      rewardToken.address
    );
    rewardStartTimestamp = (await getTimeStamp()) + 3600 * 24 + 100;
    console.log('Emissionor: ', emissionor.address);

    // Register Addresses
    await lockAddressRegistry.initialize(
      deployer.address,
      tokenVault.address,
      fnft.address,
      emissionor.address
    );
    await lockAddressRegistry.addFarm(lockFarm.address);
  });

  describe('#1: Stake', async () => {
    it('Failed - invalid lock duration (7 days ~ 3 years)', async () => {
      const secs = 3600; // 1 day

      await expect(
        lockFarm.connect(alice).stake(depositAmount, secs)
      ).to.be.revertedWith('Farm: Invalid secs');
    });

    it('Failed - not approved to the TokenVault', async () => {
      await expect(
        lockFarm.connect(alice).stake(depositAmount, lockSecs)
      ).to.be.revertedWith('ERC20: transfer amount exceeds allowance');
    });

    it('Success - stake 10 eth & lock 7 days', async () => {
      await stakingToken
        .connect(alice)
        .approve(tokenVault.address, depositAmount);
      await lockFarm.connect(alice).stake(depositAmount, lockSecs);
    });

    it('FNFT info - asset, amount, sec', async () => {
      lockEndTime = (await getTimeStamp()) + lockSecs;

      expect(await fnft.balanceOf(alice.address)).to.equal('1');
      expect(await fnft.tokenOfOwnerByIndex(alice.address, 0)).to.equal('0');

      const info = await tokenVault.getFNFT(0);
      expect(info.asset).to.equal(stakingToken.address);
      expect(info.depositAmount).to.equal(depositAmount);
      expect(info.endTime).to.equal(lockEndTime);
    });

    it('Balances - Alice & TokenVault', async () => {
      expect(await stakingToken.balanceOf(alice.address)).to.equal(
        ether(1000 - 10)
      );
      expect(await stakingToken.balanceOf(tokenVault.address)).to.equal(
        ether(10)
      );
    });

    it('Again - stake after 1 day', async () => {
      await increaseTime(3600 * 24); // 1 day

      await stakingToken
        .connect(alice)
        .approve(tokenVault.address, depositAmount);
      await lockFarm.connect(alice).stake(depositAmount, lockSecs);

      expect(await fnft.balanceOf(alice.address)).to.equal('2');
      expect(await fnft.tokenOfOwnerByIndex(alice.address, 1)).to.equal('1');
    });
  });

  describe('#2: FNFT', async () => {
    it('Transfer - from alice to Bob', async () => {
      await fnft.connect(alice).transferFrom(alice.address, bob.address, 1);

      expect(await fnft.balanceOf(alice.address)).to.equal('1');
      expect(await fnft.tokenOfOwnerByIndex(alice.address, 0)).to.equal('0');
      expect(await fnft.balanceOf(bob.address)).to.equal('1');
      expect(await fnft.tokenOfOwnerByIndex(bob.address, 0)).to.equal('1');
      expect(await fnft.totalSupply()).to.equal('2');
    });

    it('Failed - nonTokenVault cannot mint', async () => {
      await expect(fnft.connect(alice).mint(alice.address)).to.be.revertedWith(
        'AccessControl: Invalid token vault'
      );
    });
  });

  describe('#3: TokenVault', async () => {
    it('Failed - nonFarm cannot mint', async () => {
      await expect(
        tokenVault.connect(alice).mint(alice.address, {
          asset: stakingToken.address,
          depositAmount: depositAmount,
          endTime: lockEndTime,
        })
      ).to.be.revertedWith('AccessControl: Invalid farm');
    });

    it('Failed - nonFarm cannot withdraw', async () => {
      await expect(
        tokenVault.connect(alice).withdraw(alice.address, 0)
      ).to.be.revertedWith('AccessControl: Invalid farm');
    });
  });

  describe('#4: Emissionor', async () => {
    it('Failed - nonMod cannot initialize', async () => {
      await expect(
        emissionor
          .connect(alice)
          .initialize(rewardStartTimestamp, rewardAmounts, rewardCheckSum)
      ).to.be.revertedWith('Non Moderator');
    });

    it('Failed - nonMod cannot emitReward', async () => {
      await expect(emissionor.connect(alice).emitReward()).to.be.revertedWith(
        'Non Moderator'
      );
    });

    it('Failed - initialize with past startTimestamp', async () => {
      const pastTimestamp = (await getTimeStamp()) - 1000;
      await expect(
        emissionor.initialize(pastTimestamp, rewardAmounts, ether(1))
      ).to.be.revertedWith('Start timestamp should be in the future');
    });

    it('Failed - initialize with incorrect checkSum', async () => {
      await expect(
        emissionor.initialize(rewardStartTimestamp, rewardAmounts, ether(1))
      ).to.be.revertedWith('Incorrect check sum');
    });

    it('Success - initialize', async () => {
      await emissionor.initialize(
        rewardStartTimestamp,
        rewardAmounts,
        rewardCheckSum
      );
    });

    it('Success - emitReward', async () => {
      await emissionor.emitReward();

      expect(await rewardToken.balanceOf(lockFarm.address)).to.equal(ether(1));
    });

    it('Success - emitReward after 2 weeks', async () => {
      increaseTime(3600 * 24 * 7 * 2); // 2 weeks

      await emissionor.emitReward();

      expect(await rewardToken.balanceOf(lockFarm.address)).to.equal(ether(6));

      await emissionor.emitReward();

      expect(await rewardToken.balanceOf(lockFarm.address)).to.equal(ether(6));
    });
  });

  describe('#5: Claim', async () => {
    it('Failed - nonOwner cannot claim', async () => {
      await expect(lockFarm.connect(alice).claim(1)).to.be.revertedWith(
        'Farm: Invalid owner'
      );
      await expect(lockFarm.connect(bob).claim(0)).to.be.revertedWith(
        'Farm: Invalid owner'
      );
    });
    it('Success - alice claim', async () => {
      await lockFarm.connect(alice).claim(0);
      const rewardBalance0 = await rewardToken.balanceOf(alice.address);

      increaseTime(3600 * 24); // 1 day

      await lockFarm.connect(alice).claim(0);
      const rewardBalance1 = await rewardToken.balanceOf(alice.address);

      expect(rewardBalance0.lt(rewardBalance1)).to.equal(true);
    });
    it('Success - bob claim', async () => {
      await lockFarm.connect(bob).claim(1);
      const rewardBalance0 = await rewardToken.balanceOf(bob.address);

      increaseTime(3600 * 24); // 1 day

      await lockFarm.connect(bob).claim(1);
      const rewardBalance1 = await rewardToken.balanceOf(bob.address);

      expect(rewardBalance0.lt(rewardBalance1)).to.equal(true);
    });
    it('Empty claimable because of no emission', async () => {
      const rewardBalance0 = await rewardToken.balanceOf(alice.address);

      increaseTime(3600 * 24 * 7 * (rewardAmounts.length + 1));

      await lockFarm.connect(alice).claim(0);
      const rewardBalance1 = await rewardToken.balanceOf(alice.address);

      increaseTime(3600 * 24); // 1 day

      await lockFarm.connect(alice).claim(0);
      const rewardBalance2 = await rewardToken.balanceOf(alice.address);

      expect(rewardBalance0.lt(rewardBalance1)).to.equal(true);
      expect(rewardBalance1).to.equal(rewardBalance2);
    });
  });

  describe('#6: Withdraw', async () => {
    it('Failed - nonOwner cannot withdraw', async () => {
      await expect(lockFarm.connect(alice).withdraw(1)).to.be.revertedWith(
        'Farm: Invalid owner'
      );
      await expect(lockFarm.connect(bob).withdraw(0)).to.be.revertedWith(
        'Farm: Invalid owner'
      );
    });

    it('Failed - bob withdraw because non approved', async () => {
      await expect(lockFarm.connect(bob).withdraw(1)).to.be.revertedWith(
        'ERC721Burnable: caller is not owner nor approved'
      );
    });

    it('Success - bob withdraw', async () => {
      const rewardBalance0 = await rewardToken.balanceOf(bob.address);

      await emissionor.emitReward();

      await fnft.connect(bob).approve(tokenVault.address, 1);
      await lockFarm.connect(bob).withdraw(1);

      const rewardBalance1 = await rewardToken.balanceOf(bob.address);
      expect(rewardBalance0.lt(rewardBalance1)).to.equal(true);

      expect(await fnft.balanceOf(bob.address)).to.equal('0');
      expect(await fnft.totalSupply()).to.equal('1');

      expect(await stakingToken.balanceOf(bob.address)).to.equal(
        ether(1000 + 10)
      );
      expect(await stakingToken.balanceOf(tokenVault.address)).to.equal(
        ether(10)
      );
    });
  });
});
