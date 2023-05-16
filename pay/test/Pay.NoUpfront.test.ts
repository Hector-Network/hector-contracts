import { Result } from '@ethersproject/abi';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { BigNumber, constants, utils } from 'ethers';
import { emitAmounts } from '../deploy/config';
import { increaseTime, getTimeStamp, gWei } from './../helper';
import { HectorPayFactory, HectorPay, RewardToken } from '../types';
import exp from 'constants';

describe('HectoryPay', function () {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let hectorToken: RewardToken;
  let hectorPayFactory: HectorPayFactory;
  let hectorPayLogic: HectorPay;
  let hectorPay: HectorPay;

  beforeEach(async function () {
    [deployer, owner, alice, bob] = await ethers.getSigners();

    const HectorToken = await ethers.getContractFactory('RewardToken');
    hectorToken = (await HectorToken.deploy()) as RewardToken;

    const HectorPay = await ethers.getContractFactory('HectorPay');
    hectorPayLogic = (await HectorPay.deploy()) as HectorPay;

    const HectorPayFactory = await ethers.getContractFactory(
      'HectorPayFactory'
    );
    hectorPayFactory = (await HectorPayFactory.deploy(
      hectorPayLogic.address,
      deployer.address
    )) as HectorPayFactory;

    await hectorPayFactory.createHectorPayContract(hectorToken.address);
    hectorPay = (await ethers.getContractAt(
      'HectorPay',
      await hectorPayFactory.getHectorPayContractByToken(hectorToken.address)
    )) as HectorPay;

    await hectorToken.mint(owner.address, utils.parseEther('200000000000000'));
    await hectorToken
      .connect(owner)
      .approve(hectorPay.address, utils.parseEther('200000000000000'));
  });

  describe('#factory', () => {
    it('logic', async function () {
      expect(await hectorPayFactory.hectorPayLogic()).equal(
        hectorPayLogic.address
      );
    });
    it('upgradeable admin', async function () {
      expect(await hectorPayFactory.upgradeableAdmin()).equal(deployer.address);
    });
    it('pay contract', async function () {
      expect(await hectorPayFactory.getHectorPayContractCount()).equal(
        BigNumber.from(1)
      );
      expect(await hectorPayFactory.getHectorPayContractByIndex(0)).equal(
        hectorPay.address
      );
      expect(
        await hectorPayFactory.getHectorPayContractByToken(hectorToken.address)
      ).equal(hectorPay.address);
    });
    it('is deplyed', async function () {
      expect(
        await hectorPayFactory.isDeployedHectorPayContractByToken(
          hectorToken.address
        )
      ).equal(true);

      const RewardToken = await ethers.getContractFactory('RewardToken');
      const rewardToken = (await RewardToken.deploy()) as RewardToken;
      expect(
        await hectorPayFactory.isDeployedHectorPayContractByToken(
          rewardToken.address
        )
      ).equal(false);
    });
  });

  describe('#pay - create & deposit', () => {
    const aliceAmountPerSec = ethers.utils.parseEther('0.001'); // 20 decimals
    let aliceStarts = 0;
    let aliceEnds = 0;
    const bobAmountPerSec = ethers.utils.parseEther('0.01'); // 20 decimals
    let bobStarts = 0;
    let bobEnds = 0;
    const depositAmount = ethers.utils.parseEther('200000');
    const depositAmountInDecimals = ethers.utils.parseEther('20000000'); // 20 decimals

    beforeEach(async function () {
      aliceStarts = (await getTimeStamp()) - 10;
      aliceEnds = aliceStarts + 1000;
      bobStarts = (await getTimeStamp()) + 10;
      bobEnds = bobStarts + 1000;
    });

    it('create stream', async function () {
      const aliceStreamId = await hectorPay
        .connect(owner)
        .getStreamId(
          owner.address,
          alice.address,
          aliceAmountPerSec,
          aliceStarts,
          aliceEnds
        );

      const tx = await hectorPay
        .connect(owner)
        .createStream(alice.address, aliceAmountPerSec, aliceStarts, aliceEnds);
      await expect(tx)
        .to.emit(hectorPay, 'StreamCreated')
        .withArgs(
          owner.address,
          alice.address,
          aliceAmountPerSec,
          aliceStarts,
          aliceEnds,
          aliceStreamId
        );

      const stream = await hectorPay.connect(owner).streams(aliceStreamId);
      expect(stream.from).equal(owner.address);
      expect(stream.to).equal(alice.address);
      expect(stream.amountPerSec).equal(aliceAmountPerSec);
      expect(stream.starts).equal(aliceStarts);
      expect(stream.ends).equal(aliceEnds);
    });

    it('create stream again', async function () {
      await hectorPay
        .connect(owner)
        .createStream(alice.address, aliceAmountPerSec, aliceStarts, aliceEnds);
      await hectorPay.connect(owner).deposit(depositAmount);

      await expect(
        hectorPay
          .connect(owner)
          .createStream(
            alice.address,
            aliceAmountPerSec,
            aliceStarts,
            aliceEnds
          )
      ).to.be.revertedWith('ACTIVE_STREAM()');
    });

    it('create stream with reason', async function () {
      const aliceStreamId = await hectorPay
        .connect(owner)
        .getStreamId(
          owner.address,
          alice.address,
          aliceAmountPerSec,
          aliceStarts,
          aliceEnds
        );

      const tx = await hectorPay
        .connect(owner)
        .createStreamWithReason(
          alice.address,
          aliceAmountPerSec,
          aliceStarts,
          aliceEnds,
          'Pay to Alice'
        );
      await expect(tx)
        .to.emit(hectorPay, 'StreamCreatedWithReason')
        .withArgs(
          owner.address,
          alice.address,
          aliceAmountPerSec,
          aliceStarts,
          aliceEnds,
          aliceStreamId,
          'Pay to Alice'
        );

      const stream = await hectorPay.connect(owner).streams(aliceStreamId);
      expect(stream.from).equal(owner.address);
      expect(stream.to).equal(alice.address);
      expect(stream.amountPerSec).equal(aliceAmountPerSec);
      expect(stream.starts).equal(aliceStarts);
      expect(stream.ends).equal(aliceEnds);
    });

    it('deposit', async function () {
      const tx = await hectorPay.connect(owner).deposit(depositAmount);
      await expect(tx)
        .to.emit(hectorPay, 'PayerDeposit')
        .withArgs(owner.address, depositAmount);

      expect(
        (await hectorPay.connect(owner).payers(owner.address)).balance
      ).equal(depositAmountInDecimals);
      expect(await hectorToken.balanceOf(hectorPay.address)).equal(
        depositAmount
      );
    });

    it('deposit and create stream', async function () {
      const bobStreamId = await hectorPay
        .connect(owner)
        .getStreamId(
          owner.address,
          bob.address,
          bobAmountPerSec,
          bobStarts,
          bobEnds
        );

      const tx = await hectorPay
        .connect(owner)
        .depositAndCreate(
          depositAmount,
          bob.address,
          bobAmountPerSec,
          bobStarts,
          bobEnds
        );
      await expect(tx)
        .to.emit(hectorPay, 'PayerDeposit')
        .withArgs(owner.address, depositAmount);
      await expect(tx)
        .to.emit(hectorPay, 'StreamCreated')
        .withArgs(
          owner.address,
          bob.address,
          bobAmountPerSec,
          bobStarts,
          bobEnds,
          bobStreamId
        );

      expect(
        (await hectorPay.connect(owner).payers(owner.address)).balance
      ).equal(depositAmountInDecimals);
      expect(await hectorToken.balanceOf(hectorPay.address)).equal(
        depositAmount
      );

      const stream = await hectorPay.connect(owner).streams(bobStreamId);
      expect(stream.from).equal(owner.address);
      expect(stream.to).equal(bob.address);
      expect(stream.amountPerSec).equal(bobAmountPerSec);
      expect(stream.starts).equal(bobStarts);
      expect(stream.ends).equal(bobEnds);
    });

    it('deposit and create stream with reason', async function () {
      const bobStreamId = await hectorPay
        .connect(owner)
        .getStreamId(
          owner.address,
          bob.address,
          bobAmountPerSec,
          bobStarts,
          bobEnds
        );

      const tx = await hectorPay
        .connect(owner)
        .depositAndCreateWithReason(
          depositAmount,
          bob.address,
          bobAmountPerSec,
          bobStarts,
          bobEnds,
          'Pay to Bob'
        );
      await expect(tx)
        .to.emit(hectorPay, 'PayerDeposit')
        .withArgs(owner.address, depositAmount);
      await expect(tx)
        .to.emit(hectorPay, 'StreamCreatedWithReason')
        .withArgs(
          owner.address,
          bob.address,
          bobAmountPerSec,
          bobStarts,
          bobEnds,
          bobStreamId,
          'Pay to Bob'
        );

      expect(
        (await hectorPay.connect(owner).payers(owner.address)).balance
      ).equal(depositAmountInDecimals);
      expect(await hectorToken.balanceOf(hectorPay.address)).equal(
        depositAmount
      );

      const stream = await hectorPay.connect(owner).streams(bobStreamId);
      expect(stream.from).equal(owner.address);
      expect(stream.to).equal(bob.address);
      expect(stream.amountPerSec).equal(bobAmountPerSec);
      expect(stream.starts).equal(bobStarts);
      expect(stream.ends).equal(bobEnds);
    });
  });

  describe('#pay - withdraw', () => {
    const aliceAmountPerSec = ethers.utils.parseEther('0.001'); // 20 decimals
    let aliceStarts = 0;
    let aliceEnds = 0;
    const bobAmountPerSec = ethers.utils.parseEther('0.01'); // 20 decimals
    let bobStarts = 0;
    let bobEnds = 0;
    const depositAmount = ethers.utils.parseEther('200000');

    beforeEach(async function () {
      aliceStarts = (await getTimeStamp()) - 10;
      aliceEnds = aliceStarts + 1000;
      bobStarts = (await getTimeStamp()) + 10;
      bobEnds = bobStarts + 1000;

      await hectorPay
        .connect(owner)
        .depositAndCreate(
          depositAmount,
          alice.address,
          aliceAmountPerSec,
          aliceStarts,
          aliceEnds
        );

      await hectorPay
        .connect(owner)
        .depositAndCreate(
          depositAmount,
          bob.address,
          bobAmountPerSec,
          bobStarts,
          bobEnds
        );
    });

    it('withdrawable for alice', async function () {
      await increaseTime(100);

      const result = await hectorPay
        .connect(owner)
        .withdrawable(
          owner.address,
          alice.address,
          aliceAmountPerSec,
          aliceStarts,
          aliceEnds
        );
      const period = 100 + 10 + 2;
      expect(result.withdrawableAmount).gte(
        aliceAmountPerSec.mul(period).div(100)
      );
    });

    it('withdrawable for bob', async function () {
      await increaseTime(100);

      const result = await hectorPay
        .connect(owner)
        .withdrawable(
          owner.address,
          bob.address,
          bobAmountPerSec,
          bobStarts,
          bobEnds
        );
      const period = 100 - 10 + 2;
      expect(result.withdrawableAmount).gte(
        bobAmountPerSec.mul(period).div(100)
      );
    });

    it('withdraw for alice', async function () {
      await increaseTime(100);
      await hectorPay
        .connect(alice)
        .withdraw(
          owner.address,
          alice.address,
          aliceAmountPerSec,
          aliceStarts,
          aliceEnds
        );

      const period = 100 + 10 + 3;
      expect(await hectorToken.balanceOf(alice.address)).gte(
        aliceAmountPerSec.mul(period).div(100)
      );
    });

    it('withdraw for bob', async function () {
      await increaseTime(100);
      await hectorPay
        .connect(bob)
        .withdraw(
          owner.address,
          bob.address,
          bobAmountPerSec,
          bobStarts,
          bobEnds
        );

      const period = 100 - 10 + 3;
      expect(await hectorToken.balanceOf(bob.address)).gte(
        bobAmountPerSec.mul(period).div(100)
      );
    });
  });

  describe('#pay - withdraw payer', () => {
    const aliceAmountPerSec = ethers.utils.parseEther('0.001'); // 20 decimals
    let aliceStarts = 0;
    let aliceEnds = 0;
    const bobAmountPerSec = ethers.utils.parseEther('0.01'); // 20 decimals
    let bobStarts = 0;
    let bobEnds = 0;
    const depositAmount = ethers.utils.parseEther('200000');

    beforeEach(async function () {
      aliceStarts = (await getTimeStamp()) - 10;
      aliceEnds = aliceStarts + 1000;
      bobStarts = (await getTimeStamp()) + 10;
      bobEnds = bobStarts + 1000;

      await hectorPay.connect(owner).deposit(depositAmount);

      await hectorPay
        .connect(owner)
        .createStream(alice.address, aliceAmountPerSec, aliceStarts, aliceEnds);

      await hectorPay
        .connect(owner)
        .createStream(bob.address, bobAmountPerSec, bobStarts, bobEnds);
    });

    it('withdraw payer', async function () {
      await increaseTime(100);

      const amount = ethers.utils.parseEther('100000');
      await hectorPay.connect(owner).withdrawPayer(amount);

      const result = await hectorPay.connect(owner).payers(owner.address);
      const alicePeriod = 100 + 4;
      const bobPeriod = 100 + 2;
      expect(result.balance).lte(
        depositAmount
          .sub(amount)
          .mul(100)
          .sub(aliceAmountPerSec.mul(alicePeriod))
          .sub(bobAmountPerSec.mul(bobPeriod))
      );
    });

    it('withdraw payer all', async function () {
      await increaseTime(100);

      await hectorPay.connect(owner).withdrawPayerAll();

      const result = await hectorPay.connect(owner).payers(owner.address);
      expect(result.balance).equal(0);
    });
  });

  describe('#pay - cancel stream', () => {
    const aliceAmountPerSec = ethers.utils.parseEther('0.001'); // 20 decimals
    let aliceStarts = 0;
    let aliceEnds = 0;
    const bobAmountPerSec = ethers.utils.parseEther('0.01'); // 20 decimals
    let bobStarts = 0;
    let bobEnds = 0;
    const depositAmount = ethers.utils.parseEther('200000');

    beforeEach(async function () {
      aliceStarts = (await getTimeStamp()) - 10;
      aliceEnds = aliceStarts + 1000;
      bobStarts = (await getTimeStamp()) + 10;
      bobEnds = bobStarts + 1000;

      await hectorPay.connect(owner).deposit(depositAmount);

      await hectorPay
        .connect(owner)
        .createStream(alice.address, aliceAmountPerSec, aliceStarts, aliceEnds);

      await hectorPay
        .connect(owner)
        .createStream(bob.address, bobAmountPerSec, bobStarts, bobEnds);
    });

    it('cancel alice stream', async function () {
      increaseTime(100);

      await hectorPay
        .connect(owner)
        .cancelStream(alice.address, aliceAmountPerSec, aliceStarts, aliceEnds);

      const period = 100 + 10 + 3;
      expect(await hectorToken.balanceOf(alice.address)).gte(
        aliceAmountPerSec.mul(period).div(100)
      );

      const streamId = await hectorPay
        .connect(owner)
        .getStreamId(
          owner.address,
          alice.address,
          aliceAmountPerSec,
          aliceStarts,
          aliceEnds
        );
      const stream = await hectorPay.connect(owner).streams(streamId);
      expect(stream.lastPaid).equal(0);
      const payer = await hectorPay.connect(owner).payers(owner.address);
      expect(payer.totalPaidPerSec).equal(bobAmountPerSec);
    });

    it('cancel bob stream', async function () {
      increaseTime(100);

      await hectorPay
        .connect(owner)
        .cancelStream(bob.address, bobAmountPerSec, bobStarts, bobEnds);

      const period = 100 - 10 + 3;
      expect(await hectorToken.balanceOf(bob.address)).gte(
        bobAmountPerSec.mul(period).div(100)
      );

      const streamId = await hectorPay
        .connect(owner)
        .getStreamId(
          owner.address,
          bob.address,
          bobAmountPerSec,
          bobStarts,
          bobEnds
        );
      const stream = await hectorPay.connect(owner).streams(streamId);
      expect(stream.lastPaid).equal(0);
      const payer = await hectorPay.connect(owner).payers(owner.address);
      expect(payer.totalPaidPerSec).equal(aliceAmountPerSec);
    });

    it('cancel again', async function () {
      increaseTime(100);

      await hectorPay
        .connect(owner)
        .cancelStream(alice.address, aliceAmountPerSec, aliceStarts, aliceEnds);

      await expect(
        hectorPay
          .connect(owner)
          .cancelStream(
            alice.address,
            aliceAmountPerSec,
            aliceStarts,
            aliceEnds
          )
      ).to.be.revertedWith('INACTIVE_STREAM()');
    });

    it('cancel paused stream', async function () {
      increaseTime(100);

      await hectorPay
        .connect(owner)
        .pauseStream(alice.address, aliceAmountPerSec, aliceStarts, aliceEnds);

      await hectorPay
        .connect(owner)
        .batch(
          [
            hectorPay.interface.encodeFunctionData('resumeStream', [
              alice.address,
              aliceAmountPerSec,
              aliceStarts,
              aliceEnds,
            ]),
            hectorPay.interface.encodeFunctionData('cancelStream', [
              alice.address,
              aliceAmountPerSec,
              aliceStarts,
              aliceEnds,
            ]),
          ],
          true
        );
    });
  });

  describe('#pay - modify stream', () => {
    const aliceAmountPerSec = ethers.utils.parseEther('0.001'); // 20 decimals
    const aliceNewAmountPerSec = ethers.utils.parseEther('0.002'); // 20 decimals
    let aliceStarts = 0;
    let aliceEnds = 0;
    let aliceNewEnds = 0;
    const bobAmountPerSec = ethers.utils.parseEther('0.01'); // 20 decimals
    const bobNewAmountPerSec = ethers.utils.parseEther('0.02'); // 20 decimals
    let bobStarts = 0;
    let bobEnds = 0;
    let bobNewEnds = 0;
    const depositAmount = ethers.utils.parseEther('200000');

    beforeEach(async function () {
      aliceStarts = (await getTimeStamp()) - 10;
      aliceEnds = aliceStarts + 1000;
      aliceNewEnds = aliceEnds + 1000;
      bobStarts = (await getTimeStamp()) + 10;
      bobEnds = bobStarts + 1000;
      bobNewEnds = bobEnds + 1000;

      await hectorPay.connect(owner).deposit(depositAmount);

      await hectorPay
        .connect(owner)
        .createStream(alice.address, aliceAmountPerSec, aliceStarts, aliceEnds);

      await hectorPay
        .connect(owner)
        .createStream(bob.address, bobAmountPerSec, bobStarts, bobEnds);
    });

    it('modify alice stream', async function () {
      increaseTime(100);

      await hectorPay
        .connect(owner)
        .modifyStream(
          alice.address,
          aliceAmountPerSec,
          aliceStarts,
          aliceEnds,
          alice.address,
          aliceNewAmountPerSec,
          aliceNewEnds
        );

      const period = 100 + 10 + 3;
      expect(await hectorToken.balanceOf(alice.address)).gte(
        aliceAmountPerSec.mul(period).div(100)
      );

      const streamId = await hectorPay
        .connect(owner)
        .getStreamId(
          owner.address,
          alice.address,
          aliceAmountPerSec,
          aliceStarts,
          aliceEnds
        );
      const stream = await hectorPay.connect(owner).streams(streamId);
      expect(stream.lastPaid).equal(0);
      const newStreamId = await hectorPay
        .connect(owner)
        .getStreamId(
          owner.address,
          alice.address,
          aliceNewAmountPerSec,
          aliceStarts,
          aliceNewEnds
        );
      const newStream = await hectorPay.connect(owner).streams(newStreamId);
      expect(newStream.to).equal(alice.address);
      expect(newStream.amountPerSec).equal(aliceNewAmountPerSec);
      expect(newStream.starts).equal(aliceStarts);
      expect(newStream.ends).equal(aliceNewEnds);
      const payer = await hectorPay.connect(owner).payers(owner.address);
      expect(payer.totalPaidPerSec).equal(
        aliceNewAmountPerSec.add(bobAmountPerSec)
      );
    });

    it('modify bob stream', async function () {
      increaseTime(100);

      await hectorPay
        .connect(owner)
        .modifyStream(
          bob.address,
          bobAmountPerSec,
          bobStarts,
          bobEnds,
          bob.address,
          bobNewAmountPerSec,
          bobNewEnds
        );

      const period = 100 - 10 + 3;
      expect(await hectorToken.balanceOf(bob.address)).gte(
        bobAmountPerSec.mul(period).div(100)
      );

      const streamId = await hectorPay
        .connect(owner)
        .getStreamId(
          owner.address,
          bob.address,
          bobAmountPerSec,
          bobStarts,
          bobEnds
        );
      const stream = await hectorPay.connect(owner).streams(streamId);
      expect(stream.lastPaid).equal(0);
      const newStreamId = await hectorPay
        .connect(owner)
        .getStreamId(
          owner.address,
          bob.address,
          bobNewAmountPerSec,
          bobStarts,
          bobNewEnds
        );
      const newStream = await hectorPay.connect(owner).streams(newStreamId);
      expect(newStream.to).equal(bob.address);
      expect(newStream.amountPerSec).equal(bobNewAmountPerSec);
      expect(newStream.starts).equal(bobStarts);
      expect(newStream.ends).equal(bobNewEnds);
      const payer = await hectorPay.connect(owner).payers(owner.address);
      expect(payer.totalPaidPerSec).equal(
        bobNewAmountPerSec.add(aliceAmountPerSec)
      );
    });
  });

  describe('#pay - pause stream', () => {
    const aliceAmountPerSec = ethers.utils.parseEther('0.001'); // 20 decimals
    let aliceStarts = 0;
    let aliceEnds = 0;
    const bobAmountPerSec = ethers.utils.parseEther('0.01'); // 20 decimals
    let bobStarts = 0;
    let bobEnds = 0;
    const depositAmount = ethers.utils.parseEther('200000');

    beforeEach(async function () {
      aliceStarts = (await getTimeStamp()) - 10;
      aliceEnds = aliceStarts + 1000;
      bobStarts = (await getTimeStamp()) + 10;
      bobEnds = bobStarts + 1000;

      await hectorPay.connect(owner).deposit(depositAmount);

      await hectorPay
        .connect(owner)
        .createStream(alice.address, aliceAmountPerSec, aliceStarts, aliceEnds);

      await hectorPay
        .connect(owner)
        .createStream(bob.address, bobAmountPerSec, bobStarts, bobEnds);
    });

    it('pause alice stream', async function () {
      increaseTime(100);

      await hectorPay
        .connect(owner)
        .pauseStream(alice.address, aliceAmountPerSec, aliceStarts, aliceEnds);

      const period = 100 + 10 + 3;
      expect(await hectorToken.balanceOf(alice.address)).gte(
        aliceAmountPerSec.mul(period).div(100)
      );

      const streamId = await hectorPay
        .connect(owner)
        .getStreamId(
          owner.address,
          alice.address,
          aliceAmountPerSec,
          aliceStarts,
          aliceEnds
        );
      const stream = await hectorPay.connect(owner).streams(streamId);
      expect(stream.lastPaid).equal(0);
      const payer = await hectorPay.connect(owner).payers(owner.address);
      expect(payer.totalPaidPerSec).equal(bobAmountPerSec);
    });

    it('pause bob stream', async function () {
      increaseTime(100);

      await hectorPay
        .connect(owner)
        .pauseStream(bob.address, bobAmountPerSec, bobStarts, bobEnds);

      const period = 100 - 10 + 3;
      expect(await hectorToken.balanceOf(bob.address)).gte(
        bobAmountPerSec.mul(period).div(100)
      );

      const streamId = await hectorPay
        .connect(owner)
        .getStreamId(
          owner.address,
          bob.address,
          bobAmountPerSec,
          bobStarts,
          bobEnds
        );
      const stream = await hectorPay.connect(owner).streams(streamId);
      expect(stream.lastPaid).equal(0);
      const payer = await hectorPay.connect(owner).payers(owner.address);
      expect(payer.totalPaidPerSec).equal(aliceAmountPerSec);
    });
  });

  describe('#pay - resume stream', () => {
    const aliceAmountPerSec = ethers.utils.parseEther('0.001'); // 20 decimals
    let aliceStarts = 0;
    let aliceEnds = 0;
    const bobAmountPerSec = ethers.utils.parseEther('0.01'); // 20 decimals
    let bobStarts = 0;
    let bobEnds = 0;
    const depositAmount = ethers.utils.parseEther('200000');

    beforeEach(async function () {
      aliceStarts = (await getTimeStamp()) - 10;
      aliceEnds = aliceStarts + 1000;
      bobStarts = (await getTimeStamp()) + 10;
      bobEnds = bobStarts + 1000;

      await hectorPay.connect(owner).deposit(depositAmount);

      await hectorPay
        .connect(owner)
        .createStream(alice.address, aliceAmountPerSec, aliceStarts, aliceEnds);

      await hectorPay
        .connect(owner)
        .createStream(bob.address, bobAmountPerSec, bobStarts, bobEnds);

      await increaseTime(100);

      await hectorPay
        .connect(owner)
        .pauseStream(alice.address, aliceAmountPerSec, aliceStarts, aliceEnds);

      await hectorPay
        .connect(owner)
        .pauseStream(bob.address, bobAmountPerSec, bobStarts, bobEnds);
    });

    it('resume alice stream', async function () {
      await hectorPay
        .connect(owner)
        .resumeStream(alice.address, aliceAmountPerSec, aliceStarts, aliceEnds);

      await increaseTime(100);

      const result = await hectorPay
        .connect(owner)
        .withdrawable(
          owner.address,
          alice.address,
          aliceAmountPerSec,
          aliceStarts,
          aliceEnds
        );
      const period = 100;
      expect(result.withdrawableAmount).gte(
        aliceAmountPerSec.mul(period).div(100)
      );
    });

    it('resume bob stream', async function () {
      await hectorPay
        .connect(owner)
        .resumeStream(bob.address, bobAmountPerSec, bobStarts, bobEnds);

      await increaseTime(100);

      const result = await hectorPay
        .connect(owner)
        .withdrawable(
          owner.address,
          bob.address,
          bobAmountPerSec,
          bobStarts,
          bobEnds
        );
      const period = 100;
      expect(result.withdrawableAmount).gte(
        bobAmountPerSec.mul(period).div(100)
      );
    });
  });

  describe('#pay - is sufficient fund', () => {
    const aliceAmountPerSec = ethers.utils.parseEther('0.001'); // 20 decimals
    let aliceStarts = 0;
    let aliceEnds = 0;
    const bobAmountPerSec = ethers.utils.parseEther('0.01'); // 20 decimals
    let bobStarts = 0;
    let bobEnds = 0;

    beforeEach(async function () {
      aliceStarts = (await getTimeStamp()) - 10;
      aliceEnds = aliceStarts + 1000;
      bobStarts = (await getTimeStamp()) + 10;
      bobEnds = bobStarts + 1000;

      await hectorPay
        .connect(owner)
        .batch(
          [
            hectorPay.interface.encodeFunctionData('createStream', [
              alice.address,
              aliceAmountPerSec,
              aliceStarts,
              aliceEnds,
            ]),
            hectorPay.interface.encodeFunctionData('createStream', [
              bob.address,
              bobAmountPerSec,
              bobStarts,
              bobEnds,
            ]),
          ],
          true
        );
    });

    it('invalid time', async function () {
      await expect(
        hectorPay
          .connect(owner)
          .isSufficientFund(
            owner.address,
            [alice.address, bob.address],
            [aliceAmountPerSec, bobAmountPerSec],
            [aliceStarts, bobStarts],
            [aliceEnds, bobEnds],
            aliceStarts
          )
      ).to.be.revertedWith('INVALID_TIME()');
    });

    it('before bob starts', async function () {
      await increaseTime(5);

      const timestamp0 = (await getTimeStamp()) + 1;
      const result0 = await hectorPay
        .connect(owner)
        .isSufficientFund(
          owner.address,
          [alice.address, bob.address],
          [aliceAmountPerSec, bobAmountPerSec],
          [aliceStarts, bobStarts],
          [aliceEnds, bobEnds],
          timestamp0
        );

      expect(result0.isSufficient).equal(false);

      const alicePeriod = timestamp0 - aliceStarts;
      const bobPeriod = 0;
      expect(result0.chargeAmount).equal(
        aliceAmountPerSec.mul(alicePeriod).add(bobAmountPerSec.mul(bobPeriod))
      );
    });

    it('after bob starts', async function () {
      await increaseTime(100);

      const timestamp0 = (await getTimeStamp()) + 1;
      const result0 = await hectorPay
        .connect(owner)
        .isSufficientFund(
          owner.address,
          [alice.address, bob.address],
          [aliceAmountPerSec, bobAmountPerSec],
          [aliceStarts, bobStarts],
          [aliceEnds, bobEnds],
          timestamp0
        );

      expect(result0.isSufficient).equal(false);

      const alicePeriod = timestamp0 - aliceStarts;
      const bobPeriod = timestamp0 - bobStarts;
      expect(result0.chargeAmount).equal(
        aliceAmountPerSec.mul(alicePeriod).add(bobAmountPerSec.mul(bobPeriod))
      );
    });

    it('after alice ends', async function () {
      await increaseTime(1000);

      const timestamp0 = (await getTimeStamp()) + 1;
      const result0 = await hectorPay
        .connect(owner)
        .isSufficientFund(
          owner.address,
          [alice.address, bob.address],
          [aliceAmountPerSec, bobAmountPerSec],
          [aliceStarts, bobStarts],
          [aliceEnds, bobEnds],
          timestamp0
        );

      expect(result0.isSufficient).equal(false);

      const alicePeriod = 1000;
      const bobPeriod = timestamp0 - bobStarts;
      expect(result0.chargeAmount).equal(
        aliceAmountPerSec.mul(alicePeriod).add(bobAmountPerSec.mul(bobPeriod))
      );
    });

    it('after bob ends', async function () {
      await increaseTime(1010);

      const timestamp0 = (await getTimeStamp()) + 1;
      const result0 = await hectorPay
        .connect(owner)
        .isSufficientFund(
          owner.address,
          [alice.address, bob.address],
          [aliceAmountPerSec, bobAmountPerSec],
          [aliceStarts, bobStarts],
          [aliceEnds, bobEnds],
          timestamp0
        );

      expect(result0.isSufficient).equal(false);

      const alicePeriod = 1000;
      const bobPeriod = 1000;
      expect(result0.chargeAmount).equal(
        aliceAmountPerSec.mul(alicePeriod).add(bobAmountPerSec.mul(bobPeriod))
      );
    });
  });
});
