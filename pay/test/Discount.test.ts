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

describe('HectorSubscriptionV2 + Discount', function () {
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

  let multiplier = 10000;
  let hectorPlanDiscount = 1000; // 10%
  let torPlanDiscount = 0; // 0%

  let priceOne = ethers.utils.parseUnits('100', 8); // 100$
  let discountedPriceOne = priceOne.sub(
    priceOne.mul(hectorPlanDiscount).div(multiplier)
  );
  let priceTwo = ethers.utils.parseUnits('200', 8); // 200$
  let discountedPriceTwo = priceTwo.sub(
    priceTwo.mul(torPlanDiscount).div(multiplier)
  );

  let hectorPrice = ethers.utils.parseUnits('10', 8); // 10$
  let torPrice = ethers.utils.parseUnits('1', 8); // 1$

  let hectorAmount = ethers.utils.parseEther(
    priceOne.div(hectorPrice).toString()
  );
  let discountedHectorAmount = ethers.utils.parseEther(
    discountedPriceOne.div(hectorPrice).toString()
  );
  let torAmount = ethers.utils.parseEther(priceTwo.div(torPrice).toString());
  let discountedTorAmount = ethers.utils.parseEther(
    discountedPriceTwo.div(torPrice).toString()
  );

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
    await hectorDiscount.appendDiscount(
      [hectorToken.address, torToken.address],
      [hectorPlanDiscount, torPlanDiscount]
    );

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

  describe('#subscription - plan', () => {
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
      expect(planDiscountedPrices[1]).equal(discountedPriceOne);
      expect(tokenPrices[1]).equal(hectorPrice);
      expect(tokenAmounts[1]).equal(discountedHectorAmount);

      expect(plans[2].token).equal(torToken.address);
      expect(plans[2].period).equal(twoHour);
      expect(plans[2].price).equal(priceTwo);
      expect(plans[2].data).equal('0x00');
      expect(planDiscountedPrices[2]).equal(discountedPriceTwo);
      expect(tokenPrices[2]).equal(torPrice);
      expect(tokenAmounts[2]).equal(discountedTorAmount);
    });
  });

  describe('#subscription - create', () => {
    it('to create subscription for existing deposit', async function () {
      await hectorSubscription
        .connect(owner)
        .deposit(hectorToken.address, discountedHectorAmount);
      await hectorSubscription
        .connect(owner)
        .deposit(torToken.address, discountedTorAmount);

      let hectorAmountToDeposit = await hectorSubscription
        .connect(owner)
        .callStatic.toCreateSubscription(1);
      let torAmountToDeposit = await hectorSubscription
        .connect(owner)
        .callStatic.toCreateSubscription(2);

      expect(hectorAmountToDeposit).equal(0);
      expect(torAmountToDeposit).equal(0);
    });

    it('to create subscription for no deposit', async function () {
      let hectorAmountToDeposit = await hectorSubscription
        .connect(owner)
        .callStatic.toCreateSubscription(1);
      let torAmountToDeposit = await hectorSubscription
        .connect(owner)
        .callStatic.toCreateSubscription(2);

      expect(hectorAmountToDeposit).equal(discountedHectorAmount);
      expect(torAmountToDeposit).equal(discountedTorAmount);
    });

    it('create subscription in HEC (10% discount)', async function () {
      let planId = 1;
      let tx = await hectorSubscription
        .connect(owner)
        .createSubscription(planId);
      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );
      let expiredAt = block.timestamp + oneHour;

      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionCreated')
        .withArgs(
          owner.address,
          planId,
          discountedPriceOne,
          discountedHectorAmount,
          expiredAt
        );

      let subscription = await hectorSubscription.subscriptions(owner.address);

      expect(subscription.planId).equal(planId);
      expect(subscription.expiredAt).equal(expiredAt);
      expect(subscription.lastPaidAt).equal(block.timestamp);
      expect(subscription.lastAmountPaidInUsd).equal(discountedPriceOne);
      expect(subscription.lastAmountPaid).equal(discountedHectorAmount);

      expect(await hectorToken.balanceOf(treasury.address)).equal(
        ethers.constants.Zero
      );
      expect(await hectorToken.balanceOf(hectorSubscription.address)).equal(
        discountedHectorAmount
      );
    });

    it('create subscription in TOR (0% discount)', async function () {
      let planId = 2;
      let tx = await hectorSubscription
        .connect(owner)
        .createSubscription(planId);
      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );
      let expiredAt = block.timestamp + twoHour;

      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionCreated')
        .withArgs(
          owner.address,
          planId,
          discountedPriceTwo,
          discountedTorAmount,
          expiredAt
        );

      let subscription = await hectorSubscription.subscriptions(owner.address);

      expect(subscription.planId).equal(planId);
      expect(subscription.expiredAt).equal(expiredAt);
      expect(subscription.lastPaidAt).equal(block.timestamp);
      expect(subscription.lastAmountPaidInUsd).equal(discountedPriceTwo);
      expect(subscription.lastAmountPaid).equal(discountedTorAmount);

      expect(await torToken.balanceOf(treasury.address)).equal(
        ethers.constants.Zero
      );
      expect(await torToken.balanceOf(hectorSubscription.address)).equal(
        discountedTorAmount
      );
    });
  });

  describe('#subscription - sync', () => {
    it('sync subscription in HEC (10% discount)', async function () {
      let planId = 1;
      let amount = discountedHectorAmount.mul(3);
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
      let expiredAt = block.timestamp + oneHour;
      let dueDate = block.timestamp + oneHour * 3;

      await increaseTime(twoHour);

      tx = await hectorSubscription.syncSubscription(owner.address);

      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionSynced')
        .withArgs(
          owner.address,
          planId,
          expiredAt + oneHour,
          discountedPriceOne,
          discountedHectorAmount,
          discountedHectorAmount.mul(2),
          expiredAt + twoHour
        );
      await expect(tx)
        .emit(hectorSubscription, 'Funded')
        .withArgs(hectorToken.address, discountedHectorAmount.mul(2));

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
      ).equal(amount.sub(discountedHectorAmount.mul(3)));

      expect(await hectorToken.balanceOf(treasury.address)).equal(
        discountedHectorAmount.mul(2)
      );
      expect(await hectorToken.balanceOf(hectorSubscription.address)).equal(
        amount.sub(discountedHectorAmount.mul(2))
      );
    });

    it('sync subscription in TOR (10% discount)', async function () {
      let planId = 2;
      let amount = discountedTorAmount.mul(3);
      await hectorSubscription.connect(owner).deposit(torToken.address, amount);
      let tx = await hectorSubscription
        .connect(owner)
        .createSubscription(planId);
      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );
      let expiredAt = block.timestamp + twoHour;
      let dueDate = block.timestamp + twoHour * 3;

      await increaseTime(twoHour);

      tx = await hectorSubscription.syncSubscription(owner.address);

      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionSynced')
        .withArgs(
          owner.address,
          planId,
          expiredAt,
          discountedPriceTwo,
          discountedTorAmount,
          discountedTorAmount,
          expiredAt + twoHour
        );
      await expect(tx)
        .emit(hectorSubscription, 'Funded')
        .withArgs(torToken.address, discountedTorAmount);

      let subscription = await hectorSubscription.getSubscription(
        owner.address
      );
      expect(subscription.planId).equal(planId);
      expect(subscription.expiredAt).equal(expiredAt + twoHour);
      expect(subscription.isCancelled).equal(false);
      expect(subscription.isActiveForNow).equal(true);
      expect(subscription.dueDate).equal(dueDate);

      expect(
        await hectorSubscription.balanceOf(owner.address, torToken.address)
      ).equal(amount.sub(discountedTorAmount.mul(2)));

      expect(await torToken.balanceOf(treasury.address)).equal(
        discountedTorAmount
      );
      expect(await torToken.balanceOf(hectorSubscription.address)).equal(
        amount.sub(discountedTorAmount)
      );
    });
  });

  describe('#subscription - cancel', () => {
    it('cancel subscription in HEC (10% discount) in 15 ~ 30 mins (50% refund)', async function () {
      let planId = 1;
      let amount = discountedHectorAmount.mul(3);
      await hectorSubscription
        .connect(owner)
        .deposit(hectorToken.address, amount);
      await hectorSubscription.connect(owner).createSubscription(planId);

      await increaseTime(oneHour / 4);

      let tx = await hectorSubscription.connect(owner).cancelSubscription();
      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );
      let refundAmount = discountedHectorAmount.div(2);

      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionCancelled')
        .withArgs(owner.address, planId);
      await expect(tx)
        .emit(hectorSubscription, 'Refunded')
        .withArgs(owner.address, hectorToken.address, refundAmount);
      await expect(tx)
        .emit(hectorSubscription, 'Funded')
        .withArgs(
          hectorToken.address,
          discountedHectorAmount.sub(refundAmount)
        );

      let subscription = await hectorSubscription.getSubscription(
        owner.address
      );
      expect(subscription.planId).equal(0);
      expect(subscription.expiredAt).equal(block.timestamp);
      expect(subscription.isCancelled).equal(true);
      expect(subscription.isActiveForNow).equal(false);
      expect(subscription.dueDate).equal(block.timestamp);

      expect(await hectorToken.balanceOf(treasury.address)).equal(
        discountedHectorAmount.sub(refundAmount)
      );
      expect(await hectorToken.balanceOf(hectorSubscription.address)).equal(
        amount.sub(discountedHectorAmount)
      );
    });

    it('cancel subscription in TOR (0% discount) in 30 ~ 60 mins (50% refund)', async function () {
      let planId = 2;
      let amount = discountedTorAmount.mul(3);
      await hectorSubscription.connect(owner).deposit(torToken.address, amount);
      await hectorSubscription.connect(owner).createSubscription(planId);

      await increaseTime(twoHour / 4);

      let tx = await hectorSubscription.connect(owner).cancelSubscription();
      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );
      let refundAmount = discountedTorAmount.div(2);

      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionCancelled')
        .withArgs(owner.address, planId);
      await expect(tx)
        .emit(hectorSubscription, 'Refunded')
        .withArgs(owner.address, torToken.address, refundAmount);
      await expect(tx)
        .emit(hectorSubscription, 'Funded')
        .withArgs(torToken.address, discountedTorAmount.sub(refundAmount));

      let subscription = await hectorSubscription.getSubscription(
        owner.address
      );
      expect(subscription.planId).equal(0);
      expect(subscription.expiredAt).equal(block.timestamp);
      expect(subscription.isCancelled).equal(true);
      expect(subscription.isActiveForNow).equal(false);
      expect(subscription.dueDate).equal(block.timestamp);

      expect(await torToken.balanceOf(treasury.address)).equal(
        discountedTorAmount.sub(refundAmount)
      );
      expect(await torToken.balanceOf(hectorSubscription.address)).equal(
        amount.sub(discountedTorAmount)
      );
    });
  });

  describe('#subscription - modify', () => {
    it('to modify subscription for upgrade from HEC (10% discount + 100% refund) to TOR (0% discount)', async function () {
      let planId = 1;
      let newPlanId = 2;
      await hectorSubscription.connect(owner).createSubscription(planId);

      let amountToDeposit = await hectorSubscription
        .connect(owner)
        .callStatic.toModifySubscription(newPlanId);

      let refundPrice = discountedPriceOne;
      let torDepositAmount = ethers.utils.parseEther(
        discountedPriceTwo.sub(refundPrice).div(torPrice).toString()
      );

      expect(amountToDeposit).equal(torDepositAmount);
    });

    it('modify subscription for upgrade from HEC (10% discount + 100% refund) to TOR (0% discount)', async function () {
      let planId = 1;
      let newPlanId = 2;
      await hectorSubscription.connect(owner).createSubscription(planId);

      let tx = await hectorSubscription
        .connect(owner)
        .modifySubscription(newPlanId);
      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );

      let refundPrice = discountedPriceOne;
      let payPrice = discountedPriceTwo.sub(refundPrice);
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
        .withArgs(hectorToken.address, discountedHectorAmount);
    });

    it('to modify subscription for downgrade from TOR (0% discount + 10% refund) to HEC (10% discount)', async function () {
      let planId = 2;
      let newPlanId = 1;
      await hectorSubscription.connect(owner).createSubscription(planId);

      await increaseTime(twoHour / 2);

      let amountToDeposit = await hectorSubscription
        .connect(owner)
        .callStatic.toModifySubscription(newPlanId);

      let refundPrice = discountedPriceTwo.div(10);
      let hectorDepositAmount = ethers.utils.parseEther(
        discountedPriceOne.sub(refundPrice).div(hectorPrice).toString()
      );

      expect(amountToDeposit).equal(hectorDepositAmount);
    });

    it('modify subscription for downgrade from TOR (0% discount + 10% refund) to HEC (10% discount)', async function () {
      let planId = 2;
      let newPlanId = 1;
      await hectorSubscription.connect(owner).createSubscription(planId);

      await increaseTime(twoHour / 2);

      let tx = await hectorSubscription
        .connect(owner)
        .modifySubscription(newPlanId);
      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );

      let refundPrice = discountedPriceTwo.div(10);
      let payPrice = discountedPriceOne.sub(refundPrice);
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
      await expect(tx).not.emit(hectorSubscription, 'Refunded'); // need to pay more so no token for refund
      await expect(tx)
        .emit(hectorSubscription, 'Funded')
        .withArgs(torToken.address, discountedTorAmount);
    });

    it('to modify subscription for downgrade from TOR (0% discount + 100% refund) to HEC (10% discount)', async function () {
      let planId = 2;
      let newPlanId = 1;
      await hectorSubscription.connect(owner).createSubscription(planId);

      let amountToDeposit = await hectorSubscription
        .connect(owner)
        .callStatic.toModifySubscription(newPlanId);

      let hectorDepositAmount = ethers.constants.Zero;

      expect(amountToDeposit).equal(hectorDepositAmount);
    });

    it('modify subscription for downgrade from TOR (0% discount + 10% refund) to HEC (10% discount)', async function () {
      let planId = 2;
      let newPlanId = 1;
      await hectorSubscription.connect(owner).createSubscription(planId);

      let tx = await hectorSubscription
        .connect(owner)
        .modifySubscription(newPlanId);
      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );

      let payPrice = ethers.constants.Zero;
      let hectorDepositAmount = ethers.constants.Zero;
      let refundPrice = discountedPriceTwo.sub(discountedPriceOne);
      let refundTorAmount = ethers.utils.parseEther(
        refundPrice.div(torPrice).toString()
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
      await expect(tx).not.emit(hectorSubscription, 'PayerDeposit');
      await expect(tx)
        .emit(hectorSubscription, 'Refunded')
        .withArgs(owner.address, torToken.address, refundTorAmount);
      await expect(tx)
        .emit(hectorSubscription, 'Funded')
        .withArgs(torToken.address, discountedTorAmount.sub(refundTorAmount));
    });
  });
});
