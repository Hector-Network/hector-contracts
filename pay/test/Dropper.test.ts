import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { utils } from 'ethers';
import { increaseTime, getTimeStamp } from './../helper';
import {
  HectorSubscriptionV2Factory,
  HectorSubscriptionV2,
  HectorDropperFactory,
  HectorDropper,
  RewardToken,
  HectorRefund,
  PriceOracleAggregator,
  MockOracle,
  HectorCoupon,
  HectorDropperValidator,
} from '../types';

describe('HectorDropper', function () {
  let deployer: SignerWithAddress;
  let upgradeableAdmin: SignerWithAddress;
  let from: SignerWithAddress;
  let to0: SignerWithAddress;
  let to1: SignerWithAddress;
  let to2: SignerWithAddress;
  let treasury: SignerWithAddress;

  let hectorToken: RewardToken;
  let torToken: RewardToken;

  let hectorCoupon: HectorCoupon;
  let hectorRefund: HectorRefund;
  let priceOracleAggregator: PriceOracleAggregator;

  let hectorSubscriptionFactory: HectorSubscriptionV2Factory;
  let hectorSubscriptionLogic: HectorSubscriptionV2;
  let hectorSubscription: HectorSubscriptionV2;

  let product = 'TestProduct';
  let productBytes = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(product));

  let hectorDropperFactory: HectorDropperFactory;
  let hectorDropperLogic: HectorDropper;
  let hectorDropper: HectorDropper;

  let hectorDropperValidator: HectorDropperValidator;

  let oneHour = 3600 * 1;
  let twoHour = 3600 * 2;

  let fee = ethers.utils.parseEther('10');

  let priceOne = ethers.utils.parseUnits('100', 8); // 100$
  let priceTwo = ethers.utils.parseUnits('200', 8); // 200$

  let hectorPrice = ethers.utils.parseUnits('10', 8); // 10$
  let torPrice = ethers.utils.parseUnits('1', 8); // 1$

  let hectorAmount = ethers.utils.parseEther(
    priceOne.div(hectorPrice).toString()
  );
  let torAmount = ethers.utils.parseEther(priceTwo.div(torPrice).toString());

  let limitForFree = 1;
  let limitForOneHour = 2;
  let limitForTwoHour = ethers.constants.MaxUint256;

  this.beforeEach(async function () {
    [deployer, upgradeableAdmin, from, to0, to1, to2, treasury] =
      await ethers.getSigners();

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
        data: ethers.utils.defaultAbiCoder.encode(
          ['uint256', 'uint256'],
          [0, limitForOneHour]
        ),
      },
      {
        token: torToken.address,
        period: twoHour,
        price: priceTwo,
        data: ethers.utils.defaultAbiCoder.encode(
          ['uint256', 'uint256'],
          [0, limitForTwoHour]
        ),
      },
    ]);

    await hectorSubscription.updatePlan(
      [0],
      [
        {
          token: ethers.constants.AddressZero,
          period: 0,
          price: 0,
          data: ethers.utils.defaultAbiCoder.encode(
            ['uint256', 'uint256'],
            [0, limitForFree]
          ),
        },
      ]
    );

    /// Dropper ///
    const HectorDropper = await ethers.getContractFactory('HectorDropper');
    hectorDropperLogic = (await HectorDropper.deploy()) as HectorDropper;

    const HectorDropperFactory = await ethers.getContractFactory(
      'HectorDropperFactory'
    );
    await upgrades.silenceWarnings();
    hectorDropperFactory = (await upgrades.deployProxy(
      HectorDropperFactory,
      [
        hectorDropperLogic.address,
        upgradeableAdmin.address,
        treasury.address,
        fee,
      ],
      {
        unsafeAllow: ['delegatecall'],
      }
    )) as HectorDropperFactory;

    await hectorDropperFactory.createHectorDropperContract(hectorToken.address);
    hectorDropper = (await ethers.getContractAt(
      'HectorDropper',
      await hectorDropperFactory.getHectorDropperContractByToken(
        hectorToken.address
      )
    )) as HectorDropper;

    /// Validator ///
    const HectorDropperValidator = await ethers.getContractFactory(
      'HectorDropperValidator'
    );
    hectorDropperValidator = (await HectorDropperValidator.deploy(
      hectorSubscription.address
    )) as HectorDropperValidator;

    hectorDropperFactory.setValidator(hectorDropperValidator.address);

    /// TOKEN ///
    await hectorToken.mint(from.address, utils.parseEther('200000000000000'));
    await torToken.mint(from.address, utils.parseEther('200000000000000'));

    await hectorToken
      .connect(from)
      .approve(hectorSubscription.address, utils.parseEther('200000000000000'));
    await hectorToken
      .connect(from)
      .approve(hectorDropper.address, utils.parseEther('200000000000000'));

    await torToken
      .connect(from)
      .approve(hectorSubscription.address, utils.parseEther('200000000000000'));
    await torToken
      .connect(from)
      .approve(hectorDropper.address, utils.parseEther('200000000000000'));

    /// CREATE SUBSCRIPTION ///
    await hectorSubscription
      .connect(from)
      .deposit(hectorToken.address, hectorAmount);
    await hectorSubscription.connect(from).createSubscription(1);
  });

  describe('#factory', () => {
    it('logic', async function () {
      expect(await hectorDropperFactory.hectorDropperLogic()).equal(
        hectorDropperLogic.address
      );
    });
    it('upgradeable admin', async function () {
      expect(await hectorDropperFactory.upgradeableAdmin()).equal(
        upgradeableAdmin.address
      );
    });
    it('dropper validator', async function () {
      expect(await hectorDropperFactory.validator()).equal(
        hectorDropperValidator.address
      );
    });
    it('treasury', async function () {
      expect(await hectorDropperFactory.treasury()).equal(treasury.address);
    });
    it('fee', async function () {
      expect(await hectorDropperFactory.fee()).equal(fee);
    });
    it('dropper contract', async function () {
      expect(
        await hectorDropperFactory.getHectorDropperContractByIndex(0)
      ).equal(hectorDropper.address);
      expect(
        await hectorDropperFactory.getHectorDropperContractByToken(
          hectorToken.address
        )
      ).equal(hectorDropper.address);
    });
    it('is deployed', async function () {
      expect(
        await hectorDropperFactory.isDeployedHectorDropperContractByToken(
          hectorToken.address
        )
      ).equal(true);
      expect(
        await hectorDropperFactory.isDeployedHectorDropperContractByToken(
          torToken.address
        )
      ).equal(false);
    });
  });

  describe('#dropper', () => {
    it('token', async function () {
      expect(await hectorDropper.token()).equal(hectorToken.address);
    });
    it('factory', async function () {
      expect(await hectorDropper.factory()).equal(hectorDropperFactory.address);
    });
  });

  describe('#dropper - create', () => {
    let amountPerRecipient = ethers.utils.parseEther('100');
    let releaseTime = 0;
    let index = 0;
    let oneRecipients: string[] = [];
    let twoRecipients: string[] = [];
    let threeRecipients: string[] = [];

    beforeEach(async function () {
      releaseTime = (await getTimeStamp()) + oneHour;
      oneRecipients = [to0.address];
      twoRecipients = [to0.address, to1.address];
      threeRecipients = [to0.address, to1.address, to2.address];
    });

    it('create airdrop', async function () {
      let oldBalance = await hectorToken.balanceOf(from.address);
      let tx = await hectorDropper
        .connect(from)
        .createAirdrop(twoRecipients, amountPerRecipient, releaseTime, {
          value: fee,
        });
      let newBalance = await hectorToken.balanceOf(from.address);

      await expect(tx)
        .to.emit(hectorDropper, 'AirdropCreated')
        .withArgs(
          from.address,
          twoRecipients,
          amountPerRecipient,
          releaseTime,
          index
        );

      expect(oldBalance.sub(newBalance)).equal(
        amountPerRecipient.mul(twoRecipients.length)
      );
      expect(await hectorToken.balanceOf(hectorDropper.address)).equal(
        amountPerRecipient.mul(twoRecipients.length)
      );

      let info = await hectorDropper.airdrops(from.address, index);
      expect(info.from).equal(from.address);
      expect(info.amountPerRecipient).equal(amountPerRecipient);
      expect(info.releaseTime).equal(releaseTime);
      expect(info.status).equal(0);
    });

    it('create airdrop with reason', async function () {
      let reason = 'test';
      let tx = await hectorDropper
        .connect(from)
        .createAirdropWithReason(
          twoRecipients,
          amountPerRecipient,
          releaseTime,
          reason,
          {
            value: fee,
          }
        );

      await expect(tx)
        .to.emit(hectorDropper, 'AirdropCreatedWithReason')
        .withArgs(
          from.address,
          twoRecipients,
          amountPerRecipient,
          releaseTime,
          index,
          reason
        );

      let info = await hectorDropper.airdrops(from.address, index);
      expect(info.from).equal(from.address);
      expect(info.amountPerRecipient).equal(amountPerRecipient);
      expect(info.releaseTime).equal(releaseTime);
      expect(info.status).equal(0);
    });

    it('create airdrop with insufficient fee', async function () {
      await expect(
        hectorDropper
          .connect(from)
          .createAirdrop(twoRecipients, amountPerRecipient, releaseTime)
      ).to.be.revertedWith('INSUFFICIENT_FEE()');

      await expect(
        hectorDropper
          .connect(from)
          .createAirdrop(twoRecipients, amountPerRecipient, releaseTime, {
            value: fee.sub(1),
          })
      ).to.be.revertedWith('INSUFFICIENT_FEE()');
    });

    it('create airdrop with insufficnet allowance fund', async function () {
      await hectorToken.connect(from).approve(hectorDropper.address, 0);
      await expect(
        hectorDropper
          .connect(from)
          .createAirdrop(twoRecipients, amountPerRecipient, releaseTime, {
            value: fee,
          })
      ).to.be.revertedWith('ERC20: transfer amount exceeds allowance');
    });

    it('create airdrop with insufficnet balance fund', async function () {
      await hectorToken
        .connect(from)
        .transfer(to0.address, await hectorToken.balanceOf(from.address));
      await expect(
        hectorDropper
          .connect(from)
          .createAirdrop(twoRecipients, amountPerRecipient, releaseTime, {
            value: fee,
          })
      ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
    });

    it('create airdrop with invalid amount per recipient', async function () {
      await expect(
        hectorDropper
          .connect(from)
          .createAirdrop(twoRecipients, 0, releaseTime, {
            value: fee,
          })
      ).to.be.revertedWith('INVALID_AMOUNT()');
    });

    it('create airdrop with invalid release time', async function () {
      await expect(
        hectorDropper
          .connect(from)
          .createAirdrop(
            twoRecipients,
            amountPerRecipient,
            releaseTime - twoHour,
            {
              value: fee,
            }
          )
      ).to.be.revertedWith('INVALID_TIME()');
    });

    it('create airdrop with empty recipient address', async function () {
      await expect(
        hectorDropper
          .connect(from)
          .createAirdrop([], amountPerRecipient, releaseTime, {
            value: fee,
          })
      ).to.be.revertedWith('INVALID_LENGTH()');
    });

    it('create airdrop with invalid recipient address', async function () {
      await expect(
        hectorDropper
          .connect(from)
          .createAirdrop(
            [ethers.constants.AddressZero],
            amountPerRecipient,
            releaseTime,
            {
              value: fee,
            }
          )
      ).to.be.revertedWith('INVALID_ADDRESS()');
    });
  });

  describe('#dropper - cancel', () => {
    let amountPerRecipient = ethers.utils.parseEther('100');
    let releaseTime = 0;
    let index = 0;
    let oneRecipients: string[] = [];
    let twoRecipients: string[] = [];
    let threeRecipients: string[] = [];

    beforeEach(async function () {
      releaseTime = (await getTimeStamp()) + oneHour;
      oneRecipients = [to0.address];
      twoRecipients = [to0.address, to1.address];
      threeRecipients = [to0.address, to1.address, to2.address];

      await hectorDropper
        .connect(from)
        .createAirdrop(twoRecipients, amountPerRecipient, releaseTime, {
          value: fee,
        });
    });

    it('cancel airdrop', async function () {
      let oldBalance = await hectorToken.balanceOf(from.address);
      let tx = await hectorDropper.connect(from).cancelAirdrop(index);
      let newBalance = await hectorToken.balanceOf(from.address);

      await expect(tx)
        .to.emit(hectorDropper, 'AirdropCancelled')
        .withArgs(from.address, index);

      expect(newBalance.sub(oldBalance)).equal(
        amountPerRecipient.mul(twoRecipients.length)
      );
      expect(await hectorToken.balanceOf(hectorDropper.address)).equal(
        ethers.constants.Zero
      );

      let info = await hectorDropper.airdrops(from.address, index);
      expect(info.from).equal(from.address);
      expect(info.amountPerRecipient).equal(amountPerRecipient);
      expect(info.releaseTime).equal(releaseTime);
      expect(info.status).equal(2);
    });

    it('cancel cancelled airdrop', async function () {
      await hectorDropper.connect(from).cancelAirdrop(index);

      await expect(
        hectorDropper.connect(from).cancelAirdrop(index)
      ).to.be.revertedWith('INACTIVE_AIRDROP()');
    });

    it('cancel released airdrop', async function () {
      await increaseTime(twoHour);
      await hectorDropper.connect(from).releaseAirdrop(from.address, index);

      await expect(
        hectorDropper.connect(from).cancelAirdrop(index)
      ).to.be.revertedWith('INACTIVE_AIRDROP()');
    });

    it('cancel not created airdrop', async function () {
      await expect(
        hectorDropper.connect(from).cancelAirdrop(index + 1)
      ).to.be.revertedWith('INVALID_INDEX()');
    });
  });

  describe('#dropper - release', () => {
    let amountPerRecipient = ethers.utils.parseEther('100');
    let releaseTime = 0;
    let index = 0;
    let oneRecipients: string[] = [];
    let twoRecipients: string[] = [];
    let threeRecipients: string[] = [];

    beforeEach(async function () {
      releaseTime = (await getTimeStamp()) + oneHour;
      oneRecipients = [to0.address];
      twoRecipients = [to0.address, to1.address];
      threeRecipients = [to0.address, to1.address, to2.address];

      await hectorDropper
        .connect(from)
        .createAirdrop(twoRecipients, amountPerRecipient, releaseTime, {
          value: fee,
        });

      await increaseTime(twoHour);
    });

    it('release airdrop', async function () {
      let oldBalance0 = await hectorToken.balanceOf(to0.address);
      let oldBalance1 = await hectorToken.balanceOf(to1.address);
      let tx = await hectorDropper.releaseAirdrop(from.address, index);
      let newBalance0 = await hectorToken.balanceOf(to0.address);
      let newBalance1 = await hectorToken.balanceOf(to1.address);

      await expect(tx)
        .to.emit(hectorDropper, 'AirdropReleased')
        .withArgs(from.address, index);

      expect(newBalance0.sub(oldBalance0)).equal(amountPerRecipient);
      expect(newBalance1.sub(oldBalance1)).equal(amountPerRecipient);
      expect(await hectorToken.balanceOf(hectorDropper.address)).equal(
        ethers.constants.Zero
      );

      let info = await hectorDropper.airdrops(from.address, index);
      expect(info.from).equal(from.address);
      expect(info.amountPerRecipient).equal(amountPerRecipient);
      expect(info.releaseTime).equal(releaseTime);
      expect(info.status).equal(1);
    });

    it('release cancelled airdrop', async function () {
      await hectorDropper.connect(from).cancelAirdrop(index);

      await expect(
        hectorDropper.releaseAirdrop(from.address, index)
      ).to.be.revertedWith('INACTIVE_AIRDROP()');
    });

    it('release released airdrop', async function () {
      await hectorDropper.connect(from).releaseAirdrop(from.address, index);

      await expect(
        hectorDropper.releaseAirdrop(from.address, index)
      ).to.be.revertedWith('INACTIVE_AIRDROP()');
    });

    it('release not created airdrop', async function () {
      await expect(
        hectorDropper.releaseAirdrop(from.address, index + 1)
      ).to.be.revertedWith('INVALID_INDEX()');
    });

    it('release before release time', async function () {
      releaseTime = (await getTimeStamp()) + twoHour;

      await hectorDropper
        .connect(from)
        .createAirdrop(twoRecipients, amountPerRecipient, releaseTime, {
          value: fee,
        });

      await increaseTime(oneHour);

      await expect(
        hectorDropper.releaseAirdrop(from.address, index + 1)
      ).to.be.revertedWith('NOT_RELEASABLE()');
    });
  });

  describe('#dropper - release multiple', () => {
    let amountPerRecipient = ethers.utils.parseEther('100');
    let releaseTime = 0;
    let index = 0;
    let oneRecipients: string[] = [];
    let twoRecipients: string[] = [];
    let threeRecipients: string[] = [];

    beforeEach(async function () {
      releaseTime = (await getTimeStamp()) + oneHour;
      oneRecipients = [to0.address];
      twoRecipients = [to0.address, to1.address];
      threeRecipients = [to0.address, to1.address, to2.address];

      await hectorDropper
        .connect(from)
        .createAirdrop(oneRecipients, amountPerRecipient, releaseTime, {
          value: fee,
        });

      await hectorDropper
        .connect(from)
        .createAirdrop(twoRecipients, amountPerRecipient, releaseTime, {
          value: fee,
        });

      await increaseTime(twoHour);
    });

    it('release airdrops', async function () {
      await hectorDropperFactory.releaseAirdrops(
        [hectorDropper.address],
        [[from.address, from.address]],
        [[index, index + 1]]
      );

      let info0 = await hectorDropper.airdrops(from.address, index);
      expect(info0.status).equal(1);
      let info1 = await hectorDropper.airdrops(from.address, index + 1);
      expect(info1.status).equal(1);
    });
  });

  describe('#dropper - limiation for purchased plan', () => {
    let amountPerRecipient = ethers.utils.parseEther('100');
    let releaseTime = 0;
    let oneRecipients: string[] = [];
    let twoRecipients: string[] = [];
    let threeRecipients: string[] = [];

    beforeEach(async function () {
      releaseTime = (await getTimeStamp()) + oneHour;
      oneRecipients = [to0.address];
      twoRecipients = [to0.address, to1.address];
      threeRecipients = [to0.address, to1.address, to2.address];
    });

    it('create airdrop for recipients <= limit', async function () {
      await hectorDropper
        .connect(from)
        .createAirdrop(oneRecipients, amountPerRecipient, releaseTime, {
          value: fee,
        });
      await hectorDropper
        .connect(from)
        .createAirdrop(twoRecipients, amountPerRecipient, releaseTime, {
          value: fee,
        });
    });

    it('create airdrop for recipients > limit', async function () {
      await expect(
        hectorDropper
          .connect(from)
          .createAirdrop(threeRecipients, amountPerRecipient, releaseTime, {
            value: fee,
          })
      ).to.be.revertedWith('LIMITED_SUBSCRIPTION()');
    });

    it('create airdrop with free plan', async function () {
      await hectorSubscription.connect(from).cancelSubscription();

      await hectorDropper
        .connect(from)
        .createAirdrop(oneRecipients, amountPerRecipient, releaseTime, {
          value: fee,
        });

      await expect(
        hectorDropper
          .connect(from)
          .createAirdrop(twoRecipients, amountPerRecipient, releaseTime, {
            value: fee,
          })
      ).to.be.revertedWith('LIMITED_SUBSCRIPTION()');
    });
  });
});
