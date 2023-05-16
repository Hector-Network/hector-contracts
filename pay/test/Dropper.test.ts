import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { BigNumber, utils } from 'ethers';
import { increaseTime, getTimeStamp } from './../helper';
import {
  HectorSubscriptionFactory,
  HectorSubscription,
  HectorDropperFactory,
  HectorDropper,
  RewardToken,
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

  let hectorSubscriptionFactory: HectorSubscriptionFactory;
  let hectorSubscriptionLogic: HectorSubscription;
  let hectorSubscription: HectorSubscription;
  let product = 'TestProduct';
  let productBytes = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(product));

  let hectorDropperFactory: HectorDropperFactory;
  let hectorDropperLogic: HectorDropper;
  let hectorDropper: HectorDropper;

  let hectorDropperValidator: HectorDropperValidator;

  let oneHour = 3600 * 1;
  let twoHour = 3600 * 2;

  let fee = ethers.utils.parseEther('10');
  let amount0 = ethers.utils.parseEther('100');
  let amount1 = ethers.utils.parseEther('200');

  let limitForFree = 1;
  let limitForOneHour = 2;
  let limitForTwoHour = ethers.constants.MaxUint256;

  this.beforeEach(async function () {
    [deployer, upgradeableAdmin, from, to0, to1, to2, treasury] =
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
    await upgrades.silenceWarnings();
    hectorSubscriptionFactory = (await upgrades.deployProxy(
      HectorSubscriptionFactory,
      [hectorSubscriptionLogic.address, upgradeableAdmin.address],
      {
        unsafeAllow: ['delegatecall'],
      }
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
      .deposit(hectorToken.address, amount0);
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
