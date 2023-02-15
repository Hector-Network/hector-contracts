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

const deployKeeper: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, ethers } = hre;
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  /// Token Address
  const hectorTokenAddress = '0x55639b1833Ddc160c18cA60f5d0eC9286201f525';
  const daiTokenAddress = '0x80993B75e38227f1A3AF6f456Cf64747F0E21612';
  const usdcTokenAddress = '0x6f3da9C6700cAfBAb0323cF344F58C54B3ddB66b';
  const torTokenAddress = '0xCe5b1b90a1E1527E8B82a9434266b2d6B72cc70b';
  const wftmTokenAddress = '0x18002Cf2a14Ba495B94a63Cd9844f4232010D824';

  // Keeper Params
  const lockAddressRegistry = '0x2D86a40Ff217493cCE3a23627F6A749dAe1f9018';
  const priceOracleAggregator = '0xE847f70474E457f57654755e04F7F4BcfCC64F5F';
  const dao = '0x906B738Dce4E20F672C1752e48f3627CF20b883a';
  const tokens = [
    hectorTokenAddress,
    daiTokenAddress,
    usdcTokenAddress,
    torTokenAddress,
    wftmTokenAddress,
  ];
  const baseFee = 100000000; // 1$ (8 decimals)
  const params = [
    lockAddressRegistry,
    priceOracleAggregator,
    dao,
    tokens,
    baseFee,
  ];
  const hectorLockFarmKeeper = await deploy('HectorLockFarmKeeper', {
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
  });
  const hectorLockFarmKeeperImplementation = await getImplementationAddress(
    hectorLockFarmKeeper.address
  );

  if (hre.network.name !== 'localhost' && hre.network.name !== 'hardhat') {
    await waitSeconds(10);
    console.log('=====> Verifing ....');
    try {
      await hre.run('verify:verify', {
        address: hectorLockFarmKeeperImplementation,
        contract: 'contracts/HectorLockFarmKeeper.sol:HectorLockFarmKeeper',
        constructorArguments: [],
      });
    } catch (_) {}
  }
};

export default deployKeeper;
deployKeeper.tags = ['LockFarmKeeperTest'];
deployKeeper.dependencies = [];
