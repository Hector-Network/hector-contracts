import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { constants, utils } from 'ethers';
import { HectorToken } from './../types/contracts/HEC.sol/HectorToken';
import { MockPrinciple } from './../types/contracts/mock/MockPrinciple';
import { HectorBondNoTreasuryDepository } from './../types/contracts/HectorBondNoTreasuryDepository.sol/HectorBondNoTreasuryDepository';
import { increaseTime } from './../helper/helpers';

describe('Bond with no treasury', function () {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;

  let hectorToken: HectorToken;
  let principle: MockPrinciple;
  let hectorBondNoTreasuryDepository: HectorBondNoTreasuryDepository;

  const controlVariable = 2;
  const vestingTerm = 5;
  const minimumPrice = 1500;
  const maxPayout = 500;
  const fee = 500;
  const maxDebt = utils.parseUnits('2000', 9);
  const totalSupply = utils.parseEther('5000');
  const initialDebt = utils.parseUnits('100', 9);

  const payout0 = 105263157894; // payout for 5 days lock
  const payout1 = 117647058823; // payout for 6 months lock

  beforeEach(async function () {
    [owner, alice, bob, carol] = await ethers.getSigners();

    const HectorToken = await ethers.getContractFactory('HectorToken');
    hectorToken = (await HectorToken.deploy()) as HectorToken;

    const Principle = await ethers.getContractFactory('MockPrinciple');
    principle = (await Principle.deploy()) as MockPrinciple;
    await principle.connect(alice).mint(utils.parseEther('2000'));
    await principle.connect(bob).mint(utils.parseEther('2000'));
    await principle.connect(carol).mint(utils.parseEther('2000'));

    const HectorBondNoTreasuryDepository = await ethers.getContractFactory(
      'HectorBondNoTreasuryDepository'
    );
    hectorBondNoTreasuryDepository =
      (await HectorBondNoTreasuryDepository.deploy(
        'TestBond',
        hectorToken.address,
        principle.address,
        owner.address,
        constants.AddressZero
      )) as HectorBondNoTreasuryDepository;

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
    const amount = utils.parseEther('100');
    const maxPrice = 30000;
    const lockingPeriod = 5 * 24 * 3600; // 5 days lock
    const maxLockingPeriod = 5 * 30 * 24 * 3600; // 5 months lock

    it('invalid user locking period', async function () {
      let lockingPeriod = 24 * 3600; // 1 day lock

      await expect(
        hectorBondNoTreasuryDepository
          .connect(alice)
          .deposit(amount, maxPrice, lockingPeriod, alice.address)
      ).to.be.revertedWith('Invalid locking period');
    });

    it('payout with locking period', async function () {
      const tx = await hectorBondNoTreasuryDepository
        .connect(alice)
        .deposit(amount, maxPrice, lockingPeriod, alice.address);
      const reciept = await tx.wait();

      const info = await hectorBondNoTreasuryDepository.bondInfo(alice.address);
      expect(info.payout).equal(payout0);
      expect(info.lastBlockAt).equal(
        (await ethers.provider.getBlock(reciept.blockNumber)).timestamp
      );

      expect(await hectorBondNoTreasuryDepository.totalRemainingPayout()).equal(
        payout0
      );
    });

    it('payout with max locking period', async function () {
      const tx = await hectorBondNoTreasuryDepository
        .connect(bob)
        .deposit(amount, maxPrice, maxLockingPeriod, bob.address);
      const reciept = await tx.wait();

      const info = await hectorBondNoTreasuryDepository.bondInfo(bob.address);
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
        .deposit(amount, maxPrice, lockingPeriod, alice.address);
      expect(await hectorBondNoTreasuryDepository.totalRemainingPayout()).equal(
        payout0
      );

      await hectorBondNoTreasuryDepository
        .connect(bob)
        .deposit(amount, maxPrice, maxLockingPeriod, bob.address);

      expect(await hectorBondNoTreasuryDepository.totalRemainingPayout()).equal(
        payout0 + payout1
      );
    });
  });

  describe('#redeem', () => {
    const amount = utils.parseEther('100');
    const maxPrice = 30000;
    const lockingPeriod = 5 * 24 * 3600; // 5 days lock
    const maxLockingPeriod = 5 * 30 * 24 * 3600; // 5 months lock

    beforeEach(async function () {
      await hectorBondNoTreasuryDepository
        .connect(alice)
        .deposit(amount, maxPrice, lockingPeriod, alice.address);
      await hectorBondNoTreasuryDepository
        .connect(bob)
        .deposit(amount, maxPrice, maxLockingPeriod, bob.address);
    });

    it('after 5 days for alice', async function () {
      await increaseTime(lockingPeriod);

      await hectorBondNoTreasuryDepository.connect(alice).redeem(alice.address);
      expect(await hectorToken.balanceOf(alice.address)).equal(payout0);

      const info = await hectorBondNoTreasuryDepository.bondInfo(alice.address);
      expect(info.payout).equal(0);

      expect(await hectorBondNoTreasuryDepository.totalRemainingPayout()).equal(
        payout1
      );
    });

    it('after 5 days for bob', async function () {
      await increaseTime(lockingPeriod);

      await expect(
        hectorBondNoTreasuryDepository.connect(bob).redeem(bob.address)
      ).to.be.revertedWith('Not fully vested');
    });

    it('after 5 months for bob', async function () {
      await increaseTime(maxLockingPeriod);

      await hectorBondNoTreasuryDepository.connect(bob).redeem(bob.address);
      expect(await hectorToken.balanceOf(bob.address)).equal(payout1);

      const info = await hectorBondNoTreasuryDepository.bondInfo(bob.address);
      expect(info.payout).equal(0);
    });
  });
});
