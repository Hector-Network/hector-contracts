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

  {
    try {
      await hre.run('verify:verify', {
        address: '0x17678aEe38d9108a7653a8F913DeB081B314bFc1',
        contract:
          'contracts/HectorPay/subscription/HectorSubscription.sol:HectorSubscription',
        constructorArguments: [],
      });
    } catch (_) {}

    await waitSeconds(10);
    try {
      await hre.run('verify:verify', {
        address: '0x8Bf476fb3589BD04d7F08627a2eCf5d621d659F6',
        contract:
          'contracts/HectorPay/v1/HectorPayFactory.sol:HectorPayFactory',
        constructorArguments: [
          '0x8C888Bd8C7ba703FF7774d694774A730C41cEb86',
          deployer.address,
          '0x7ae683cC863e31F71f5dB121fc3AF0C8c6E11E39',
        ],
      });
    } catch (_) {}
    return;
  }

  const hectorMultiPayProduct = 'Hector Multi Pay';

  /// SUBSCRIPTION ///
  const subscriptionLogic = await deploy('HectorSubscription', {
    from: deployer.address,
    args: [],
    log: true,
  });

  const subscriptionParams = [subscriptionLogic.address, deployer.address];
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

  await waitSeconds(2);
  const paySubscription =
    await subscriptionFactoryContract.getHectorSubscriptionContractByName(
      ethers.utils.keccak256(ethers.utils.toUtf8Bytes(hectorMultiPayProduct))
    );

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
