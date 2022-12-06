import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { waitSeconds } from '../helper/helpers';
import { ethers } from 'hardhat';
import { constants } from 'ethers';

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
  const hectorTokenAddress = '0x55639b1833Ddc160c18cA60f5d0eC9286201f525';
  const daiTokenAddress = '0x80993B75e38227f1A3AF6f456Cf64747F0E21612';
  const usdcTokenAddress = '0x6f3da9C6700cAfBAb0323cF344F58C54B3ddB66b';
  const torTokenAddress = '0xCe5b1b90a1E1527E8B82a9434266b2d6B72cc70b';
  const wftmTokenAddress = '0x18002Cf2a14Ba495B94a63Cd9844f4232010D824';
  const hecusdclpTokenAddress = '0x9C4Ee29CD1C219623eBEA40A42b5af11414D7C90';
  const principleAddresses = [
    daiTokenAddress,
    usdcTokenAddress,
    torTokenAddress,
    wftmTokenAddress,
    hecusdclpTokenAddress,
  ];

  /// Oracle Address
  const daiChainlinkPriceFeeder = '0x9BB8A6dcD83E36726Cc230a97F1AF8a84ae5F128';
  const usdcChainlinkPriceFeeder = '0x9BB8A6dcD83E36726Cc230a97F1AF8a84ae5F128';
  const torChainlinkPriceFeeder = '0x9BB8A6dcD83E36726Cc230a97F1AF8a84ae5F128';
  const wftmChainlinkPriceFeeder = '0xe04676B9A9A2973BCb0D1478b5E1E9098BBB7f3D';
  const uniswapFactory = '0xEE4bC42157cf65291Ba2FE839AE127e3Cc76f741';

  /// PriceOracleAggregator
  const priceOracleAggregator = await deploy('PriceOracleAggregator', {
    from: deployer.address,
    args: [],
    log: true,
  });
  const priceOracleAggregatorContract = await ethers.getContract(
    'PriceOracleAggregator',
    deployer
  );

  /// DAI ChainlinkUSDAdapter
  const daiChainlinkUSDAdapter = await deploy('ChainlinkUSDAdapter', {
    from: deployer.address,
    args: [
      daiTokenAddress,
      daiChainlinkPriceFeeder,
      constants.AddressZero,
      priceOracleAggregator.address,
    ],
    log: true,
  });
  await waitSeconds(2);
  await priceOracleAggregatorContract.updateOracleForAsset(
    daiTokenAddress,
    daiChainlinkUSDAdapter.address
  );

  /// USDC ChainlinkUSDAdapter
  const usdcChainlinkUSDAdapter = await deploy('ChainlinkUSDAdapter', {
    from: deployer.address,
    args: [
      usdcTokenAddress,
      usdcChainlinkPriceFeeder,
      constants.AddressZero,
      priceOracleAggregator.address,
    ],
    log: true,
  });
  await waitSeconds(2);
  await priceOracleAggregatorContract.updateOracleForAsset(
    usdcTokenAddress,
    usdcChainlinkUSDAdapter.address
  );

  /// TOR ChainlinkUSDAdapter
  const torChainlinkUSDAdapter = await deploy('ChainlinkUSDAdapter', {
    from: deployer.address,
    args: [
      torTokenAddress,
      torChainlinkPriceFeeder,
      constants.AddressZero,
      priceOracleAggregator.address,
    ],
    log: true,
  });
  await waitSeconds(2);
  await priceOracleAggregatorContract.updateOracleForAsset(
    torTokenAddress,
    torChainlinkUSDAdapter.address
  );

  /// WFTM ChainlinkUSDAdapter
  const wftmChainlinkUSDAdapter = await deploy('ChainlinkUSDAdapter', {
    from: deployer.address,
    args: [
      wftmTokenAddress,
      wftmChainlinkPriceFeeder,
      constants.AddressZero,
      priceOracleAggregator.address,
    ],
    log: true,
  });
  await waitSeconds(2);
  await priceOracleAggregatorContract.updateOracleForAsset(
    wftmTokenAddress,
    wftmChainlinkUSDAdapter.address
  );

  /// HEC<>USDC UniswapV2Oracle
  const hecusdcUniswapV2Oracle = await deploy('UniswapV2Oracle', {
    from: deployer.address,
    args: [
      uniswapFactory,
      hectorTokenAddress,
      usdcTokenAddress,
      priceOracleAggregator.address,
    ],
    log: true,
  });
  const hecusdcUniswapV2OracleContract = await ethers.getContract(
    'UniswapV2Oracle',
    deployer
  );
  await waitSeconds(2);
  await hecusdcUniswapV2OracleContract.setAllowStaleConsults(true);
  await waitSeconds(2);
  await hecusdcUniswapV2OracleContract.update();
  await waitSeconds(2);
  await priceOracleAggregatorContract.updateOracleForAsset(
    hectorTokenAddress,
    hecusdcUniswapV2Oracle.address
  );

  /// HEC<>USDC UniswapV2LPOracle
  const hecusdcUniswapV2LPOracle = await deploy('UniswapV2LPOracle', {
    from: deployer.address,
    args: [hecusdclpTokenAddress, priceOracleAggregator.address],
    log: true,
  });
  await waitSeconds(2);
  await priceOracleAggregatorContract.updateOracleForAsset(
    hecusdclpTokenAddress,
    hecusdcUniswapV2LPOracle.address
  );

  /// BondV3
  const params = [
    'HecBondV3',
    hectorTokenAddress,
    deployer.address,
    priceOracleAggregator.address,
  ];
  const hectorBondNoTreasuryDepository = await deploy('BondNoTreasuryV3', {
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
  const hectorBondNoTreasuryDepositoryImplementation =
    await getImplementationAddress(hectorBondNoTreasuryDepository.address);

  /// BondV3 Initialize
  const contract = await ethers.getContract('BondNoTreasuryV3', deployer);

  /// Initial Params
  const fundRecipient = '0xBF014a15198EDcFcb2921dE7099BF256DB31c4ba';
  const feeBps = 1000;
  const feeRecipients = [
    '0x906B738Dce4E20F672C1752e48f3627CF20b883a',
    '0xa79E9d90abeE6fC7b36E05FB7F9692e2CF2b368b',
  ];
  const weightBps = [1000, 9000];
  const minimumPrice = 100000;

  await waitSeconds(2);
  await contract.setMinPrice(minimumPrice);
  await waitSeconds(2);
  await contract.initializeFundRecipient(fundRecipient, feeBps);
  await waitSeconds(2);
  await contract.initializeFeeRecipient(feeRecipients, weightBps);
  await waitSeconds(2);
  await contract.initializeDepositTokens(principleAddresses);

  await waitSeconds(2);
  await contract.setLockingDiscount(5 * 60, 200); // 5 minutes lock - 2%
  await waitSeconds(2);
  await contract.setLockingDiscount(5 * 24 * 3600, 500); // 5 days lock - 5%
  await waitSeconds(2);
  await contract.setLockingDiscount(5 * 7 * 24 * 3600, 1000); // 5 weeks lock - 10%
  await waitSeconds(2);
  await contract.setLockingDiscount(5 * 30 * 24 * 3600, 1500); // 5 months lock - 15%

  if (hre.network.name !== 'localhost' && hre.network.name !== 'hardhat') {
    await waitSeconds(10);
    console.log('=====> Verifing ....');
    try {
      await hre.run('verify:verify', {
        address: priceOracleAggregator.address,
        contract:
          'contracts/oracle/PriceOracleAggregator.sol:PriceOracleAggregator',
        constructorArguments: [],
      });
    } catch (_) {}
    await waitSeconds(10);
    try {
      await hre.run('verify:verify', {
        address: daiChainlinkUSDAdapter.address,
        contract:
          'contracts/oracle/ChainlinkUSDAdapter.sol:ChainlinkUSDAdapter',
        constructorArguments: [
          daiTokenAddress,
          daiChainlinkPriceFeeder,
          constants.AddressZero,
          priceOracleAggregator.address,
        ],
      });
    } catch (_) {}
    await waitSeconds(10);
    try {
      await hre.run('verify:verify', {
        address: usdcChainlinkUSDAdapter.address,
        contract:
          'contracts/oracle/ChainlinkUSDAdapter.sol:ChainlinkUSDAdapter',
        constructorArguments: [
          usdcTokenAddress,
          usdcChainlinkPriceFeeder,
          constants.AddressZero,
          priceOracleAggregator.address,
        ],
      });
    } catch (_) {}
    await waitSeconds(10);
    try {
      await hre.run('verify:verify', {
        address: torChainlinkUSDAdapter.address,
        contract:
          'contracts/oracle/ChainlinkUSDAdapter.sol:ChainlinkUSDAdapter',
        constructorArguments: [
          torTokenAddress,
          torChainlinkPriceFeeder,
          constants.AddressZero,
          priceOracleAggregator.address,
        ],
      });
    } catch (_) {}
    await waitSeconds(10);
    try {
      await hre.run('verify:verify', {
        address: wftmChainlinkUSDAdapter.address,
        contract:
          'contracts/oracle/ChainlinkUSDAdapter.sol:ChainlinkUSDAdapter',
        constructorArguments: [
          wftmTokenAddress,
          wftmChainlinkPriceFeeder,
          constants.AddressZero,
          priceOracleAggregator.address,
        ],
      });
    } catch (_) {}
    await waitSeconds(10);
    try {
      await hre.run('verify:verify', {
        address: hecusdcUniswapV2Oracle.address,
        contract: 'contracts/oracle/UniswapV2Oracle.sol:UniswapV2Oracle',
        constructorArguments: [
          uniswapFactory,
          hectorTokenAddress,
          usdcTokenAddress,
          priceOracleAggregator.address,
        ],
      });
    } catch (_) {}
    await waitSeconds(10);
    try {
      await hre.run('verify:verify', {
        address: hecusdcUniswapV2LPOracle.address,
        contract: 'contracts/oracle/UniswapV2LPOracle.sol:UniswapV2LPOracle',
        constructorArguments: [
          hecusdclpTokenAddress,
          priceOracleAggregator.address,
        ],
      });
    } catch (_) {}
    await waitSeconds(10);
    try {
      await hre.run('verify:verify', {
        address: hectorBondNoTreasuryDepositoryImplementation,
        contract:
          'contracts/HectorBondV3NoTreasuryFTMDepository.sol:BondNoTreasuryV3',
        constructorArguments: [],
      });
    } catch (_) {}
  }
};

export default deployBond;
deployBond.tags = ['BondV3Test'];
deployBond.dependencies = [];
