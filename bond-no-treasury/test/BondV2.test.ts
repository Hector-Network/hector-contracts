import { MockBondPricing } from './../types/contracts/mock/MockBondPricing.sol/MockBondPricing';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { BigNumber, constants, utils } from 'ethers';
import { increaseTime } from './../helper/helpers';
import {
  HectorBondV2NoTreasuryFTMDepository,
  MockPrinciple,
  MockUniswapPairOracle,
  RewardToken,
} from '../types';

describe('Bond with no treasury', function () {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let fundRecipient: SignerWithAddress;
  let feeRecipient1: SignerWithAddress;
  let feeRecipient2: SignerWithAddress;

  let hectorToken: RewardToken;
  let principal: MockPrinciple;
  let oracle: MockUniswapPairOracle;
  let bondPricing: MockBondPricing;
  let bond: HectorBondV2NoTreasuryFTMDepository;

  const feeBps = BigNumber.from(1000);
  const feeWeightBps1 = BigNumber.from(1000);
  const feeWeightBps2 = BigNumber.from(9000);
  const fiveDays = BigNumber.from(5 * 24 * 3600);
  const oneWeeks = BigNumber.from(7 * 24 * 3600);
  const threeYears = BigNumber.from(3 * 365 * 24 * 3600);
  const fiveDaysDiscount = BigNumber.from(500);
  const oneWeeksDiscount = BigNumber.from(1000);
  const threeYearsDiscount = BigNumber.from(1500);

  beforeEach(async function () {
    [owner, alice, bob, feeRecipient1, feeRecipient2, fundRecipient] =
      await ethers.getSigners();

    const HectorToken = await ethers.getContractFactory('RewardToken');
    hectorToken = (await HectorToken.deploy()) as RewardToken;

    const Principle = await ethers.getContractFactory('MockPrinciple');
    principal = (await Principle.deploy()) as MockPrinciple;

    const Oracle = await ethers.getContractFactory('MockUniswapPairOracle');
    oracle = (await Oracle.deploy(
      hectorToken.address,
      principal.address
    )) as MockUniswapPairOracle;

    const BondPricing = await ethers.getContractFactory('MockBondPricing');
    bondPricing = (await BondPricing.deploy()) as MockBondPricing;
    await bondPricing.addOracle(
      oracle.address,
      hectorToken.address,
      principal.address
    );

    const HectorBondV2NoTreasuryFTMDepository = await ethers.getContractFactory(
      'HectorBondV2NoTreasuryFTMDepository'
    );
    bond = (await upgrades.deployProxy(HectorBondV2NoTreasuryFTMDepository, [
      'TestBond',
      hectorToken.address,
      owner.address,
      bondPricing.address,
    ])) as HectorBondV2NoTreasuryFTMDepository;

    await bond.initializeFundRecipient(fundRecipient.address, feeBps);
    await bond.initializeFeeRecipient(
      [feeRecipient1.address, feeRecipient2.address],
      [feeWeightBps1, feeWeightBps2]
    );
    await bond.initializeDepositTokens([principal.address]);
    await bond.setMinPrice(100);

    await bond.setLockingDiscount(fiveDays, fiveDaysDiscount); // 5 days lock - 5%
    await bond.setLockingDiscount(oneWeeks, oneWeeksDiscount); // 1 weeks lock - 10%
    await bond.setLockingDiscount(threeYears, threeYearsDiscount); // 3 years lock - 15%

    await hectorToken.mint(bond.address, utils.parseEther('20000'));

    await principal.connect(alice).mint(utils.parseEther('20000'));
    await principal.connect(bob).mint(utils.parseEther('20000'));
    await principal.connect(alice).approve(bond.address, constants.MaxUint256);
    await principal.connect(bob).approve(bond.address, constants.MaxUint256);
  });

  describe('#minimum price', () => {
    const minimumPrice = 1000;

    it('setMinPrice', async function () {
      await bond.setMinPrice(minimumPrice);

      expect(await bond.minimumPrice()).equal(minimumPrice);
    });
  });

  describe('#fee infos', () => {
    it('allFeeInfos', async function () {
      const result = await bond.allFeeInfos();

      expect(result[0]).to.deep.equal([
        feeRecipient1.address,
        feeRecipient2.address,
      ]);
      expect(result[1]).to.deep.equal([feeWeightBps1, feeWeightBps2]);
    });

    it('updateFeeWeights', async function () {
      await bond.updateFeeWeights(
        [feeRecipient1.address],
        [BigNumber.from(10000)]
      );

      const result = await bond.allFeeInfos();

      expect(result[0]).to.deep.equal([feeRecipient1.address]);
      expect(result[1]).to.deep.equal([BigNumber.from(10000)]);
    });
  });

  describe('#pausable', () => {
    const maxPrice = 30000000000;
    const amount1 = utils.parseEther('10000');
    const payout1 = BigNumber.from('1052631578947368548474'); // 10000 / 9.5 = 1052.6315789474

    it('deposit when paused', async function () {
      await bond.pause();

      await expect(
        bond
          .connect(alice)
          .deposit(principal.address, amount1, maxPrice, fiveDays)
      ).to.be.revertedWith('Pausable: paused');
    });

    it('redeem when paused', async function () {
      await bond
        .connect(alice)
        .deposit(principal.address, amount1, maxPrice, fiveDays);

      await bond.pause();
      await increaseTime(fiveDays.toNumber());

      await expect(bond.connect(alice).redeem(1)).to.be.revertedWith(
        'Pausable: paused'
      );
    });

    it('unpause', async function () {
      await bond
        .connect(alice)
        .deposit(principal.address, amount1, maxPrice, fiveDays);

      await bond.pause();
      await increaseTime(fiveDays.toNumber());
      await bond.unpause();

      bond.connect(alice).redeem(1);
    });
  });

  describe('#locking discount and period', () => {
    it('setLockingDiscount to add', async function () {
      await bond.setLockingDiscount(100, 10); // 100 seconds lock - 0.1%

      expect(await bond.lockingDiscounts(100)).equal(10);
    });

    it('setLockingDiscount to update', async function () {
      expect(await bond.lockingDiscounts(fiveDays)).equal(fiveDaysDiscount);

      await bond.setLockingDiscount(fiveDays, 2000); // 5 days lock - 20%

      expect(await bond.lockingDiscounts(fiveDays)).equal(2000);
    });

    it('allLockingPeriodsDiscounts', async function () {
      const result = await bond.allLockingPeriodsDiscounts();

      expect(result[0]).to.deep.equal([fiveDays, oneWeeks, threeYears]);
      expect(result[1]).to.deep.equal([
        fiveDaysDiscount,
        oneWeeksDiscount,
        threeYearsDiscount,
      ]);
    });
  });

  describe('#principals', () => {
    it('allPrincipals', async function () {
      const result = await bond.allPrincipals();

      expect(result[0]).to.deep.equal([principal.address]);
      expect(result[1]).to.deep.equal([constants.Zero]);
    });
  });

  describe('#minimum principal amount', () => {
    it('minimumPrinciaplAmount in 5% discount, 0.01 HEC amount, HEC: 10$', async function () {
      const result = await bond.minimumPrincipalAmount(principal.address, 500);

      // 0.01HEC * 95% * 10$ = 0.095DAI
      expect(result).equal(utils.parseEther('0.095'));
    });
  });

  describe('#bond price', () => {
    it('bondPriceInUSD in HEC: 10$', async function () {
      const result = await bond.bondPriceInUSD(principal.address);

      // 10$
      expect(result).equal(utils.parseEther('10'));
    });

    it('bondPrice', async function () {
      const result = await bond.bondPrice(principal.address);

      // 10$
      expect(result).equal(100000);
    });
  });

  describe('#payout for', () => {
    it('payoutFor in HEC: 10$ and discount: 5%', async function () {
      const result = await bond.payoutFor(
        principal.address,
        utils.parseEther('95'),
        500
      );

      // 95 / (10$ * 95%)
      expect(result).gt(utils.parseEther('10'));
    });
  });

  describe('#withdraw token', () => {
    it('totalRemainingPayout', async function () {
      expect(await bond.totalRemainingPayout()).equal(constants.Zero);
    });

    it('withdrawToken of HEC', async function () {
      await bond.withdrawToken(hectorToken.address);

      const result = await hectorToken.balanceOf(owner.address);

      expect(result).equal(utils.parseEther('20000'));
    });
  });

  describe('#deposit', () => {
    const maxPrice = 30000000000;
    const amount1 = utils.parseEther('10000');
    const payout1 = BigNumber.from('1052631578947368548474'); // 10000 / 9.5 = 1052.6315789474
    const amount2 = utils.parseEther('5000');
    const payout2 = BigNumber.from('555555555555555622805'); // 5000 / 9 = 555.5555555556

    it('invalid user locking period', async function () {
      let lockingPeriod = 24 * 3600; // 1 day lock

      await expect(
        bond
          .connect(alice)
          .deposit(principal.address, amount1, maxPrice, lockingPeriod)
      ).to.be.revertedWith('Invalid locking period');
    });

    it('payout with locking period', async function () {
      const tx = await bond
        .connect(alice)
        .deposit(principal.address, amount1, maxPrice, fiveDays);
      const reciept = await tx.wait();

      const info = await bond.bondInfo(1);
      expect(info.depositId).equal(BigNumber.from(1));
      expect(info.principal).equal(principal.address);
      expect(info.amount).equal(amount1);
      expect(info.payout).equal(payout1);
      expect(info.vesting).equal(fiveDays);
      expect(info.lastBlockAt).equal(
        (await ethers.provider.getBlock(reciept.blockNumber)).timestamp
      );
      expect(info.pricePaid).equal(utils.parseEther('9.5'));
      expect(info.depositor).equal(alice.address);

      expect(await bond.totalRemainingPayout()).equal(payout1);
    });

    it('payout with locking period - two times', async function () {
      await bond
        .connect(alice)
        .deposit(principal.address, amount1, maxPrice, fiveDays);

      const tx = await bond
        .connect(alice)
        .deposit(principal.address, amount2, maxPrice, oneWeeks);
      const reciept = await tx.wait();

      const info = await bond.bondInfo(2);
      expect(info.depositId).equal(BigNumber.from(2));
      expect(info.principal).equal(principal.address);
      expect(info.amount).equal(amount2);
      expect(info.payout).equal(payout2);
      expect(info.vesting).equal(oneWeeks);
      expect(info.lastBlockAt).equal(
        (await ethers.provider.getBlock(reciept.blockNumber)).timestamp
      );
      expect(info.pricePaid).equal(utils.parseEther('9'));
      expect(info.depositor).equal(alice.address);

      expect(await bond.totalRemainingPayout()).equal(payout1.add(payout2));
    });

    it('all bond infos with pendingPayoutFor', async function () {
      await bond
        .connect(alice)
        .deposit(principal.address, amount1, maxPrice, fiveDays);
      await bond
        .connect(alice)
        .deposit(principal.address, amount2, maxPrice, oneWeeks);

      await increaseTime(fiveDays.toNumber());

      const result = await bond.allBondInfos(alice.address);

      expect(result[0][0].depositId).equal(BigNumber.from(1));
      expect(result[0][0].principal).equal(principal.address);
      expect(result[0][0].payout).equal(payout1);
      expect(result[0][0].vesting).equal(fiveDays);
      expect(result[0][0].pricePaid).equal(utils.parseEther('9.5'));
      expect(result[0][0].depositor).equal(alice.address);
      expect(result[0][1].depositId).equal(BigNumber.from(2));
      expect(result[0][1].principal).equal(principal.address);
      expect(result[0][1].payout).equal(payout2);
      expect(result[0][1].vesting).equal(oneWeeks);
      expect(result[0][1].pricePaid).equal(utils.parseEther('9'));
      expect(result[0][1].depositor).equal(alice.address);

      const percent = fiveDays.mul(10000).div(oneWeeks);
      expect(await bond.percentVestedFor(2)).equal(percent);

      expect(result[1][0]).equal(payout1);
      expect(result[1][1]).equal(payout2.mul(percent).div(10000));
    });
  });

  describe('#redeem', () => {
    const maxPrice = 30000000000;
    const amount1 = utils.parseEther('10000');
    const payout1 = BigNumber.from('1052631578947368548474'); // 10000 / 9.5 = 1052.6315789474
    const amount2 = utils.parseEther('5000');
    const payout2 = BigNumber.from('555555555555555622805'); // 5000 / 9 = 555.5555555556

    beforeEach(async function () {
      await bond
        .connect(alice)
        .deposit(principal.address, amount1, maxPrice, fiveDays);
      await bond
        .connect(alice)
        .deposit(principal.address, amount1, maxPrice, fiveDays);
      await bond
        .connect(bob)
        .deposit(principal.address, amount2, maxPrice, oneWeeks);
    });

    it('redeem others bond', async function () {
      await expect(bond.connect(alice).redeem(3)).to.be.revertedWith(
        'Cant redeem others bond'
      );
      await expect(bond.connect(bob).redeem(2)).to.be.revertedWith(
        'Cant redeem others bond'
      );
      await expect(bond.connect(bob).redeem(1)).to.be.revertedWith(
        'Cant redeem others bond'
      );
    });

    it('after 5 days for alice', async function () {
      await increaseTime(fiveDays.toNumber());

      expect(await bond.totalRemainingPayout()).equal(
        payout1.add(payout1).add(payout2)
      );

      await bond.connect(alice).redeem(1);
      expect(await hectorToken.balanceOf(alice.address)).equal(payout1);
      expect(await bond.totalRemainingPayout()).equal(payout1.add(payout2));

      const info0 = await bond.bondInfo(1);
      expect(info0.payout).equal(0);

      const result1 = await bond.allBondInfos(alice.address);
      expect(result1[0][0].depositId).equal(BigNumber.from(2));
      expect(result1[0][0].principal).equal(principal.address);
      expect(result1[0][0].payout).equal(payout1);
      expect(result1[0][0].vesting).equal(fiveDays);
      expect(result1[0][0].pricePaid).equal(utils.parseEther('9.5'));
      expect(result1[0][0].depositor).equal(alice.address);

      await bond.connect(alice).redeem(2);
      expect(await hectorToken.balanceOf(alice.address)).equal(
        payout1.add(payout1)
      );
      expect(await bond.totalRemainingPayout()).equal(payout2);

      const info1 = await bond.bondInfo(2);
      expect(info1.payout).equal(0);

      const result2 = await bond.allBondInfos(alice.address);
      expect(result2[0]).to.deep.equal([]);
    });

    it('after 5 days for bob', async function () {
      await increaseTime(fiveDays.toNumber());

      await expect(bond.connect(bob).redeem(3)).to.be.revertedWith(
        'Not fully vested'
      );
    });

    it('after 1 weeks for bob', async function () {
      await increaseTime(oneWeeks.toNumber());

      await bond.connect(bob).redeem(3);
      expect(await hectorToken.balanceOf(bob.address)).equal(payout2);

      const info = await bond.bondInfo(bob.address);
      expect(info.payout).equal(0);

      const result = await bond.allBondInfos(bob.address);
      expect(result[0]).to.deep.equal([]);
    });
  });

  describe('#fee', () => {
    const maxPrice = 30000000000;
    const amount1 = utils.parseEther('10000');
    const amount2 = utils.parseEther('5000');

    beforeEach(async function () {
      await bond
        .connect(alice)
        .deposit(principal.address, amount1, maxPrice, fiveDays);
      await bond
        .connect(alice)
        .deposit(principal.address, amount1, maxPrice, fiveDays);
      await bond
        .connect(bob)
        .deposit(principal.address, amount2, maxPrice, oneWeeks);
    });

    it('token balances for feeRecipients in fee: 10%', async function () {
      // (10000 + 10000 + 5000) * 10% = 2500
      const result1 = await bond.tokenBalances(
        principal.address,
        feeRecipient1.address
      );
      expect(result1).equal(
        amount1
          .add(amount1)
          .add(amount2)
          .mul(feeBps)
          .div(10000)
          .mul(feeWeightBps1)
          .div(10000)
      );

      const result2 = await bond.tokenBalances(
        principal.address,
        feeRecipient2.address
      );
      expect(result2).equal(
        amount1
          .add(amount1)
          .add(amount2)
          .mul(feeBps)
          .div(10000)
          .mul(feeWeightBps2)
          .div(10000)
      );
    });

    it('claim fee', async function () {
      await bond.claimFund(principal.address);
      await bond.claimFee(principal.address, feeRecipient1.address);
      await bond.claimFee(principal.address, feeRecipient2.address);

      expect(await principal.balanceOf(feeRecipient1.address)).equal(
        amount1
          .add(amount1)
          .add(amount2)
          .mul(feeBps)
          .div(10000)
          .mul(feeWeightBps1)
          .div(10000)
      );
      expect(await principal.balanceOf(feeRecipient2.address)).equal(
        amount1
          .add(amount1)
          .add(amount2)
          .mul(feeBps)
          .div(10000)
          .mul(feeWeightBps2)
          .div(10000)
      );

      expect(
        await bond.tokenBalances(principal.address, feeRecipient1.address)
      ).equal(constants.Zero);
      expect(
        await bond.tokenBalances(principal.address, feeRecipient2.address)
      ).equal(constants.Zero);
    });
  });

  describe('#fund', () => {
    const maxPrice = 30000000000;
    const amount1 = utils.parseEther('10000');
    const amount2 = utils.parseEther('5000');

    beforeEach(async function () {
      await bond
        .connect(alice)
        .deposit(principal.address, amount1, maxPrice, fiveDays);
      await bond
        .connect(alice)
        .deposit(principal.address, amount1, maxPrice, fiveDays);
      await bond
        .connect(bob)
        .deposit(principal.address, amount2, maxPrice, oneWeeks);
    });

    it('token balances for fundRecipient in fee: 10%', async function () {
      // (10000 + 10000 + 5000) * (100% - 10%) = 22500
      const result = await bond.tokenBalances(
        principal.address,
        fundRecipient.address
      );
      expect(result).equal(
        amount1
          .add(amount1)
          .add(amount2)
          .mul(10000 - feeBps.toNumber())
          .div(10000)
      );
    });

    it('claim fund', async function () {
      await bond.claimFee(principal.address, feeRecipient1.address);
      await bond.claimFee(principal.address, feeRecipient2.address);
      await bond.claimFund(principal.address);

      expect(await principal.balanceOf(fundRecipient.address)).equal(
        amount1
          .add(amount1)
          .add(amount2)
          .mul(10000 - feeBps.toNumber())
          .div(10000)
      );

      expect(
        await bond.tokenBalances(principal.address, fundRecipient.address)
      ).equal(constants.Zero);
    });
  });
});
