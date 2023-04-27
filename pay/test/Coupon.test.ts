import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { BigNumber, BigNumberish, utils } from 'ethers';
import { increaseTime, getTimeStamp } from './../helper';
import {
  HectorSubscriptionFactory,
  HectorSubscription,
  RewardToken,
  HectorCoupon,
} from '../types';

const encodeCouponInfo = (coupon: {
  id: number;
  product: string;
  token: string;
  discount: BigNumberish;
  isFixed: boolean;
}) => {
  const abi = ethers.utils.defaultAbiCoder;
  return abi.encode(
    ['uint256', 'uint256', 'bool'],
    [coupon.id, coupon.discount, coupon.isFixed]
  );
};

const signCouponMessage = async (
  couponContract: HectorCoupon,
  userAddress: string,
  coupon: {
    id: number;
    product: string;
    token: string;
    discount: BigNumberish;
    isFixed: boolean;
  },
  signer: SignerWithAddress
) => {
  const domain = {
    name: await couponContract.NAME(),
    version: await couponContract.VERSION(),
    chainId: (await ethers.provider.getNetwork()).chainId,
    verifyingContract: couponContract.address,
  };
  const types = {
    Coupon: [
      { name: 'nonce', type: 'uint256' },
      { name: 'payer', type: 'address' },
      { name: 'id', type: 'uint256' },
      { name: 'product', type: 'bytes32' },
      { name: 'token', type: 'address' },
      { name: 'discount', type: 'uint256' },
      { name: 'isFixed', type: 'bool' },
    ],
  };
  const value = {
    nonce: await couponContract.nonces(userAddress),
    payer: userAddress,
    id: coupon.id,
    product: ethers.utils.formatBytes32String(coupon.product),
    token: coupon.token,
    discount: coupon.discount,
    isFixed: coupon.isFixed,
  };

  const flagSig = await signer._signTypedData(domain, types, value);
  const sig = ethers.utils.splitSignature(flagSig);
  const abi = ethers.utils.defaultAbiCoder;
  const signature = abi.encode(
    ['uint8', 'bytes32', 'bytes32'],
    [sig.v, sig.r, sig.s]
  );

  return signature;
};

