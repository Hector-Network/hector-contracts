import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { waitSeconds } from '../helper/helpers';

async function getImplementationAddress(proxyAddress: string) {
  const implHex = await ethers.provider.getStorageAt(
    proxyAddress,
    '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'
  );
  return ethers.utils.hexStripZeros(implHex);
}

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
  const upgradeableAdmin = '0x45D2a1f4e76523e74EAe9aCE2d765d527433705a';
  const hectorMultiPayProduct = 'Hector Multi Pay';

  /// SUBSCRIPTION (Reusing) ///
  const subscriptionFactoryContract = await ethers.getContract(
    'HectorSubscriptionFactory',
    deployer
  );

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

  const payParams = [payLogic.address, upgradeableAdmin];
  const payFactory = await deploy('HectorPayFactory', {
    from: deployer.address,
    args: [],
    log: true,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        methodName: 'initialize',
        args: payParams,
      },
    },
  });
  const payFactoryImplementation = await getImplementationAddress(
    payFactory.address
  );
  const payFactoryContract = await ethers.getContract(
    'HectorPayFactory',
    deployer
  );

  await (
    await payFactoryContract.createHectorPayContract(hectorTokenAddress)
  ).wait();
  await waitSeconds(1);
  await (
    await payFactoryContract.createHectorPayContract(torTokenAddress)
  ).wait();

  /// VALIDATOR ///
  const validatorParams = [paySubscription, payFactory.address];
  const payValidator = await deploy('HectorPayValidator', {
    from: deployer.address,
    args: validatorParams,
    log: true,
  });

  await (await payFactoryContract.setValidator(payValidator.address)).wait();

  /// VERIFY ///
  if (hre.network.name !== 'localhost' && hre.network.name !== 'hardhat') {
    await waitSeconds(10);
    console.log('=====> Verifing ....');
    try {
      await hre.run('verify:verify', {
        address: payFactoryImplementation,
        contract:
          'contracts/HectorPay/v1_upfront_pay/HectorPayFactory.sol:HectorPayFactory',
        constructorArguments: [],
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

    await waitSeconds(10);
    try {
      await hre.run('verify:verify', {
        address: payValidator.address,
        contract:
          'contracts/HectorPay/validator/HectorPayValidator.sol:HectorPayValidator',
        constructorArguments: validatorParams,
      });
    } catch (_) {}
  }
};

export default deployPay;
deployPay.tags = ['Pay'];
deployPay.dependencies = ['Subscription'];
