import { Result } from '@ethersproject/abi';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { BigNumber, constants, utils } from 'ethers';
import { emitAmounts } from '../deploy/config';
import { increaseTime, getTimeStamp, gWei } from './../helper';
import {
  BondNoTreasury,
  MockPrinciple,
  RewardToken,
  PriceOracleAggregator,
  MockOracle,
  Emissionor,
  Splitter,
  RewardWeight,
  LockFarm,
  TokenVault,
  FNFT,
  LockAddressRegistry,
  HectorMinterMock,
} from '../types';

describe('BondV3.1 with no treasury', function () {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let fundRecipient: SignerWithAddress;
  let feeRecipient1: SignerWithAddress;
  let feeRecipient2: SignerWithAddress;
  let autoStakingFeeRecipient: SignerWithAddress;

  let hectorToken: RewardToken;
  let stablePrincipal: MockPrinciple;
  let nonStablePrincipal: MockPrinciple;
  let lpPrincipal: MockPrinciple;
  let hectorOracle: MockOracle;
  let stableOracle: MockOracle;
  let nonStableOracle: MockOracle;
  let lpOracle: MockOracle;
  let priceOracleAggregator: PriceOracleAggregator;
  let bond: BondNoTreasury;

  let rewardToken: RewardToken;
  let treasury: HectorMinterMock;
  let lockAddressRegistry: LockAddressRegistry;
  let fnft: FNFT;
  let tokenVault: TokenVault;
  let lockFarm: LockFarm;
  let rewardWeight: RewardWeight;
  let splitter: Splitter;
  let emissionor: Emissionor;

  const feeBps = BigNumber.from(1000);
  const feeWeightBps1 = BigNumber.from(1000);
  const feeWeightBps2 = BigNumber.from(9000);
  const autoStakingFeeBps = BigNumber.from(1000);
  const fiveDays = BigNumber.from(5 * 24 * 3600);
  const oneWeeks = BigNumber.from(7 * 24 * 3600);
  const threeYears = BigNumber.from(3 * 365 * 24 * 3600);
  const fiveDaysDiscount = BigNumber.from(500);
  const oneWeeksDiscount = BigNumber.from(1000);
  const threeYearsDiscount = BigNumber.from(1500);

  beforeEach(async function () {
    [
      owner,
      alice,
      bob,
      feeRecipient1,
      feeRecipient2,
      fundRecipient,
      autoStakingFeeRecipient,
    ] = await ethers.getSigners();

    const HectorToken = await ethers.getContractFactory('RewardToken');
    hectorToken = (await HectorToken.deploy()) as RewardToken;

    const Principle = await ethers.getContractFactory('MockPrinciple');
    stablePrincipal = (await Principle.deploy()) as MockPrinciple;
    nonStablePrincipal = (await Principle.deploy()) as MockPrinciple;
    lpPrincipal = (await Principle.deploy()) as MockPrinciple;

    const Oracle = await ethers.getContractFactory('MockOracle');
    hectorOracle = (await Oracle.deploy(
      hectorToken.address,
      1000000000 // 10$
    )) as MockOracle;
    stableOracle = (await Oracle.deploy(
      stablePrincipal.address,
      100000000 // 1$
    )) as MockOracle;
    nonStableOracle = (await Oracle.deploy(
      nonStablePrincipal.address,
      2000000000 // 20$
    )) as MockOracle;
    lpOracle = (await Oracle.deploy(
      lpPrincipal.address,
      100000000000000 // 1000000$
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
      stablePrincipal.address,
      stableOracle.address
    );
    await priceOracleAggregator.updateOracleForAsset(
      nonStablePrincipal.address,
      nonStableOracle.address
    );
    await priceOracleAggregator.updateOracleForAsset(
      lpPrincipal.address,
      lpOracle.address
    );

    const RewardToken = await ethers.getContractFactory('RewardToken');
    rewardToken = (await RewardToken.deploy()) as RewardToken;

    const Treasury = await ethers.getContractFactory('HectorMinterMock');
    treasury = (await Treasury.deploy()) as HectorMinterMock;
    await treasury.setHector(rewardToken.address);

    const LockAddressRegistry = await ethers.getContractFactory(
      'LockAddressRegistry'
    );
    lockAddressRegistry =
      (await LockAddressRegistry.deploy()) as LockAddressRegistry;

    const FNFT = await ethers.getContractFactory('FNFT');
    fnft = (await FNFT.deploy(lockAddressRegistry.address)) as FNFT;

    const TokenVault = await ethers.getContractFactory('TokenVault');
    tokenVault = (await TokenVault.deploy(
      lockAddressRegistry.address
    )) as TokenVault;

    const LockFarm = await ethers.getContractFactory('LockFarm');
    lockFarm = (await LockFarm.deploy(
      lockAddressRegistry.address,
      'AutoStakingBond Farm',
      hectorToken.address,
      rewardToken.address
    )) as LockFarm;

    const RewardWeight = await ethers.getContractFactory('RewardWeight');
    rewardWeight = (await RewardWeight.deploy(
      hectorToken.address
    )) as RewardWeight;
    await rewardWeight.register(lockFarm.address, 10000);

    const Splitter = await ethers.getContractFactory('Splitter');
    splitter = (await Splitter.deploy(rewardWeight.address)) as Splitter;
    await splitter.setRewardToken(rewardToken.address);
    await splitter.register(lockFarm.address);

    const Emissionor = await ethers.getContractFactory('Emissionor');
    emissionor = (await Emissionor.deploy(
      treasury.address,
      splitter.address,
      rewardToken.address
    )) as Emissionor;
    await emissionor.initialize(
      (await getTimeStamp()) + 10,
      emitAmounts.map((amount) => gWei(amount)),
      emitAmounts.reduce(
        (sum, current) => sum.add(gWei(current)),
        BigNumber.from(0)
      )
    );

    await lockAddressRegistry.initialize(
      owner.address,
      tokenVault.address,
      fnft.address,
      emissionor.address
    );
    await lockAddressRegistry.addFarm(lockFarm.address);
    await treasury.setRewardManager(emissionor.address);

    const BondNoTreasury = await ethers.getContractFactory('BondNoTreasury');
    bond = (await upgrades.deployProxy(BondNoTreasury, [
      'TestBond',
      hectorToken.address,
      owner.address,
      priceOracleAggregator.address,
      lockFarm.address,
      fnft.address,
      tokenVault.address,
    ])) as BondNoTreasury;

    await bond.initializeFundRecipient(fundRecipient.address, feeBps);
    await bond.initializeFeeRecipient(
      [feeRecipient1.address, feeRecipient2.address],
      [feeWeightBps1, feeWeightBps2]
    );
    await bond.initializeDepositTokens([
      stablePrincipal.address,
      nonStablePrincipal.address,
      lpPrincipal.address,
    ]);
    await bond.initializeAutoStakingFee(
      false,
      autoStakingFeeRecipient.address,
      autoStakingFeeBps
    );
    await bond.setMinPrice(100);

    await bond.setLockingDiscount(fiveDays, fiveDaysDiscount); // 5 days lock - 5%
    await bond.setLockingDiscount(oneWeeks, oneWeeksDiscount); // 1 weeks lock - 10%
    await bond.setLockingDiscount(threeYears, threeYearsDiscount); // 3 years lock - 15%

    await hectorToken.mint(bond.address, utils.parseEther('200000000000000'));
    await rewardToken.mint(
      treasury.address,
      utils.parseEther('200000000000000')
    );

    await stablePrincipal.connect(alice).mint(utils.parseEther('20000'));
    await stablePrincipal.connect(bob).mint(utils.parseEther('20000'));
    await stablePrincipal
      .connect(alice)
      .approve(bond.address, constants.MaxUint256);
    await stablePrincipal
      .connect(bob)
      .approve(bond.address, constants.MaxUint256);

    await nonStablePrincipal.connect(alice).mint(utils.parseEther('20000'));
    await nonStablePrincipal.connect(bob).mint(utils.parseEther('20000'));
    await nonStablePrincipal
      .connect(alice)
      .approve(bond.address, constants.MaxUint256);
    await nonStablePrincipal
      .connect(bob)
      .approve(bond.address, constants.MaxUint256);

    await lpPrincipal.connect(alice).mint(utils.parseEther('20000'));
    await lpPrincipal.connect(bob).mint(utils.parseEther('20000'));
    await lpPrincipal
      .connect(alice)
      .approve(bond.address, constants.MaxUint256);
    await lpPrincipal.connect(bob).approve(bond.address, constants.MaxUint256);
  });

  describe('#price oracle aggregator', () => {
    it('viewPriceInUSD', async function () {
      // 10$
      expect(
        await priceOracleAggregator.viewPriceInUSD(hectorToken.address)
      ).equal(1000000000);
      // 1$
      expect(
        await priceOracleAggregator.viewPriceInUSD(stablePrincipal.address)
      ).equal(100000000);
      // 20$
      expect(
        await priceOracleAggregator.viewPriceInUSD(nonStablePrincipal.address)
      ).equal(2000000000);
      // 1000000$
      expect(
        await priceOracleAggregator.viewPriceInUSD(lpPrincipal.address)
      ).equal(100000000000000);
    });
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
    const payout1 = BigNumber.from('1052631578947368421052'); // 10000 / 9.5 = 1052.6315789474

    it('deposit when paused', async function () {
      await bond.pause();

      await expect(
        bond
          .connect(alice)
          .deposit(stablePrincipal.address, amount1, maxPrice, fiveDays)
      ).to.be.revertedWith('Pausable: paused');
    });

    it('redeem when paused', async function () {
      await bond
        .connect(alice)
        .deposit(stablePrincipal.address, amount1, maxPrice, fiveDays);

      await bond.pause();
      await increaseTime(fiveDays.toNumber());

      await expect(bond.connect(alice).redeem(1)).to.be.revertedWith(
        'Pausable: paused'
      );
    });

    it('unpause', async function () {
      await bond
        .connect(alice)
        .deposit(stablePrincipal.address, amount1, maxPrice, fiveDays);

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

  describe('#stablePrincipals', () => {
    it('allPrincipals', async function () {
      const result = await bond.allPrincipals();

      expect(result[0]).to.deep.equal([
        stablePrincipal.address,
        nonStablePrincipal.address,
        lpPrincipal.address,
      ]);
      expect(result[1]).to.deep.equal([
        constants.Zero,
        constants.Zero,
        constants.Zero,
      ]);
    });
  });

  describe('#minimum stablePrincipal amount', () => {
    it('minimumPrinciaplAmount in 5% discount, 0.01 HEC amount, HEC: 10$', async function () {
      const result = await bond.minimumPrincipalAmount(
        stablePrincipal.address,
        500
      );

      // 0.01HEC * 95% * 10$ = 0.095DAI
      expect(result).equal(utils.parseEther('0.095'));
    });
  });

  describe('#bond price', () => {
    it('bondPriceInUSD in HEC: 10$', async function () {
      const result = await bond.bondPriceInUSD();

      // 10$ = 10 * 10^8
      expect(result).equal(1000000000);
    });

    it('bondPrice', async function () {
      const result = await bond.bondPrice();

      // 10$ = 10 * 10^8
      expect(result).equal(1000000000);
    });
  });

  describe('#payout for', () => {
    it('payoutFor in stable principal: 10$ vs 1$ and discount: 5%', async function () {
      const result = await bond.payoutFor(
        stablePrincipal.address,
        utils.parseEther('95'),
        500
      );

      // 95 / (10$ * 95%)
      expect(result).equal(utils.parseEther('10'));
    });
    it('payoutFor in non stable principal: 10$ vs 20$ and discount: 5%', async function () {
      const result = await bond.payoutFor(
        nonStablePrincipal.address,
        utils.parseEther('95'),
        500
      );

      // (95 * 20$) / (10$ * 95%)
      expect(result).equal(utils.parseEther('200'));
    });
    it('payoutFor in lp principal: 10$ vs 1000000$ and discount: 5%', async function () {
      const result = await bond.payoutFor(
        lpPrincipal.address,
        utils.parseEther('95'),
        500
      );

      // (95 * 1000000$) / (10$ * 95%)
      expect(result).equal(utils.parseEther('10000000'));
    });
  });

  describe('#withdraw token', () => {
    it('totalRemainingPayout', async function () {
      expect(await bond.totalRemainingPayout()).equal(constants.Zero);
    });

    it('withdrawToken of HEC', async function () {
      await bond.withdrawToken(hectorToken.address);

      const result = await hectorToken.balanceOf(owner.address);

      expect(result).equal(utils.parseEther('200000000000000'));
    });
  });

  describe('#deposit stable principal', () => {
    const maxPrice = 30000000000;
    const amount1 = utils.parseEther('10000');
    const payout1 = BigNumber.from('1052631578947368421052'); // 10000 / 9.5 = 1052.6315789474
    const amount2 = utils.parseEther('5000');
    const payout2 = BigNumber.from('555555555555555555555'); // 5000 / 9 = 555.5555555556

    it('invalid user locking period', async function () {
      let lockingPeriod = 24 * 3600; // 1 day lock

      await expect(
        bond
          .connect(alice)
          .deposit(stablePrincipal.address, amount1, maxPrice, lockingPeriod)
      ).to.be.revertedWith('Invalid locking period');
    });

    it('payout with locking period', async function () {
      const tx = await bond
        .connect(alice)
        .deposit(stablePrincipal.address, amount1, maxPrice, fiveDays);
      const reciept = await tx.wait();

      const info = await bond.bondInfo(1);
      expect(info.depositId).equal(BigNumber.from(1));
      expect(info.principal).equal(stablePrincipal.address);
      expect(info.amount).equal(amount1);
      expect(info.payout).equal(payout1);
      expect(info.vesting).equal(fiveDays);
      expect(info.lastBlockAt).equal(
        (await ethers.provider.getBlock(reciept.blockNumber)).timestamp
      );
      expect(info.pricePaid).equal(950000000); // 9.5$
      expect(info.depositor).equal(alice.address);

      expect(await bond.totalRemainingPayout()).equal(payout1);
    });

    it('payout with locking period - two times', async function () {
      await bond
        .connect(alice)
        .deposit(stablePrincipal.address, amount1, maxPrice, fiveDays);

      const tx = await bond
        .connect(alice)
        .deposit(stablePrincipal.address, amount2, maxPrice, oneWeeks);
      const reciept = await tx.wait();

      const info = await bond.bondInfo(2);
      expect(info.depositId).equal(BigNumber.from(2));
      expect(info.principal).equal(stablePrincipal.address);
      expect(info.amount).equal(amount2);
      expect(info.payout).equal(payout2);
      expect(info.vesting).equal(oneWeeks);
      expect(info.lastBlockAt).equal(
        (await ethers.provider.getBlock(reciept.blockNumber)).timestamp
      );
      expect(info.pricePaid).equal(900000000); // 9$
      expect(info.depositor).equal(alice.address);

      expect(await bond.totalRemainingPayout()).equal(payout1.add(payout2));
    });

    it('all bond infos with pendingPayoutFor', async function () {
      await bond
        .connect(alice)
        .deposit(stablePrincipal.address, amount1, maxPrice, fiveDays);
      await bond
        .connect(alice)
        .deposit(stablePrincipal.address, amount2, maxPrice, oneWeeks);

      await increaseTime(fiveDays.toNumber());

      const result = await bond.allBondInfos(alice.address);

      expect(result[0][0].depositId).equal(BigNumber.from(1));
      expect(result[0][0].principal).equal(stablePrincipal.address);
      expect(result[0][0].payout).equal(payout1);
      expect(result[0][0].vesting).equal(fiveDays);
      expect(result[0][0].pricePaid).equal(950000000);
      expect(result[0][0].depositor).equal(alice.address);
      expect(result[0][1].depositId).equal(BigNumber.from(2));
      expect(result[0][1].principal).equal(stablePrincipal.address);
      expect(result[0][1].payout).equal(payout2);
      expect(result[0][1].vesting).equal(oneWeeks);
      expect(result[0][1].pricePaid).equal(900000000);
      expect(result[0][1].depositor).equal(alice.address);

      const percent = fiveDays.mul(10000).div(oneWeeks);
      expect(await bond.percentVestedFor(2)).equal(percent);

      expect(result[1][0]).equal(payout1);
      expect(result[1][1]).equal(payout2.mul(percent).div(10000));
    });
  });

  describe('#redeem for stable principal', () => {
    const maxPrice = 30000000000;
    const amount1 = utils.parseEther('10000');
    const payout1 = BigNumber.from('1052631578947368421052'); // 10000 / 9.5 = 1052.6315789474
    const amount2 = utils.parseEther('5000');
    const payout2 = BigNumber.from('555555555555555555555'); // 5000 / 9 = 555.5555555556

    beforeEach(async function () {
      await bond
        .connect(alice)
        .deposit(stablePrincipal.address, amount1, maxPrice, fiveDays);
      await bond
        .connect(alice)
        .deposit(stablePrincipal.address, amount1, maxPrice, fiveDays);
      await bond
        .connect(bob)
        .deposit(stablePrincipal.address, amount2, maxPrice, oneWeeks);
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
      expect(result1[0][0].principal).equal(stablePrincipal.address);
      expect(result1[0][0].payout).equal(payout1);
      expect(result1[0][0].vesting).equal(fiveDays);
      expect(result1[0][0].pricePaid).equal(950000000);
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

  describe('#deposit non stable principal', () => {
    const maxPrice = 30000000000;
    const amount1 = utils.parseEther('10000');
    const payout1 = BigNumber.from('21052631578947368421052'); // 10000 * 20$ / 9.5$ = 21052.6315789474
    const amount2 = utils.parseEther('5000');
    const payout2 = BigNumber.from('11111111111111111111111'); // 5000 * 20$ / 9$ = 11111.1111111111

    it('invalid user locking period', async function () {
      let lockingPeriod = 24 * 3600; // 1 day lock

      await expect(
        bond
          .connect(alice)
          .deposit(nonStablePrincipal.address, amount1, maxPrice, lockingPeriod)
      ).to.be.revertedWith('Invalid locking period');
    });

    it('payout with locking period', async function () {
      const tx = await bond
        .connect(alice)
        .deposit(nonStablePrincipal.address, amount1, maxPrice, fiveDays);
      const reciept = await tx.wait();

      const info = await bond.bondInfo(1);
      expect(info.depositId).equal(BigNumber.from(1));
      expect(info.principal).equal(nonStablePrincipal.address);
      expect(info.amount).equal(amount1);
      expect(info.payout).equal(payout1);
      expect(info.vesting).equal(fiveDays);
      expect(info.lastBlockAt).equal(
        (await ethers.provider.getBlock(reciept.blockNumber)).timestamp
      );
      expect(info.pricePaid).equal(950000000); // 9.5$
      expect(info.depositor).equal(alice.address);

      expect(await bond.totalRemainingPayout()).equal(payout1);
    });

    it('payout with locking period - two times', async function () {
      await bond
        .connect(alice)
        .deposit(nonStablePrincipal.address, amount1, maxPrice, fiveDays);

      const tx = await bond
        .connect(alice)
        .deposit(nonStablePrincipal.address, amount2, maxPrice, oneWeeks);
      const reciept = await tx.wait();

      const info = await bond.bondInfo(2);
      expect(info.depositId).equal(BigNumber.from(2));
      expect(info.principal).equal(nonStablePrincipal.address);
      expect(info.amount).equal(amount2);
      expect(info.payout).equal(payout2);
      expect(info.vesting).equal(oneWeeks);
      expect(info.lastBlockAt).equal(
        (await ethers.provider.getBlock(reciept.blockNumber)).timestamp
      );
      expect(info.pricePaid).equal(900000000); // 9$
      expect(info.depositor).equal(alice.address);

      expect(await bond.totalRemainingPayout()).equal(payout1.add(payout2));
    });

    it('all bond infos with pendingPayoutFor', async function () {
      await bond
        .connect(alice)
        .deposit(nonStablePrincipal.address, amount1, maxPrice, fiveDays);
      await bond
        .connect(alice)
        .deposit(nonStablePrincipal.address, amount2, maxPrice, oneWeeks);

      await increaseTime(fiveDays.toNumber());

      const result = await bond.allBondInfos(alice.address);

      expect(result[0][0].depositId).equal(BigNumber.from(1));
      expect(result[0][0].principal).equal(nonStablePrincipal.address);
      expect(result[0][0].payout).equal(payout1);
      expect(result[0][0].vesting).equal(fiveDays);
      expect(result[0][0].pricePaid).equal(950000000);
      expect(result[0][0].depositor).equal(alice.address);
      expect(result[0][1].depositId).equal(BigNumber.from(2));
      expect(result[0][1].principal).equal(nonStablePrincipal.address);
      expect(result[0][1].payout).equal(payout2);
      expect(result[0][1].vesting).equal(oneWeeks);
      expect(result[0][1].pricePaid).equal(900000000);
      expect(result[0][1].depositor).equal(alice.address);

      const percent = fiveDays.mul(10000).div(oneWeeks);
      expect(await bond.percentVestedFor(2)).equal(percent);

      expect(result[1][0]).equal(payout1);
      expect(result[1][1]).equal(payout2.mul(percent).div(10000));
    });
  });

  describe('#redeem for non stable principal', () => {
    const maxPrice = 30000000000;
    const amount1 = utils.parseEther('10000');
    const payout1 = BigNumber.from('21052631578947368421052'); // 10000 * 20$ / 9.5$ = 21052.6315789474
    const amount2 = utils.parseEther('5000');
    const payout2 = BigNumber.from('11111111111111111111111'); // 5000 * 20$ / 9$ = 11111.1111111111

    beforeEach(async function () {
      await bond
        .connect(alice)
        .deposit(nonStablePrincipal.address, amount1, maxPrice, fiveDays);
      await bond
        .connect(alice)
        .deposit(nonStablePrincipal.address, amount1, maxPrice, fiveDays);
      await bond
        .connect(bob)
        .deposit(nonStablePrincipal.address, amount2, maxPrice, oneWeeks);
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
      expect(result1[0][0].principal).equal(nonStablePrincipal.address);
      expect(result1[0][0].payout).equal(payout1);
      expect(result1[0][0].vesting).equal(fiveDays);
      expect(result1[0][0].pricePaid).equal(950000000);
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

  describe('#deposit lp principal', () => {
    const maxPrice = 30000000000;
    const amount1 = utils.parseEther('10000');
    const payout1 = BigNumber.from('1052631578947368421052631578'); // 10000 * 1000000$ / 9.5$ = 1052631578.9473684
    const amount2 = utils.parseEther('5000');
    const payout2 = BigNumber.from('555555555555555555555555555'); // 5000 * 1000000$ / 9$ = 5555555555555556

    it('invalid user locking period', async function () {
      let lockingPeriod = 24 * 3600; // 1 day lock

      await expect(
        bond
          .connect(alice)
          .deposit(lpPrincipal.address, amount1, maxPrice, lockingPeriod)
      ).to.be.revertedWith('Invalid locking period');
    });

    it('payout with locking period', async function () {
      const tx = await bond
        .connect(alice)
        .deposit(lpPrincipal.address, amount1, maxPrice, fiveDays);
      const reciept = await tx.wait();

      const info = await bond.bondInfo(1);
      expect(info.depositId).equal(BigNumber.from(1));
      expect(info.principal).equal(lpPrincipal.address);
      expect(info.amount).equal(amount1);
      expect(info.payout).equal(payout1);
      expect(info.vesting).equal(fiveDays);
      expect(info.lastBlockAt).equal(
        (await ethers.provider.getBlock(reciept.blockNumber)).timestamp
      );
      expect(info.pricePaid).equal(950000000); // 9.5$
      expect(info.depositor).equal(alice.address);

      expect(await bond.totalRemainingPayout()).equal(payout1);
    });

    it('payout with locking period - two times', async function () {
      await bond
        .connect(alice)
        .deposit(lpPrincipal.address, amount1, maxPrice, fiveDays);

      const tx = await bond
        .connect(alice)
        .deposit(lpPrincipal.address, amount2, maxPrice, oneWeeks);
      const reciept = await tx.wait();

      const info = await bond.bondInfo(2);
      expect(info.depositId).equal(BigNumber.from(2));
      expect(info.principal).equal(lpPrincipal.address);
      expect(info.amount).equal(amount2);
      expect(info.payout).equal(payout2);
      expect(info.vesting).equal(oneWeeks);
      expect(info.lastBlockAt).equal(
        (await ethers.provider.getBlock(reciept.blockNumber)).timestamp
      );
      expect(info.pricePaid).equal(900000000); // 9$
      expect(info.depositor).equal(alice.address);

      expect(await bond.totalRemainingPayout()).equal(payout1.add(payout2));
    });

    it('all bond infos with pendingPayoutFor', async function () {
      await bond
        .connect(alice)
        .deposit(lpPrincipal.address, amount1, maxPrice, fiveDays);
      await bond
        .connect(alice)
        .deposit(lpPrincipal.address, amount2, maxPrice, oneWeeks);

      await increaseTime(fiveDays.toNumber());

      const result = await bond.allBondInfos(alice.address);

      expect(result[0][0].depositId).equal(BigNumber.from(1));
      expect(result[0][0].principal).equal(lpPrincipal.address);
      expect(result[0][0].payout).equal(payout1);
      expect(result[0][0].vesting).equal(fiveDays);
      expect(result[0][0].pricePaid).equal(950000000);
      expect(result[0][0].depositor).equal(alice.address);
      expect(result[0][1].depositId).equal(BigNumber.from(2));
      expect(result[0][1].principal).equal(lpPrincipal.address);
      expect(result[0][1].payout).equal(payout2);
      expect(result[0][1].vesting).equal(oneWeeks);
      expect(result[0][1].pricePaid).equal(900000000);
      expect(result[0][1].depositor).equal(alice.address);

      const percent = fiveDays.mul(10000).div(oneWeeks);
      expect(await bond.percentVestedFor(2)).equal(percent);

      expect(result[1][0]).equal(payout1);
      expect(result[1][1]).equal(payout2.mul(percent).div(10000));
    });
  });

  describe('#redeem for lp principal', () => {
    const maxPrice = 30000000000;
    const amount1 = utils.parseEther('10000');
    const payout1 = BigNumber.from('1052631578947368421052631578'); // 10000 * 1000000$ / 9.5$ = 1052631578.9473684
    const amount2 = utils.parseEther('5000');
    const payout2 = BigNumber.from('555555555555555555555555555'); // 5000 * 1000000$ / 9$ = 5555555555555556

    beforeEach(async function () {
      await bond
        .connect(alice)
        .deposit(lpPrincipal.address, amount1, maxPrice, fiveDays);
      await bond
        .connect(alice)
        .deposit(lpPrincipal.address, amount1, maxPrice, fiveDays);
      await bond
        .connect(bob)
        .deposit(lpPrincipal.address, amount2, maxPrice, oneWeeks);
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
      expect(result1[0][0].principal).equal(lpPrincipal.address);
      expect(result1[0][0].payout).equal(payout1);
      expect(result1[0][0].vesting).equal(fiveDays);
      expect(result1[0][0].pricePaid).equal(950000000);
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
        .deposit(stablePrincipal.address, amount1, maxPrice, fiveDays);
      await bond
        .connect(alice)
        .deposit(stablePrincipal.address, amount1, maxPrice, fiveDays);
      await bond
        .connect(bob)
        .deposit(stablePrincipal.address, amount2, maxPrice, oneWeeks);
    });

    it('token balances for feeRecipients in fee: 10%', async function () {
      // (10000 + 10000 + 5000) * 10% = 2500
      const result1 = await bond.tokenBalances(
        stablePrincipal.address,
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
        stablePrincipal.address,
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
      await bond.claimFund(stablePrincipal.address);
      await bond.claimFee(stablePrincipal.address, feeRecipient1.address);
      await bond.claimFee(stablePrincipal.address, feeRecipient2.address);

      expect(await stablePrincipal.balanceOf(feeRecipient1.address)).equal(
        amount1
          .add(amount1)
          .add(amount2)
          .mul(feeBps)
          .div(10000)
          .mul(feeWeightBps1)
          .div(10000)
      );
      expect(await stablePrincipal.balanceOf(feeRecipient2.address)).equal(
        amount1
          .add(amount1)
          .add(amount2)
          .mul(feeBps)
          .div(10000)
          .mul(feeWeightBps2)
          .div(10000)
      );

      expect(
        await bond.tokenBalances(stablePrincipal.address, feeRecipient1.address)
      ).equal(constants.Zero);
      expect(
        await bond.tokenBalances(stablePrincipal.address, feeRecipient2.address)
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
        .deposit(stablePrincipal.address, amount1, maxPrice, fiveDays);
      await bond
        .connect(alice)
        .deposit(stablePrincipal.address, amount1, maxPrice, fiveDays);
      await bond
        .connect(bob)
        .deposit(stablePrincipal.address, amount2, maxPrice, oneWeeks);
    });

    it('token balances for fundRecipient in fee: 10%', async function () {
      // (10000 + 10000 + 5000) * (100% - 10%) = 22500
      const result = await bond.tokenBalances(
        stablePrincipal.address,
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
      await bond.claimFee(stablePrincipal.address, feeRecipient1.address);
      await bond.claimFee(stablePrincipal.address, feeRecipient2.address);
      await bond.claimFund(stablePrincipal.address);

      expect(await stablePrincipal.balanceOf(fundRecipient.address)).equal(
        amount1
          .add(amount1)
          .add(amount2)
          .mul(10000 - feeBps.toNumber())
          .div(10000)
      );

      expect(
        await bond.tokenBalances(stablePrincipal.address, fundRecipient.address)
      ).equal(constants.Zero);
    });
  });

  describe('#autostaking', () => {
    const maxPrice = 30000000000;
    const amount1 = utils.parseEther('10000');
    const payout1 = BigNumber.from('1052631578947368421052'); // 10000 * 1000000$ / 9.5$ = 1052631578.9473684    const rewardAmount1 = BigNumber.from('61891658926315');
    const rewardAmount1 = BigNumber.from('61890596682105');
    const autoStakingFeeAmount1 = BigNumber.from('6189059668210');
    const amount2 = utils.parseEther('5000');
    const payout2 = BigNumber.from('555555555555555555555'); // 5000 * 1000000$ / 9$ = 5555555555555556
    const rewardAmount2 = BigNumber.from('32782725133333');
    const autoStakingFeeAmount2 = BigNumber.from('3278272513333');

    beforeEach(async function () {
      await bond.toggleAutoStaking(); // enable auto staking

      await bond
        .connect(alice)
        .deposit(stablePrincipal.address, amount1, maxPrice, fiveDays);
      await bond
        .connect(alice)
        .deposit(stablePrincipal.address, amount1, maxPrice, fiveDays);
      await bond
        .connect(bob)
        .deposit(stablePrincipal.address, amount2, maxPrice, oneWeeks);
      await increaseTime(fiveDays.toNumber());
      await emissionor.emitReward();
      await increaseTime(oneWeeks.toNumber());
      await emissionor.emitReward();
    });

    it('bondInfoFor', async function () {
      const result1 = await bond.bondInfoFor(1);
      expect(result1[0].stake).equal(true);
      expect(result1[0].fnftId).equal(BigNumber.from(0));
      expect(result1[1]).equal(payout1);
      expect(result1[2]).equal(rewardAmount1);

      const result2 = await bond.bondInfoFor(2);
      expect(result2[0].stake).equal(true);
      expect(result2[0].fnftId).equal(BigNumber.from(1));
      expect(result2[1]).equal(payout1);
      expect(result2[2]).equal(rewardAmount1);

      const result3 = await bond.bondInfoFor(3);
      expect(result3[0].stake).equal(true);
      expect(result3[0].fnftId).equal(BigNumber.from(2));
      expect(result3[1]).equal(payout2);
      expect(result3[2]).equal(rewardAmount2);
    });

    it('redeem', async function () {
      await bond.connect(alice).redeem(1);
      expect(await rewardToken.balanceOf(alice.address)).equal(
        rewardAmount1.sub(autoStakingFeeAmount1)
      );
      expect(
        await bond.tokenBalances(
          rewardToken.address,
          autoStakingFeeRecipient.address
        )
      ).equal(autoStakingFeeAmount1);

      await bond.connect(alice).redeem(2);
      expect(await rewardToken.balanceOf(alice.address)).equal(
        rewardAmount1.sub(autoStakingFeeAmount1).mul(2)
      );
      expect(
        await bond.tokenBalances(
          rewardToken.address,
          autoStakingFeeRecipient.address
        )
      ).equal(autoStakingFeeAmount1.mul(2));

      await bond.connect(bob).redeem(3);
      expect(await rewardToken.balanceOf(bob.address)).equal(
        rewardAmount2.sub(autoStakingFeeAmount2)
      );
      expect(
        await bond.tokenBalances(
          rewardToken.address,
          autoStakingFeeRecipient.address
        )
      ).equal(autoStakingFeeAmount1.mul(2).add(autoStakingFeeAmount2));
    });

    it('redeem with non auto staking', async function () {
      await bond.toggleAutoStaking(); // disable auto staking

      await bond
        .connect(bob)
        .deposit(stablePrincipal.address, amount1, maxPrice, fiveDays);
      await increaseTime(fiveDays.toNumber());

      await bond.connect(bob).redeem(4);
      expect(await rewardToken.balanceOf(bob.address)).equal(constants.Zero);
      expect(
        await bond.tokenBalances(
          rewardToken.address,
          autoStakingFeeRecipient.address
        )
      ).equal(constants.Zero);
    });

    // it('claim reward', async function () {
    //   await bond.connect(alice).claim(1);

    //   expect(await rewardToken.balanceOf(alice.address)).equal(
    //     rewardAmount1.sub(autoStakingFeeAmount1)
    //   );
    //   expect(
    //     await bond.tokenBalances(
    //       rewardToken.address,
    //       autoStakingFeeRecipient.address
    //     )
    //   ).equal(autoStakingFeeAmount1);
    // });

    it('claimAutoStakingFee', async function () {
      await bond.connect(alice).redeem(1);
      await bond.connect(alice).redeem(2);
      await bond.connect(bob).redeem(3);
      await bond.claimAutoStakingFee();

      expect(
        await rewardToken.balanceOf(autoStakingFeeRecipient.address)
      ).equal(autoStakingFeeAmount1.mul(2).add(autoStakingFeeAmount2));
    });
  });

  describe('#nonautostaking', () => {
    const maxPrice = 30000000000;
    const amount1 = utils.parseEther('5000');
    const payout1 = BigNumber.from('555555555555555555555'); // 5000 * 1000000$ / 9$ = 5555555555555556

    beforeEach(async function () {
      await bond.toggleAutoStaking(); // enable auto staking
      await bond.setLockingDiscount(180, oneWeeksDiscount); // 3 minutes lock

      await bond
        .connect(alice)
        .deposit(stablePrincipal.address, amount1, maxPrice, 180);
      await increaseTime(fiveDays.toNumber());
      await emissionor.emitReward();
      await increaseTime(oneWeeks.toNumber());
      await emissionor.emitReward();
    });

    it('lockedStakeMinTime', async function () {
      expect(await bond.lockedStakeMinTime()).equal(
        await lockFarm.lockedStakeMinTime()
      );
    });

    it('deposit short period', async function () {
      const result = await bond.bondInfoFor(1);
      expect(result[0].stake).equal(false);
      expect(result[0].fnftId).equal(BigNumber.from(0));
      expect(result[1]).equal(payout1);
      expect(result[2]).equal(BigNumber.from(0));

      // await bond.connect(alice).claim(1);
      // expect(await rewardToken.balanceOf(alice.address)).equal(constants.Zero);

      await bond.connect(alice).redeem(1);
      expect(await rewardToken.balanceOf(alice.address)).equal(constants.Zero);
      expect(await hectorToken.balanceOf(alice.address)).equal(payout1);
    });
  });
});
