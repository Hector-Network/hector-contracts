import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { waitSeconds } from '../helper/helpers';
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';

async function getImplementationAddress(proxyAddress: string) {
  const implHex = await ethers.provider.getStorageAt(
    proxyAddress,
    '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'
  );
  return ethers.utils.hexStripZeros(implHex);
}

type PlanType = {
  token: string;
  period: number;
  price: BigNumber;
  data: string;
};

const deploySubscription: DeployFunction = async (
  hre: HardhatRuntimeEnvironment
) => {
  const { deployments, ethers } = hre;
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  /// Token Address: Mainnet
  // const hectorTokenAddress = '0x5c4fdfc5233f935f20d2adba572f770c2e377ab0';
  // const torTokenAddress = '0x74e23df9110aa9ea0b6ff2faee01e740ca1c642e';

  /// Token Address: FTM Testnet
  const hectorTokenAddress = '0x55639b1833Ddc160c18cA60f5d0eC9286201f525';
  const torTokenAddress = '0xCe5b1b90a1E1527E8B82a9434266b2d6B72cc70b';
  const usdcTokenAddress = '0x6f3da9C6700cAfBAb0323cF344F58C54B3ddB66b';
  const treasury = '0xBF014a15198EDcFcb2921dE7099BF256DB31c4ba';
  const upgradeableAdmin = '0x45D2a1f4e76523e74EAe9aCE2d765d527433705a';
  const priceOracleAggregatorAddress =
    '0xe847f70474e457f57654755e04f7f4bcfcc64f5f';

  /// Token Address: BSC Testnet
  // const hectorTokenAddress = '0x7400E9838BAD5cfFe1C4dc0236Fce2E725C73d42';
  // const torTokenAddress = '0x205F190776C8d466727bD0Cac6D1B564DC3C8Ea9';
  // const treasury = '0xBF014a15198EDcFcb2921dE7099BF256DB31c4ba';

  /// CONFIGURATION ///

  const LEVEL = {
    Small: 0,
    Medium: 1,
    Large: 2,
  };

  const multiPay = {
    product: 'Hector Multi Pay',
    maxStreamsByLevel: {
      [LEVEL.Small]: 3,
      [LEVEL.Medium]: 10,
      [LEVEL.Large]: 50,
    } as Record<string, number>,
    maxRecipientsByLevel: {
      [LEVEL.Small]: 15,
      [LEVEL.Medium]: 150,
      [LEVEL.Large]: 500,
    } as Record<string, number>,
    discountInUSD: {
      3: [0, 0, 0],
      6: [60, 70, 99],
      12: [160, 190, 249],
    } as Record<string, number[]>,
    pricePerMonthInUSD: [70, 99, 199], // 70$, 99$, 199$
    levels: [LEVEL.Small, LEVEL.Medium, LEVEL.Large],
    months: [3, 6, 12], // 3 months, 6 months, 12 months
    tokens: [hectorTokenAddress, torTokenAddress, usdcTokenAddress], // HEC, TOR, USDC
    plans: [] as PlanType[],
  };

  const taxReport = {
    product: 'Hector Tax Report',
    discountInUSD: {
      3: [0],
      6: [5],
      12: [15],
    } as Record<string, number[]>,
    pricePerMonthInUSD: [5], // 5$
    levels: [LEVEL.Small],
    months: [3, 6, 12], // 3 months, 6 months, 12 months
    tokens: [hectorTokenAddress, torTokenAddress], // HEC, TOR
    plans: [] as PlanType[],
    refunds: {
      planIds: [1, 2, 3, 4, 5, 6],
      refunds: [
        // 3 months subscription
        [
          { limitPeriod: 3600 * 24 * 15, percent: 10000 }, // 0 ~ 15 days, 150 available for refund (100%)
          { limitPeriod: 3600 * 24 * 30, percent: 6666 }, // 15 ~ 30 days, 100 available for refund (66.66%)
          { limitPeriod: 3600 * 24 * 60, percent: 3333 }, // 30 ~ 60 days, 50 available for refund (33.33%)
        ],
        [
          { limitPeriod: 3600 * 24 * 15, percent: 10000 }, // 0 ~ 15 days, 150 available for refund (100%)
          { limitPeriod: 3600 * 24 * 30, percent: 6666 }, // 15 ~ 30 days, 100 available for refund (66.66%)
          { limitPeriod: 3600 * 24 * 60, percent: 3333 }, // 30 ~ 60 days, 50 available for refund (33.33%)
        ],
        // 6 months subscription
        [
          { limitPeriod: 3600 * 24 * 30, percent: 10000 }, // 0 ~ 30 days, 250 available for refund (100%)
          { limitPeriod: 3600 * 24 * 60, percent: 6666 }, // 30 ~ 60 days, 166 available for refund (66.66%)
          { limitPeriod: 3600 * 24 * 120, percent: 3333 }, // 60 ~ 120 days, 83 available for refund (33.33%)
        ],
        [
          { limitPeriod: 3600 * 24 * 30, percent: 10000 }, // 0 ~ 30 days, 250 available for refund (100%)
          { limitPeriod: 3600 * 24 * 60, percent: 6666 }, // 30 ~ 60 days, 166 available for refund (66.66%)
          { limitPeriod: 3600 * 24 * 120, percent: 3333 }, // 60 ~ 120 days, 83 available for refund (33.33%)
        ],
        // 12 months subscription
        [
          { limitPeriod: 3600 * 24 * 60, percent: 10000 }, // 0 ~ 60 days, 450 available for refund (100%)
          { limitPeriod: 3600 * 24 * 120, percent: 6666 }, // 60 ~ 120 days, 300 available for refund (66.66%)
          { limitPeriod: 3600 * 24 * 240, percent: 3333 }, // 120 ~ 240 days, 150 available for refund (33.33%)
        ],
        [
          { limitPeriod: 3600 * 24 * 60, percent: 10000 }, // 0 ~ 60 days, 450 available for refund (100%)
          { limitPeriod: 3600 * 24 * 120, percent: 6666 }, // 60 ~ 120 days, 300 available for refund (66.66%)
          { limitPeriod: 3600 * 24 * 240, percent: 3333 }, // 120 ~ 240 days, 150 available for refund (33.33%)
        ],
      ],
    },
  };

  {
    for (let product of [multiPay, taxReport]) {
      for (let level of product.levels) {
        for (let month of product.months) {
          for (let token of product.tokens) {
            product.plans.push({
              token: token,
              period: 2_592_000 * month,
              price: ethers.utils.parseUnits(
                (
                  product.pricePerMonthInUSD[level] * month -
                  product.discountInUSD[month]![level]
                ).toString(),
                8
              ),
              data:
                product == multiPay
                  ? ethers.utils.defaultAbiCoder.encode(
                      ['uint256', 'uint256'],
                      [
                        product.maxStreamsByLevel[level],
                        product.maxRecipientsByLevel[level],
                      ]
                    )
                  : '0x00',
            });
          }
        }
      }
    }
  }

  const discounts = {
    tokens: [hectorTokenAddress, torTokenAddress],
    discounts: [
      1000, // HEC: 10% discount
      0, // TOR: 0% discount
    ],
  };

  /// COUPON ///
  const hectorCoupon = await deploy('HectorCoupon', {
    from: deployer.address,
    args: [],
    log: true,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        methodName: 'initialize',
        args: [],
      },
    },
  });
  const hectorCouponImplementation = await getImplementationAddress(
    hectorCoupon.address
  );

  /// REFUND ///
  const hectorRefund = await deploy('HectorRefund', {
    from: deployer.address,
    args: [],
    log: true,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        methodName: 'initialize',
        args: [],
      },
    },
  });
  const hectorRefundImplementation = await getImplementationAddress(
    hectorRefund.address
  );
  const hectorRefundContract = await ethers.getContract(
    'HectorRefund',
    deployer
  );

  await (
    await hectorRefundContract.appendRefund(
      taxReport.product,
      taxReport.refunds.planIds,
      taxReport.refunds.refunds
    )
  ).wait();

  /// DISCOUNT ///
  const hectorDiscount = await deploy('HectorDiscount', {
    from: deployer.address,
    args: [],
    log: true,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        methodName: 'initialize',
        args: [],
      },
    },
  });
  const hectorDiscountImplementation = await getImplementationAddress(
    hectorDiscount.address
  );
  const hectorDiscountContract = await ethers.getContract(
    'HectorDiscount',
    deployer
  );

  await (
    await hectorDiscountContract.appendDiscount(
      discounts.tokens,
      discounts.discounts
    )
  ).wait();

  /// SUBSCRIPTION ///
  const subscriptionLogic = await deploy('HectorSubscriptionV2', {
    from: deployer.address,
    args: [],
    log: true,
  });

  const subscriptionParams = [
    subscriptionLogic.address,
    upgradeableAdmin,
    hectorCoupon.address,
    hectorRefund.address,
    hectorDiscount.address,
    priceOracleAggregatorAddress,
  ];
  const subscriptionFactory = await deploy('HectorSubscriptionV2Factory', {
    from: deployer.address,
    args: [],
    log: true,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        methodName: 'initialize',
        args: subscriptionParams,
      },
    },
  });
  const subscriptionFactoryImplementation = await getImplementationAddress(
    subscriptionFactory.address
  );
  const subscriptionFactoryContract = await ethers.getContract(
    'HectorSubscriptionV2Factory',
    deployer
  );

  /// MULTI PAY SUBSCRIPTION ///
  if (
    (await subscriptionFactoryContract.isDeployedHectorSubscriptionContractByProduct(
      multiPay.product
    )) == false
  ) {
    await (
      await subscriptionFactoryContract.createHectorSubscriptionContract(
        multiPay.product,
        treasury
      )
    ).wait();

    const paySubscription =
      await subscriptionFactoryContract.getHectorSubscriptionContractByName(
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes(multiPay.product))
      );
    const paySubscriptionContract = await ethers.getContractAt(
      'HectorSubscriptionV2',
      paySubscription,
      deployer
    );

    await (await paySubscriptionContract.appendPlan(multiPay.plans)).wait();
  }

  /// TAX REPORT SUBSCRIPTION ///
  if (
    (await subscriptionFactoryContract.isDeployedHectorSubscriptionContractByProduct(
      taxReport.product
    )) == false
  ) {
    await (
      await subscriptionFactoryContract.createHectorSubscriptionContract(
        taxReport.product,
        treasury
      )
    ).wait();

    const taxSubscription =
      await subscriptionFactoryContract.getHectorSubscriptionContractByName(
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes(taxReport.product))
      );
    const taxSubscriptionContract = await ethers.getContractAt(
      'HectorSubscriptionV2',
      taxSubscription,
      deployer
    );

    await (await taxSubscriptionContract.appendPlan(taxReport.plans)).wait();
  }

  /// VERIFY ///
  if (hre.network.name !== 'localhost' && hre.network.name !== 'hardhat') {
    await waitSeconds(10);
    console.log('=====> Verifing ....');
    try {
      await hre.run('verify:verify', {
        address: subscriptionFactoryImplementation,
        contract:
          'contracts/HectorPay/subscription_v2/HectorSubscriptionV2Factory.sol:HectorSubscriptionV2Factory',
        constructorArguments: [],
      });
    } catch (_) {}

    await waitSeconds(10);
    try {
      await hre.run('verify:verify', {
        address: subscriptionLogic.address,
        contract:
          'contracts/HectorPay/subscription_v2/HectorSubscriptionV2.sol:HectorSubscriptionV2',
        constructorArguments: [],
      });
    } catch (_) {}

    await waitSeconds(10);
    try {
      await hre.run('verify:verify', {
        address: hectorCouponImplementation,
        contract: 'contracts/HectorPay/coupon/HectorCoupon.sol:HectorCoupon',
        constructorArguments: [],
      });
    } catch (_) {}

    await waitSeconds(10);
    try {
      await hre.run('verify:verify', {
        address: hectorRefundImplementation,
        contract: 'contracts/HectorPay/refund/HectorRefund.sol:HectorRefund',
        constructorArguments: [],
      });
    } catch (_) {}

    await waitSeconds(10);
    try {
      await hre.run('verify:verify', {
        address: hectorDiscountImplementation,
        contract:
          'contracts/HectorPay/discount/HectorDiscount.sol:HectorDiscount',
        constructorArguments: [],
      });
    } catch (_) {}
  }
};

export default deploySubscription;
deploySubscription.tags = ['SubscriptionV2Test'];
deploySubscription.dependencies = [];
