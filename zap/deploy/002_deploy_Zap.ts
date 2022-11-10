import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { waitSeconds } from '../helper/helpers';
import { constants, utils } from 'ethers';

const deployZap: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, ethers } = hre;
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  /// Token Address: Mainnet
  //   const hectorTokenAddress = '0x5c4fdfc5233f935f20d2adba572f770c2e377ab0';
  //   const usdcTokenAddress = '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75';
  //   const torTokenAddress = '0x74E23dF9110Aa9eA0b6ff2fAEE01e740CA1c642e';
  //   const wftmTokenAddress = '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83';
  //   const spookyRouterAddress = '0xF491e7B69E4244ad4002BC14e878a34207E38c29';

  /// Token Address: Testnet
  const hectorTokenAddress = '0x55639b1833Ddc160c18cA60f5d0eC9286201f525';
  const usdcTokenAddress = '0x6f3da9C6700cAfBAb0323cF344F58C54B3ddB66b';
  const torTokenAddress = '0xCe5b1b90a1E1527E8B82a9434266b2d6B72cc70b';
  const wftmTokenAddress = '0xf1277d1Ed8AD466beddF92ef448A132661956621';
  const spookyRouterAddress = '0xa6AD18C2aC47803E193F75c3677b14BF19B94883';

  const fee = 30; // 0.3%

  /// Bond Pricing
  const params = [
    hectorTokenAddress,
    wftmTokenAddress,
    spookyRouterAddress,
    fee,
  ];
  const zap = await deploy('HectorZap', {
    from: deployer.address,
    args: params,
    log: true,
  });
  const zapContract = await ethers.getContract('HectorZap', deployer);
  await zapContract.setNotLP(usdcTokenAddress);
  await zapContract.setNotLP(torTokenAddress);

  if (hre.network.name !== 'localhost' && hre.network.name !== 'hardhat') {
    await waitSeconds(10);
    console.log('=====> Verifing ....');
    try {
      await hre.run('verify:verify', {
        address: zap.address,
        contract: 'contracts/HectorZap.sol:HectorZap',
        constructorArguments: params,
      });
    } catch (_) {}
  }
};

export default deployZap;
deployZap.tags = ['Zap'];
deployZap.dependencies = [];
