import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { waitSeconds } from '../helper/helpers';

const deployPay: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, ethers } = hre;
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  /// Token Address: Mainnet
  //   const hectorTokenAddress = '0x5c4fdfc5233f935f20d2adba572f770c2e377ab0';

  /// Token Address: FTM Testnet
  const hectorTokenAddress = '0x55639b1833Ddc160c18cA60f5d0eC9286201f525';
  const torTokenAddress = '0xCe5b1b90a1E1527E8B82a9434266b2d6B72cc70b';
  const treasury = '0xBF014a15198EDcFcb2921dE7099BF256DB31c4ba';

  /// Token Address: BSC Testnet
  // const hectorTokenAddress = '0x7400E9838BAD5cfFe1C4dc0236Fce2E725C73d42';
  // const torTokenAddress = '0x205F190776C8d466727bD0Cac6D1B564DC3C8Ea9';
  // const treasury = '0xBF014a15198EDcFcb2921dE7099BF256DB31c4ba';

  // {
  //   try {
  //     await hre.run('verify:verify', {
  //       address: '0xa8261FDe59063025931808ac0BeDb75416733f29',
  //       contract: 'contracts/HectorPay/v1/HectorPay.sol:HectorPay',
  //       constructorArguments: [],
  //     });
  //   } catch (_) {}

  //   await waitSeconds(10);
  //   try {
  //     await hre.run('verify:verify', {
  //       address: '0x712061c1D066B34F98381FBE057B81d29a1757F8',
  //       contract:
  //         'contracts/HectorPay/subscription/HectorSubscription.sol:HectorSubscription',
  //       constructorArguments: [],
  //     });
  //   } catch (_) {}

  //   await waitSeconds(10);
  //   try {
  //     await hre.run('verify:verify', {
  //       address: '0x7E61920c0F49eA2C5A042435b80755b7afd6771a',
  //       contract:
  //         'contracts/HectorPay/v1/HectorPayFactory.sol:HectorPayFactory',
  //       constructorArguments: [
  //         '0xa8261FDe59063025931808ac0BeDb75416733f29',
  //         deployer.address,
  //         '0x4745e4E101D8A8B687A15c138Ab4dFdf9262dFd1',
  //       ],
  //     });
  //   } catch (_) {}
  //   return;
  // }

  const hectorMultiPayProduct = 'Hector Multi Pay';
  const upgradeableAdmin = '0x906B738Dce4E20F672C1752e48f3627CF20b883a';

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

  await waitSeconds(10);
  try {
    (
      await paySubscriptionContract.appendPlan([
        {
          token: hectorTokenAddress,
          period: 3600 * 24,
          amount: ethers.utils.parseUnits('10', 9),
        },
        {
          token: torTokenAddress,
          period: 3600 * 48,
          amount: ethers.utils.parseEther('200'),
        },
      ])
    ).wait();
  } catch (_) {}

  /// MULTI PAY ///
  const payLogic = await deploy('HectorPay', {
    from: deployer.address,
    args: [],
    log: true,
  });

  const payParams = [payLogic.address, deployer.address, paySubscription];
  const payFactory = await deploy('HectorPayFactory', {
    from: deployer.address,
    args: payParams,
    log: true,
  });
  const payFactoryContract = await ethers.getContract(
    'HectorPayFactory',
    deployer
  );

  await waitSeconds(10);
  try {
    await payFactoryContract.createHectorPayContract(hectorTokenAddress);
  } catch (_) {}

  await waitSeconds(10);
  try {
    await payFactoryContract.createHectorPayContract(torTokenAddress);
  } catch (_) {}

  /// VERIFY ///
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
          'contracts/HectorPay/v1/HectorPayFactory.sol:HectorPayFactory',
        constructorArguments: payParams,
      });
    } catch (_) {}

    await waitSeconds(10);
    try {
      await hre.run('verify:verify', {
        address: payLogic.address,
        contract: 'contracts/HectorPay/v1/HectorPay.sol:HectorPay',
        constructorArguments: [],
      });
    } catch (_) {}
  }
};

export default deployPay;
deployPay.tags = ['PayTest'];
deployPay.dependencies = [];
