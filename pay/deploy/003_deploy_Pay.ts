import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { constants } from 'ethers';
import { waitSeconds } from '../helper/helpers';

const deployPay: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, ethers } = hre;
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  /// Token Address: Mainnet
  const wbtcTokenAddress = '0x321162cd933e2be498cd2267a90534a804051b11';
  const wethTokenAddress = '0x74b23882a30290451a17c44f4f05243b6b58c76d';
  const wftmTokenAddress = '0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83';
  const fraxTokenAddress = '0xdc301622e621166bd8e82f2ca0a26c13ad0be355';
  const booTokenAddress = '0x841fad6eae12c286d1fd18d1d525dffa75c7effe';
  const spiritTokenAddress = '0x5cc61a78f164885776aa610fb0fe1257df78e59b';
  const geistTokenAddress = '0xd8321aa83fb0a4ecd6348d4577431310a6e0814d';
  const lqdrTokenAddress = '0x10b620b2dbac4faa7d7ffd71da486f5d44cd86f9';
  const hectorTokenAddress = '0x5c4fdfc5233f935f20d2adba572f770c2e377ab0';
  const daiTokenAddress = '0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e';
  const usdcTokenAddress = '0x04068da6c83afcfa0e13ba15a6696662335d5b75';
  const usdtTokenAddress = '0x049d68029688eabf473097a2fc38ef61633a3c7a';
  const busdTokenAddress = '0x4fabb145d64652a948d72533023f6e7a623c7c53';
  const torTokenAddress = '0x74e23df9110aa9ea0b6ff2faee01e740ca1c642e';

  /// Configuration: Mainnet
  const multiSigWallet = '0x2ba5F2ce103A45e278D7Bc99153190eD6E9c4A96';
  const treasury = '0x2ba5F2ce103A45e278D7Bc99153190eD6E9c4A96';
  const upgradeableAdmin = '0x45D2a1f4e76523e74EAe9aCE2d765d527433705a';
  const hectorMultiPayProduct = 'Hector Multi Pay';

  /// SUBSCRIPTION ///
  const subscriptionLogic = await deploy('HectorSubscription', {
    from: deployer.address,
    args: [],
    log: true,
  });

  const subscriptionParams = [subscriptionLogic.address, upgradeableAdmin];
  const subscriptionFactory = await deploy('HectorSubscriptionFactory', {
    from: deployer.address,
    args: subscriptionParams,
    log: true,
  });
  const subscriptionFactoryContract = await ethers.getContract(
    'HectorSubscriptionFactory',
    deployer
  );

  await waitSeconds(10);
  try {
    (
      await subscriptionFactoryContract.createHectorSubscriptionContract(
        hectorMultiPayProduct,
        treasury
      )
    ).wait();
  } catch (_) {}

  await waitSeconds(10);
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
  await waitSeconds(10);
  try {
    (await paySubscriptionContract.appendPlan(plans)).wait();
  } catch (_) {}
  await waitSeconds(10);
  try {
    (await paySubscriptionContract.updatePlan(0, freePlan)).wait();
  } catch (_) {}

  /// MULTI PAY ///
  const payLogic = await deploy('HectorPay', {
    from: deployer.address,
    args: [],
    log: true,
  });
  await waitSeconds(5);

  const payParams = [payLogic.address, upgradeableAdmin, paySubscription];
  const payFactory = await deploy('HectorPayFactory', {
    from: deployer.address,
    args: payParams,
    log: true,
  });
  const payFactoryContract = await ethers.getContract(
    'HectorPayFactory',
    deployer
  );

  // await waitSeconds(10);
  // try {
  //   (await payFactoryContract.createHectorPayContract(wbtcTokenAddress)).wait();
  // } catch (_) {}

  // await waitSeconds(10);
  // try {
  //   (await payFactoryContract.createHectorPayContract(wethTokenAddress)).wait();
  // } catch (_) {}

  // await waitSeconds(10);
  // try {
  //   (await payFactoryContract.createHectorPayContract(wftmTokenAddress)).wait();
  // } catch (_) {}

  // await waitSeconds(10);
  // try {
  //   (await payFactoryContract.createHectorPayContract(fraxTokenAddress)).wait();
  // } catch (_) {}

  // await waitSeconds(10);
  // try {
  //   (await payFactoryContract.createHectorPayContract(booTokenAddress)).wait();
  // } catch (_) {}

  // await waitSeconds(10);
  // try {
  //   (
  //     await payFactoryContract.createHectorPayContract(spiritTokenAddress)
  //   ).wait();
  // } catch (_) {}

  // await waitSeconds(10);
  // try {
  //   (
  //     await payFactoryContract.createHectorPayContract(geistTokenAddress)
  //   ).wait();
  // } catch (_) {}

  // await waitSeconds(10);
  // try {
  //   (await payFactoryContract.createHectorPayContract(lqdrTokenAddress)).wait();
  // } catch (_) {}

  await waitSeconds(10);
  try {
    (
      await payFactoryContract.createHectorPayContract(hectorTokenAddress)
    ).wait();
  } catch (_) {}

  // await waitSeconds(10);
  // try {
  //   (await payFactoryContract.createHectorPayContract(daiTokenAddress)).wait();
  // } catch (_) {}

  // await waitSeconds(10);
  // try {
  //   (await payFactoryContract.createHectorPayContract(usdcTokenAddress)).wait();
  // } catch (_) {}
  // await waitSeconds(10);
  // try {
  //   (await payFactoryContract.createHectorPayContract(usdtTokenAddress)).wait();
  // } catch (_) {}
  // await waitSeconds(10);
  // try {
  //   (await payFactoryContract.createHectorPayContract(busdTokenAddress)).wait();
  // } catch (_) {}
  await waitSeconds(10);
  try {
    await payFactoryContract.createHectorPayContract(torTokenAddress);
  } catch (_) {}

  if (hre.network.name !== 'localhost' && hre.network.name !== 'hardhat') {
    await waitSeconds(10);
    console.log('=====> Verifing ....');
    try {
      await hre.run('verify:verify', {
        address: subscriptionFactory.address,
        contract:
          'contracts/HectorPay/subscription/HectorSubscriptionFactory.sol:HectorSubscriptionFactory',
        constructorArguments: subscriptionParams,
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
        address: payFactory.address,
        contract:
          'contracts/HectorPay/v1_upfront_pay/HectorPayFactory.sol:HectorPayFactory',
        constructorArguments: payParams,
      });
    } catch (_) {}

    await waitSeconds(10);
    try {
      await hre.run('verify:verify', {
        address: payLogic.address,
        contract: 'contracts/HectorPay/v1_upfront_pay/HectorPay.sol:HectorPay',
        constructorArguments: [],
      });
    } catch (_) {}
  }
};

export default deployPay;
deployPay.tags = ['Pay'];
deployPay.dependencies = [];
