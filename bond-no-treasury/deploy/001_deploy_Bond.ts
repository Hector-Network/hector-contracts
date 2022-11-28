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
  const hec_usdc_oracle = '';
  const hec_usdt_oracle = '';

  /// Bond Pricing
  const bondPricing = await deploy('BondPricing', {
    from: deployer.address,
    args: [],
    log: true,
  });
  const bondPricingContract = await ethers.getContract('BondPricing', deployer);
  await waitSeconds(2);
  await bondPricingContract.addOracle(
    hec_dai_oracle,
    hectorTokenAddress,
    daiTokenAddress
  );
  await waitSeconds(2);
  await bondPricingContract.addOracle(
    hec_usdc_oracle,
    hectorTokenAddress,
    usdcTokenAddress
  );
  await waitSeconds(2);
  await bondPricingContract.addOracle(
    hec_usdt_oracle,
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
  const hectorBondNoTreasuryDepositoryImplementation =
    await getImplementationAddress(hectorBondNoTreasuryDepository.address);

  /// BondV2 Initialize
  const contract = await ethers.getContract(
    'HectorBondV2NoTreasuryFTMDepository',
    deployer
  );

  /// Initial Params
  // const fundRecipient = '0xBF014a15198EDcFcb2921dE7099BF256DB31c4ba';
  // const feeBps = 1000;
  // const feeRecipients = [
  //   '0x906B738Dce4E20F672C1752e48f3627CF20b883a',
  //   '0xa79E9d90abeE6fC7b36E05FB7F9692e2CF2b368b',
  // ];
  // const weightBps = [1000, 9000];
  // const minimumPrice = 100;

  // await waitSeconds(2);
  // await contract.setMinPrice(minimumPrice);
  // await waitSeconds(1);
  // await contract.initializeFundRecipient(fundRecipient, feeBps);
  // await waitSeconds(1);
  // await contract.initializeFeeRecipient(feeRecipients, weightBps);
  // await waitSeconds(1);
  // await contract.initializeDepositTokens(principleAddresses);

  // await waitSeconds(1);
  // await contract.setLockingDiscount(5 * 60, 200); // 5 minutes lock - 2%
  // await waitSeconds(1);
  // await contract.setLockingDiscount(5 * 24 * 3600, 500); // 5 days lock - 5%
  // await waitSeconds(1);
  // await contract.setLockingDiscount(5 * 7 * 24 * 3600, 1000); // 5 weeks lock - 10%
  // await waitSeconds(1);
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
    await waitSeconds(10);
    try {
      await hre.run('verify:verify', {
        address: hectorBondNoTreasuryDepositoryImplementation,
        contract:
          'contracts/HectorBondV2NoTreasuryFTMDepository.sol:HectorBondV2NoTreasuryFTMDepository',
        constructorArguments: [],
      });
    } catch (_) {}
  }
};

export default deployBond;
deployBond.tags = ['Bond'];
deployBond.dependencies = [];