describe('HectorSubscription', function () {
  let deployer: SignerWithAddress;
  let upgradeableAdmin: SignerWithAddress;
  let owner: SignerWithAddress;
  let treasury: SignerWithAddress;
  let signer: SignerWithAddress;
  let notSigner: SignerWithAddress;

  let hectorToken: RewardToken;
  let torToken: RewardToken;
  let hectorSubscriptionFactory: HectorSubscriptionFactory;
  let hectorSubscriptionLogic: HectorSubscription;
  let hectorSubscription: HectorSubscription;
  let hectorCoupon: HectorCoupon;

  let product = 'TestProduct';
  let productBytes = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(product));

  let oneHour = 3600 * 1;
  let twoHour = 3600 * 2;

  let amount0 = ethers.utils.parseEther('100');
  let amount1 = ethers.utils.parseEther('200');

  let activePlans: {
    token: string;
    period: number;
    amount: BigNumber;
    data: string;
  }[] = [];
  let correctFixedCouponInfo: {
    id: number;
    product: string;
    token: string;
    discount: BigNumberish;
    isFixed: boolean;
  };
  let correctPercentCouponInfo: {
    id: number;
    product: string;
    token: string;
    discount: BigNumberish;
    isFixed: boolean;
  };

  beforeEach(async function () {
    [deployer, upgradeableAdmin, owner, treasury, signer, notSigner] =
      await ethers.getSigners();

    const TokenFactory = await ethers.getContractFactory('RewardToken');
    hectorToken = (await TokenFactory.deploy()) as RewardToken;
    torToken = (await TokenFactory.deploy()) as RewardToken;

    // Subscription Factory
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

    // Product Subscription
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

    activePlans = [
      {
        token: hectorToken.address,
        period: oneHour,
        amount: amount0,
        data: '0x00',
      },
      {
        token: torToken.address,
        period: twoHour,
        amount: amount1,
        data: '0x00',
      },
    ];
    await hectorSubscription.appendPlan(activePlans);

    // Coupon
    const HectorCoupon = await ethers.getContractFactory('HectorCoupon');
    await upgrades.silenceWarnings();
    hectorCoupon = (await upgrades.deployProxy(HectorCoupon, [], {
      unsafeAllow: ['delegatecall'],
    })) as HectorCoupon;
    await hectorCoupon.setModerator(signer.address, true);
    await hectorSubscriptionFactory.setCoupon(hectorCoupon.address);

    await hectorToken.mint(owner.address, utils.parseEther('200000000000000'));
    await hectorToken
      .connect(owner)
      .approve(hectorSubscription.address, utils.parseEther('200000000000000'));

    await torToken.mint(owner.address, utils.parseEther('200000000000000'));
    await torToken
      .connect(owner)
      .approve(hectorSubscription.address, utils.parseEther('200000000000000'));

    // Info
    correctFixedCouponInfo = {
      id: 1,
      product: product,
      token: hectorToken.address,
      discount: amount0.div(2), // half discount
      isFixed: true,
    };
    correctPercentCouponInfo = {
      id: 2,
      product: product,
      token: hectorToken.address,
      discount: 2500, // 25% discount
      isFixed: false,
    };
  });

  describe('#coupon', () => {
    let correctPay: {
      product: string;
      payer: string;
      token: string;
      amount: BigNumber;
    };

    beforeEach(async function () {
      correctPay = {
        product: product,
        payer: owner.address,
        token: hectorToken.address,
        amount: amount0,
      };
    });

    it('moderator', async function () {
      expect(await hectorCoupon.moderators(signer.address)).equal(true);
    });
    it('applyCoupon', async function () {
      let tx = await hectorCoupon
        .connect(owner)
        .applyCoupon(
          correctPay,
          await encodeCouponInfo(correctFixedCouponInfo),
          await signCouponMessage(
            hectorCoupon,
            owner.address,
            correctFixedCouponInfo,
            signer
          )
        );

      await expect(tx)
        .to.emit(hectorCoupon, 'CouponApplied')
        .withArgs(owner.address, correctFixedCouponInfo.id, product);
    });
    it('applyCoupon - valid', async function () {
      const result0 = await hectorCoupon.callStatic.applyCoupon(
        correctPay,
        await encodeCouponInfo(correctFixedCouponInfo),
        await signCouponMessage(
          hectorCoupon,
          owner.address,
          correctFixedCouponInfo,
          signer
        )
      );
      expect(result0.isValid).equal(true);
      expect(result0.id).equal(correctFixedCouponInfo.id);
      expect(result0.newAmount).equal(
        correctPay.amount.sub(correctFixedCouponInfo.discount)
      );

      const result1 = await hectorCoupon.callStatic.applyCoupon(
        correctPay,
        await encodeCouponInfo(correctPercentCouponInfo),
        await signCouponMessage(
          hectorCoupon,
          owner.address,
          correctPercentCouponInfo,
          signer
        )
      );
      expect(result1.isValid).equal(true);
      expect(result1.id).equal(correctPercentCouponInfo.id);
      expect(result1.newAmount).equal(
        correctPay.amount.sub(
          correctPay.amount
            .mul(correctPercentCouponInfo.discount)
            .div(await hectorCoupon.MULTIPLIER())
        )
      );
    });
    it('applyCoupon - invalid signer', async function () {
      const result0 = await hectorCoupon.callStatic.applyCoupon(
        correctPay,
        await encodeCouponInfo(correctFixedCouponInfo),
        await signCouponMessage(
          hectorCoupon,
          owner.address,
          correctFixedCouponInfo,
          notSigner
        )
      );
      expect(result0.isValid).equal(false);
      expect(result0.newAmount).equal(correctPay.amount);

      const result1 = await hectorCoupon.callStatic.applyCoupon(
        correctPay,
        await encodeCouponInfo(correctPercentCouponInfo),
        await signCouponMessage(
          hectorCoupon,
          owner.address,
          correctPercentCouponInfo,
          notSigner
        )
      );
      expect(result1.isValid).equal(false);
      expect(result1.newAmount).equal(correctPay.amount);
    });
    it('applyCoupon - invalid payer', async function () {
      const result0 = await hectorCoupon.callStatic.applyCoupon(
        { ...correctPay, payer: deployer.address },
        await encodeCouponInfo(correctFixedCouponInfo),
        await signCouponMessage(
          hectorCoupon,
          owner.address,
          correctFixedCouponInfo,
          signer
        )
      );
      expect(result0.isValid).equal(false);

      const result1 = await hectorCoupon.callStatic.applyCoupon(
        { ...correctPay, payer: deployer.address },
        await encodeCouponInfo(correctPercentCouponInfo),
        await signCouponMessage(
          hectorCoupon,
          owner.address,
          correctPercentCouponInfo,
          signer
        )
      );
      expect(result1.isValid).equal(false);
    });
    it('applyCoupon - invalid id', async function () {
      const result0 = await hectorCoupon.callStatic.applyCoupon(
        correctPay,
        await encodeCouponInfo({
          ...correctFixedCouponInfo,
          id: correctFixedCouponInfo.id + 10,
        }),
        await signCouponMessage(
          hectorCoupon,
          owner.address,
          correctFixedCouponInfo,
          signer
        )
      );
      expect(result0.isValid).equal(false);

      const result1 = await hectorCoupon.callStatic.applyCoupon(
        correctPay,
        await encodeCouponInfo({
          ...correctPercentCouponInfo,
          id: correctPercentCouponInfo.id + 10,
        }),
        await signCouponMessage(
          hectorCoupon,
          owner.address,
          correctPercentCouponInfo,
          signer
        )
      );
      expect(result1.isValid).equal(false);
    });
    it('applyCoupon - invalid product', async function () {
      const result0 = await hectorCoupon.callStatic.applyCoupon(
        { ...correctPay, product: product + 'not' },
        await encodeCouponInfo(correctFixedCouponInfo),
        await signCouponMessage(
          hectorCoupon,
          owner.address,
          correctFixedCouponInfo,
          signer
        )
      );
      expect(result0.isValid).equal(false);

      const result1 = await hectorCoupon.callStatic.applyCoupon(
        { ...correctPay, product: product + 'not' },
        await encodeCouponInfo(correctPercentCouponInfo),
        await signCouponMessage(
          hectorCoupon,
          owner.address,
          correctPercentCouponInfo,
          signer
        )
      );
      expect(result1.isValid).equal(false);
    });
    it('applyCoupon - invalid token', async function () {
      const result0 = await hectorCoupon.callStatic.applyCoupon(
        { ...correctPay, token: torToken.address },
        await encodeCouponInfo(correctFixedCouponInfo),
        await signCouponMessage(
          hectorCoupon,
          owner.address,
          correctFixedCouponInfo,
          signer
        )
      );
      expect(result0.isValid).equal(false);

      const result1 = await hectorCoupon.callStatic.applyCoupon(
        { ...correctPay, token: torToken.address },
        await encodeCouponInfo(correctPercentCouponInfo),
        await signCouponMessage(
          hectorCoupon,
          owner.address,
          correctPercentCouponInfo,
          signer
        )
      );
      expect(result1.isValid).equal(false);
    });
    it('applyCoupon - invalid discount', async function () {
      const result0 = await hectorCoupon.callStatic.applyCoupon(
        correctPay,
        await encodeCouponInfo({
          ...correctFixedCouponInfo,
          discount: 100,
        }),
        await signCouponMessage(
          hectorCoupon,
          owner.address,
          correctFixedCouponInfo,
          signer
        )
      );
      expect(result0.isValid).equal(false);

      const result1 = await hectorCoupon.callStatic.applyCoupon(
        correctPay,
        await encodeCouponInfo({
          ...correctPercentCouponInfo,
          discount: 100,
        }),
        await signCouponMessage(
          hectorCoupon,
          owner.address,
          correctPercentCouponInfo,
          signer
        )
      );
      expect(result1.isValid).equal(false);
    });
    it('applyCoupon - invalid isFixed', async function () {
      const result0 = await hectorCoupon.callStatic.applyCoupon(
        correctPay,
        await encodeCouponInfo({
          ...correctFixedCouponInfo,
          isFixed: !correctFixedCouponInfo.isFixed,
        }),
        await signCouponMessage(
          hectorCoupon,
          owner.address,
          correctFixedCouponInfo,
          signer
        )
      );
      expect(result0.isValid).equal(false);

      const result1 = await hectorCoupon.callStatic.applyCoupon(
        correctPay,
        await encodeCouponInfo({
          ...correctPercentCouponInfo,
          isFixed: !correctPercentCouponInfo.isFixed,
        }),
        await signCouponMessage(
          hectorCoupon,
          owner.address,
          correctPercentCouponInfo,
          signer
        )
      );
      expect(result1.isValid).equal(false);
    });
  });

  describe('#subscription - fixed discount coupon', () => {
    const planId = 1;
    let couponInfo: string;
    let signature: string;

    beforeEach(async function () {
      couponInfo = await encodeCouponInfo(correctFixedCouponInfo);
      signature = await signCouponMessage(
        hectorCoupon,
        owner.address,
        correctFixedCouponInfo,
        signer
      );
    });

    it('to create subscription with coupon', async function () {
      const amountToDeposit = await hectorSubscription
        .connect(owner)
        .callStatic.toCreateSubscritpionWithCoupon(
          planId,
          couponInfo,
          signature
        );

      expect(amountToDeposit).equal(
        activePlans[planId - 1].amount.sub(correctFixedCouponInfo.discount)
      );
    });

    it('create subscription with coupon', async function () {
      const oldBalance = await hectorToken.balanceOf(owner.address);
      const tx = await hectorSubscription
        .connect(owner)
        .createSubscriptionWithCoupon(planId, couponInfo, signature);
      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );
      let expiredAt = block.timestamp + activePlans[planId - 1].period;
      const newBalance = await hectorToken.balanceOf(owner.address);

      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionCreatedWithCoupon')
        .withArgs(owner.address, planId, correctFixedCouponInfo.id, expiredAt);

      expect(oldBalance.sub(newBalance)).equal(
        activePlans[planId - 1].amount.sub(correctFixedCouponInfo.discount)
      );
    });

    it('create subscription with invalid coupon', async function () {
      await expect(
        hectorSubscription
          .connect(owner)
          .createSubscriptionWithCoupon(planId + 1, couponInfo, signature)
      ).to.be.revertedWith('INVALID_COUPON()');
    });
  });

  describe('#subscription - percent discount coupon', () => {
    const planId = 1;
    let couponInfo: string;
    let signature: string;

    beforeEach(async function () {
      couponInfo = await encodeCouponInfo(correctPercentCouponInfo);
      signature = await signCouponMessage(
        hectorCoupon,
        owner.address,
        correctPercentCouponInfo,
        signer
      );
    });

    it('to create subscription with coupon', async function () {
      const amountToDeposit = await hectorSubscription
        .connect(owner)
        .callStatic.toCreateSubscritpionWithCoupon(
          planId,
          couponInfo,
          signature
        );

      expect(amountToDeposit).equal(
        activePlans[planId - 1].amount.sub(
          activePlans[planId - 1].amount
            .mul(correctPercentCouponInfo.discount)
            .div(await hectorCoupon.MULTIPLIER())
        )
      );
    });

    it('create subscription with coupon', async function () {
      const oldBalance = await hectorToken.balanceOf(owner.address);
      const tx = await hectorSubscription
        .connect(owner)
        .createSubscriptionWithCoupon(planId, couponInfo, signature);
      let txReceipt = await hectorSubscription.provider.getTransactionReceipt(
        tx.hash
      );
      let block = await hectorSubscription.provider.getBlock(
        txReceipt.blockNumber
      );
      let expiredAt = block.timestamp + activePlans[planId - 1].period;
      const newBalance = await hectorToken.balanceOf(owner.address);

      await expect(tx)
        .emit(hectorSubscription, 'SubscriptionCreatedWithCoupon')
        .withArgs(
          owner.address,
          planId,
          correctPercentCouponInfo.id,
          expiredAt
        );

      expect(oldBalance.sub(newBalance)).equal(
        activePlans[planId - 1].amount.sub(
          activePlans[planId - 1].amount
            .mul(correctPercentCouponInfo.discount)
            .div(await hectorCoupon.MULTIPLIER())
        )
      );
    });

    it('create subscription with invalid coupon', async function () {
      await expect(
        hectorSubscription
          .connect(owner)
          .createSubscriptionWithCoupon(planId + 1, couponInfo, signature)
      ).to.be.revertedWith('INVALID_COUPON()');
    });
  });
});
