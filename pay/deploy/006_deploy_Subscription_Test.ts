import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { waitSeconds } from '../helper/helpers';
import { ethers } from 'hardhat';

async function getImplementationAddress(proxyAddress: string) {
  const implHex = await ethers.provider.getStorageAt(
    proxyAddress,
    '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'
  );
  return ethers.utils.hexStripZeros(implHex);
}

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
  const treasury = '0xBF014a15198EDcFcb2921dE7099BF256DB31c4ba';

  /// Token Address: BSC Testnet
  // const hectorTokenAddress = '0x7400E9838BAD5cfFe1C4dc0236Fce2E725C73d42';
  // const torTokenAddress = '0x205F190776C8d466727bD0Cac6D1B564DC3C8Ea9';
  // const treasury = '0xBF014a15198EDcFcb2921dE7099BF256DB31c4ba';

  const hectorMultiPayProduct = 'Hector Multi Pay';
  const hectorTaxReportProduct = 'Hector Tax Report';
  const upgradeableAdmin = '0x45D2a1f4e76523e74EAe9aCE2d765d527433705a';

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

  /// SUBSCRIPTION ///
  const subscriptionLogic = await deploy('HectorSubscription', {
    from: deployer.address,
    args: [],
    log: true,
  });

  const subscriptionParams = [subscriptionLogic.address, upgradeableAdmin];
  const subscriptionFactory = await deploy('HectorSubscriptionFactory', {
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
    'HectorSubscriptionFactory',
    deployer
  );

  await (
    await subscriptionFactoryContract.setCoupon(hectorCoupon.address)
  ).wait();

  /// MULTI PAY SUBSCRIPTION ///
  if (
    (await subscriptionFactoryContract.isDeployedHectorSubscriptionContractByProduct(
      hectorMultiPayProduct
    )) == false
  ) {
    await (
      await subscriptionFactoryContract.createHectorSubscriptionContract(
        hectorMultiPayProduct,
        treasury
      )
    ).wait();

    const paySubscription =
      await subscriptionFactoryContract.getHectorSubscriptionContractByName(
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes(hectorMultiPayProduct))
      );
    const paySubscriptionContract = await ethers.getContractAt(
      'HectorSubscription',
      paySubscription,
      deployer
    );

    const plans = [
      // Small For 3 Months
      {
        token: torTokenAddress,
        period: 3600 * 24 * 90,
        amount: ethers.utils.parseEther('80').mul(3),
        data: ethers.utils.hexZeroPad(ethers.utils.hexlify(20), 32),
      },
      // Small For 6 Months
      {
        token: torTokenAddress,
        period: 3600 * 24 * 180,
        amount: ethers.utils.parseEther('80').mul(6).mul(85).div(100),
        data: ethers.utils.hexZeroPad(ethers.utils.hexlify(20), 32),
      },
      // Small For 1 Year
      {
        token: torTokenAddress,
        period: 3600 * 24 * 365,
        amount: ethers.utils.parseEther('80').mul(12).mul(70).div(100),
        data: ethers.utils.hexZeroPad(ethers.utils.hexlify(20), 32),
      },

      // Medium For 3 Months
      {
        token: torTokenAddress,
        period: 3600 * 24 * 90,
        amount: ethers.utils.parseEther('123').mul(3),
        data: ethers.utils.hexZeroPad(ethers.utils.hexlify(30), 32),
      },
      // Medium For 6 Months
      {
        token: torTokenAddress,
        period: 3600 * 24 * 180,
        amount: ethers.utils.parseEther('123').mul(6).mul(85).div(100),
        data: ethers.utils.hexZeroPad(ethers.utils.hexlify(30), 32),
      },
      // Medium For 1 Year
      {
        token: torTokenAddress,
        period: 3600 * 24 * 365,
        amount: ethers.utils.parseEther('123').mul(12).mul(70).div(100),
        data: ethers.utils.hexZeroPad(ethers.utils.hexlify(30), 32),
      },

      // Large For 3 Months
      {
        token: torTokenAddress,
        period: 3600 * 24 * 90,
        amount: ethers.utils.parseEther('200').mul(3),
        data: ethers.utils.hexZeroPad(ethers.utils.hexlify(50), 32),
      },
      // Large For 6 Months
      {
        token: torTokenAddress,
        period: 3600 * 24 * 180,
        amount: ethers.utils.parseEther('200').mul(6).mul(85).div(100),
        data: ethers.utils.hexZeroPad(ethers.utils.hexlify(50), 32),
      },
      // Large For 1 Year
      {
        token: torTokenAddress,
        period: 3600 * 24 * 365,
        amount: ethers.utils.parseEther('200').mul(12).mul(70).div(100),
        data: ethers.utils.hexZeroPad(ethers.utils.hexlify(50), 32),
      },

      // Enterprise For 3 Months
      {
        token: torTokenAddress,
        period: 3600 * 24 * 90,
        amount: ethers.utils.parseEther('250').mul(3),
        data: ethers.utils.hexZeroPad(
          ethers.utils.hexlify(ethers.constants.MaxUint256),
          32
        ),
      },
      // Enterprise For 6 Months
      {
        token: torTokenAddress,
        period: 3600 * 24 * 180,
        amount: ethers.utils.parseEther('250').mul(6).mul(85).div(100),
        data: ethers.utils.hexZeroPad(
          ethers.utils.hexlify(ethers.constants.MaxUint256),
          32
        ),
      },
      // Enterprise For 1 Year
      {
        token: torTokenAddress,
        period: 3600 * 24 * 365,
        amount: ethers.utils.parseEther('250').mul(12).mul(70).div(100),
        data: ethers.utils.hexZeroPad(
          ethers.utils.hexlify(ethers.constants.MaxUint256),
          32
        ),
      },
    ];
    const freePlan = {
      token: ethers.constants.AddressZero,
      period: 0,
      amount: 0,
      data: ethers.utils.hexZeroPad(ethers.utils.hexlify(3), 32),
    };
    await (await paySubscriptionContract.appendPlan(plans)).wait();
    await (await paySubscriptionContract.updatePlan(0, freePlan)).wait();
  }

  /// TAX REPORT SUBSCRIPTION ///
  if (
    (await subscriptionFactoryContract.isDeployedHectorSubscriptionContractByProduct(
      hectorTaxReportProduct
    )) == false
  ) {
    await (
      await subscriptionFactoryContract.createHectorSubscriptionContract(
        hectorTaxReportProduct,
        treasury
      )
    ).wait();

    const paySubscription =
      await subscriptionFactoryContract.getHectorSubscriptionContractByName(
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes(hectorTaxReportProduct))
      );
    const paySubscriptionContract = await ethers.getContractAt(
      'HectorSubscription',
      paySubscription,
      deployer
    );

    const plans = [
      {
        token: torTokenAddress,
        period: 3600 * 24 * 90,
        amount: ethers.utils.parseEther('60'),
        data: '0x00',
      },
      {
        token: torTokenAddress,
        period: 3600 * 24 * 180,
        amount: ethers.utils.parseEther('84'),
        data: '0x00',
      },
      {
        token: torTokenAddress,
        period: 3600 * 24 * 365,
        amount: ethers.utils.parseEther('150'),
        data: '0x00',
      },
    ];
    const freePlan = {
      token: ethers.constants.AddressZero,
      period: 0,
      amount: 0,
      data: '0x00',
    };
    await (await paySubscriptionContract.appendPlan(plans)).wait();
    await (await paySubscriptionContract.updatePlan(0, freePlan)).wait();
  }

  /// VERIFY ///
  if (hre.network.name !== 'localhost' && hre.network.name !== 'hardhat') {
    await waitSeconds(10);
    console.log('=====> Verifing ....');
    try {
      await hre.run('verify:verify', {
        address: subscriptionFactoryImplementation,
        contract:
          'contracts/HectorPay/subscription/HectorSubscriptionFactory.sol:HectorSubscriptionFactory',
        constructorArguments: [],
      });
    } catch (_) {}

    await waitSeconds(10);
    try {
      await hre.run('verify:verify', {
        address: subscriptionLogic.address,
        contract:
          'contracts/HectorPay/subscription/HectorSubscription.sol:HectorSubscription',
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
  }
};

export default deploySubscription;
deploySubscription.tags = ['SubscriptionTest'];
deploySubscription.dependencies = [];
