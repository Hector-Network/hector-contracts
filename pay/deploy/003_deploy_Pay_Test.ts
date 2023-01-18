import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { constants } from 'ethers';
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
  //   const hectorTokenAddress = '0x5c4fdfc5233f935f20d2adba572f770c2e377ab0';

  /// Token Address: Testnet
  const hectorTokenAddress = '0x55639b1833Ddc160c18cA60f5d0eC9286201f525';
  const torTokenAddress = '0xCe5b1b90a1E1527E8B82a9434266b2d6B72cc70b';

  const payLogic = await deploy('HectorPay', {
    from: deployer.address,
    args: [],
    log: true,
  });

  const params = [payLogic.address, deployer.address];
  const payFactory = await deploy('HectorPayFactory', {
    from: deployer.address,
    args: params,
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

  if (hre.network.name !== 'localhost' && hre.network.name !== 'hardhat') {
    await waitSeconds(10);
    console.log('=====> Verifing ....');
    try {
      await hre.run('verify:verify', {
        address: payFactory.address,
        contract: 'contracts/HectorPay/HectorPayFactory.sol:HectorPayFactory',
        constructorArguments: params,
      });
    } catch (_) {}
    await waitSeconds(2);
    try {
      await hre.run('verify:verify', {
        address: payLogic.address,
        contract: 'contracts/HectorPay/HectorPay.sol:HectorPay',
        constructorArguments: [],
      });
    } catch (_) {}
  }
};

export default deployPay;
deployPay.tags = ['PayTest'];
deployPay.dependencies = [];
