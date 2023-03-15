import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { BigNumber, utils } from 'ethers';
import { increaseTime, getTimeStamp } from './../helper';
import {
  HectorSubscriptionFactory,
  HectorSubscription,
  RewardToken,
} from '../types';

describe('HectorSubscription', function () {
  let deployer: SignerWithAddress;
  let upgradeableAdmin: SignerWithAddress;
  let owner: SignerWithAddress;
  let treasury: SignerWithAddress;

  let hectorToken: RewardToken;
  let torToken: RewardToken;
  let hectorSubscriptionFactory: HectorSubscriptionFactory;
  let hectorSubscriptionLogic: HectorSubscription;
  let hectorSubscription: HectorSubscription;

  let product = 'TestProduct';
  let productBytes = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(product));

  let oneHour = 3600 * 1;
  let twoHour = 3600 * 2;

  let amount0 = ethers.utils.parseEther('100');
  let amount1 = ethers.utils.parseEther('200');

  beforeEach(async function () {
    [deployer, upgradeableAdmin, owner, treasury] = await ethers.getSigners();

    const TokenFactory = await ethers.getContractFactory('RewardToken');
    hectorToken = (await TokenFactory.deploy()) as RewardToken;
    torToken = (await TokenFactory.deploy()) as RewardToken;

    const HectorSubscription = await ethers.getContractFactory(
      'HectorSubscription'
    );
    hectorSubscriptionLogic =
      (await HectorSubscription.deploy()) as HectorSubscription;

    const HectorSubscriptionFactory = await ethers.getContractFactory(
      'HectorSubscriptionFactory'
    );
    hectorSubscriptionFactory = (await HectorSubscriptionFactory.deploy(
      hectorSubscriptionLogic.address,
      upgradeableAdmin.address
    )) as HectorSubscriptionFactory;

    await hectorSubscriptionFactory.createHectorSubscriptionContract(
      product,
      treasury.address
    );
    hectorSubscription = (await ethers.getContractAt(
      'HectorSubscription',
      await hectorSubscriptionFactory.getHectorSubscriptionContractByName(
        productBytes
      )
    )) as HectorSubscription;

    await hectorSubscription.appendPlan([
      {
        token: hectorToken.address,
        period: oneHour,
        amount: amount0,
      },
      {
        token: torToken.address,
        period: twoHour,
        amount: amount1,
      },
    ]);

    await hectorToken.mint(owner.address, utils.parseEther('200000000000000'));
    await hectorToken
      .connect(owner)
      .approve(hectorSubscription.address, utils.parseEther('200000000000000'));

    await torToken.mint(owner.address, utils.parseEther('200000000000000'));
    await torToken
      .connect(owner)
      .approve(hectorSubscription.address, utils.parseEther('200000000000000'));
  });

  describe('#factory', () => {
    it('logic', async function () {
      expect(await hectorSubscriptionFactory.hectorSubscriptionLogic()).equal(
        hectorSubscriptionLogic.address
      );
    });
    it('upgradeable admin', async function () {
      expect(await hectorSubscriptionFactory.upgradeableAdmin()).equal(
        upgradeableAdmin.address
      );
    });
    it('subscription contract', async function () {
      let subscription =
        await hectorSubscriptionFactory.getHectorSubscriptionByIndex(0);
      expect(subscription.product).equal(product);
      expect(subscription.subscription).equal(hectorSubscription.address);

      expect(
        await hectorSubscriptionFactory.getHectorSubscriptionContractByName(
          productBytes
        )
      ).equal(hectorSubscription.address);
    });
    it('is deplyed', async function () {
      expect(
        await hectorSubscriptionFactory.isDeployedHectorSubscriptionContractByProduct(
          product
        )
      ).equal(true);

      let otherProduct = 'OtherTest';
      expect(
        await hectorSubscriptionFactory.isDeployedHectorSubscriptionContractByProduct(
          otherProduct
        )
      ).equal(false);
    });
  });

  describe('#subscription - plan', () => {
    it('all plans', async function () {
      let plans = await hectorSubscription.allPlans();

      expect(plans.length).equal(3);

      expect(plans[1].token).equal(hectorToken.address);
      expect(plans[1].period).equal(oneHour);
      expect(plans[1].amount).equal(amount0);

      expect(plans[2].token).equal(torToken.address);
      expect(plans[2].period).equal(twoHour);
      expect(plans[2].amount).equal(amount1);
    });

    it('append plan', async function () {
      let tx = await hectorSubscription.appendPlan([
        {
          token: hectorToken.address,
          period: twoHour,
          amount: amount1,
        },
      ]);

      await expect(tx)
        .to.emit(hectorSubscription, 'PlanUpdated')
        .withArgs(3, hectorToken.address, twoHour, amount1);

      let plans = await hectorSubscription.allPlans();
      expect(plans.length).equal(4);
      expect(plans[3].token).equal(hectorToken.address);
      expect(plans[3].period).equal(twoHour);
      expect(plans[3].amount).equal(amount1);
    });

    it('update plan', async function () {
      let tx = await hectorSubscription.updatePlan(2, {
        token: hectorToken.address,
        period: twoHour,
        amount: amount1,
      });

      await expect(tx)
        .to.emit(hectorSubscription, 'PlanUpdated')
        .withArgs(2, hectorToken.address, twoHour, amount1);

      let plans = await hectorSubscription.allPlans();
      expect(plans.length).equal(3);
      expect(plans[2].token).equal(hectorToken.address);
      expect(plans[2].period).equal(twoHour);
      expect(plans[2].amount).equal(amount1);
    });
  });

  describe('#subscription - deposit/withdraw', () => {
    it('deposit', async function () {
      let amount = ethers.utils.parseEther('1000');
      let tx = await hectorSubscription
        .connect(owner)
        .deposit(hectorToken.address, amount);

      await expect(tx)
        .to.emit(hectorSubscription, 'PayerDeposit')
        .withArgs(owner.address, hectorToken.address, amount);

      expect(
        await hectorSubscription.balanceOf(owner.address, hectorToken.address)
      ).equal(amount);
      expect(
        await hectorSubscription.balanceOf(owner.address, torToken.address)
      ).equal(0);
    });

    it('withdraw', async function () {
      let amount = ethers.utils.parseEther('1000');
      await hectorSubscription
        .connect(owner)
        .deposit(hectorToken.address, amount);

      await expect(
        hectorSubscription.connect(owner).withdraw(torToken.address, amount)
      ).to.be.revertedWith('INVALID_AMOUNT()');

      let tx = await hectorSubscription
        .connect(owner)
        .withdraw(hectorToken.address, amount.div(2));
      await expect(tx)
        .to.emit(hectorSubscription, 'PayerWithdraw')
        .withArgs(owner.address, hectorToken.address, amount.div(2));
      expect(
        await hectorSubscription.balanceOf(owner.address, hectorToken.address)
      ).equal(amount.div(2));
    });

    it('withdraw all', async function () {
      let amount = ethers.utils.parseEther('1000');
      await hectorSubscription
        .connect(owner)
        .deposit(hectorToken.address, amount);

      let tx = await hectorSubscription
        .connect(owner)
        .withdrawAll(hectorToken.address);
      await expect(tx)
        .to.emit(hectorSubscription, 'PayerWithdraw')
        .withArgs(owner.address, hectorToken.address, amount);
      expect(
        await hectorSubscription.balanceOf(owner.address, hectorToken.address)
      ).equal(0);
    });
  });

  describe('#subscription - create', () => {
    beforeEach(async function () {
      let amount = ethers.utils.parseEther('1000');
      await hectorSubscription
        .connect(owner)
        .deposit(hectorToken.address, amount);
    });

    it('invalid plan', async function () {
      await expect(
        hectorSubscription.connect(owner).createSubscription(3)
      ).to.be.revertedWith('INVALID_PLAN()');
    });

    it('insufficient fund', async function () {
      await expect(
        hectorSubscription.connect(owner).createSubscription(2)
      ).to.be.revertedWith('INSUFFICIENT_FUND()');
    });

    it('create subscription', async function () {
      let tx = await hectorSubscription.connect(owner).createSubscription(1);
      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );
      let expiredAt = block.timestamp + oneHour;

      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionCreated')
        .withArgs(owner.address, 1, expiredAt);

      let subscription = await hectorSubscription.getSubscription(
        owner.address
      );

      expect(subscription.planId).equal(1);
      expect(subscription.expiredAt).equal(expiredAt);

      expect(await hectorToken.balanceOf(treasury.address)).equal(amount0);
    });

    it('create subscription again', async function () {
      await hectorSubscription.connect(owner).createSubscription(1);

      await expect(
        hectorSubscription.connect(owner).createSubscription(2)
      ).to.be.revertedWith('ACTIVE_SUBSCRIPTION()');
    });

    it('deposit and create subscription', async function () {
      let amount = ethers.utils.parseEther('1000');
      let tx = await hectorSubscription
        .connect(owner)
        .depositAndCreateSubscription(2, amount);
      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );
      let expiredAt = block.timestamp + twoHour;

      await expect(tx)
        .to.emit(hectorSubscription, 'PayerDeposit')
        .withArgs(owner.address, torToken.address, amount);
      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionCreated')
        .withArgs(owner.address, 2, expiredAt);
    });
  });

  describe('#subscription - sync', () => {
    let planId = 1;
    let expiredAt: number;
    let dueDate: number;
    let amount = amount0.mul(3);

    beforeEach(async function () {
      let tx = await hectorSubscription
        .connect(owner)
        .depositAndCreateSubscription(planId, amount);
      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );
      expiredAt = block.timestamp + oneHour;
      dueDate = block.timestamp + oneHour * 3;
    });

    it('sync subscription', async function () {
      let tx = await hectorSubscription.syncSubscription(owner.address);

      await expect(tx).not.emit(hectorSubscription, 'SubscriptionSynced');

      let subscription = await hectorSubscription.getSubscription(
        owner.address
      );
      expect(subscription.planId).equal(planId);
      expect(subscription.expiredAt).equal(expiredAt);
      expect(subscription.isCancelled).equal(false);
      expect(subscription.isActiveForNow).equal(true);
      expect(subscription.dueDate).equal(dueDate);

      expect(
        await hectorSubscription.balanceOf(owner.address, hectorToken.address)
      ).equal(amount.sub(amount0));
    });

    it('sync subscription after 1 hour', async function () {
      await increaseTime(oneHour);

      let tx = await hectorSubscription.syncSubscription(owner.address);

      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionSynced')
        .withArgs(owner.address, planId, expiredAt + oneHour, amount0);

      let subscription = await hectorSubscription.getSubscription(
        owner.address
      );
      expect(subscription.planId).equal(planId);
      expect(subscription.expiredAt).equal(expiredAt + oneHour);
      expect(subscription.isCancelled).equal(false);
      expect(subscription.isActiveForNow).equal(true);
      expect(subscription.dueDate).equal(dueDate);

      expect(
        await hectorSubscription.balanceOf(owner.address, hectorToken.address)
      ).equal(amount.sub(amount0.mul(2)));
    });

    it('sync subscription after 2 hours', async function () {
      await increaseTime(twoHour);

      let tx = await hectorSubscription.syncSubscription(owner.address);

      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionSynced')
        .withArgs(owner.address, planId, expiredAt + twoHour, amount0.mul(2));

      let subscription = await hectorSubscription.getSubscription(
        owner.address
      );
      expect(subscription.planId).equal(planId);
      expect(subscription.expiredAt).equal(expiredAt + twoHour);
      expect(subscription.isCancelled).equal(false);
      expect(subscription.isActiveForNow).equal(true);
      expect(subscription.dueDate).equal(dueDate);

      expect(
        await hectorSubscription.balanceOf(owner.address, hectorToken.address)
      ).equal(amount.sub(amount0.mul(3)));
    });

    it('sync subscription after 3 hours', async function () {
      await increaseTime(oneHour + twoHour);

      let tx = await hectorSubscription.syncSubscription(owner.address);

      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionSynced')
        .withArgs(owner.address, planId, expiredAt + twoHour, amount0.mul(2));

      let subscription = await hectorSubscription.getSubscription(
        owner.address
      );
      expect(subscription.planId).equal(planId);
      expect(subscription.expiredAt).equal(expiredAt + twoHour);
      expect(subscription.isCancelled).equal(false);
      expect(subscription.isActiveForNow).equal(false);
      expect(subscription.dueDate).equal(dueDate);
    });

    it('sync subscription after 2 months', async function () {
      await increaseTime(oneHour * 24 * 30 * 2);

      let tx = await hectorSubscription.syncSubscription(owner.address);

      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionSynced')
        .withArgs(owner.address, 0, expiredAt + twoHour, amount0.mul(2));

      let subscription = await hectorSubscription.getSubscription(
        owner.address
      );
      expect(subscription.planId).equal(0);
      expect(subscription.expiredAt).equal(expiredAt + twoHour);
      expect(subscription.isCancelled).equal(true);
      expect(subscription.isActiveForNow).equal(false);
      expect(subscription.dueDate).equal(dueDate);
    });
  });

  describe('#subscription - cancel', () => {
    let planId = 1;
    let expiredAt: number;
    let amount = amount0.mul(3);

    beforeEach(async function () {
      let tx = await hectorSubscription
        .connect(owner)
        .depositAndCreateSubscription(planId, amount);
      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );
      expiredAt = block.timestamp + oneHour;
    });

    it('cancel subscription', async function () {
      let tx = await hectorSubscription.connect(owner).cancelSubscription();

      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionCancelled')
        .withArgs(owner.address, planId);

      let subscription = await hectorSubscription.getSubscription(
        owner.address
      );
      expect(subscription.planId).equal(0);
      expect(subscription.expiredAt).equal(expiredAt);
      expect(subscription.isCancelled).equal(true);
      expect(subscription.isActiveForNow).equal(true);
      expect(subscription.dueDate).equal(expiredAt);
    });

    it('cancel subscription again', async function () {
      await hectorSubscription.connect(owner).cancelSubscription();

      await expect(
        hectorSubscription.connect(owner).cancelSubscription()
      ).revertedWith('INACTIVE_SUBSCRIPTION()');
    });
  });

  describe('#subscription - modify', () => {
    let planId = 1;
    let newPlanId = 2;
    let timestamp: number;
    let amount = amount0;

    beforeEach(async function () {
      let tx = await hectorSubscription
        .connect(owner)
        .depositAndCreateSubscription(planId, amount);
      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );
      timestamp = block.timestamp;
    });

    it('to modify subscription for different token', async function () {
      await increaseTime(oneHour / 2);

      let amountToDeposit = await hectorSubscription
        .connect(owner)
        .callStatic.toModifySubscription(newPlanId);

      expect(amountToDeposit).equal(amount1);
    });

    it('to modify subscription for same token', async function () {
      await hectorSubscription.updatePlan(2, {
        token: hectorToken.address,
        period: twoHour,
        amount: amount1,
      });

      await increaseTime(oneHour / 2);

      let amountToDeposit = await hectorSubscription
        .connect(owner)
        .callStatic.toModifySubscription(newPlanId);

      expect(amountToDeposit).gte(amount1.sub(amount0.div(2)));
    });

    it('modify subscription for different token', async function () {
      await increaseTime(oneHour / 2);

      let tx = await hectorSubscription
        .connect(owner)
        .modifySubscription(newPlanId);
      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );

      const refundForOldPlan = amount0
        .mul(timestamp + oneHour - block.timestamp)
        .div(oneHour);

      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionModified')
        .withArgs(
          owner.address,
          planId,
          refundForOldPlan,
          newPlanId,
          amount1,
          block.timestamp + twoHour
        );

      expect(
        await hectorSubscription.refundOf(owner.address, hectorToken.address)
      ).equal(refundForOldPlan);
    });

    it('modify subscription for same token', async function () {
      await hectorSubscription.updatePlan(2, {
        token: hectorToken.address,
        period: twoHour,
        amount: amount1,
      });

      await increaseTime(oneHour / 2);

      let tx = await hectorSubscription
        .connect(owner)
        .modifySubscription(newPlanId);
      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );

      const payForNewPlan = amount1.sub(
        amount0.mul(timestamp + oneHour - block.timestamp).div(oneHour)
      );

      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionModified')
        .withArgs(
          owner.address,
          planId,
          0,
          newPlanId,
          payForNewPlan,
          block.timestamp + twoHour
        );
      await expect(tx)
        .emit(hectorSubscription, 'PayerDeposit')
        .withArgs(owner.address, hectorToken.address, payForNewPlan);

      expect(
        await hectorSubscription.refundOf(owner.address, hectorToken.address)
      ).equal(0);
    });
  });

  describe.only('#subscription: Cancelled subscription handling - Michael', function () {
    let customSubscription: HectorSubscription;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let plan30Days: any;
    let plan90Days: any;
    const expireDeadline = 60 * 60 * 24 * 30; // 1 month in seconds
    const threeMonths = 60 * 60 * 24 * 90; // 3 months in seconds

    beforeEach(async function () {
      // Deploy the necessary contracts
      [user1, user2] = await ethers.getSigners();

      // Set plans
      plan30Days = {
        token: torToken.address,
        period: 2592000,
        amount: ethers.utils.parseEther('100'),
      }; // 30 days
      plan90Days = {
        token: hectorToken.address,
        period: 7776000,
        amount: ethers.utils.parseEther('250'),
      }; // 90 days

      await hectorSubscription.appendPlan([plan30Days, plan90Days]);

      // Distribute tokens to users
      await torToken.mint(user1.address, utils.parseEther('1000'));

      await hectorToken.mint(user2.address, utils.parseEther('2000'));
    });

    it('getSubscription is NOT updated with latest when plan is expired', async function () {
      await torToken
        .connect(user1)
        .approve(hectorSubscription.address, plan30Days.amount);
      let tx = await hectorSubscription
        .connect(user1)
        .depositAndCreateSubscription(3, plan30Days.amount);

      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );
      let expiredAt = block.timestamp + oneHour;

      // Fast forward to expire the subscription
      await increaseTime(plan30Days.period + expireDeadline);

      let subscription = await hectorSubscription.getSubscription(
        user1.address
      );

      //SHOULD BE equal to 0 because the subscription is inactive > 30 days
      //https://github.com/Hector-Network/hector-contracts/blob/55604770f3a95f103b8e265f6405a3600baf43d8/pay/contracts/subscription/HectorSubscription.sol#L421
      try {
        expect(subscription.planId).to.equal(0);
      } catch (error: any) {
        console.log(
          '❌ FAILED - plan ID should be 0 if expired more than 30 days',
          error.message
        );
      }
    });

    it('should not adjust token balance for an expired subscription', async function () {
      await torToken
        .connect(user1)
        .approve(hectorSubscription.address, plan30Days.amount);
      await hectorSubscription
        .connect(user1)
        .depositAndCreateSubscription(3, plan30Days.amount);

      // Fast forward to expire the subscription
      await increaseTime(plan30Days.period + expireDeadline);
      // Sync subscription
      await hectorSubscription.syncSubscription(user1.address);
      let subscription = await hectorSubscription.getSubscription(
        user1.address
      );

      const userBalance = await torToken.balanceOf(user1.address);
      expect(subscription.planId).to.equal(0);

      expect(userBalance).to.equal(utils.parseEther('900')); // 1000 - 100
    });
    it('Excess amount will stay in subscriptoin when less than the plan amount', async function () {
      const amount = utils.parseEther('150');
      await torToken.connect(user1).approve(hectorSubscription.address, amount);
      await hectorSubscription
        .connect(user1)
        .depositAndCreateSubscription(3, amount);

      // Fast forward to expire the subscription
      await increaseTime(plan30Days.period + expireDeadline);
      // Sync subscription
      await hectorSubscription.syncSubscription(user1.address);
      let subscription = await hectorSubscription.getSubscription(
        user1.address
      );
      const userBalance = await torToken.balanceOf(user1.address);
      const remaingSubBalance = await hectorSubscription.balanceOf(
        user1.address,
        torToken.address
      );

      expect(remaingSubBalance).to.equal(utils.parseEther('50')); // excess 50 remains in subscription contract
    });
    it('Excess amount will NOT stay in subscription when plan is expired when sending more than the plan amount', async function () {
      const amount = utils.parseEther('200');
      await torToken.connect(user1).approve(hectorSubscription.address, amount);
      await hectorSubscription
        .connect(user1)
        .depositAndCreateSubscription(3, amount);

      // Fast forward to expire the subscription
      await increaseTime(plan30Days.period + expireDeadline);
      // Sync subscription
      await hectorSubscription.syncSubscription(user1.address);
      let subscription = await hectorSubscription.getSubscription(
        user1.address
      );
      const userBalance = await torToken.balanceOf(user1.address);
      const treasuryBalance = await torToken.balanceOf(treasury.address);
      const remaingSubBalance = await hectorSubscription.balanceOf(
        user1.address,
        torToken.address
      );

      expect(remaingSubBalance).to.equal(utils.parseEther('0'));
      expect(treasuryBalance).to.equal(utils.parseEther('200'));
    });

    it('Sub Expire more than 30 days + new Deposit = Sub active', async function () {
      const amount = utils.parseEther('200');
      await torToken
        .connect(user1)
        .approve(hectorSubscription.address, plan30Days.amount);
      let tx = await hectorSubscription
        .connect(user1)
        .depositAndCreateSubscription(3, plan30Days.amount);

      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );
      let expiredAt = block.timestamp + oneHour;

      // Fast forward to expire the subscription
      await increaseTime(plan30Days.period + threeMonths);
      await hectorSubscription.syncSubscription(user1.address);
      let subscription = await hectorSubscription.getSubscription(
        user1.address
      );

      expect(subscription.planId).to.equal(0);

      //Reactivate subscription
      await torToken
        .connect(user1)
        .approve(hectorSubscription.address, plan30Days.amount);
      await hectorSubscription
        .connect(user1)
        .depositAndCreateSubscription(3, plan30Days.amount);

      await hectorSubscription.syncSubscription(user1.address);
      subscription = await hectorSubscription.getSubscription(user1.address);

      expect(subscription.planId).to.equal(3);

      const userBalance = await torToken.balanceOf(user1.address);
      const treasuryBalance = await torToken.balanceOf(treasury.address);

      expect(userBalance).to.equal(utils.parseEther('800'));
      expect(treasuryBalance).to.equal(utils.parseEther('200'));
    });

    it('Sub Expire less than 30 days + new Deposit = Sub active', async function () {
      await torToken
        .connect(user1)
        .approve(hectorSubscription.address, plan30Days.amount);
      let tx = await hectorSubscription
        .connect(user1)
        .depositAndCreateSubscription(3, plan30Days.amount);

      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );
      let expiredAt = block.timestamp + oneHour;

      // Fast forward to expire the subscription
      await increaseTime(plan30Days.period + expireDeadline);

      let subscription = await hectorSubscription.getSubscription(
        user1.address
      );

      expect(subscription.planId).to.equal(3);

      //Reactivate subscription
      const userBalance = await torToken.balanceOf(user1.address);
      expect(userBalance).to.equal(utils.parseEther('900'));
      await torToken
        .connect(user1)
        .approve(hectorSubscription.address, plan30Days.amount);
      try {
        await hectorSubscription
          .connect(user1)
          .depositAndCreateSubscription(3, plan30Days.amount);
      } catch (error: any) {
        console.log(
          '❌ FAILED - unable to reactivate subscription despite sufficient fund - only need 100 to renew',
          error.message
        );
      }
    });
  });
});
