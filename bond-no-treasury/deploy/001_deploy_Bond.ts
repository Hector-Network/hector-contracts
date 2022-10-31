import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { waitSeconds } from '../helper/helpers';
import { constants, utils } from 'ethers';

const deployBond: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, ethers } = hre;
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  /// Token Address
  const hectorTokenAddress = '0x5c4fdfc5233f935f20d2adba572f770c2e377ab0';
  const daiTokenAddress = '0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e';
  const usdcTokenAddress = '0x04068da6c83afcfa0e13ba15a6696662335d5b75';
  const usdTTokenAddress = '0x049d68029688eabf473097a2fc38ef61633a3c7a';
  const principleAddresses = [
    daiTokenAddress,
    usdcTokenAddress,
    usdTTokenAddress,
  ];

  /// Oracle Address
  const hec_dai_oracle = '0x227ccdfebea1355e73f1936c8a23ebb5f0181b3c';

  /// Initial Params
  const fundRecipient = '';
  const feeBps = 3000;
  const feeRecipients = [''];
  const weightBps = [10000];
  const minimumPrice = 10000;

  /// Bond Pricing
  const bondPricing = await deploy('BondPricing', {
    from: deployer.address,
    args: [],
    log: true,
  });
  const bondPricingContract = await ethers.getContract('BondPricing', deployer);
  await bondPricingContract.addOracle(
    hec_dai_oracle,
    hectorTokenAddress,
    daiTokenAddress
  );
  await bondPricingContract.addOracle(
    hec_dai_oracle,
    hectorTokenAddress,
    usdcTokenAddress
  );
  await bondPricingContract.addOracle(
    hec_dai_oracle,
    hectorTokenAddress,
    usdTTokenAddress
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
  // const contract = await ethers.getContract(
  //   'HectorBondV2NoTreasuryFTMDepository',
  //   deployer
  // );

  // await contract.setMinPrice(minimumPrice);
  // await contract.initializeFundRecipient(fundRecipient, feeBps);
  // await contract.initializeFeeRecipient(feeRecipients, weightBps);
  // await contract.initializeDepositTokens(principleAddresses);

  // await contract.setLockingDiscount(5 * 24 * 3600, 500); // 5 days lock - 5%
  // await contract.setLockingDiscount(5 * 7 * 24 * 3600, 1000); // 7 weeks lock - 10%
  // await contract.setLockingDiscount(5 * 30 * 24 * 3600, 1500); // 5 months lock - 15%

  if (hre.network.name !== 'localhost' && hre.network.name !== 'hardhat') {
    await waitSeconds(10);
    console.log('=====> Verifing ....');
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
deployBond.tags = ['Bond'];
deployBond.dependencies = [];
