import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { constants, utils } from 'ethers';
import { HectorToken } from './../types/contracts/HEC.sol/HectorToken';
import { MockPrinciple } from './../types/contracts/mock/MockPrinciple';
import { MockOracle } from './../types/contracts/mock/MockOracle';
import { HectorBondNoTreasuryBNBDepository } from './../types/contracts/HectorBondNoTreasuryBNBDepository.sol/HectorBondNoTreasuryBNBDepository';
import { increaseTime } from './../helper/helpers';

describe('Bond with no treasury', function () {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;

  let hectorToken: HectorToken;
  let principle: MockPrinciple;
  let oracle: MockOracle;
  let hectorBondNoTreasuryDepository: HectorBondNoTreasuryBNBDepository;

  const controlVariable = 2;
  const vestingTerm = 5;
  const minimumPrice = 1500000000;
  const maxPayout = 500;
  const fee = 500;
  const maxDebt = utils.parseUnits('200000', 9);
  const totalSupply = utils.parseEther('5000');
  const initialDebt = utils.parseUnits('100', 9);

  const payout0 = 70175438; // payout for 5 days lock
  const payout1 = 78431372; // payout for 6 months lock

  beforeEach(async function () {
    [owner, alice, bob, carol] = await ethers.getSigners();

    const HectorToken = await ethers.getContractFactory('HectorToken');
    hectorToken = (await HectorToken.deploy()) as HectorToken;

    const Principle = await ethers.getContractFactory('MockPrinciple');
    principle = (await Principle.deploy()) as MockPrinciple;
    await principle.connect(alice).mint(utils.parseEther('20000'));
    await principle.connect(bob).mint(utils.parseEther('20000'));
    await principle.connect(carol).mint(utils.parseEther('20000'));

    const Oracle = await ethers.getContractFactory('MockOracle');
    oracle = (await Oracle.deploy()) as MockOracle;

    const HectorBondNoTreasuryDepository = await ethers.getContractFactory(
      'HectorBondNoTreasuryBNBDepository'
    );
    hectorBondNoTreasuryDepository =
      (await HectorBondNoTreasuryDepository.deploy(
        'TestBond',
        hectorToken.address,
        principle.address,
        owner.address,
        oracle.address
      )) as HectorBondNoTreasuryBNBDepository;

    await hectorBondNoTreasuryDepository.initializeBondTerms(
      controlVariable,
      vestingTerm,
      minimumPrice,
      maxPayout,
      fee,
      maxDebt,
      totalSupply,
      initialDebt
    );
    await hectorBondNoTreasuryDepository.setLockingDiscount(5 * 24 * 3600, 500); // 5 days lock - 5%
    await hectorBondNoTreasuryDepository.setLockingDiscount(
      5 * 7 * 24 * 3600,
      1000
    ); // 7 weeks lock - 10%
    await hectorBondNoTreasuryDepository.setLockingDiscount(
      5 * 30 * 24 * 3600,
      1500
    ); // 5 months lock - 15%

    await hectorToken.mint(hectorBondNoTreasuryDepository.address, totalSupply);
    await principle
      .connect(alice)
      .approve(hectorBondNoTreasuryDepository.address, constants.MaxUint256);
    await principle
      .connect(bob)
      .approve(hectorBondNoTreasuryDepository.address, constants.MaxUint256);
    await principle
      .connect(carol)
      .approve(hectorBondNoTreasuryDepository.address, constants.MaxUint256);
  });

  describe('#setBondTerms', () => {
    const totalSupply = utils.parseEther('15000');

    it('totalSupply', async function () {
      await hectorBondNoTreasuryDepository.setBondTerms(5, totalSupply);

      expect((await hectorBondNoTreasuryDepository.terms()).totalSupply).equal(
        totalSupply
      );
    });
  });

  describe('#setLockingDiscount', () => {
    it('add new discount', async function () {
      await hectorBondNoTreasuryDepository.setLockingDiscount(100, 10); // 100 seconds lock - 0.1%

      expect(await hectorBondNoTreasuryDepository.lockingDiscounts(100)).equal(
        10
      );
    });

    it('update existing discount', async function () {
      expect(
        await hectorBondNoTreasuryDepository.lockingDiscounts(5 * 7 * 24 * 3600)
      ).equal(1000);

      await hectorBondNoTreasuryDepository.setLockingDiscount(
        5 * 7 * 24 * 3600,
        2000
      ); // 5 days lock - 20%

      expect(
        await hectorBondNoTreasuryDepository.lockingDiscounts(5 * 7 * 24 * 3600)
      ).equal(2000);
    });
  });

  describe('#deposit', () => {
    const amount = utils.parseEther('10000');
    const maxPrice = 30000000000;
    const lockingPeriod = 5 * 24 * 3600; // 5 days lock
    const maxLockingPeriod = 5 * 30 * 24 * 3600; // 5 months lock

    it('invalid user locking period', async function () {
      let lockingPeriod = 24 * 3600; // 1 day lock

      await expect(
        hectorBondNoTreasuryDepository
          .connect(alice)
          .deposit(amount, maxPrice, lockingPeriod)
      ).to.be.revertedWith('Invalid locking period');
    });

    it('payout with locking period', async function () {
      const tx = await hectorBondNoTreasuryDepository
        .connect(alice)
        .deposit(amount, maxPrice, lockingPeriod);
      const reciept = await tx.wait();

      const info = await hectorBondNoTreasuryDepository.bondInfo(1);
      expect(info.payout).equal(payout0);
      expect(info.lastBlockAt).equal(
        (await ethers.provider.getBlock(reciept.blockNumber)).timestamp
      );

      expect(await hectorBondNoTreasuryDepository.totalRemainingPayout()).equal(
        payout0
      );
    });

    it('payout with locking period - two times', async function () {
      await hectorBondNoTreasuryDepository
        .connect(alice)
        .deposit(amount, maxPrice, lockingPeriod);

      const tx = await hectorBondNoTreasuryDepository
        .connect(alice)
        .deposit(amount, maxPrice, lockingPeriod);
      const reciept = await tx.wait();

      const info = await hectorBondNoTreasuryDepository.bondInfo(2);
      expect(info.payout).equal(payout0);
      expect(info.lastBlockAt).equal(
        (await ethers.provider.getBlock(reciept.blockNumber)).timestamp
      );

      expect(await hectorBondNoTreasuryDepository.totalRemainingPayout()).equal(
        payout0 + payout0
      );
    });

    it('payout with max locking period', async function () {
      const tx = await hectorBondNoTreasuryDepository
        .connect(bob)
        .deposit(amount, maxPrice, maxLockingPeriod);
      const reciept = await tx.wait();

      const info = await hectorBondNoTreasuryDepository.bondInfo(1);
      expect(info.payout).equal(payout1);
      expect(info.lastBlockAt).equal(
        (await ethers.provider.getBlock(reciept.blockNumber)).timestamp
      );

      expect(await hectorBondNoTreasuryDepository.totalRemainingPayout()).equal(
        payout1
      );
    });

    it('totalReaminingPayout', async function () {
      await hectorBondNoTreasuryDepository
        .connect(alice)
        .deposit(amount, maxPrice, lockingPeriod);
      expect(await hectorBondNoTreasuryDepository.totalRemainingPayout()).equal(
        payout0
      );

      await hectorBondNoTreasuryDepository
        .connect(bob)
        .deposit(amount, maxPrice, maxLockingPeriod);

      expect(await hectorBondNoTreasuryDepository.totalRemainingPayout()).equal(
        payout0 + payout1
      );
    });
  });

  describe('#redeem', () => {
    const amount = utils.parseEther('10000');
    const maxPrice = 30000000000;
    const lockingPeriod = 5 * 24 * 3600; // 5 days lock
    const maxLockingPeriod = 5 * 30 * 24 * 3600; // 5 months lock

    beforeEach(async function () {
      await hectorBondNoTreasuryDepository
        .connect(alice)
        .deposit(amount, maxPrice, lockingPeriod);
      await hectorBondNoTreasuryDepository
        .connect(alice)
        .deposit(amount, maxPrice, lockingPeriod);
      await hectorBondNoTreasuryDepository
        .connect(bob)
        .deposit(amount, maxPrice, maxLockingPeriod);
    });

    it('redeem others bond', async function () {
      await expect(
        hectorBondNoTreasuryDepository.connect(alice).redeem(3)
      ).to.be.revertedWith('Cant redeem others bond');
      await expect(
        hectorBondNoTreasuryDepository.connect(bob).redeem(2)
      ).to.be.revertedWith('Cant redeem others bond');
      await expect(
        hectorBondNoTreasuryDepository.connect(bob).redeem(1)
      ).to.be.revertedWith('Cant redeem others bond');
    });

    it('after 5 days for alice', async function () {
      await increaseTime(lockingPeriod);

      await hectorBondNoTreasuryDepository.connect(alice).redeem(1);
      expect(await hectorToken.balanceOf(alice.address)).equal(payout0);

      const info0 = await hectorBondNoTreasuryDepository.bondInfo(1);
      expect(info0.payout).equal(0);

      expect(await hectorBondNoTreasuryDepository.totalRemainingPayout()).equal(
        payout0 + payout1
      );

      await hectorBondNoTreasuryDepository.connect(alice).redeem(2);
      expect(await hectorToken.balanceOf(alice.address)).equal(
        payout0 + payout0
      );

      const info1 = await hectorBondNoTreasuryDepository.bondInfo(2);
      expect(info1.payout).equal(0);

      expect(await hectorBondNoTreasuryDepository.totalRemainingPayout()).equal(
        payout1
      );
    });

    it('after 5 days for bob', async function () {
      await increaseTime(lockingPeriod);

      await expect(
        hectorBondNoTreasuryDepository.connect(bob).redeem(3)
      ).to.be.revertedWith('Not fully vested');
    });

    it('after 5 months for bob', async function () {
      await increaseTime(maxLockingPeriod);

      await hectorBondNoTreasuryDepository.connect(bob).redeem(3);
      expect(await hectorToken.balanceOf(bob.address)).equal(payout1);

      const info = await hectorBondNoTreasuryDepository.bondInfo(bob.address);
      expect(info.payout).equal(0);
    });
  });
});
