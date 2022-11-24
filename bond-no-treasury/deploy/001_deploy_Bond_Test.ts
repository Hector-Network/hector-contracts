import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { waitSeconds } from '../helper/helpers';
import { constants, utils } from 'ethers';

const deployBond: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, ethers } = hre;
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  /// Token Address
  const hectorTokenAddress = '0x55639b1833Ddc160c18cA60f5d0eC9286201f525';
  const daiTokenAddress = '0x80993B75e38227f1A3AF6f456Cf64747F0E21612';
  const usdcTokenAddress = '0x6f3da9C6700cAfBAb0323cF344F58C54B3ddB66b';
  const torTokenAddress = '0xCe5b1b90a1E1527E8B82a9434266b2d6B72cc70b';
  const principleAddresses = [
    daiTokenAddress,
    usdcTokenAddress,
    torTokenAddress,
  ];

  /// Oracle Address
  const hecDaiOracle = await deploy('MockUniswapPairOracle', {
    from: deployer.address,
    args: [hectorTokenAddress, daiTokenAddress],
    log: true,
  });
  const hecUsdcOracle = await deploy('MockUniswapPairOracle', {
    from: deployer.address,
    args: [hectorTokenAddress, usdcTokenAddress],
    log: true,
  });
  const hecTorOracle = await deploy('MockUniswapPairOracle', {
    from: deployer.address,
    args: [hectorTokenAddress, torTokenAddress],
    log: true,
  });

  /// Bond Pricing
  const bondPricing = await deploy('BondPricing', {
    from: deployer.address,
    args: [],
    log: true,
  });
  const bondPricingContract = await ethers.getContract('BondPricing', deployer);
  await bondPricingContract.addOracle(
    hecDaiOracle.address,
    hectorTokenAddress,
    daiTokenAddress
  );
  await bondPricingContract.addOracle(
    hecUsdcOracle.address,
    hectorTokenAddress,
    usdcTokenAddress
  );
  await bondPricingContract.addOracle(
    hecTorOracle.address,
    hectorTokenAddress,
    torTokenAddress
  );

  /// BondV2
  const params = [
    'HecBondV2',
    hectorTokenAddress,
    deployer.address,
    bondPricing.address,
  ];
  const hectorBondNoTreasuryDepository = await deploy(
    'HectorBondV2NoTreasuryFTMDepository',
    {
      from: deployer.address,
      args: params,
      log: true,
    }
  );

  /// BondV2 Initialize
  const contract = await ethers.getContract(
    'HectorBondV2NoTreasuryFTMDepository',
    deployer
  );

  /// Initial Params
  const fundRecipient = '';
  const feeBps = 1000;
  const feeRecipients = [''];
  const weightBps = [1000, 9000];
  const minimumPrice = 100;

  await contract.setMinPrice(minimumPrice);
  await contract.initializeFundRecipient(fundRecipient, feeBps);
  await contract.initializeFeeRecipient(feeRecipients, weightBps);
  await contract.initializeDepositTokens(principleAddresses);

  await contract.setLockingDiscount(5 * 24 * 3600, 500); // 5 days lock - 5%
  await contract.setLockingDiscount(5 * 7 * 24 * 3600, 1000); // 5 weeks lock - 10%
  await contract.setLockingDiscount(5 * 30 * 24 * 3600, 1500); // 5 months lock - 15%

  if (hre.network.name !== 'localhost' && hre.network.name !== 'hardhat') {
    await waitSeconds(10);
    console.log('=====> Verifing ....');
    try {
      await hre.run('verify:verify', {
        address: hecDaiOracle.address,
        contract:
          'contracts/mock/MockUniswapPairOracle.sol:MockUniswapPairOracle',
        constructorArguments: [hectorTokenAddress, daiTokenAddress],
      });
    } catch (_) {}
    try {
      await hre.run('verify:verify', {
        address: hecUsdcOracle.address,
        contract:
          'contracts/mock/MockUniswapPairOracle.sol:MockUniswapPairOracle',
        constructorArguments: [hectorTokenAddress, usdcTokenAddress],
      });
    } catch (_) {}
    try {
      await hre.run('verify:verify', {
        address: hecTorOracle.address,
        contract:
          'contracts/mock/MockUniswapPairOracle.sol:MockUniswapPairOracle',
        constructorArguments: [hectorTokenAddress, torTokenAddress],
      });
    } catch (_) {}
    try {
      await hre.run('verify:verify', {
        address: bondPricing.address,
        contract: 'contracts/BondPricing.sol:BondPricing',
        constructorArguments: [],
      });
    } catch (_) {}
    try {
      await hre.run('verify:verify', {
        address: hectorBondNoTreasuryDepository.address,
        contract:
          'contracts/HectorBondV2NoTreasuryFTMDepository.sol:HectorBondV2NoTreasuryFTMDepository',
        constructorArguments: params,
      });
    } catch (_) {}
  }
};

export default deployBond;
deployBond.tags = ['BondTest'];
deployBond.dependencies = [];
