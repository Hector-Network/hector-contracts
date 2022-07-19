import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { BigNumber, constants, utils } from 'ethers';
import { HectorToken } from './../types/HEC.sol/HectorToken';
import { MockPrinciple } from './../types/contracts/mock/MockPrinciple';
import { HectorBondNoTreasuryDepository } from './../types/HectorBondNoTreasuryDepository.sol/HectorBondNoTreasuryDepository';
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
  const maxDiscount = 500;
  const maxLockingPeriod = 3600;
  const totalSupply = utils.parseEther('5000');
  const initialDebt = utils.parseUnits('100', 9);

  const payout0 = 101399310484; // payout for 1000 seconds locking
  const payout1 = 105263157894; // payout for 3600 (max) seconds locking

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
      maxDiscount,
      maxLockingPeriod,
      totalSupply,
      initialDebt
    );

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
    const maxDiscount = 1500;
    const maxLockingPeriod = 13600;
    const totalSupply = utils.parseEther('15000');

    it('maxDiscount', async function () {
      await hectorBondNoTreasuryDepository.setBondTerms(5, maxDiscount);

      expect((await hectorBondNoTreasuryDepository.terms()).maxDiscount).equal(
        maxDiscount
      );
    });

    it('maxLockingPeriod', async function () {
      await hectorBondNoTreasuryDepository.setBondTerms(6, maxLockingPeriod);

      expect(
        (await hectorBondNoTreasuryDepository.terms()).maxLockingPeriod
      ).equal(maxLockingPeriod);
    });

    it('maxLockingPeriod', async function () {
      await hectorBondNoTreasuryDepository.setBondTerms(7, totalSupply);

      expect((await hectorBondNoTreasuryDepository.terms()).totalSupply).equal(
        totalSupply
      );
    });
  });

  describe('#deposit', () => {
    const amount = utils.parseEther('100');
    const maxPrice = 30000;
    const lockingPeriod = 1000;

    it('invalid user locking period', async function () {
      let lockingPeriod = maxLockingPeriod + 1;

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
    });
  });

  describe('#redeem', () => {
    const amount = utils.parseEther('100');
    const maxPrice = 30000;
    const lockingPeriod = 1000;

    beforeEach(async function () {
      await hectorBondNoTreasuryDepository
        .connect(alice)
        .deposit(amount, maxPrice, lockingPeriod, alice.address);
      await hectorBondNoTreasuryDepository
        .connect(bob)
        .deposit(amount, maxPrice, maxLockingPeriod, bob.address);
    });

    it('after 1000 seconds for alice', async function () {
      await increaseTime(lockingPeriod);

      await hectorBondNoTreasuryDepository.connect(alice).redeem(alice.address);
      expect(await hectorToken.balanceOf(alice.address)).equal(payout0);

      const info = await hectorBondNoTreasuryDepository.bondInfo(alice.address);
      expect(info.payout).equal(0);
    });

    it('after 1000 seconds for bob', async function () {
      await increaseTime(lockingPeriod);

      await expect(
        hectorBondNoTreasuryDepository.connect(bob).redeem(bob.address)
      ).to.be.revertedWith('Not fully vested');
    });

    it('after 3600 (max) seconds for bob', async function () {
      await increaseTime(maxLockingPeriod);

      await hectorBondNoTreasuryDepository.connect(bob).redeem(bob.address);
      expect(await hectorToken.balanceOf(bob.address)).equal(payout1);

      const info = await hectorBondNoTreasuryDepository.bondInfo(bob.address);
      expect(info.payout).equal(0);
    });
  });
});
