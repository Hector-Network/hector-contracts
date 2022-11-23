import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { waitSeconds } from '../helper/helpers';

const deployPay: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, ethers } = hre;
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  /// Token Address: Mainnet
  //   const hectorTokenAddress = '0x5c4fdfc5233f935f20d2adba572f770c2e377ab0';

  /// Token Address: Testnet
  const hectorTokenAddress = '0x55639b1833Ddc160c18cA60f5d0eC9286201f525';
  const torTokenAddress = '0xCe5b1b90a1E1527E8B82a9434266b2d6B72cc70b';

  const payFactory = await deploy('HectorPayFactory', {
    from: deployer.address,
    args: [],
    log: true,
  });
  const payFactoryContract = await ethers.getContract(
    'HectorPayFactory',
    deployer
  );

  try {
    await payFactoryContract.createHectorPayContract(hectorTokenAddress);
  } catch (_) {}
  try {
    await payFactoryContract.createHectorPayContract(torTokenAddress);
  } catch (_) {}

  if (hre.network.name !== 'localhost' && hre.network.name !== 'hardhat') {
    await waitSeconds(10);
    console.log('=====> Verifing ....');
    try {
      await hre.run('verify:verify', {
        address: payFactory.address,
        contract: 'contracts/HectorPayFactory.sol:HectorPayFactory',
        constructorArguments: [],
      });
    } catch (_) {}
  }
};

export default deployPay;
deployPay.tags = ['Pay'];
deployPay.dependencies = [];
