import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { BigNumber, utils } from 'ethers';
import { increaseTime, getTimeStamp } from './../helper';
import {
  HectorSubscriptionV2Factory,
  HectorSubscriptionV2,
  RewardToken,
  HectorRefund,
  PriceOracleAggregator,
  MockOracle,
  HectorCoupon,
  HectorDiscount,
} from '../types';

describe('HectorSubscriptionV2', function () {
  let deployer: SignerWithAddress;
  let upgradeableAdmin: SignerWithAddress;
  let owner: SignerWithAddress;
  let treasury: SignerWithAddress;

  let hectorToken: RewardToken;
  let torToken: RewardToken;

  let hectorCoupon: HectorCoupon;
  let hectorRefund: HectorRefund;
  let hectorDiscount: HectorDiscount;
  let priceOracleAggregator: PriceOracleAggregator;

  let hectorSubscriptionFactory: HectorSubscriptionV2Factory;
  let hectorSubscriptionLogic: HectorSubscriptionV2;
  let hectorSubscription: HectorSubscriptionV2;

  let product = 'TestProduct';
  let productBytes = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(product));

  let oneHour = 3600 * 1;
  let twoHour = 3600 * 2;

  let priceOne = ethers.utils.parseUnits('100', 8); // 100$
  let priceTwo = ethers.utils.parseUnits('200', 8); // 200$

  let hectorPrice = ethers.utils.parseUnits('10', 8); // 10$
  let torPrice = ethers.utils.parseUnits('1', 8); // 1$

  let hectorAmount = ethers.utils.parseEther(
    priceOne.div(hectorPrice).toString()
  );
  let torAmount = ethers.utils.parseEther(priceTwo.div(torPrice).toString());

  beforeEach(async function () {
    [deployer, upgradeableAdmin, owner, treasury] = await ethers.getSigners();

    /// Token
    const TokenFactory = await ethers.getContractFactory('RewardToken');
    hectorToken = (await TokenFactory.deploy()) as RewardToken;
    torToken = (await TokenFactory.deploy()) as RewardToken;

    /// Coupon
    const HectorCoupon = await ethers.getContractFactory('HectorCoupon');
    await upgrades.silenceWarnings();
    hectorCoupon = (await upgrades.deployProxy(HectorCoupon, [], {
      unsafeAllow: ['delegatecall'],
    })) as HectorCoupon;

    /// Refund
    const HectorRefund = await ethers.getContractFactory('HectorRefund');
    await upgrades.silenceWarnings();
    hectorRefund = (await upgrades.deployProxy(HectorRefund, [], {
      unsafeAllow: ['delegatecall'],
    })) as HectorRefund;
    await hectorRefund.appendRefund(
      product,
      [1, 2],
      [
        [
          { limitPeriod: oneHour / 4, percent: 10000 }, // 15 mins: 100%
          { limitPeriod: oneHour / 2, percent: 5000 }, // 30 mins: 50%
          { limitPeriod: (oneHour * 3) / 4, percent: 1000 }, // 45 mins: 10%
        ],
        [
          { limitPeriod: twoHour / 4, percent: 10000 }, // 30 mins: 100%
          { limitPeriod: twoHour / 2, percent: 5000 }, // 60 mins: 50%
          { limitPeriod: (twoHour * 3) / 4, percent: 1000 }, // 90 mins: 10%
        ],
      ]
    );

    /// Discount
    const HectorDiscount = await ethers.getContractFactory('HectorDiscount');
    await upgrades.silenceWarnings();
    hectorDiscount = (await upgrades.deployProxy(HectorDiscount, [], {
      unsafeAllow: ['delegatecall'],
    })) as HectorDiscount;

    /// Oracle
    const Oracle = await ethers.getContractFactory('MockOracle');
    const hectorOracle = (await Oracle.deploy(
      hectorToken.address,
      hectorPrice
    )) as MockOracle;
    const torOracle = (await Oracle.deploy(
      torToken.address,
      torPrice
    )) as MockOracle;

    const PriceOracleAggregator = await ethers.getContractFactory(
      'PriceOracleAggregator'
    );
    priceOracleAggregator =
      (await PriceOracleAggregator.deploy()) as PriceOracleAggregator;
    await priceOracleAggregator.updateOracleForAsset(
      hectorToken.address,
      hectorOracle.address
    );
    await priceOracleAggregator.updateOracleForAsset(
      torToken.address,
      torOracle.address
    );

    /// Subscription
    const HectorSubscription = await ethers.getContractFactory(
      'HectorSubscriptionV2'
    );
    hectorSubscriptionLogic =
      (await HectorSubscription.deploy()) as HectorSubscriptionV2;

    const HectorSubscriptionFactory = await ethers.getContractFactory(
      'HectorSubscriptionV2Factory'
    );
    await upgrades.silenceWarnings();
    hectorSubscriptionFactory = (await upgrades.deployProxy(
      HectorSubscriptionFactory,
      [
        hectorSubscriptionLogic.address,
        upgradeableAdmin.address,
        hectorCoupon.address,
        hectorRefund.address,
        hectorDiscount.address,
        priceOracleAggregator.address,
      ],
      {
        unsafeAllow: ['delegatecall'],
      }
    )) as HectorSubscriptionV2Factory;

    await hectorSubscriptionFactory.createHectorSubscriptionContract(
      product,
      treasury.address
    );
    hectorSubscription = (await ethers.getContractAt(
      'HectorSubscriptionV2',
      await hectorSubscriptionFactory.getHectorSubscriptionContractByName(
        productBytes
      )
    )) as HectorSubscriptionV2;

    await hectorSubscription.appendPlan([
      {
        token: hectorToken.address,
        period: oneHour,
        price: priceOne,
        data: '0x00',
      },
      {
        token: torToken.address,
        period: twoHour,
        price: priceTwo,
        data: '0x00',
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
    it('coupon service', async function () {
      expect(await hectorSubscriptionFactory.couponService()).equal(
        hectorCoupon.address
      );
    });
    it('refund service', async function () {
      expect(await hectorSubscriptionFactory.refundService()).equal(
        hectorRefund.address
      );
    });
    it('price oracle aggregator', async function () {
      expect(await hectorSubscriptionFactory.priceOracleAggregator()).equal(
        priceOracleAggregator.address
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
      expect(plans[1].price).equal(priceOne);
      expect(plans[1].data).equal('0x00');

      expect(plans[2].token).equal(torToken.address);
      expect(plans[2].period).equal(twoHour);
      expect(plans[2].price).equal(priceTwo);
      expect(plans[2].data).equal('0x00');
    });

    it('all plans with token price', async function () {
      let info = await hectorSubscription.allPlansWithTokenPrice();
      let plans = info[0];
      let planDiscountedPrices = info[1];
      let tokenPrices = info[2];
      let tokenAmounts = info[3];

      expect(plans.length).equal(3);
      expect(planDiscountedPrices.length).equal(3);
      expect(tokenPrices.length).equal(3);
      expect(tokenAmounts.length).equal(3);

      expect(plans[1].token).equal(hectorToken.address);
      expect(plans[1].period).equal(oneHour);
      expect(plans[1].price).equal(priceOne);
      expect(plans[1].data).equal('0x00');
      expect(planDiscountedPrices[1]).equal(priceOne);
      expect(tokenPrices[1]).equal(hectorPrice);
      expect(tokenAmounts[1]).equal(hectorAmount);

      expect(plans[2].token).equal(torToken.address);
      expect(plans[2].period).equal(twoHour);
      expect(plans[2].price).equal(priceTwo);
      expect(plans[2].data).equal('0x00');
      expect(planDiscountedPrices[2]).equal(priceTwo);
      expect(tokenPrices[2]).equal(torPrice);
      expect(tokenAmounts[2]).equal(torAmount);
    });

    it('append plan', async function () {
      let tx = await hectorSubscription.appendPlan([
        {
          token: hectorToken.address,
          period: twoHour,
          price: priceTwo,
          data: '0x00',
        },
      ]);

      await expect(tx)
        .to.emit(hectorSubscription, 'PlanUpdated')
        .withArgs(3, hectorToken.address, twoHour, priceTwo, '0x00');

      let plans = await hectorSubscription.allPlans();
      expect(plans.length).equal(4);
      expect(plans[3].token).equal(hectorToken.address);
      expect(plans[3].period).equal(twoHour);
      expect(plans[3].price).equal(priceTwo);
      expect(plans[3].data).equal('0x00');
    });

    it('update plan', async function () {
      let tx = await hectorSubscription.updatePlan(
        [2],
        [
          {
            token: hectorToken.address,
            period: twoHour,
            price: priceTwo,
            data: '0x00',
          },
        ]
      );

      await expect(tx)
        .to.emit(hectorSubscription, 'PlanUpdated')
        .withArgs(2, hectorToken.address, twoHour, priceTwo, '0x00');

      let plans = await hectorSubscription.allPlans();
      expect(plans.length).equal(3);
      expect(plans[2].token).equal(hectorToken.address);
      expect(plans[2].period).equal(twoHour);
      expect(plans[2].price).equal(priceTwo);
      expect(plans[2].data).equal('0x00');
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
      await hectorSubscription
        .connect(owner)
        .deposit(hectorToken.address, hectorAmount);
    });

    it('invalid plan', async function () {
      await expect(
        hectorSubscription.connect(owner).createSubscription(3)
      ).to.be.revertedWith('INVALID_PLAN()');
    });

    it('insufficient fund', async function () {
      await torToken.connect(owner).approve(hectorSubscription.address, 0);

      await expect(
        hectorSubscription.connect(owner).createSubscription(2)
      ).to.be.revertedWith('ERC20: transfer amount exceeds allowance');
    });

    it('to create subscription for existing deposit', async function () {
      let amountToDeposit = await hectorSubscription.toCreateSubscription(
        owner.address,
        1
      );

      expect(amountToDeposit).equal(0);
    });

    it('to create subscription for no deposit', async function () {
      let amountToDeposit = await hectorSubscription.toCreateSubscription(
        owner.address,
        2
      );

      expect(amountToDeposit).equal(torAmount);
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
        .withArgs(owner.address, 1, priceOne, hectorAmount, expiredAt);

      let subscription = await hectorSubscription.subscriptions(owner.address);

      expect(subscription.planId).equal(1);
      expect(subscription.expiredAt).equal(expiredAt);
      expect(subscription.lastPaidAt).equal(block.timestamp);
      expect(subscription.lastAmountPaidInUsd).equal(priceOne);
      expect(subscription.lastAmountPaid).equal(hectorAmount);

      expect(await hectorToken.balanceOf(treasury.address)).equal(
        ethers.constants.Zero
      );
      expect(await hectorToken.balanceOf(hectorSubscription.address)).equal(
        hectorAmount
      );
    });

    it('create subscription again', async function () {
      await hectorSubscription.connect(owner).createSubscription(1);

      await expect(
        hectorSubscription.connect(owner).createSubscription(2)
      ).to.be.revertedWith('ACTIVE_SUBSCRIPTION()');
    });

    it('deposit and create subscription', async function () {
      let tx = await hectorSubscription.connect(owner).createSubscription(2);
      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );
      let expiredAt = block.timestamp + twoHour;

      await expect(tx)
        .to.emit(hectorSubscription, 'PayerDeposit')
        .withArgs(owner.address, torToken.address, torAmount);
      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionCreated')
        .withArgs(owner.address, 2, priceTwo, torAmount, expiredAt);

      let subscription = await hectorSubscription.subscriptions(owner.address);

      expect(subscription.planId).equal(2);
      expect(subscription.expiredAt).equal(expiredAt);
      expect(subscription.lastPaidAt).equal(block.timestamp);
      expect(subscription.lastAmountPaidInUsd).equal(priceTwo);
      expect(subscription.lastAmountPaid).equal(torAmount);

      expect(await torToken.balanceOf(treasury.address)).equal(
        ethers.constants.Zero
      );
      expect(await torToken.balanceOf(hectorSubscription.address)).equal(
        torAmount
      );
    });
  });

  describe('#subscription - sync', () => {
    let planId = 1;
    let expiredAt: number;
    let dueDate: number;
    let amount = hectorAmount.mul(3);

    beforeEach(async function () {
      await hectorSubscription
        .connect(owner)
        .deposit(hectorToken.address, amount);
      let tx = await hectorSubscription
        .connect(owner)
        .createSubscription(planId);
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
      ).equal(amount.sub(hectorAmount));

      expect(await hectorToken.balanceOf(treasury.address)).equal(
        ethers.constants.Zero
      );
      expect(await hectorToken.balanceOf(hectorSubscription.address)).equal(
        amount
      );
    });

    it('sync subscription after 1 hour', async function () {
      await increaseTime(oneHour);

      let tx = await hectorSubscription.syncSubscription(owner.address);

      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionSynced')
        .withArgs(
          owner.address,
          planId,
          expiredAt,
          priceOne,
          hectorAmount,
          hectorAmount,
          expiredAt + oneHour
        );
      await expect(tx)
        .emit(hectorSubscription, 'Funded')
        .withArgs(hectorToken.address, hectorAmount);

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
      ).equal(amount.sub(hectorAmount.mul(2)));

      expect(await hectorToken.balanceOf(treasury.address)).equal(hectorAmount);
      expect(await hectorToken.balanceOf(hectorSubscription.address)).equal(
        amount.sub(hectorAmount)
      );
    });

    it('sync subscription after 2 hours', async function () {
      await increaseTime(twoHour);

      let tx = await hectorSubscription.syncSubscription(owner.address);

      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionSynced')
        .withArgs(
          owner.address,
          planId,
          expiredAt + oneHour,
          priceOne,
          hectorAmount,
          hectorAmount.mul(2),
          expiredAt + twoHour
        );
      await expect(tx)
        .emit(hectorSubscription, 'Funded')
        .withArgs(hectorToken.address, hectorAmount.mul(2));

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
      ).equal(amount.sub(hectorAmount.mul(3)));

      expect(await hectorToken.balanceOf(treasury.address)).equal(
        hectorAmount.mul(2)
      );
      expect(await hectorToken.balanceOf(hectorSubscription.address)).equal(
        amount.sub(hectorAmount.mul(2))
      );
    });

    it('sync subscription after 3 hours', async function () {
      await increaseTime(oneHour + twoHour);

      let tx = await hectorSubscription.syncSubscription(owner.address);

      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionSynced')
        .withArgs(
          owner.address,
          planId,
          expiredAt + oneHour,
          ethers.constants.Zero,
          ethers.constants.Zero,
          hectorAmount.mul(2),
          expiredAt + twoHour
        );
      await expect(tx)
        .emit(hectorSubscription, 'Funded')
        .withArgs(hectorToken.address, hectorAmount.mul(3));

      let subscription = await hectorSubscription.getSubscription(
        owner.address
      );
      expect(subscription.planId).equal(planId);
      expect(subscription.expiredAt).equal(expiredAt + twoHour);
      expect(subscription.isCancelled).equal(false);
      expect(subscription.isActiveForNow).equal(false);
      expect(subscription.dueDate).equal(dueDate);

      expect(
        await hectorSubscription.balanceOf(owner.address, hectorToken.address)
      ).equal(amount.sub(hectorAmount.mul(3)));

      expect(await hectorToken.balanceOf(treasury.address)).equal(
        hectorAmount.mul(3)
      );
      expect(await hectorToken.balanceOf(hectorSubscription.address)).equal(
        amount.sub(hectorAmount.mul(3))
      );
    });

    it('sync subscription after 2 months', async function () {
      await increaseTime(oneHour * 24 * 30 * 2);

      let tx = await hectorSubscription.syncSubscription(owner.address);

      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionSynced')
        .withArgs(
          owner.address,
          ethers.constants.Zero,
          expiredAt + oneHour,
          ethers.constants.Zero,
          ethers.constants.Zero,
          hectorAmount.mul(2),
          expiredAt + twoHour
        );
      await expect(tx)
        .emit(hectorSubscription, 'Funded')
        .withArgs(hectorToken.address, hectorAmount.mul(3));

      let subscription = await hectorSubscription.getSubscription(
        owner.address
      );
      expect(subscription.planId).equal(0);
      expect(subscription.expiredAt).equal(expiredAt + twoHour);
      expect(subscription.isCancelled).equal(true);
      expect(subscription.isActiveForNow).equal(false);
      expect(subscription.dueDate).equal(dueDate);

      expect(
        await hectorSubscription.balanceOf(owner.address, hectorToken.address)
      ).equal(amount.sub(hectorAmount.mul(3)));

      expect(await hectorToken.balanceOf(treasury.address)).equal(
        hectorAmount.mul(3)
      );
      expect(await hectorToken.balanceOf(hectorSubscription.address)).equal(
        amount.sub(hectorAmount.mul(3))
      );
    });
  });

  describe('#subscription - cancel', () => {
    let planId = 1;
    let expiredAt: number;
    let amount = hectorAmount.mul(3);

    beforeEach(async function () {
      await hectorSubscription
        .connect(owner)
        .deposit(hectorToken.address, amount);
      let tx = await hectorSubscription
        .connect(owner)
        .createSubscription(planId);
      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );
      expiredAt = block.timestamp + oneHour;
    });

    it('cancel subscription in 0 ~ 15 mins (100% refund)', async function () {
      let tx = await hectorSubscription.connect(owner).cancelSubscription();
      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );
      let refundAmount = hectorAmount;

      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionCancelled')
        .withArgs(owner.address, planId);
      await expect(tx)
        .emit(hectorSubscription, 'Refunded')
        .withArgs(owner.address, hectorToken.address, refundAmount);
      await expect(tx).not.emit(hectorSubscription, 'Funded');

      let subscription = await hectorSubscription.getSubscription(
        owner.address
      );
      expect(subscription.planId).equal(0);
      expect(subscription.expiredAt).equal(block.timestamp);
      expect(subscription.isCancelled).equal(true);
      expect(subscription.isActiveForNow).equal(false);
      expect(subscription.dueDate).equal(block.timestamp);

      expect(await hectorToken.balanceOf(treasury.address)).equal(
        hectorAmount.sub(refundAmount)
      );
      expect(await hectorToken.balanceOf(hectorSubscription.address)).equal(
        amount.sub(hectorAmount)
      );
    });

    it('cancel subscription in 15 ~ 30 mins (50% refund)', async function () {
      await increaseTime(oneHour / 4);

      let tx = await hectorSubscription.connect(owner).cancelSubscription();
      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );
      let refundAmount = hectorAmount.div(2);

      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionCancelled')
        .withArgs(owner.address, planId);
      await expect(tx)
        .emit(hectorSubscription, 'Refunded')
        .withArgs(owner.address, hectorToken.address, refundAmount);
      await expect(tx)
        .emit(hectorSubscription, 'Funded')
        .withArgs(hectorToken.address, hectorAmount.sub(refundAmount));

      let subscription = await hectorSubscription.getSubscription(
        owner.address
      );
      expect(subscription.planId).equal(0);
      expect(subscription.expiredAt).equal(block.timestamp);
      expect(subscription.isCancelled).equal(true);
      expect(subscription.isActiveForNow).equal(false);
      expect(subscription.dueDate).equal(block.timestamp);

      expect(await hectorToken.balanceOf(treasury.address)).equal(
        hectorAmount.sub(refundAmount)
      );
      expect(await hectorToken.balanceOf(hectorSubscription.address)).equal(
        amount.sub(hectorAmount)
      );
    });

    it('cancel subscription in 30 ~ 45 mins (10% refund)', async function () {
      await increaseTime(oneHour / 2);

      let tx = await hectorSubscription.connect(owner).cancelSubscription();
      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );
      let refundAmount = hectorAmount.div(10);

      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionCancelled')
        .withArgs(owner.address, planId);
      await expect(tx)
        .emit(hectorSubscription, 'Refunded')
        .withArgs(owner.address, hectorToken.address, refundAmount);
      await expect(tx)
        .emit(hectorSubscription, 'Funded')
        .withArgs(hectorToken.address, hectorAmount.sub(refundAmount));

      let subscription = await hectorSubscription.getSubscription(
        owner.address
      );
      expect(subscription.planId).equal(0);
      expect(subscription.expiredAt).equal(block.timestamp);
      expect(subscription.isCancelled).equal(true);
      expect(subscription.isActiveForNow).equal(false);
      expect(subscription.dueDate).equal(block.timestamp);

      expect(await hectorToken.balanceOf(treasury.address)).equal(
        hectorAmount.sub(refundAmount)
      );
      expect(await hectorToken.balanceOf(hectorSubscription.address)).equal(
        amount.sub(hectorAmount)
      );
    });

    it('cancel subscription in 45 ~ 60 mins (0% refund)', async function () {
      await increaseTime((oneHour * 3) / 4);

      let tx = await hectorSubscription.connect(owner).cancelSubscription();
      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );
      let refundAmount = ethers.constants.Zero;

      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionCancelled')
        .withArgs(owner.address, planId);
      await expect(tx).not.emit(hectorSubscription, 'Refunded');
      await expect(tx)
        .emit(hectorSubscription, 'Funded')
        .withArgs(hectorToken.address, hectorAmount.sub(refundAmount));

      let subscription = await hectorSubscription.getSubscription(
        owner.address
      );
      expect(subscription.planId).equal(0);
      expect(subscription.expiredAt).equal(block.timestamp);
      expect(subscription.isCancelled).equal(true);
      expect(subscription.isActiveForNow).equal(false);
      expect(subscription.dueDate).equal(block.timestamp);

      expect(await hectorToken.balanceOf(treasury.address)).equal(
        hectorAmount.sub(refundAmount)
      );
      expect(await hectorToken.balanceOf(hectorSubscription.address)).equal(
        amount.sub(hectorAmount)
      );
    });

    it('cancel subscription again', async function () {
      await hectorSubscription.connect(owner).cancelSubscription();

      await expect(
        hectorSubscription.connect(owner).cancelSubscription()
      ).revertedWith('INACTIVE_SUBSCRIPTION()');
    });
  });

  describe('#subscription - modify', () => {
    it('invalid plan', async function () {
      let planId = 1;

      await hectorSubscription
        .connect(owner)
        .deposit(hectorToken.address, hectorAmount);
      await hectorSubscription.connect(owner).createSubscription(planId);

      await expect(
        hectorSubscription.connect(owner).modifySubscription(3)
      ).to.be.revertedWith('INVALID_PLAN()');

      await expect(
        hectorSubscription.connect(owner).modifySubscription(planId)
      ).to.be.revertedWith('INVALID_PLAN()');
    });

    describe('for upgrade', () => {
      let planId = 1;
      let newPlanId = 2;

      beforeEach(async function () {
        await hectorSubscription
          .connect(owner)
          .deposit(hectorToken.address, hectorAmount);
        await hectorSubscription.connect(owner).createSubscription(planId);
      });

      it('to modify subscription for different token in 0 ~ 15 mins (100% refund)', async function () {
        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let refundPrice = priceOne;
        let torDepositAmount = ethers.utils.parseEther(
          priceTwo.sub(refundPrice).div(torPrice).toString()
        );

        expect(amountToDeposit).equal(torDepositAmount);
      });

      it('to modify subscription for different token in 15 ~ 30 mins (50% refund)', async function () {
        await increaseTime(oneHour / 4);

        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let refundPrice = priceOne.div(2);
        let torDepositAmount = ethers.utils.parseEther(
          priceTwo.sub(refundPrice).div(torPrice).toString()
        );

        expect(amountToDeposit).equal(torDepositAmount);
      });

      it('to modify subscription for different token in 30 ~ 45 mins (10% refund)', async function () {
        await increaseTime(oneHour / 2);

        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let refundPrice = priceOne.div(10);
        let torDepositAmount = ethers.utils.parseEther(
          priceTwo.sub(refundPrice).div(torPrice).toString()
        );

        expect(amountToDeposit).equal(torDepositAmount);
      });

      it('to modify subscription for different token in 45 ~ 60 mins (0% refund)', async function () {
        await increaseTime((oneHour * 3) / 4);

        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let refundPrice = ethers.constants.Zero;
        let torDepositAmount = ethers.utils.parseEther(
          priceTwo.sub(refundPrice).div(torPrice).toString()
        );

        expect(amountToDeposit).equal(torDepositAmount);
      });

      it('to modify subscription for same token in 0 ~ 15 mins (100% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: twoHour,
              price: priceTwo,
              data: '0x00',
            },
          ]
        );

        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let refundPrice = priceOne;
        let hectorDepositAmount = ethers.utils.parseEther(
          priceTwo.sub(refundPrice).div(hectorPrice).toString()
        );

        expect(amountToDeposit).equal(hectorDepositAmount);
      });

      it('to modify subscription for same token in 15 ~ 30 mins (50% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: twoHour,
              price: priceTwo,
              data: '0x00',
            },
          ]
        );

        await increaseTime(oneHour / 4);

        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let refundPrice = priceOne.div(2);
        let hectorDepositAmount = ethers.utils.parseEther(
          priceTwo.sub(refundPrice).div(hectorPrice).toString()
        );

        expect(amountToDeposit).equal(hectorDepositAmount);
      });

      it('to modify subscription for same token in 30 ~ 45 mins (10% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: twoHour,
              price: priceTwo,
              data: '0x00',
            },
          ]
        );

        await increaseTime(oneHour / 2);

        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let refundPrice = priceOne.div(10);
        let hectorDepositAmount = ethers.utils.parseEther(
          priceTwo.sub(refundPrice).div(hectorPrice).toString()
        );

        expect(amountToDeposit).equal(hectorDepositAmount);
      });

      it('to modify subscription for same token in 45 ~ 60 mins (0% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: twoHour,
              price: priceTwo,
              data: '0x00',
            },
          ]
        );

        await increaseTime((oneHour * 3) / 4);

        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let refundPrice = ethers.constants.Zero;
        let hectorDepositAmount = ethers.utils.parseEther(
          priceTwo.sub(refundPrice).div(hectorPrice).toString()
        );

        expect(amountToDeposit).equal(hectorDepositAmount);
      });

      it('modify subscription for different token in 0 ~ 15 mins (100% refund)', async function () {
        let tx = await hectorSubscription
          .connect(owner)
          .modifySubscription(newPlanId);
        let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
          tx.hash
        );
        let block = await hectorSubscription.provider.getBlock(
          txReceipt.blockNumber
        );

        let refundPrice = priceOne;
        let payPrice = priceTwo.sub(refundPrice);
        let torDepositAmount = ethers.utils.parseEther(
          payPrice.div(torPrice).toString()
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            torDepositAmount,
            block.timestamp + twoHour
          );
        await expect(tx)
          .emit(hectorSubscription, 'PayerDeposit')
          .withArgs(owner.address, torToken.address, torDepositAmount);
        await expect(tx).not.emit(hectorSubscription, 'Refunded'); // need to pay more so no token for refund
        await expect(tx)
          .emit(hectorSubscription, 'Funded')
          .withArgs(hectorToken.address, hectorAmount);
      });

      it('modify subscription for different token in 15 ~ 30 mins (50% refund)', async function () {
        await increaseTime(oneHour / 4);

        let tx = await hectorSubscription
          .connect(owner)
          .modifySubscription(newPlanId);
        let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
          tx.hash
        );
        let block = await hectorSubscription.provider.getBlock(
          txReceipt.blockNumber
        );

        let refundPrice = priceOne.div(2);
        let payPrice = priceTwo.sub(refundPrice);
        let torDepositAmount = ethers.utils.parseEther(
          payPrice.div(torPrice).toString()
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            torDepositAmount,
            block.timestamp + twoHour
          );
        await expect(tx)
          .emit(hectorSubscription, 'PayerDeposit')
          .withArgs(owner.address, torToken.address, torDepositAmount);
        await expect(tx).not.emit(hectorSubscription, 'Refunded'); // need to pay more so no token for refund
        await expect(tx)
          .emit(hectorSubscription, 'Funded')
          .withArgs(hectorToken.address, hectorAmount);
      });

      it('modify subscription for different token in 30 ~ 45 mins (10% refund)', async function () {
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

        let refundPrice = priceOne.div(10);
        let payPrice = priceTwo.sub(refundPrice);
        let torDepositAmount = ethers.utils.parseEther(
          payPrice.div(torPrice).toString()
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            torDepositAmount,
            block.timestamp + twoHour
          );
        await expect(tx)
          .emit(hectorSubscription, 'PayerDeposit')
          .withArgs(owner.address, torToken.address, torDepositAmount);
        await expect(tx).not.emit(hectorSubscription, 'Refunded'); // need to pay more so no token for refund
        await expect(tx)
          .emit(hectorSubscription, 'Funded')
          .withArgs(hectorToken.address, hectorAmount);
      });

      it('modify subscription for different token in 45 ~ 60 mins (0% refund)', async function () {
        await increaseTime((oneHour * 3) / 4);

        let tx = await hectorSubscription
          .connect(owner)
          .modifySubscription(newPlanId);
        let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
          tx.hash
        );
        let block = await hectorSubscription.provider.getBlock(
          txReceipt.blockNumber
        );

        let refundPrice = ethers.constants.Zero;
        let payPrice = priceTwo.sub(refundPrice);
        let torDepositAmount = ethers.utils.parseEther(
          payPrice.div(torPrice).toString()
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            torDepositAmount,
            block.timestamp + twoHour
          );
        await expect(tx)
          .emit(hectorSubscription, 'PayerDeposit')
          .withArgs(owner.address, torToken.address, torDepositAmount);
        await expect(tx).not.emit(hectorSubscription, 'Refunded'); // need to pay more so no token for refund
        await expect(tx)
          .emit(hectorSubscription, 'Funded')
          .withArgs(hectorToken.address, hectorAmount);
      });

      it('modify subscription for same token in 0 ~ 15 mins (100% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: twoHour,
              price: priceTwo,
              data: '0x00',
            },
          ]
        );

        let tx = await hectorSubscription
          .connect(owner)
          .modifySubscription(newPlanId);
        let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
          tx.hash
        );
        let block = await hectorSubscription.provider.getBlock(
          txReceipt.blockNumber
        );

        let refundPrice = priceOne;
        let payPrice = priceTwo.sub(refundPrice);
        let hectorDepositAmount = ethers.utils.parseEther(
          payPrice.div(hectorPrice).toString()
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            hectorDepositAmount,
            block.timestamp + twoHour
          );
        await expect(tx)
          .emit(hectorSubscription, 'PayerDeposit')
          .withArgs(owner.address, hectorToken.address, hectorDepositAmount);
        await expect(tx).not.emit(hectorSubscription, 'Refunded'); // need to pay more so no token for refund
        await expect(tx)
          .emit(hectorSubscription, 'Funded')
          .withArgs(hectorToken.address, hectorAmount);
      });

      it('modify subscription for same token in 15 ~ 30 mins (50% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: twoHour,
              price: priceTwo,
              data: '0x00',
            },
          ]
        );

        await increaseTime(oneHour / 4);

        let tx = await hectorSubscription
          .connect(owner)
          .modifySubscription(newPlanId);
        let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
          tx.hash
        );
        let block = await hectorSubscription.provider.getBlock(
          txReceipt.blockNumber
        );

        let refundPrice = priceOne.div(2);
        let payPrice = priceTwo.sub(refundPrice);
        let hectorDepositAmount = ethers.utils.parseEther(
          payPrice.div(hectorPrice).toString()
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            hectorDepositAmount,
            block.timestamp + twoHour
          );
        await expect(tx)
          .emit(hectorSubscription, 'PayerDeposit')
          .withArgs(owner.address, hectorToken.address, hectorDepositAmount);
        await expect(tx).not.emit(hectorSubscription, 'Refunded'); // need to pay more so no token for refund
        await expect(tx)
          .emit(hectorSubscription, 'Funded')
          .withArgs(hectorToken.address, hectorAmount);
      });

      it('modify subscription for same token in 30 ~ 45 mins (10% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: twoHour,
              price: priceTwo,
              data: '0x00',
            },
          ]
        );

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

        let refundPrice = priceOne.div(10);
        let payPrice = priceTwo.sub(refundPrice);
        let hectorDepositAmount = ethers.utils.parseEther(
          payPrice.div(hectorPrice).toString()
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            hectorDepositAmount,
            block.timestamp + twoHour
          );
        await expect(tx)
          .emit(hectorSubscription, 'PayerDeposit')
          .withArgs(owner.address, hectorToken.address, hectorDepositAmount);
        await expect(tx).not.emit(hectorSubscription, 'Refunded'); // need to pay more so no token for refund
        await expect(tx)
          .emit(hectorSubscription, 'Funded')
          .withArgs(hectorToken.address, hectorAmount);
      });

      it('modify subscription for same token in 45 ~ 60 mins (0% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: twoHour,
              price: priceTwo,
              data: '0x00',
            },
          ]
        );

        await increaseTime((oneHour * 3) / 4);

        let tx = await hectorSubscription
          .connect(owner)
          .modifySubscription(newPlanId);
        let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
          tx.hash
        );
        let block = await hectorSubscription.provider.getBlock(
          txReceipt.blockNumber
        );

        let refundPrice = ethers.constants.Zero;
        let payPrice = priceTwo.sub(refundPrice);
        let hectorDepositAmount = ethers.utils.parseEther(
          payPrice.div(hectorPrice).toString()
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            hectorDepositAmount,
            block.timestamp + twoHour
          );
        await expect(tx)
          .emit(hectorSubscription, 'PayerDeposit')
          .withArgs(owner.address, hectorToken.address, hectorDepositAmount);
        await expect(tx).not.emit(hectorSubscription, 'Refunded'); // need to pay more so no token for refund
        await expect(tx)
          .emit(hectorSubscription, 'Funded')
          .withArgs(hectorToken.address, hectorAmount);
      });
    });

    describe('for downgrade', () => {
      let planId = 1;
      let newPlanId = 2;
      let hectorAmount: BigNumber;
      let torAmount: BigNumber;

      beforeEach(async function () {
        await hectorSubscription.updatePlan(
          [1, 2],
          [
            {
              token: hectorToken.address,
              period: twoHour,
              price: priceTwo,
              data: '0x00',
            },
            {
              token: torToken.address,
              period: oneHour,
              price: priceOne,
              data: '0x00',
            },
          ]
        );
        hectorAmount = ethers.utils.parseEther(
          priceTwo.div(hectorPrice).toString()
        );
        torAmount = ethers.utils.parseEther(priceOne.div(torPrice).toString());

        await hectorSubscription
          .connect(owner)
          .deposit(hectorToken.address, hectorAmount);
        await hectorSubscription.connect(owner).createSubscription(planId);
      });

      it('to modify subscription for different token in 0 ~ 15 mins (100% refund)', async function () {
        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let torDepositAmount = ethers.constants.Zero; // refund is enough so no need to deposit more

        expect(amountToDeposit).equal(torDepositAmount);
      });

      it('to modify subscription for different token in 15 ~ 30 mins (50% refund)', async function () {
        await increaseTime(oneHour / 4);

        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let refundPrice = priceTwo.div(2);
        let torDepositAmount = ethers.utils.parseEther(
          priceOne.sub(refundPrice).div(torPrice).toString()
        );

        expect(amountToDeposit).equal(torDepositAmount);
      });

      it('to modify subscription for different token in 30 ~ 45 mins (10% refund)', async function () {
        await increaseTime(oneHour / 2);

        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let refundPrice = priceTwo.div(10);
        let torDepositAmount = ethers.utils.parseEther(
          priceOne.sub(refundPrice).div(torPrice).toString()
        );

        expect(amountToDeposit).equal(torDepositAmount);
      });

      it('to modify subscription for different token in 45 ~ 60 mins (0% refund)', async function () {
        await increaseTime((oneHour * 3) / 4);

        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let refundPrice = ethers.constants.Zero;
        let torDepositAmount = ethers.utils.parseEther(
          priceOne.sub(refundPrice).div(torPrice).toString()
        );

        expect(amountToDeposit).equal(torDepositAmount);
      });

      it('to modify subscription for same token in 0 ~ 15 mins (100% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: oneHour,
              price: priceOne,
              data: '0x00',
            },
          ]
        );

        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let hectorDepositAmount = ethers.constants.Zero; // refund is enough so no need to deposit more

        expect(amountToDeposit).equal(hectorDepositAmount);
      });

      it('to modify subscription for same token in 15 ~ 30 mins (50% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: oneHour,
              price: priceOne,
              data: '0x00',
            },
          ]
        );

        await increaseTime(oneHour / 4);

        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let refundPrice = priceTwo.div(2);
        let hectorDepositAmount = ethers.utils.parseEther(
          priceOne.sub(refundPrice).div(hectorPrice).toString()
        );

        expect(amountToDeposit).equal(hectorDepositAmount);
      });

      it('to modify subscription for same token in 30 ~ 45 mins (10% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: oneHour,
              price: priceOne,
              data: '0x00',
            },
          ]
        );

        await increaseTime(oneHour / 2);

        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let refundPrice = priceTwo.div(10);
        let hectorDepositAmount = ethers.utils.parseEther(
          priceOne.sub(refundPrice).div(hectorPrice).toString()
        );

        expect(amountToDeposit).equal(hectorDepositAmount);
      });

      it('to modify subscription for same token in 45 ~ 60 mins (0% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: oneHour,
              price: priceOne,
              data: '0x00',
            },
          ]
        );

        await increaseTime((oneHour * 3) / 4);

        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let refundPrice = ethers.constants.Zero;
        let hectorDepositAmount = ethers.utils.parseEther(
          priceOne.sub(refundPrice).div(hectorPrice).toString()
        );

        expect(amountToDeposit).equal(hectorDepositAmount);
      });

      it('modify subscription for different token in 0 ~ 15 mins (100% refund)', async function () {
        let tx = await hectorSubscription
          .connect(owner)
          .modifySubscription(newPlanId);
        let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
          tx.hash
        );
        let block = await hectorSubscription.provider.getBlock(
          txReceipt.blockNumber
        );

        let refundPrice = priceTwo;
        let hectorRefundAmount = ethers.utils.parseEther(
          refundPrice.sub(priceOne).div(hectorPrice).toString()
        );
        let payPrice = ethers.constants.Zero; // refund is enough so no need to deposit more
        let torDepositAmount = ethers.utils.parseEther(
          payPrice.div(torPrice).toString()
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            torDepositAmount,
            block.timestamp + oneHour
          );
        await expect(tx).not.emit(hectorSubscription, 'PayerDeposit'); // refund is enough so no need to deposit more
        await expect(tx)
          .emit(hectorSubscription, 'Refunded')
          .withArgs(owner.address, hectorToken.address, hectorRefundAmount);
        await expect(tx)
          .emit(hectorSubscription, 'Funded')
          .withArgs(hectorToken.address, hectorAmount.sub(hectorRefundAmount));
      });

      it('modify subscription for different token in 15 ~ 30 mins (50% refund)', async function () {
        await increaseTime(oneHour / 4);

        let tx = await hectorSubscription
          .connect(owner)
          .modifySubscription(newPlanId);
        let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
          tx.hash
        );
        let block = await hectorSubscription.provider.getBlock(
          txReceipt.blockNumber
        );

        let refundPrice = priceTwo.div(2);
        let hectorRefundAmount = ethers.utils.parseEther(
          refundPrice.sub(priceOne).div(hectorPrice).toString()
        );
        let payPrice = priceOne.sub(refundPrice);
        let torDepositAmount = ethers.utils.parseEther(
          payPrice.div(torPrice).toString()
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            torDepositAmount,
            block.timestamp + oneHour
          );
        await expect(tx).not.emit(hectorSubscription, 'PayerDeposit'); // refund is enough so no need to deposit more
        await expect(tx).not.emit(hectorSubscription, 'Refunded'); // refund is fully used to purchase a new subscription
        await expect(tx)
          .emit(hectorSubscription, 'Funded')
          .withArgs(hectorToken.address, hectorAmount.sub(hectorRefundAmount));
      });

      it('modify subscription for different token in 30 ~ 45 mins (10% refund)', async function () {
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

        let refundPrice = priceTwo.div(10);
        let hectorRefundAmount = ethers.constants.Zero; // refund is fully used to purchase a new subscription
        let payPrice = priceOne.sub(refundPrice);
        let torDepositAmount = ethers.utils.parseEther(
          payPrice.div(torPrice).toString()
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            torDepositAmount,
            block.timestamp + oneHour
          );
        await expect(tx)
          .emit(hectorSubscription, 'PayerDeposit')
          .withArgs(owner.address, torToken.address, torDepositAmount);
        await expect(tx).not.emit(hectorSubscription, 'Refunded'); // refund is fully used to purchase a new subscription
        await expect(tx)
          .emit(hectorSubscription, 'Funded')
          .withArgs(hectorToken.address, hectorAmount.sub(hectorRefundAmount));
      });

      it('modify subscription for different token in 45 ~ 60 mins (0% refund)', async function () {
        await increaseTime((oneHour * 3) / 4);

        let tx = await hectorSubscription
          .connect(owner)
          .modifySubscription(newPlanId);
        let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
          tx.hash
        );
        let block = await hectorSubscription.provider.getBlock(
          txReceipt.blockNumber
        );

        let refundPrice = ethers.constants.Zero;
        let hectorRefundAmount = ethers.constants.Zero; // refund is fully used to purchase a new subscription
        let payPrice = priceOne.sub(refundPrice);
        let torDepositAmount = ethers.utils.parseEther(
          payPrice.div(torPrice).toString()
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            torDepositAmount,
            block.timestamp + oneHour
          );
        await expect(tx)
          .emit(hectorSubscription, 'PayerDeposit')
          .withArgs(owner.address, torToken.address, torDepositAmount);
        await expect(tx).not.emit(hectorSubscription, 'Refunded'); // refund is fully used to purchase a new subscription
        await expect(tx)
          .emit(hectorSubscription, 'Funded')
          .withArgs(hectorToken.address, hectorAmount.sub(hectorRefundAmount));
      });

      it('modify subscription for same token in 0 ~ 15 mins (100% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: oneHour,
              price: priceOne,
              data: '0x00',
            },
          ]
        );

        let tx = await hectorSubscription
          .connect(owner)
          .modifySubscription(newPlanId);
        let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
          tx.hash
        );
        let block = await hectorSubscription.provider.getBlock(
          txReceipt.blockNumber
        );

        let refundPrice = priceTwo;
        let hectorRefundAmount = ethers.utils.parseEther(
          refundPrice.sub(priceOne).div(hectorPrice).toString()
        );
        let payPrice = priceTwo.sub(refundPrice);
        let hectorDepositAmount = ethers.utils.parseEther(
          payPrice.div(hectorPrice).toString()
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            hectorDepositAmount,
            block.timestamp + oneHour
          );
        await expect(tx).not.emit(hectorSubscription, 'PayerDeposit'); // refund is enough so no need to deposit more
        await expect(tx)
          .emit(hectorSubscription, 'Refunded')
          .withArgs(owner.address, hectorToken.address, hectorRefundAmount);
        await expect(tx)
          .emit(hectorSubscription, 'Funded')
          .withArgs(hectorToken.address, hectorAmount.sub(hectorRefundAmount));
      });

      it('modify subscription for same token in 15 ~ 30 mins (50% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: oneHour,
              price: priceOne,
              data: '0x00',
            },
          ]
        );

        await increaseTime(oneHour / 4);

        let tx = await hectorSubscription
          .connect(owner)
          .modifySubscription(newPlanId);
        let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
          tx.hash
        );
        let block = await hectorSubscription.provider.getBlock(
          txReceipt.blockNumber
        );

        let refundPrice = priceTwo.div(2);
        let hectorRefundAmount = ethers.utils.parseEther(
          refundPrice.sub(priceOne).div(hectorPrice).toString()
        );
        let payPrice = priceOne.sub(refundPrice);
        let hectorDepositAmount = ethers.utils.parseEther(
          payPrice.div(hectorPrice).toString()
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            hectorDepositAmount,
            block.timestamp + oneHour
          );
        await expect(tx).not.emit(hectorSubscription, 'PayerDeposit'); // refund is enough so no need to deposit more
        await expect(tx).not.emit(hectorSubscription, 'Refunded'); // refund is fully used to purchase a new subscription
        await expect(tx)
          .emit(hectorSubscription, 'Funded')
          .withArgs(hectorToken.address, hectorAmount.sub(hectorRefundAmount));
      });

      it('modify subscription for same token in 30 ~ 45 mins (10% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: oneHour,
              price: priceOne,
              data: '0x00',
            },
          ]
        );

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

        let refundPrice = priceTwo.div(10);
        let hectorRefundAmount = ethers.constants.Zero; // refund is fully used to purchase a new subscription
        let payPrice = priceOne.sub(refundPrice);
        let hectorDepositAmount = ethers.utils.parseEther(
          payPrice.div(hectorPrice).toString()
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            hectorDepositAmount,
            block.timestamp + oneHour
          );
        await expect(tx)
          .emit(hectorSubscription, 'PayerDeposit')
          .withArgs(owner.address, hectorToken.address, hectorDepositAmount);
        await expect(tx).not.emit(hectorSubscription, 'Refunded'); // refund is fully used to purchase a new subscription
        await expect(tx)
          .emit(hectorSubscription, 'Funded')
          .withArgs(hectorToken.address, hectorAmount.sub(hectorRefundAmount));
      });

      it('modify subscription for same token in 45 ~ 60 mins (0% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: oneHour,
              price: priceOne,
              data: '0x00',
            },
          ]
        );

        await increaseTime((oneHour * 3) / 4);

        let tx = await hectorSubscription
          .connect(owner)
          .modifySubscription(newPlanId);
        let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
          tx.hash
        );
        let block = await hectorSubscription.provider.getBlock(
          txReceipt.blockNumber
        );

        let refundPrice = ethers.constants.Zero;
        let hectorRefundAmount = ethers.constants.Zero; // refund is fully used to purchase a new subscription
        let payPrice = priceOne.sub(refundPrice);
        let hectorDepositAmount = ethers.utils.parseEther(
          payPrice.div(hectorPrice).toString()
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            hectorDepositAmount,
            block.timestamp + oneHour
          );
        await expect(tx)
          .emit(hectorSubscription, 'PayerDeposit')
          .withArgs(owner.address, hectorToken.address, hectorDepositAmount);
        await expect(tx).not.emit(hectorSubscription, 'Refunded'); // refund is fully used to purchase a new subscription
        await expect(tx)
          .emit(hectorSubscription, 'Funded')
          .withArgs(hectorToken.address, hectorAmount.sub(hectorRefundAmount));
      });
    });
  });

  describe('#subscription - create by mod', () => {
    it('invalid plan', async function () {
      await expect(
        hectorSubscription.createSubscriptionByMod(
          owner.address,
          3,
          hectorToken.address,
          hectorAmount
        )
      ).to.be.revertedWith('INVALID_PLAN()');
    });

    it('invalid moderator', async function () {
      await expect(
        hectorSubscription
          .connect(owner)
          .createSubscriptionByMod(
            owner.address,
            1,
            hectorToken.address,
            hectorAmount
          )
      ).to.be.revertedWith('INVALID_MODERATOR()');
    });

    it('insufficient fund', async function () {
      await expect(
        hectorSubscription.createSubscriptionByMod(
          owner.address,
          1,
          hectorToken.address,
          0
        )
      ).to.be.revertedWith('INSUFFICIENT_FUND()');
    });

    it('create subscription by mod', async function () {
      let tx = await hectorSubscription.createSubscriptionByMod(
        owner.address,
        1,
        hectorToken.address,
        hectorAmount
      );
      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );
      let expiredAt = block.timestamp + oneHour;

      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionCreated')
        .withArgs(owner.address, 1, priceOne, hectorAmount, expiredAt);
      await expect(tx)
        .emit(hectorSubscription, 'PayerDeposit')
        .withArgs(owner.address, hectorToken.address, hectorAmount);

      let subscription = await hectorSubscription.getSubscription(
        owner.address
      );

      expect(subscription.planId).equal(1);
      expect(subscription.expiredAt).equal(expiredAt);

      let subscriptionByMod = await hectorSubscription.subscriptionByMod(
        owner.address
      );

      expect(subscriptionByMod).equal(true);
    });
  });

  describe('#subscription - cancel by mod', () => {
    let planId = 1;
    let expiredAt: number;
    let amount = hectorAmount.mul(3);

    beforeEach(async function () {
      let tx = await hectorSubscription.createSubscriptionByMod(
        owner.address,
        planId,
        hectorToken.address,
        amount
      );
      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );
      expiredAt = block.timestamp + oneHour;
    });

    it('invalid moderator', async function () {
      await expect(
        hectorSubscription.connect(owner).cancelSubscriptionByMod(owner.address)
      ).to.be.revertedWith('INVALID_MODERATOR()');
    });

    it('cancel subscription in 0 ~ 15 mins (100% refund)', async function () {
      let tx = await hectorSubscription.cancelSubscriptionByMod(owner.address);
      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );
      let refundAmount = hectorAmount;

      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionCancelled')
        .withArgs(owner.address, planId);
      await expect(tx)
        .emit(hectorSubscription, 'RefundedByMod')
        .withArgs(owner.address, hectorToken.address, refundAmount);
      await expect(tx).not.emit(hectorSubscription, 'FundedByMod');

      let subscription = await hectorSubscription.getSubscription(
        owner.address
      );
      expect(subscription.planId).equal(0);
      expect(subscription.expiredAt).equal(block.timestamp);
      expect(subscription.isCancelled).equal(true);
      expect(subscription.isActiveForNow).equal(false);
      expect(subscription.dueDate).equal(block.timestamp);
    });

    it('cancel subscription in 15 ~ 30 mins (50% refund)', async function () {
      await increaseTime(oneHour / 4);

      let tx = await hectorSubscription.cancelSubscriptionByMod(owner.address);
      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );
      let refundAmount = hectorAmount.div(2);

      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionCancelled')
        .withArgs(owner.address, planId);
      await expect(tx)
        .emit(hectorSubscription, 'RefundedByMod')
        .withArgs(owner.address, hectorToken.address, refundAmount);
      await expect(tx)
        .emit(hectorSubscription, 'FundedByMod')
        .withArgs(hectorToken.address, hectorAmount.sub(refundAmount));

      let subscription = await hectorSubscription.getSubscription(
        owner.address
      );
      expect(subscription.planId).equal(0);
      expect(subscription.expiredAt).equal(block.timestamp);
      expect(subscription.isCancelled).equal(true);
      expect(subscription.isActiveForNow).equal(false);
      expect(subscription.dueDate).equal(block.timestamp);
    });

    it('cancel subscription in 30 ~ 45 mins (10% refund)', async function () {
      await increaseTime(oneHour / 2);

      let tx = await hectorSubscription.cancelSubscriptionByMod(owner.address);
      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );
      let refundAmount = hectorAmount.div(10);

      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionCancelled')
        .withArgs(owner.address, planId);
      await expect(tx)
        .emit(hectorSubscription, 'RefundedByMod')
        .withArgs(owner.address, hectorToken.address, refundAmount);
      await expect(tx)
        .emit(hectorSubscription, 'FundedByMod')
        .withArgs(hectorToken.address, hectorAmount.sub(refundAmount));

      let subscription = await hectorSubscription.getSubscription(
        owner.address
      );
      expect(subscription.planId).equal(0);
      expect(subscription.expiredAt).equal(block.timestamp);
      expect(subscription.isCancelled).equal(true);
      expect(subscription.isActiveForNow).equal(false);
      expect(subscription.dueDate).equal(block.timestamp);
    });

    it('cancel subscription in 45 ~ 60 mins (0% refund)', async function () {
      await increaseTime((oneHour * 3) / 4);

      let tx = await hectorSubscription.cancelSubscriptionByMod(owner.address);
      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );
      let refundAmount = ethers.constants.Zero;

      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionCancelled')
        .withArgs(owner.address, planId);
      await expect(tx).not.emit(hectorSubscription, 'RefundedByMod');
      await expect(tx)
        .emit(hectorSubscription, 'FundedByMod')
        .withArgs(hectorToken.address, hectorAmount.sub(refundAmount));

      let subscription = await hectorSubscription.getSubscription(
        owner.address
      );
      expect(subscription.planId).equal(0);
      expect(subscription.expiredAt).equal(block.timestamp);
      expect(subscription.isCancelled).equal(true);
      expect(subscription.isActiveForNow).equal(false);
      expect(subscription.dueDate).equal(block.timestamp);
    });

    it('cancel subscription again', async function () {
      await hectorSubscription.cancelSubscriptionByMod(owner.address);

      await expect(
        hectorSubscription.cancelSubscriptionByMod(owner.address)
      ).revertedWith('INACTIVE_SUBSCRIPTION()');
    });
  });

  describe('#subscription - modify by mod', () => {
    it('invalid plan', async function () {
      let planId = 1;

      await hectorSubscription.createSubscriptionByMod(
        owner.address,
        planId,
        hectorToken.address,
        hectorAmount
      );

      await expect(
        hectorSubscription.modifySubscriptionByMod(
          owner.address,
          3,
          hectorToken.address,
          hectorAmount
        )
      ).to.be.revertedWith('INVALID_PLAN()');

      await expect(
        hectorSubscription.modifySubscriptionByMod(
          owner.address,
          planId,
          hectorToken.address,
          hectorAmount
        )
      ).to.be.revertedWith('INVALID_PLAN()');
    });

    describe('for upgrade', () => {
      let planId = 1;
      let newPlanId = 2;

      beforeEach(async function () {
        await hectorSubscription.createSubscriptionByMod(
          owner.address,
          planId,
          hectorToken.address,
          hectorAmount
        );
      });

      it('invalid moderator', async function () {
        await expect(
          hectorSubscription
            .connect(owner)
            .modifySubscriptionByMod(
              owner.address,
              newPlanId,
              torToken.address,
              torAmount
            )
        ).to.be.revertedWith('INVALID_MODERATOR()');
      });

      it('insufficient fund', async function () {
        await expect(
          hectorSubscription.modifySubscriptionByMod(
            owner.address,
            newPlanId,
            torToken.address,
            0
          )
        ).to.be.revertedWith('INSUFFICIENT_FUND()');
      });

      it('to modify subscription for different token in 0 ~ 15 mins (100% refund)', async function () {
        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let refundPrice = priceOne;
        let torDepositAmount = ethers.utils.parseEther(
          priceTwo.sub(refundPrice).div(torPrice).toString()
        );

        expect(amountToDeposit).equal(torDepositAmount);
      });

      it('to modify subscription for different token in 15 ~ 30 mins (50% refund)', async function () {
        await increaseTime(oneHour / 4);

        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let refundPrice = priceOne.div(2);
        let torDepositAmount = ethers.utils.parseEther(
          priceTwo.sub(refundPrice).div(torPrice).toString()
        );

        expect(amountToDeposit).equal(torDepositAmount);
      });

      it('to modify subscription for different token in 30 ~ 45 mins (10% refund)', async function () {
        await increaseTime(oneHour / 2);

        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let refundPrice = priceOne.div(10);
        let torDepositAmount = ethers.utils.parseEther(
          priceTwo.sub(refundPrice).div(torPrice).toString()
        );

        expect(amountToDeposit).equal(torDepositAmount);
      });

      it('to modify subscription for different token in 45 ~ 60 mins (0% refund)', async function () {
        await increaseTime((oneHour * 3) / 4);

        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let refundPrice = ethers.constants.Zero;
        let torDepositAmount = ethers.utils.parseEther(
          priceTwo.sub(refundPrice).div(torPrice).toString()
        );

        expect(amountToDeposit).equal(torDepositAmount);
      });

      it('to modify subscription for same token in 0 ~ 15 mins (100% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: twoHour,
              price: priceTwo,
              data: '0x00',
            },
          ]
        );

        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let refundPrice = priceOne;
        let hectorDepositAmount = ethers.utils.parseEther(
          priceTwo.sub(refundPrice).div(hectorPrice).toString()
        );

        expect(amountToDeposit).equal(hectorDepositAmount);
      });

      it('to modify subscription for same token in 15 ~ 30 mins (50% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: twoHour,
              price: priceTwo,
              data: '0x00',
            },
          ]
        );

        await increaseTime(oneHour / 4);

        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let refundPrice = priceOne.div(2);
        let hectorDepositAmount = ethers.utils.parseEther(
          priceTwo.sub(refundPrice).div(hectorPrice).toString()
        );

        expect(amountToDeposit).equal(hectorDepositAmount);
      });

      it('to modify subscription for same token in 30 ~ 45 mins (10% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: twoHour,
              price: priceTwo,
              data: '0x00',
            },
          ]
        );

        await increaseTime(oneHour / 2);

        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let refundPrice = priceOne.div(10);
        let hectorDepositAmount = ethers.utils.parseEther(
          priceTwo.sub(refundPrice).div(hectorPrice).toString()
        );

        expect(amountToDeposit).equal(hectorDepositAmount);
      });

      it('to modify subscription for same token in 45 ~ 60 mins (0% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: twoHour,
              price: priceTwo,
              data: '0x00',
            },
          ]
        );

        await increaseTime((oneHour * 3) / 4);

        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let refundPrice = ethers.constants.Zero;
        let hectorDepositAmount = ethers.utils.parseEther(
          priceTwo.sub(refundPrice).div(hectorPrice).toString()
        );

        expect(amountToDeposit).equal(hectorDepositAmount);
      });

      it('modify subscription for different token in 0 ~ 15 mins (100% refund)', async function () {
        let refundPrice = priceOne;
        let payPrice = priceTwo.sub(refundPrice);
        let torDepositAmount = ethers.utils.parseEther(
          payPrice.div(torPrice).toString()
        );

        let tx = await hectorSubscription.modifySubscriptionByMod(
          owner.address,
          newPlanId,
          torToken.address,
          torDepositAmount
        );
        let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
          tx.hash
        );
        let block = await hectorSubscription.provider.getBlock(
          txReceipt.blockNumber
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            torDepositAmount,
            block.timestamp + twoHour
          );
        await expect(tx)
          .emit(hectorSubscription, 'PayerDeposit')
          .withArgs(owner.address, torToken.address, torDepositAmount);
        await expect(tx).not.emit(hectorSubscription, 'RefundedByMod'); // need to pay more so no token for refund
        await expect(tx)
          .emit(hectorSubscription, 'FundedByMod')
          .withArgs(hectorToken.address, hectorAmount);
      });

      it('modify subscription for different token in 15 ~ 30 mins (50% refund)', async function () {
        await increaseTime(oneHour / 4);

        let refundPrice = priceOne.div(2);
        let payPrice = priceTwo.sub(refundPrice);
        let torDepositAmount = ethers.utils.parseEther(
          payPrice.div(torPrice).toString()
        );

        let tx = await hectorSubscription.modifySubscriptionByMod(
          owner.address,
          newPlanId,
          torToken.address,
          torDepositAmount
        );
        let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
          tx.hash
        );
        let block = await hectorSubscription.provider.getBlock(
          txReceipt.blockNumber
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            torDepositAmount,
            block.timestamp + twoHour
          );
        await expect(tx)
          .emit(hectorSubscription, 'PayerDeposit')
          .withArgs(owner.address, torToken.address, torDepositAmount);
        await expect(tx).not.emit(hectorSubscription, 'RefundedByMod'); // need to pay more so no token for refund
        await expect(tx)
          .emit(hectorSubscription, 'FundedByMod')
          .withArgs(hectorToken.address, hectorAmount);
      });

      it('modify subscription for different token in 30 ~ 45 mins (10% refund)', async function () {
        await increaseTime(oneHour / 2);

        let refundPrice = priceOne.div(10);
        let payPrice = priceTwo.sub(refundPrice);
        let torDepositAmount = ethers.utils.parseEther(
          payPrice.div(torPrice).toString()
        );

        let tx = await hectorSubscription.modifySubscriptionByMod(
          owner.address,
          newPlanId,
          torToken.address,
          torDepositAmount
        );
        let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
          tx.hash
        );
        let block = await hectorSubscription.provider.getBlock(
          txReceipt.blockNumber
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            torDepositAmount,
            block.timestamp + twoHour
          );
        await expect(tx)
          .emit(hectorSubscription, 'PayerDeposit')
          .withArgs(owner.address, torToken.address, torDepositAmount);
        await expect(tx).not.emit(hectorSubscription, 'RefundedByMod'); // need to pay more so no token for refund
        await expect(tx)
          .emit(hectorSubscription, 'FundedByMod')
          .withArgs(hectorToken.address, hectorAmount);
      });

      it('modify subscription for different token in 45 ~ 60 mins (0% refund)', async function () {
        await increaseTime((oneHour * 3) / 4);

        let refundPrice = ethers.constants.Zero;
        let payPrice = priceTwo.sub(refundPrice);
        let torDepositAmount = ethers.utils.parseEther(
          payPrice.div(torPrice).toString()
        );

        let tx = await hectorSubscription.modifySubscriptionByMod(
          owner.address,
          newPlanId,
          torToken.address,
          torDepositAmount
        );
        let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
          tx.hash
        );
        let block = await hectorSubscription.provider.getBlock(
          txReceipt.blockNumber
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            torDepositAmount,
            block.timestamp + twoHour
          );
        await expect(tx)
          .emit(hectorSubscription, 'PayerDeposit')
          .withArgs(owner.address, torToken.address, torDepositAmount);
        await expect(tx).not.emit(hectorSubscription, 'RefundedByMod'); // need to pay more so no token for refund
        await expect(tx)
          .emit(hectorSubscription, 'FundedByMod')
          .withArgs(hectorToken.address, hectorAmount);
      });

      it('modify subscription for same token in 0 ~ 15 mins (100% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: twoHour,
              price: priceTwo,
              data: '0x00',
            },
          ]
        );

        let refundPrice = priceOne;
        let payPrice = priceTwo.sub(refundPrice);
        let hectorDepositAmount = ethers.utils.parseEther(
          payPrice.div(hectorPrice).toString()
        );

        let tx = await hectorSubscription.modifySubscriptionByMod(
          owner.address,
          newPlanId,
          hectorToken.address,
          hectorDepositAmount
        );
        let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
          tx.hash
        );
        let block = await hectorSubscription.provider.getBlock(
          txReceipt.blockNumber
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            hectorDepositAmount,
            block.timestamp + twoHour
          );
        await expect(tx)
          .emit(hectorSubscription, 'PayerDeposit')
          .withArgs(owner.address, hectorToken.address, hectorDepositAmount);
        await expect(tx).not.emit(hectorSubscription, 'RefundedByMod'); // need to pay more so no token for refund
        await expect(tx)
          .emit(hectorSubscription, 'FundedByMod')
          .withArgs(hectorToken.address, hectorAmount);
      });

      it('modify subscription for same token in 15 ~ 30 mins (50% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: twoHour,
              price: priceTwo,
              data: '0x00',
            },
          ]
        );

        await increaseTime(oneHour / 4);

        let refundPrice = priceOne.div(2);
        let payPrice = priceTwo.sub(refundPrice);
        let hectorDepositAmount = ethers.utils.parseEther(
          payPrice.div(hectorPrice).toString()
        );

        let tx = await hectorSubscription.modifySubscriptionByMod(
          owner.address,
          newPlanId,
          hectorToken.address,
          hectorDepositAmount
        );
        let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
          tx.hash
        );
        let block = await hectorSubscription.provider.getBlock(
          txReceipt.blockNumber
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            hectorDepositAmount,
            block.timestamp + twoHour
          );
        await expect(tx)
          .emit(hectorSubscription, 'PayerDeposit')
          .withArgs(owner.address, hectorToken.address, hectorDepositAmount);
        await expect(tx).not.emit(hectorSubscription, 'RefundedByMod'); // need to pay more so no token for refund
        await expect(tx)
          .emit(hectorSubscription, 'FundedByMod')
          .withArgs(hectorToken.address, hectorAmount);
      });

      it('modify subscription for same token in 30 ~ 45 mins (10% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: twoHour,
              price: priceTwo,
              data: '0x00',
            },
          ]
        );

        await increaseTime(oneHour / 2);

        let refundPrice = priceOne.div(10);
        let payPrice = priceTwo.sub(refundPrice);
        let hectorDepositAmount = ethers.utils.parseEther(
          payPrice.div(hectorPrice).toString()
        );

        let tx = await hectorSubscription.modifySubscriptionByMod(
          owner.address,
          newPlanId,
          hectorToken.address,
          hectorDepositAmount
        );
        let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
          tx.hash
        );
        let block = await hectorSubscription.provider.getBlock(
          txReceipt.blockNumber
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            hectorDepositAmount,
            block.timestamp + twoHour
          );
        await expect(tx)
          .emit(hectorSubscription, 'PayerDeposit')
          .withArgs(owner.address, hectorToken.address, hectorDepositAmount);
        await expect(tx).not.emit(hectorSubscription, 'RefundedByMod'); // need to pay more so no token for refund
        await expect(tx)
          .emit(hectorSubscription, 'FundedByMod')
          .withArgs(hectorToken.address, hectorAmount);
      });

      it('modify subscription for same token in 45 ~ 60 mins (0% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: twoHour,
              price: priceTwo,
              data: '0x00',
            },
          ]
        );

        await increaseTime((oneHour * 3) / 4);

        let refundPrice = ethers.constants.Zero;
        let payPrice = priceTwo.sub(refundPrice);
        let hectorDepositAmount = ethers.utils.parseEther(
          payPrice.div(hectorPrice).toString()
        );

        let tx = await hectorSubscription.modifySubscriptionByMod(
          owner.address,
          newPlanId,
          hectorToken.address,
          hectorDepositAmount
        );
        let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
          tx.hash
        );
        let block = await hectorSubscription.provider.getBlock(
          txReceipt.blockNumber
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            hectorDepositAmount,
            block.timestamp + twoHour
          );
        await expect(tx)
          .emit(hectorSubscription, 'PayerDeposit')
          .withArgs(owner.address, hectorToken.address, hectorDepositAmount);
        await expect(tx).not.emit(hectorSubscription, 'RefundedByMod'); // need to pay more so no token for refund
        await expect(tx)
          .emit(hectorSubscription, 'FundedByMod')
          .withArgs(hectorToken.address, hectorAmount);
      });
    });

    describe('for downgrade', () => {
      let planId = 1;
      let newPlanId = 2;
      let hectorAmount: BigNumber;
      let torAmount: BigNumber;

      beforeEach(async function () {
        await hectorSubscription.updatePlan(
          [1, 2],
          [
            {
              token: hectorToken.address,
              period: twoHour,
              price: priceTwo,
              data: '0x00',
            },
            {
              token: torToken.address,
              period: oneHour,
              price: priceOne,
              data: '0x00',
            },
          ]
        );
        hectorAmount = ethers.utils.parseEther(
          priceTwo.div(hectorPrice).toString()
        );
        torAmount = ethers.utils.parseEther(priceOne.div(torPrice).toString());

        await hectorSubscription.createSubscriptionByMod(
          owner.address,
          planId,
          hectorToken.address,
          hectorAmount
        );
      });

      it('to modify subscription for different token in 0 ~ 15 mins (100% refund)', async function () {
        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let torDepositAmount = ethers.constants.Zero; // refund is enough so no need to deposit more

        expect(amountToDeposit).equal(torDepositAmount);
      });

      it('to modify subscription for different token in 15 ~ 30 mins (50% refund)', async function () {
        await increaseTime(oneHour / 4);

        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let refundPrice = priceTwo.div(2);
        let torDepositAmount = ethers.utils.parseEther(
          priceOne.sub(refundPrice).div(torPrice).toString()
        );

        expect(amountToDeposit).equal(torDepositAmount);
      });

      it('to modify subscription for different token in 30 ~ 45 mins (10% refund)', async function () {
        await increaseTime(oneHour / 2);

        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let refundPrice = priceTwo.div(10);
        let torDepositAmount = ethers.utils.parseEther(
          priceOne.sub(refundPrice).div(torPrice).toString()
        );

        expect(amountToDeposit).equal(torDepositAmount);
      });

      it('to modify subscription for different token in 45 ~ 60 mins (0% refund)', async function () {
        await increaseTime((oneHour * 3) / 4);

        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let refundPrice = ethers.constants.Zero;
        let torDepositAmount = ethers.utils.parseEther(
          priceOne.sub(refundPrice).div(torPrice).toString()
        );

        expect(amountToDeposit).equal(torDepositAmount);
      });

      it('to modify subscription for same token in 0 ~ 15 mins (100% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: oneHour,
              price: priceOne,
              data: '0x00',
            },
          ]
        );

        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let hectorDepositAmount = ethers.constants.Zero; // refund is enough so no need to deposit more

        expect(amountToDeposit).equal(hectorDepositAmount);
      });

      it('to modify subscription for same token in 15 ~ 30 mins (50% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: oneHour,
              price: priceOne,
              data: '0x00',
            },
          ]
        );

        await increaseTime(oneHour / 4);

        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let refundPrice = priceTwo.div(2);
        let hectorDepositAmount = ethers.utils.parseEther(
          priceOne.sub(refundPrice).div(hectorPrice).toString()
        );

        expect(amountToDeposit).equal(hectorDepositAmount);
      });

      it('to modify subscription for same token in 30 ~ 45 mins (10% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: oneHour,
              price: priceOne,
              data: '0x00',
            },
          ]
        );

        await increaseTime(oneHour / 2);

        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let refundPrice = priceTwo.div(10);
        let hectorDepositAmount = ethers.utils.parseEther(
          priceOne.sub(refundPrice).div(hectorPrice).toString()
        );

        expect(amountToDeposit).equal(hectorDepositAmount);
      });

      it('to modify subscription for same token in 45 ~ 60 mins (0% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: oneHour,
              price: priceOne,
              data: '0x00',
            },
          ]
        );

        await increaseTime((oneHour * 3) / 4);

        let amountToDeposit = await hectorSubscription.toModifySubscription(
          owner.address,
          newPlanId
        );

        let refundPrice = ethers.constants.Zero;
        let hectorDepositAmount = ethers.utils.parseEther(
          priceOne.sub(refundPrice).div(hectorPrice).toString()
        );

        expect(amountToDeposit).equal(hectorDepositAmount);
      });

      it('modify subscription for different token in 0 ~ 15 mins (100% refund)', async function () {
        let refundPrice = priceTwo;
        let hectorRefundAmount = ethers.utils.parseEther(
          refundPrice.sub(priceOne).div(hectorPrice).toString()
        );
        let payPrice = ethers.constants.Zero; // refund is enough so no need to deposit more
        let torDepositAmount = ethers.utils.parseEther(
          payPrice.div(torPrice).toString()
        );

        let tx = await hectorSubscription.modifySubscriptionByMod(
          owner.address,
          newPlanId,
          torToken.address,
          torDepositAmount
        );
        let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
          tx.hash
        );
        let block = await hectorSubscription.provider.getBlock(
          txReceipt.blockNumber
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            torDepositAmount,
            block.timestamp + oneHour
          );
        await expect(tx).not.emit(hectorSubscription, 'PayerDeposit'); // refund is enough so no need to deposit more
        await expect(tx)
          .emit(hectorSubscription, 'RefundedByMod')
          .withArgs(owner.address, hectorToken.address, hectorRefundAmount);
        await expect(tx)
          .emit(hectorSubscription, 'FundedByMod')
          .withArgs(hectorToken.address, hectorAmount.sub(hectorRefundAmount));
      });

      it('modify subscription for different token in 15 ~ 30 mins (50% refund)', async function () {
        await increaseTime(oneHour / 4);

        let refundPrice = priceTwo.div(2);
        let hectorRefundAmount = ethers.utils.parseEther(
          refundPrice.sub(priceOne).div(hectorPrice).toString()
        );
        let payPrice = priceOne.sub(refundPrice);
        let torDepositAmount = ethers.utils.parseEther(
          payPrice.div(torPrice).toString()
        );

        let tx = await hectorSubscription.modifySubscriptionByMod(
          owner.address,
          newPlanId,
          torToken.address,
          torDepositAmount
        );
        let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
          tx.hash
        );
        let block = await hectorSubscription.provider.getBlock(
          txReceipt.blockNumber
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            torDepositAmount,
            block.timestamp + oneHour
          );
        await expect(tx).not.emit(hectorSubscription, 'PayerDeposit'); // refund is enough so no need to deposit more
        await expect(tx).not.emit(hectorSubscription, 'RefundedByMod'); // refund is fully used to purchase a new subscription
        await expect(tx)
          .emit(hectorSubscription, 'FundedByMod')
          .withArgs(hectorToken.address, hectorAmount.sub(hectorRefundAmount));
      });

      it('modify subscription for different token in 30 ~ 45 mins (10% refund)', async function () {
        await increaseTime(oneHour / 2);

        let refundPrice = priceTwo.div(10);
        let hectorRefundAmount = ethers.constants.Zero; // refund is fully used to purchase a new subscription
        let payPrice = priceOne.sub(refundPrice);
        let torDepositAmount = ethers.utils.parseEther(
          payPrice.div(torPrice).toString()
        );

        let tx = await hectorSubscription.modifySubscriptionByMod(
          owner.address,
          newPlanId,
          torToken.address,
          torDepositAmount
        );
        let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
          tx.hash
        );
        let block = await hectorSubscription.provider.getBlock(
          txReceipt.blockNumber
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            torDepositAmount,
            block.timestamp + oneHour
          );
        await expect(tx)
          .emit(hectorSubscription, 'PayerDeposit')
          .withArgs(owner.address, torToken.address, torDepositAmount);
        await expect(tx).not.emit(hectorSubscription, 'RefundedByMod'); // refund is fully used to purchase a new subscription
        await expect(tx)
          .emit(hectorSubscription, 'FundedByMod')
          .withArgs(hectorToken.address, hectorAmount.sub(hectorRefundAmount));
      });

      it('modify subscription for different token in 45 ~ 60 mins (0% refund)', async function () {
        await increaseTime((oneHour * 3) / 4);

        let refundPrice = ethers.constants.Zero;
        let hectorRefundAmount = ethers.constants.Zero; // refund is fully used to purchase a new subscription
        let payPrice = priceOne.sub(refundPrice);
        let torDepositAmount = ethers.utils.parseEther(
          payPrice.div(torPrice).toString()
        );

        let tx = await hectorSubscription.modifySubscriptionByMod(
          owner.address,
          newPlanId,
          torToken.address,
          torDepositAmount
        );
        let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
          tx.hash
        );
        let block = await hectorSubscription.provider.getBlock(
          txReceipt.blockNumber
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            torDepositAmount,
            block.timestamp + oneHour
          );
        await expect(tx)
          .emit(hectorSubscription, 'PayerDeposit')
          .withArgs(owner.address, torToken.address, torDepositAmount);
        await expect(tx).not.emit(hectorSubscription, 'RefundedByMod'); // refund is fully used to purchase a new subscription
        await expect(tx)
          .emit(hectorSubscription, 'FundedByMod')
          .withArgs(hectorToken.address, hectorAmount.sub(hectorRefundAmount));
      });

      it('modify subscription for same token in 0 ~ 15 mins (100% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: oneHour,
              price: priceOne,
              data: '0x00',
            },
          ]
        );

        let refundPrice = priceTwo;
        let hectorRefundAmount = ethers.utils.parseEther(
          refundPrice.sub(priceOne).div(hectorPrice).toString()
        );
        let payPrice = priceTwo.sub(refundPrice);
        let hectorDepositAmount = ethers.utils.parseEther(
          payPrice.div(hectorPrice).toString()
        );

        let tx = await hectorSubscription.modifySubscriptionByMod(
          owner.address,
          newPlanId,
          hectorToken.address,
          hectorDepositAmount
        );
        let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
          tx.hash
        );
        let block = await hectorSubscription.provider.getBlock(
          txReceipt.blockNumber
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            hectorDepositAmount,
            block.timestamp + oneHour
          );
        await expect(tx).not.emit(hectorSubscription, 'PayerDeposit'); // refund is enough so no need to deposit more
        await expect(tx)
          .emit(hectorSubscription, 'RefundedByMod')
          .withArgs(owner.address, hectorToken.address, hectorRefundAmount);
        await expect(tx)
          .emit(hectorSubscription, 'FundedByMod')
          .withArgs(hectorToken.address, hectorAmount.sub(hectorRefundAmount));
      });

      it('modify subscription for same token in 15 ~ 30 mins (50% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: oneHour,
              price: priceOne,
              data: '0x00',
            },
          ]
        );

        await increaseTime(oneHour / 4);

        let refundPrice = priceTwo.div(2);
        let hectorRefundAmount = ethers.utils.parseEther(
          refundPrice.sub(priceOne).div(hectorPrice).toString()
        );
        let payPrice = priceOne.sub(refundPrice);
        let hectorDepositAmount = ethers.utils.parseEther(
          payPrice.div(hectorPrice).toString()
        );

        let tx = await hectorSubscription.modifySubscriptionByMod(
          owner.address,
          newPlanId,
          hectorToken.address,
          hectorDepositAmount
        );
        let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
          tx.hash
        );
        let block = await hectorSubscription.provider.getBlock(
          txReceipt.blockNumber
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            hectorDepositAmount,
            block.timestamp + oneHour
          );
        await expect(tx).not.emit(hectorSubscription, 'PayerDeposit'); // refund is enough so no need to deposit more
        await expect(tx).not.emit(hectorSubscription, 'RefundedByMod'); // refund is fully used to purchase a new subscription
        await expect(tx)
          .emit(hectorSubscription, 'FundedByMod')
          .withArgs(hectorToken.address, hectorAmount.sub(hectorRefundAmount));
      });

      it('modify subscription for same token in 30 ~ 45 mins (10% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: oneHour,
              price: priceOne,
              data: '0x00',
            },
          ]
        );

        await increaseTime(oneHour / 2);

        let refundPrice = priceTwo.div(10);
        let hectorRefundAmount = ethers.constants.Zero; // refund is fully used to purchase a new subscription
        let payPrice = priceOne.sub(refundPrice);
        let hectorDepositAmount = ethers.utils.parseEther(
          payPrice.div(hectorPrice).toString()
        );

        let tx = await hectorSubscription.modifySubscriptionByMod(
          owner.address,
          newPlanId,
          hectorToken.address,
          hectorDepositAmount
        );
        let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
          tx.hash
        );
        let block = await hectorSubscription.provider.getBlock(
          txReceipt.blockNumber
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            hectorDepositAmount,
            block.timestamp + oneHour
          );
        await expect(tx)
          .emit(hectorSubscription, 'PayerDeposit')
          .withArgs(owner.address, hectorToken.address, hectorDepositAmount);
        await expect(tx).not.emit(hectorSubscription, 'RefundedByMod'); // refund is fully used to purchase a new subscription
        await expect(tx)
          .emit(hectorSubscription, 'FundedByMod')
          .withArgs(hectorToken.address, hectorAmount.sub(hectorRefundAmount));
      });

      it('modify subscription for same token in 45 ~ 60 mins (0% refund)', async function () {
        await hectorSubscription.updatePlan(
          [2],
          [
            {
              token: hectorToken.address,
              period: oneHour,
              price: priceOne,
              data: '0x00',
            },
          ]
        );

        await increaseTime((oneHour * 3) / 4);

        let refundPrice = ethers.constants.Zero;
        let hectorRefundAmount = ethers.constants.Zero; // refund is fully used to purchase a new subscription
        let payPrice = priceOne.sub(refundPrice);
        let hectorDepositAmount = ethers.utils.parseEther(
          payPrice.div(hectorPrice).toString()
        );

        let tx = await hectorSubscription.modifySubscriptionByMod(
          owner.address,
          newPlanId,
          hectorToken.address,
          hectorDepositAmount
        );
        let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
          tx.hash
        );
        let block = await hectorSubscription.provider.getBlock(
          txReceipt.blockNumber
        );

        await expect(tx)
          .emit(hectorSubscription, 'SubscriptionModified')
          .withArgs(
            owner.address,
            planId,
            newPlanId,
            payPrice,
            hectorDepositAmount,
            block.timestamp + oneHour
          );
        await expect(tx)
          .emit(hectorSubscription, 'PayerDeposit')
          .withArgs(owner.address, hectorToken.address, hectorDepositAmount);
        await expect(tx).not.emit(hectorSubscription, 'RefundedByMod'); // refund is fully used to purchase a new subscription
        await expect(tx)
          .emit(hectorSubscription, 'FundedByMod')
          .withArgs(hectorToken.address, hectorAmount.sub(hectorRefundAmount));
      });
    });
  });

  describe('#subscription: Cancelled subscription handling - Michael', function () {
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let plan30Days: any;
    let plan90Days: any;
    let plan30DaysAmount: BigNumber;
    let plan90DaysAmount: BigNumber;
    const expireDeadline = 60 * 60 * 24 * 30; // 1 week in seconds
    const threeMonths = 60 * 60 * 24 * 90; // 3 months in seconds

    beforeEach(async function () {
      // Deploy the necessary contracts
      [user1, user2] = await ethers.getSigners();

      // Set plans
      plan30Days = {
        token: torToken.address,
        period: 2592000,
        price: ethers.utils.parseUnits('100', 8),
        data: '0x00',
      }; // 30 days
      plan30DaysAmount = ethers.utils.parseEther(
        plan30Days.price.div(torPrice).toString()
      );
      plan90Days = {
        token: hectorToken.address,
        period: 7776000,
        price: ethers.utils.parseUnits('250', 8),
        data: '0x00',
      }; // 90 days
      plan90DaysAmount = ethers.utils.parseEther(
        plan90Days.price.div(hectorPrice).toString()
      );

      await hectorSubscription.appendPlan([plan30Days, plan90Days]);

      // Distribute tokens to users
      await torToken.mint(user1.address, utils.parseEther('1000'));

      await hectorToken.mint(user2.address, utils.parseEther('2000'));
    });

    it('getSubscription is NOT updated with latest when plan is expired', async function () {
      await torToken
        .connect(user1)
        .approve(hectorSubscription.address, plan30DaysAmount);
      let tx = await hectorSubscription.connect(user1).createSubscription(3);

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
        .approve(hectorSubscription.address, plan30DaysAmount);
      await hectorSubscription.connect(user1).createSubscription(3);

      // Fast forward to expire the subscription
      await increaseTime(plan30Days.period + expireDeadline);
      // Sync subscription
      await hectorSubscription.syncSubscription(user1.address);
      let subscription = await hectorSubscription.getSubscription(
        user1.address
      );

      const userBalance = await torToken.balanceOf(user1.address);
      expect(subscription.planId).to.be.equal(0);

      expect(userBalance).to.equal(utils.parseEther('900')); // 1000 - 100
    });
    it('Excess amount will stay in subscriptoin when less than the plan amount', async function () {
      const amount = utils.parseEther('150');
      await torToken.connect(user1).approve(hectorSubscription.address, amount);
      await hectorSubscription.connect(user1).deposit(plan30Days.token, amount);
      await hectorSubscription.connect(user1).createSubscription(3);

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
      await hectorSubscription.connect(user1).deposit(plan30Days.token, amount);
      await hectorSubscription.connect(user1).createSubscription(3);

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
        .approve(hectorSubscription.address, plan30DaysAmount);
      let tx = await hectorSubscription.connect(user1).createSubscription(3);

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
        .approve(hectorSubscription.address, plan30DaysAmount);
      await hectorSubscription.connect(user1).createSubscription(3);

      await hectorSubscription.syncSubscription(user1.address);
      subscription = await hectorSubscription.getSubscription(user1.address);

      expect(subscription.planId).to.equal(3);

      const userBalance = await torToken.balanceOf(user1.address);
      const treasuryBalance = await torToken.balanceOf(treasury.address);

      expect(userBalance).to.equal(utils.parseEther('800'));
      expect(treasuryBalance).to.equal(utils.parseEther('100'));
    });

    it('Sub Expire less than 30 days + new Deposit = Sub active', async function () {
      await torToken
        .connect(user1)
        .approve(hectorSubscription.address, plan30DaysAmount);
      let tx = await hectorSubscription.connect(user1).createSubscription(3);

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

      expect(subscription.planId).to.not.equal(3);

      //Reactivate subscription
      const userBalance = await torToken.balanceOf(user1.address);
      expect(userBalance).to.equal(utils.parseEther('900'));
      await torToken
        .connect(user1)
        .approve(hectorSubscription.address, plan30DaysAmount);
      try {
        await hectorSubscription.connect(user1).createSubscription(3);
      } catch (error: any) {
        console.log(
          '❌ FAILED - unable to reactivate subscription despite sufficient fund - only need 100 to renew',
          error.message
        );
      }
    });
  });
});
