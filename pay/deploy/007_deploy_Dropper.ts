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

const deployDropper: DeployFunction = async (
  hre: HardhatRuntimeEnvironment
) => {
  const { deployments, ethers } = hre;
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  /// Token Address: FTM
  const hectorTokenAddress = '0x5c4fdfc5233f935f20d2adba572f770c2e377ab0';
  const torTokenAddress = '0xCe5b1b90a1E1527E8B82a9434266b2d6B72cc70b';
  const treasury = '0xBF014a15198EDcFcb2921dE7099BF256DB31c4ba';

  const fee = ethers.utils.parseEther('0.1');
  const hectorMultiPayProduct = 'Hector Multi Pay';
  const upgradeableAdmin = '0x45D2a1f4e76523e74EAe9aCE2d765d527433705a';

  /// SUBSCRIPTION (Reusing) ///
  const subscriptionFactoryContract = await ethers.getContract(
    'HectorSubscriptionFactory',
    deployer
  );

  const paySubscription =
    await subscriptionFactoryContract.getHectorSubscriptionContractByName(
      ethers.utils.keccak256(ethers.utils.toUtf8Bytes(hectorMultiPayProduct))
    );

  /// Dropper ///
  const dropperLogic = await deploy('HectorDropper', {
    from: deployer.address,
    args: [],
    log: true,
  });

  const dropperParams = [dropperLogic.address, upgradeableAdmin, treasury, fee];
  const dropperFactory = await deploy('HectorDropperFactory', {
    from: deployer.address,
    args: [],
    log: true,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        methodName: 'initialize',
        args: dropperParams,
      },
    },
  });
  const dropperFactoryImplementation = await getImplementationAddress(
    dropperFactory.address
  );
  const dropperFactoryContract = await ethers.getContract(
    'HectorDropperFactory',
    deployer
  );

  await (
    await dropperFactoryContract.createHectorDropperContract(hectorTokenAddress)
  ).wait();
  await waitSeconds(1);
  await (
    await dropperFactoryContract.createHectorDropperContract(torTokenAddress)
  ).wait();

  /// VALIDATOR ///
  const validatorParams = [paySubscription];
  const dropperValidator = await deploy('HectorDropperValidator', {
    from: deployer.address,
    args: validatorParams,
    log: true,
  });

  await (
    await dropperFactoryContract.setValidator(dropperValidator.address)
  ).wait();

  /// VERIFY ///
  if (hre.network.name !== 'localhost' && hre.network.name !== 'hardhat') {
    await waitSeconds(10);
    console.log('=====> Verifing ....');
    try {
      await hre.run('verify:verify', {
        address: dropperFactoryImplementation,
        contract:
          'contracts/HectorPay/dropper/HectorDropperFactory.sol:HectorDropperFactory',
        constructorArguments: [],
      });
    } catch (_) {}

    await waitSeconds(10);
    try {
      await hre.run('verify:verify', {
        address: dropperLogic.address,
        contract: 'contracts/HectorPay/dropper/HectorDropper.sol:HectorDropper',
        constructorArguments: [],
      });
    } catch (_) {}

    await waitSeconds(10);
    try {
      await hre.run('verify:verify', {
        address: dropperValidator.address,
        contract:
          'contracts/HectorPay/validator/HectorDropperValidator.sol:HectorDropperValidator',
        constructorArguments: validatorParams,
      });
    } catch (_) {}
  }
};

export default deployDropper;
deployDropper.tags = ['Dropper'];
deployDropper.dependencies = ['Subscription'];
