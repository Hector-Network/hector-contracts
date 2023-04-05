import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { BigNumber, utils } from 'ethers';
import { increaseTime, getTimeStamp } from './../helper';
import {
  HectorSubscriptionFactory,
  HectorSubscription,
  HectorPayFactory,
  HectorPay,
  RewardToken,
} from '../types';

describe('HectorUpfrontPay', function () {
  let deployer: SignerWithAddress;
  let upgradeableAdmin: SignerWithAddress;
  let payer: SignerWithAddress;
  let payee: SignerWithAddress;
  let treasury: SignerWithAddress;

  let hectorToken: RewardToken;
  let torToken: RewardToken;

  let hectorSubscriptionFactory: HectorSubscriptionFactory;
  let hectorSubscriptionLogic: HectorSubscription;
  let hectorSubscription: HectorSubscription;
  let product = 'TestProduct';
  let productBytes = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(product));

  let hectorPayFactory: HectorPayFactory;
  let hectorPayLogic: HectorPay;
  let hectorPay: HectorPay;

  let oneHour = 3600 * 1;
  let twoHour = 3600 * 2;

  let amount0 = ethers.utils.parseEther('100');
  let amount1 = ethers.utils.parseEther('200');

  let limitForFree = 1;
  let limitForOneHour = 2;
  let limitForTwoHour = ethers.constants.MaxUint256;

  let divisor = 100;

  this.beforeEach(async function () {
    [deployer, upgradeableAdmin, payer, payee, treasury] =
      await ethers.getSigners();

    /// TOKEN ///
    const TokenFactory = await ethers.getContractFactory('RewardToken');
    hectorToken = (await TokenFactory.deploy()) as RewardToken;
    torToken = (await TokenFactory.deploy()) as RewardToken;

    /// SUBSCRIPTION ///
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
        data: ethers.utils.hexZeroPad(
          ethers.utils.hexlify(limitForOneHour),
          32
        ),
      },
      {
        token: torToken.address,
        period: twoHour,
        amount: amount1,
        data: ethers.utils.hexZeroPad(
          ethers.utils.hexlify(limitForTwoHour),
          32
        ),
      },
    ]);

    await hectorSubscription.updatePlan(0, {
      token: ethers.constants.AddressZero,
      period: 0,
      amount: 0,
      data: ethers.utils.hexZeroPad(ethers.utils.hexlify(limitForFree), 32),
    });

    /// Pay ///
    const HectorPay = await ethers.getContractFactory('HectorPay');
    hectorPayLogic = (await HectorPay.deploy()) as HectorPay;

    const HectorPayFactory = await ethers.getContractFactory(
      'HectorPayFactory'
    );
    hectorPayFactory = (await HectorPayFactory.deploy(
      hectorPayLogic.address,
      upgradeableAdmin.address,
      hectorSubscription.address
    )) as HectorPayFactory;

    await hectorPayFactory.createHectorPayContract(hectorToken.address);
    hectorPay = (await ethers.getContractAt(
      'HectorPay',
      await hectorPayFactory.getHectorPayContractByToken(hectorToken.address)
    )) as HectorPay;

    /// TOKEN ///
    await hectorToken.mint(payer.address, utils.parseEther('200000000000000'));
    await torToken.mint(payer.address, utils.parseEther('200000000000000'));

    await hectorToken
      .connect(payer)
      .approve(hectorSubscription.address, utils.parseEther('200000000000000'));
    await hectorToken
      .connect(payer)
      .approve(hectorPay.address, utils.parseEther('200000000000000'));

    await torToken
      .connect(payer)
      .approve(hectorSubscription.address, utils.parseEther('200000000000000'));
    await torToken
      .connect(payer)
      .approve(hectorPay.address, utils.parseEther('200000000000000'));

    /// CREATE SUBSCRIPTION ///
    await hectorSubscription
      .connect(payer)
      .deposit(hectorToken.address, amount0);
    await hectorSubscription.connect(payer).createSubscription(1);
  });

  describe('#factory', () => {
    it('logic', async function () {
      expect(await hectorPayFactory.hectorPayLogic()).equal(
        hectorPayLogic.address
      );
    });
    it('upgradeable admin', async function () {
      expect(await hectorPayFactory.upgradeableAdmin()).equal(
        upgradeableAdmin.address
      );
    });
    it('pay subscription', async function () {
      expect(await hectorPayFactory.subscription()).equal(
        hectorSubscription.address
      );
    });
    it('pay contract', async function () {
      expect(await hectorPayFactory.getHectorPayContractByIndex(0)).equal(
        hectorPay.address
      );
      expect(
        await hectorPayFactory.getHectorPayContractByToken(hectorToken.address)
      ).equal(hectorPay.address);
    });
    it('is deployed', async function () {
      expect(
        await hectorPayFactory.isDeployedHectorPayContractByToken(
          hectorToken.address
        )
      ).equal(true);
      expect(
        await hectorPayFactory.isDeployedHectorPayContractByToken(
          torToken.address
        )
      ).equal(false);
    });
  });

  describe('#pay', () => {
    it('token', async function () {
      expect(await hectorPay.token()).equal(hectorToken.address);
    });
    it('factory', async function () {
      expect(await hectorPay.factory()).equal(hectorPayFactory.address);
    });
  });

  describe('#pay - deposit/withdraw payer', () => {
    it('deposit', async function () {
      let amount = ethers.utils.parseEther('1000');
      let tx = await hectorPay.connect(payer).deposit(amount);

      await expect(tx)
        .to.emit(hectorPay, 'PayerDeposit')
        .withArgs(payer.address, amount.mul(divisor));

      let info = await hectorPay.payers(payer.address);
      expect(info.totalDeposited).equal(amount.mul(divisor));

      expect(await hectorToken.balanceOf(hectorPay.address)).equal(amount);
    });
    it('withdrawable payer', async function () {
      let amount = ethers.utils.parseEther('1000');

      await hectorPay.connect(payer).deposit(amount);
      expect(await hectorPay.withdrawablePayer(payer.address)).equal(amount);

      await hectorPay.connect(payer).deposit(amount);
      expect(await hectorPay.withdrawablePayer(payer.address)).equal(
        amount.mul(2)
      );
    });
    it('withdraw payer', async function () {
      let amount = ethers.utils.parseEther('1000');
      await hectorPay.connect(payer).deposit(amount.mul(2));

      let tx = await hectorPay.connect(payer).withdrawPayer(amount);

      await expect(tx)
        .to.emit(hectorPay, 'PayerWithdraw')
        .withArgs(payer.address, amount.mul(divisor));

      let info = await hectorPay.payers(payer.address);
      expect(info.totalDeposited).equal(amount.mul(divisor));

      expect(await hectorToken.balanceOf(hectorPay.address)).equal(amount);
    });
    it('withdraw payer all', async function () {
      let amount = ethers.utils.parseEther('1000');
      await hectorPay.connect(payer).deposit(amount);

      let tx = await hectorPay.connect(payer).withdrawPayerAll();

      await expect(tx)
        .to.emit(hectorPay, 'PayerWithdraw')
        .withArgs(payer.address, amount.mul(divisor));

      let info = await hectorPay.payers(payer.address);
      expect(info.totalDeposited).equal(0);

      expect(await hectorToken.balanceOf(hectorPay.address)).equal(0);
    });
  });

  describe('#pay - create', () => {
    let amountPerSec = ethers.utils.parseEther('100'); // divisor = 100
    let starts = 0;
    let ends = 0;
    let streamId = '';

    beforeEach(async function () {
      let amount = ethers.utils.parseEther('1000');
      await hectorPay.connect(payer).deposit(amount);

      starts = (await getTimeStamp()) + 10;
      ends = starts + 100;

      streamId = await hectorPay.getStreamId(
        payer.address,
        payee.address,
        amountPerSec,
        starts,
        ends
      );
    });

    it('create stream', async function () {
      let tx = await hectorPay
        .connect(payer)
        .createStream(payee.address, amountPerSec, starts, ends);

      await expect(tx)
        .to.emit(hectorPay, 'StreamCreated')
        .withArgs(
          payer.address,
          payee.address,
          amountPerSec,
          starts,
          ends,
          streamId
        );

      let decimalAmount = amountPerSec.mul(ends - starts);
      let info = await hectorPay.payers(payer.address);
      expect(info.totalCommitted).equal(decimalAmount);

      let stream = await hectorPay.streams(streamId);
      expect(stream.lastPaid).equal(starts);
    });

    it('create stream with reason', async function () {
      let reason = 'test';
      let tx = await hectorPay
        .connect(payer)
        .createStreamWithReason(
          payee.address,
          amountPerSec,
          starts,
          ends,
          reason
        );

      await expect(tx)
        .to.emit(hectorPay, 'StreamCreatedWithReason')
        .withArgs(
          payer.address,
          payee.address,
          amountPerSec,
          starts,
          ends,
          streamId,
          reason
        );

      let decimalAmount = amountPerSec.mul(ends - starts);
      let info = await hectorPay.payers(payer.address);
      expect(info.totalCommitted).equal(decimalAmount);

      let stream = await hectorPay.streams(streamId);
      expect(stream.lastPaid).equal(starts);
    });

    it('create stream again', async function () {
      await hectorPay
        .connect(payer)
        .createStream(payee.address, amountPerSec, starts, ends);

      await expect(
        hectorPay
          .connect(payer)
          .createStream(payee.address, amountPerSec, starts, ends)
      ).to.be.revertedWith('ACTIVE_STREAM()');
    });

    it('create stream insufficent fund', async function () {
      await expect(
        hectorPay
          .connect(payer)
          .createStream(payee.address, amountPerSec, starts, ends + 1000)
      ).to.be.revertedWith('INSUFFICIENT_FUND()');
    });
  });

  describe('#pay - pause', () => {
    let amountPerSec = ethers.utils.parseEther('100'); // divisor = 100
    let starts = 0;
    let ends = 0;
    let streamId = '';

    beforeEach(async function () {
      let amount = ethers.utils.parseEther('1000');
      await hectorPay.connect(payer).deposit(amount);

      starts = (await getTimeStamp()) + 10;
      ends = starts + 100;

      streamId = await hectorPay.getStreamId(
        payer.address,
        payee.address,
        amountPerSec,
        starts,
        ends
      );

      await hectorPay
        .connect(payer)
        .createStream(payee.address, amountPerSec, starts, ends);

      await increaseTime(50);
    });

    it('pause stream', async function () {
      let tx = await hectorPay
        .connect(payer)
        .pauseStream(payee.address, amountPerSec, starts, ends);
      let txReceipt = await hectorPay.provider.getTransactionReceipt(tx.hash);
      let block = await hectorPay.provider.getBlock(txReceipt.blockNumber);
      let decimalAmount = amountPerSec.mul(block.timestamp - starts);

      await expect(tx)
        .to.emit(hectorPay, 'StreamPaused')
        .withArgs(
          payer.address,
          payee.address,
          amountPerSec,
          starts,
          ends,
          streamId
        );
      await expect(tx)
        .to.emit(hectorPay, 'Withdraw')
        .withArgs(
          payer.address,
          payee.address,
          amountPerSec,
          starts,
          ends,
          block.timestamp,
          streamId,
          decimalAmount
        );

      let info = await hectorPay.payers(payer.address);
      expect(info.totalWithdrawn).equal(decimalAmount);

      let stream = await hectorPay.streams(streamId);
      expect(stream.lastPaid).equal(0);
      expect(stream.lastPaused).equal(block.timestamp);

      let paused = await hectorPay.isPausedBySubscription(streamId);
      expect(paused).equal(false);

      expect(await hectorToken.balanceOf(payee.address)).equal(
        decimalAmount.div(divisor)
      );
    });

    it('pause stream again', async function () {
      await hectorPay
        .connect(payer)
        .pauseStream(payee.address, amountPerSec, starts, ends);

      await expect(
        hectorPay
          .connect(payer)
          .pauseStream(payee.address, amountPerSec, starts, ends)
      ).to.be.revertedWith('INACTIVE_STREAM()');
    });

    it('pause inactive stream', async function () {
      await expect(
        hectorPay
          .connect(payer)
          .pauseStream(payee.address, amountPerSec, starts, ends + 10)
      ).to.be.revertedWith('INACTIVE_STREAM()');
    });

    it('pause inactive subscription', async function () {
      await hectorSubscription.connect(payer).cancelSubscription();
      await increaseTime(oneHour);

      let tx = await hectorPay.pauseStreamBySubscription(
        payer.address,
        payee.address,
        amountPerSec,
        starts,
        ends
      );
      let txReceipt = await hectorPay.provider.getTransactionReceipt(tx.hash);
      let block = await hectorPay.provider.getBlock(txReceipt.blockNumber);
      let decimalAmount = amountPerSec.mul(ends - starts);

      await expect(tx)
        .to.emit(hectorPay, 'StreamPaused')
        .withArgs(
          payer.address,
          payee.address,
          amountPerSec,
          starts,
          ends,
          streamId
        );
      await expect(tx)
        .to.emit(hectorPay, 'Withdraw')
        .withArgs(
          payer.address,
          payee.address,
          amountPerSec,
          starts,
          ends,
          ends,
          streamId,
          decimalAmount
        );

      let info = await hectorPay.payers(payer.address);
      expect(info.totalWithdrawn).equal(decimalAmount);

      let stream = await hectorPay.streams(streamId);
      expect(stream.lastPaid).equal(0);
      expect(stream.lastPaused).equal(block.timestamp);

      let paused = await hectorPay.isPausedBySubscription(streamId);
      expect(paused).equal(true);

      expect(await hectorToken.balanceOf(payee.address)).equal(
        decimalAmount.div(divisor)
      );
    });
  });

  describe('#pay - resume', () => {
    let amountPerSec = ethers.utils.parseEther('100'); // divisor = 100
    let starts = 0;
    let ends = 0;
    let streamId = '';
    let pausedAt = 0;
    let totalCommitted: BigNumber;

    beforeEach(async function () {
      let amount = ethers.utils.parseEther('100000');
      await hectorPay.connect(payer).deposit(amount);

      starts = (await getTimeStamp()) + 10;
      ends = starts + 100;

      streamId = await hectorPay.getStreamId(
        payer.address,
        payee.address,
        amountPerSec,
        starts,
        ends
      );

      totalCommitted = amountPerSec.mul(ends - starts);

      await hectorPay
        .connect(payer)
        .createStream(payee.address, amountPerSec, starts, ends);

      await increaseTime(50);

      let tx = await hectorPay
        .connect(payer)
        .pauseStream(payee.address, amountPerSec, starts, ends);
      let txReceipt = await hectorPay.provider.getTransactionReceipt(tx.hash);
      let block = await hectorPay.provider.getBlock(txReceipt.blockNumber);
      pausedAt = block.timestamp;

      await increaseTime(10);
    });

    it('resume stream', async function () {
      let tx = await hectorPay
        .connect(payer)
        .resumeStream(payee.address, amountPerSec, starts, ends);
      let txReceipt = await hectorPay.provider.getTransactionReceipt(tx.hash);
      let block = await hectorPay.provider.getBlock(txReceipt.blockNumber);

      await expect(tx)
        .to.emit(hectorPay, 'StreamResumed')
        .withArgs(
          payer.address,
          payee.address,
          amountPerSec,
          starts,
          ends,
          streamId
        );

      let pausedAmount = amountPerSec.mul(block.timestamp - pausedAt);

      let info = await hectorPay.payers(payer.address);
      expect(info.totalCommitted).equal(totalCommitted.sub(pausedAmount));

      let stream = await hectorPay.streams(streamId);
      expect(stream.lastPaid).equal(block.timestamp);
      expect(stream.lastPaused).equal(0);

      let paused = await hectorPay.isPausedBySubscription(streamId);
      expect(paused).equal(false);
    });

    it('resume stream again', async function () {
      await hectorPay
        .connect(payer)
        .resumeStream(payee.address, amountPerSec, starts, ends);

      await expect(
        hectorPay
          .connect(payer)
          .resumeStream(payee.address, amountPerSec, starts, ends)
      ).to.be.revertedWith('ACTIVE_STREAM()');
    });

    it('resume active stream', async function () {
      await hectorPay
        .connect(payer)
        .createStream(payee.address, amountPerSec, starts, ends + 10);

      await expect(
        hectorPay
          .connect(payer)
          .resumeStream(payee.address, amountPerSec, starts, ends + 10)
      ).to.be.revertedWith('ACTIVE_STREAM()');
    });

    it('resume paused by subscription', async function () {
      ends += oneHour;
      await hectorPay
        .connect(payer)
        .createStream(payee.address, amountPerSec, starts, ends);
      streamId = await hectorPay.getStreamId(
        payer.address,
        payee.address,
        amountPerSec,
        starts,
        ends
      );
      await hectorSubscription.connect(payer).cancelSubscription();
      await increaseTime(oneHour);
      let tx = await hectorPay.pauseStreamBySubscription(
        payer.address,
        payee.address,
        amountPerSec,
        starts,
        ends
      );
      let txReceipt = await hectorPay.provider.getTransactionReceipt(tx.hash);
      let block = await hectorPay.provider.getBlock(txReceipt.blockNumber);
      pausedAt = block.timestamp;
      await hectorSubscription
        .connect(payer)
        .deposit(hectorToken.address, amount0);
      await hectorSubscription.connect(payer).createSubscription(1);

      tx = await hectorPay.resumeStreamBySubscription(
        payer.address,
        payee.address,
        amountPerSec,
        starts,
        ends
      );
      txReceipt = await hectorPay.provider.getTransactionReceipt(tx.hash);
      block = await hectorPay.provider.getBlock(txReceipt.blockNumber);

      await expect(tx)
        .to.emit(hectorPay, 'StreamResumed')
        .withArgs(
          payer.address,
          payee.address,
          amountPerSec,
          starts,
          ends,
          streamId
        );

      let pausedAmount = amountPerSec.mul(block.timestamp - pausedAt);

      let info = await hectorPay.payers(payer.address);
      expect(info.totalCommitted).equal(
        totalCommitted.add(amountPerSec.mul(ends - starts).sub(pausedAmount))
      );

      let stream = await hectorPay.streams(streamId);
      expect(stream.lastPaid).equal(block.timestamp);
      expect(stream.lastPaused).equal(0);

      let paused = await hectorPay.isPausedBySubscription(streamId);
      expect(paused).equal(false);
    });
  });

  describe('#pay - cancel', () => {
    let amountPerSec = ethers.utils.parseEther('100'); // divisor = 100
    let starts = 0;
    let ends = 0;
    let streamId = '';
    let totalCommitted: BigNumber;

    beforeEach(async function () {
      let amount = ethers.utils.parseEther('1000');
      await hectorPay.connect(payer).deposit(amount);

      starts = (await getTimeStamp()) + 10;
      ends = starts + 100;

      streamId = await hectorPay.getStreamId(
        payer.address,
        payee.address,
        amountPerSec,
        starts,
        ends
      );

      await hectorPay
        .connect(payer)
        .createStream(payee.address, amountPerSec, starts, ends);

      totalCommitted = amountPerSec.mul(ends - starts);

      await increaseTime(50);
    });

    it('cancel stream', async function () {
      let tx = await hectorPay
        .connect(payer)
        .cancelStream(payee.address, amountPerSec, starts, ends);
      let txReceipt = await hectorPay.provider.getTransactionReceipt(tx.hash);
      let block = await hectorPay.provider.getBlock(txReceipt.blockNumber);
      let cancelledAt = block.timestamp;
      let decimalAmount = amountPerSec.mul(cancelledAt - starts);
      let cancelledAmount = amountPerSec.mul(ends - cancelledAt);

      await expect(tx)
        .to.emit(hectorPay, 'StreamCancelled')
        .withArgs(
          payer.address,
          payee.address,
          amountPerSec,
          starts,
          ends,
          streamId
        );
      await expect(tx)
        .to.emit(hectorPay, 'Withdraw')
        .withArgs(
          payer.address,
          payee.address,
          amountPerSec,
          starts,
          ends,
          block.timestamp,
          streamId,
          decimalAmount
        );

      let info = await hectorPay.payers(payer.address);
      expect(info.totalWithdrawn).equal(decimalAmount);
      expect(info.totalCommitted).equal(totalCommitted.sub(cancelledAmount));

      let stream = await hectorPay.streams(streamId);
      expect(stream.lastPaid).equal(0);

      expect(await hectorToken.balanceOf(payee.address)).equal(
        decimalAmount.div(divisor)
      );
    });

    it('cancel inactive stream', async function () {
      await expect(
        hectorPay
          .connect(payer)
          .cancelStream(payee.address, amountPerSec, starts, ends + 10)
      ).to.be.revertedWith('INACTIVE_STREAM()');
    });

    it('cancel paused stream', async function () {
      let tx = await hectorPay
        .connect(payer)
        .pauseStream(payee.address, amountPerSec, starts, ends);
      let txReceipt = await hectorPay.provider.getTransactionReceipt(tx.hash);
      let block = await hectorPay.provider.getBlock(txReceipt.blockNumber);
      let pausedAt = block.timestamp;
      let decimalAmount = amountPerSec.mul(pausedAt - starts);
      let cancelledAmount = amountPerSec.mul(ends - pausedAt);

      await increaseTime(10);
      await hectorPay
        .connect(payer)
        .cancelStream(payee.address, amountPerSec, starts, ends);

      let info = await hectorPay.payers(payer.address);
      expect(info.totalWithdrawn).equal(decimalAmount);
      expect(info.totalCommitted).equal(totalCommitted.sub(cancelledAmount));

      let stream = await hectorPay.streams(streamId);
      expect(stream.lastPaid).equal(0);
      expect(stream.lastPaused).equal(0);

      expect(await hectorToken.balanceOf(payee.address)).equal(
        decimalAmount.div(divisor)
      );
    });

    it('cancel ended stream', async function () {
      await increaseTime(100);

      let tx = await hectorPay
        .connect(payer)
        .cancelStream(payee.address, amountPerSec, starts, ends);
      let txReceipt = await hectorPay.provider.getTransactionReceipt(tx.hash);
      let block = await hectorPay.provider.getBlock(txReceipt.blockNumber);
      let decimalAmount = amountPerSec.mul(ends - starts);
      let cancelledAmount = 0;

      await expect(tx)
        .to.emit(hectorPay, 'StreamCancelled')
        .withArgs(
          payer.address,
          payee.address,
          amountPerSec,
          starts,
          ends,
          streamId
        );
      await expect(tx)
        .to.emit(hectorPay, 'Withdraw')
        .withArgs(
          payer.address,
          payee.address,
          amountPerSec,
          starts,
          ends,
          ends,
          streamId,
          decimalAmount
        );

      let info = await hectorPay.payers(payer.address);
      expect(info.totalWithdrawn).equal(decimalAmount);
      expect(info.totalCommitted).equal(totalCommitted.sub(cancelledAmount));

      let stream = await hectorPay.streams(streamId);
      expect(stream.lastPaid).equal(0);

      expect(await hectorToken.balanceOf(payee.address)).equal(
        decimalAmount.div(divisor)
      );
    });
  });

  describe('#pay - withdraw payee', () => {
    let amountPerSec = ethers.utils.parseEther('100'); // divisor = 100
    let starts = 0;
    let ends = 0;
    let streamId = '';

    beforeEach(async function () {
      let amount = ethers.utils.parseEther('1000');
      await hectorPay.connect(payer).deposit(amount);

      starts = (await getTimeStamp()) + 10;
      ends = starts + 100;

      streamId = await hectorPay.getStreamId(
        payer.address,
        payee.address,
        amountPerSec,
        starts,
        ends
      );

      await hectorPay
        .connect(payer)
        .createStream(payee.address, amountPerSec, starts, ends);

      await increaseTime(50);
    });

    it('withdrawable', async function () {
      let decimalAmount = amountPerSec.mul((await getTimeStamp()) - starts);

      let info = await hectorPay.withdrawable(
        payer.address,
        payee.address,
        amountPerSec,
        starts,
        ends
      );
      expect(info.streamId).equal(streamId);
      expect(info.lastPaid).equal(starts);
      expect(info.withdrawableAmount).gte(decimalAmount.div(divisor));
    });

    it('withdraw', async function () {
      let tx = await hectorPay.withdraw(
        payer.address,
        payee.address,
        amountPerSec,
        starts,
        ends
      );
      let txReceipt = await hectorPay.provider.getTransactionReceipt(tx.hash);
      let block = await hectorPay.provider.getBlock(txReceipt.blockNumber);
      let withdrawnAt = block.timestamp;
      let decimalAmount = amountPerSec.mul(withdrawnAt - starts);

      await expect(tx)
        .to.emit(hectorPay, 'Withdraw')
        .withArgs(
          payer.address,
          payee.address,
          amountPerSec,
          starts,
          ends,
          withdrawnAt,
          streamId,
          decimalAmount
        );

      let info = await hectorPay.payers(payer.address);
      expect(info.totalWithdrawn).equal(decimalAmount);

      let stream = await hectorPay.streams(streamId);
      expect(stream.lastPaid).equal(withdrawnAt);

      expect(await hectorToken.balanceOf(payee.address)).equal(
        decimalAmount.div(divisor)
      );
    });

    it('withdraw again', async function () {
      await hectorPay.withdraw(
        payer.address,
        payee.address,
        amountPerSec,
        starts,
        ends
      );
      const lastPaid = (await hectorPay.streams(streamId)).lastPaid;
      await increaseTime(10);

      let tx = await hectorPay.withdraw(
        payer.address,
        payee.address,
        amountPerSec,
        starts,
        ends
      );
      let txReceipt = await hectorPay.provider.getTransactionReceipt(tx.hash);
      let block = await hectorPay.provider.getBlock(txReceipt.blockNumber);
      let withdrawnAt = block.timestamp;
      let decimalAmount = amountPerSec.mul(withdrawnAt - lastPaid);

      await expect(tx)
        .to.emit(hectorPay, 'Withdraw')
        .withArgs(
          payer.address,
          payee.address,
          amountPerSec,
          starts,
          ends,
          withdrawnAt,
          streamId,
          decimalAmount
        );

      let info = await hectorPay.payers(payer.address);
      expect(info.totalWithdrawn).equal(amountPerSec.mul(withdrawnAt - starts));

      let stream = await hectorPay.streams(streamId);
      expect(stream.lastPaid).equal(withdrawnAt);

      expect(await hectorToken.balanceOf(payee.address)).equal(
        amountPerSec.mul(withdrawnAt - starts).div(divisor)
      );
    });

    it('withdraw ended stream', async function () {
      await increaseTime(100);

      let tx = await hectorPay.withdraw(
        payer.address,
        payee.address,
        amountPerSec,
        starts,
        ends
      );
      let withdrawnAt = ends;
      let decimalAmount = amountPerSec.mul(withdrawnAt - starts);

      await expect(tx)
        .to.emit(hectorPay, 'Withdraw')
        .withArgs(
          payer.address,
          payee.address,
          amountPerSec,
          starts,
          ends,
          withdrawnAt,
          streamId,
          decimalAmount
        );

      let info = await hectorPay.payers(payer.address);
      expect(info.totalWithdrawn).equal(decimalAmount);

      let stream = await hectorPay.streams(streamId);
      expect(stream.lastPaid).equal(withdrawnAt);

      expect(await hectorToken.balanceOf(payee.address)).equal(
        decimalAmount.div(divisor)
      );
    });

    it('withdraw paused stream', async function () {
      await hectorPay
        .connect(payer)
        .pauseStream(payee.address, amountPerSec, starts, ends);

      await expect(
        hectorPay.withdraw(
          payer.address,
          payee.address,
          amountPerSec,
          starts,
          ends
        )
      ).to.be.revertedWith('INACTIVE_STREAM()');
    });

    it('withdraw cancelled stream', async function () {
      await hectorPay
        .connect(payer)
        .cancelStream(payee.address, amountPerSec, starts, ends);

      await expect(
        hectorPay.withdraw(
          payer.address,
          payee.address,
          amountPerSec,
          starts,
          ends
        )
      ).to.be.revertedWith('INACTIVE_STREAM()');
    });
  });

  describe('#pay - limitation for free plan', () => {
    let amountPerSec = ethers.utils.parseEther('100'); // divisor = 100
    let starts = 0;
    let ends = 0;
    let streamId = '';

    beforeEach(async function () {
      let amount = ethers.utils.parseEther('1000');
      await hectorPay.connect(payer).deposit(amount);

      await hectorSubscription.connect(payer).cancelSubscription();
      await increaseTime(twoHour);

      starts = (await getTimeStamp()) + 10;
      ends = starts + 100;

      streamId = await hectorPay.getStreamId(
        payer.address,
        payee.address,
        amountPerSec,
        starts,
        ends
      );
    });

    it('create one stream with free plan', async function () {
      let tx = await hectorPay
        .connect(payer)
        .createStream(payee.address, amountPerSec, starts, ends);

      await expect(tx)
        .to.emit(hectorPay, 'StreamCreated')
        .withArgs(
          payer.address,
          payee.address,
          amountPerSec,
          starts,
          ends,
          streamId
        );
    });

    it('create more streams with free plan', async function () {
      await hectorPay
        .connect(payer)
        .createStream(payee.address, amountPerSec, starts, ends);

      await expect(
        hectorPay
          .connect(payer)
          .createStream(payee.address, amountPerSec, starts + 10, ends + 10)
      ).to.be.revertedWith('LIMITED_SUBSCRIPTION()');
    });
  });

  describe('#pay - limiation for purchased plan', () => {
    let amountPerSec = ethers.utils.parseEther('100'); // divisor = 100
    let starts = 0;
    let ends = 0;
    let streamId = '';

    beforeEach(async function () {
      let amount = ethers.utils.parseEther('1000');
      await hectorPay.connect(payer).deposit(amount);

      starts = (await getTimeStamp()) + 10;
      ends = starts + 100;

      streamId = await hectorPay.getStreamId(
        payer.address,
        payee.address,
        amountPerSec,
        starts,
        ends
      );
    });

    it('create two streams with first plan', async function () {
      await hectorPay
        .connect(payer)
        .createStream(payee.address, amountPerSec, starts, ends);

      await hectorPay
        .connect(payer)
        .createStream(payee.address, amountPerSec, starts + 10, ends + 10);
    });

    it('create more streams with first plan', async function () {
      await hectorPay
        .connect(payer)
        .createStream(payee.address, amountPerSec, starts, ends);

      await hectorPay
        .connect(payer)
        .createStream(payee.address, amountPerSec, starts + 10, ends + 10);

      await expect(
        hectorPay
          .connect(payer)
          .createStream(payee.address, amountPerSec, starts + 20, ends + 20)
      ).to.be.revertedWith('LIMITED_SUBSCRIPTION()');
    });

    it('create more streams after one is ended with first plan', async function () {
      // Two active streams
      await hectorPay
        .connect(payer)
        .createStream(payee.address, amountPerSec, starts, ends);
      await hectorPay
        .connect(payer)
        .createStream(payee.address, amountPerSec, starts + 10, ends + 10);

      // First stream is inactive so can create a new one
      await increaseTime(ends - (await getTimeStamp()) + 1);
      await hectorPay
        .connect(payer)
        .createStream(payee.address, amountPerSec, starts + 20, ends + 20);

      // Two streams are both inactive so can create two ones
      await increaseTime(ends - (await getTimeStamp()) + 21);
      await hectorPay
        .connect(payer)
        .createStream(payee.address, amountPerSec, starts + 30, ends + 30);
      await hectorPay
        .connect(payer)
        .createStream(payee.address, amountPerSec, starts + 40, ends + 40);
    });
  });
});
