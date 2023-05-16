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

const deploySubscriptionTreasury: DeployFunction = async (
  hre: HardhatRuntimeEnvironment
) => {
  const { deployments, ethers } = hre;
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  const daoWalletAddress = '0xBF014a15198EDcFcb2921dE7099BF256DB31c4ba';

  /// Subscription Treasury
  const params = [daoWalletAddress];
  const hectorSubscriptionTreasury = await deploy(
    'HectorSubscriptionTreasury',
    {
      from: deployer.address,
      args: [],
      log: true,
      proxy: {
        proxyContract: 'OpenZeppelinTransparentProxy',
        execute: {
          methodName: 'initialize',
          args: params,
        },
      },
    }
  );
  const hectorSubscriptionTreasuryImplementation =
    await getImplementationAddress(hectorSubscriptionTreasury.address);

  if (hre.network.name !== 'localhost' && hre.network.name !== 'hardhat') {
    await waitSeconds(10);
    console.log('=====> Verifing ....');
    try {
      await hre.run('verify:verify', {
        address: hectorSubscriptionTreasuryImplementation,
        contract:
          'contracts/HectorPay/subscription/HectorSubscriptionTreasury.sol:HectorSubscriptionTreasury',
        constructorArguments: [],
      });
    } catch (_) {}
  }
};

export default deploySubscriptionTreasury;
deploySubscriptionTreasury.tags = ['SubscriptionTreasuryTest'];
deploySubscriptionTreasury.dependencies = [];
