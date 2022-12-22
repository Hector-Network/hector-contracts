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
  const hectorTokenAddress = '0x5c4fdfc5233f935f20d2adba572f770c2e377ab0';
  const daiTokenAddress = '0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e';
  const usdcTokenAddress = '0x04068da6c83afcfa0e13ba15a6696662335d5b75';
  const usdtTokenAddress = '0x049d68029688eabf473097a2fc38ef61633a3c7a';
  const wftmTokenAddress = '0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83';
  const hecusdclpTokenAddress = '0x0b9589A2C1379138D4cC5043cE551F466193c8dE';
  const principleAddresses = [
    daiTokenAddress,
    usdcTokenAddress,
    usdtTokenAddress,
    wftmTokenAddress,
    hecusdclpTokenAddress,
  ];

  /// Oracle Address
  const daiChainlinkPriceFeeder = '0x91d5DEFAFfE2854C7D02F50c80FA1fdc8A721e52';
  const usdcChainlinkPriceFeeder = '0x2553f4eeb82d5A26427b8d1106C51499CBa5D99c';
  const usdtChainlinkPriceFeeder = '0xF64b636c5dFe1d3555A847341cDC449f612307d0';
  const wftmChainlinkPriceFeeder = '0xf4766552D15AE4d256Ad41B6cf2933482B0680dc';
  const uniswapFactory = '0x152eE697f2E276fA89E96742e9bB9aB1F2E61bE3';

  // LockFarm Address
  const lockFarmAddress = '0x95B7f9ac7f2E4cB09205AAa2Ac74527f55272229';
  const fnftAddress = '0x6c6dFEa66A03423A8C4340a99c58DEA711CFB65d';
  const tokenVaultAddress = '0x48a241f049595B13F891dae7C839836F95011693';

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
  await waitSeconds(5);
  const daiChainlinkUSDAdapter = await deploy('DAIChainlinkUSDAdapter', {
    contract: 'ChainlinkUSDAdapter',
    from: deployer.address,
    args: [
      daiTokenAddress,
      daiChainlinkPriceFeeder,
      constants.AddressZero,
      priceOracleAggregator.address,
    ],
    log: true,
  });
  await waitSeconds(5);
  (
    await priceOracleAggregatorContract.updateOracleForAsset(
      daiTokenAddress,
      daiChainlinkUSDAdapter.address
    )
  ).wait();

  /// USDC ChainlinkUSDAdapter
  await waitSeconds(5);
  const usdcChainlinkUSDAdapter = await deploy('USDCChainlinkUSDAdapter', {
    contract: 'ChainlinkUSDAdapter',
    from: deployer.address,
    args: [
      usdcTokenAddress,
      usdcChainlinkPriceFeeder,
      constants.AddressZero,
      priceOracleAggregator.address,
    ],
    log: true,
  });
  await waitSeconds(5);
  (
    await priceOracleAggregatorContract.updateOracleForAsset(
      usdcTokenAddress,
      usdcChainlinkUSDAdapter.address
    )
  ).wait();

  /// USDT ChainlinkUSDAdapter
  await waitSeconds(5);
  const usdtChainlinkUSDAdapter = await deploy('USDTChainlinkUSDAdapter', {
    contract: 'ChainlinkUSDAdapter',
    from: deployer.address,
    args: [
      usdtTokenAddress,
      usdtChainlinkPriceFeeder,
      constants.AddressZero,
      priceOracleAggregator.address,
    ],
    log: true,
  });
  await waitSeconds(5);
  (
    await priceOracleAggregatorContract.updateOracleForAsset(
      usdtTokenAddress,
      usdtChainlinkUSDAdapter.address
    )
  ).wait();

  /// WFTM ChainlinkUSDAdapter
  await waitSeconds(5);
  const wftmChainlinkUSDAdapter = await deploy('WFTMChainlinkUSDAdapter', {
    contract: 'ChainlinkUSDAdapter',
    from: deployer.address,
    args: [
      wftmTokenAddress,
      wftmChainlinkPriceFeeder,
      constants.AddressZero,
      priceOracleAggregator.address,
    ],
    log: true,
  });
  await waitSeconds(5);
  (
    await priceOracleAggregatorContract.updateOracleForAsset(
      wftmTokenAddress,
      wftmChainlinkUSDAdapter.address
    )
  ).wait();

  /// HEC<>USDC UniswapV2Oracle
  await waitSeconds(5);
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
  await waitSeconds(5);
  (await hecusdcUniswapV2OracleContract.setAllowStaleConsults(true)).wait();
  await waitSeconds(5);
  (await hecusdcUniswapV2OracleContract.update()).wait();
  await waitSeconds(5);
  (
    await priceOracleAggregatorContract.updateOracleForAsset(
      hectorTokenAddress,
      hecusdcUniswapV2Oracle.address
    )
  ).wait();

  /// HEC<>USDC UniswapV2LPOracle
  await waitSeconds(5);
  const hecusdcUniswapV2LPOracle = await deploy('UniswapV2LPOracle', {
    from: deployer.address,
    args: [hecusdclpTokenAddress, priceOracleAggregator.address],
    log: true,
  });
  await waitSeconds(5);
  (
    await priceOracleAggregatorContract.updateOracleForAsset(
      hecusdclpTokenAddress,
      hecusdcUniswapV2LPOracle.address
    )
  ).wait();

  /// BondV31
  await waitSeconds(5);
  const params = [
    'HecBondV3',
    hectorTokenAddress,
    deployer.address,
    priceOracleAggregator.address,
    lockFarmAddress,
    fnftAddress,
    tokenVaultAddress,
  ];
  const hectorBondNoTreasuryDepository = await deploy('BondNoTreasury', {
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

  /// BondV31 Initialize
  const contract = await ethers.getContract('BondNoTreasury', deployer);

  /// Initial Params
  const fundRecipient = '0xBF014a15198EDcFcb2921dE7099BF256DB31c4ba';
  const feeBps = 1000;
  const feeRecipients = [
    '0x906B738Dce4E20F672C1752e48f3627CF20b883a',
    '0xa79E9d90abeE6fC7b36E05FB7F9692e2CF2b368b',
  ];
  const weightBps = [1000, 9000];
  const autoStakingFeeBps = 1000;
  const autoStakingFeeRecipient = '0xBF014a15198EDcFcb2921dE7099BF256DB31c4ba';
  const minimumPrice = 100000;

  await waitSeconds(5);
  (await contract.setMinPrice(minimumPrice)).wait();
  await waitSeconds(5);
  (await contract.initializeFundRecipient(fundRecipient, feeBps)).wait();
  await waitSeconds(5);
  (await contract.initializeFeeRecipient(feeRecipients, weightBps)).wait();
  await waitSeconds(5);
  (
    await contract.initializeAutoStakingFee(
      true,
      autoStakingFeeRecipient,
      autoStakingFeeBps
    )
  ).wait();
  await waitSeconds(5);
  (await contract.initializeDepositTokens(principleAddresses)).wait();

  await waitSeconds(5);
  (await contract.setLockingDiscount(5 * 24 * 3600, 500)).wait(); // 5 days lock - 5%
  await waitSeconds(5);
  (await contract.setLockingDiscount(5 * 7 * 24 * 3600, 1000)).wait(); // 5 weeks lock - 10%
  await waitSeconds(5);
  (await contract.setLockingDiscount(5 * 30 * 24 * 3600, 1500)).wait(); // 5 months lock - 15%

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
        address: usdtChainlinkUSDAdapter.address,
        contract:
          'contracts/oracle/ChainlinkUSDAdapter.sol:ChainlinkUSDAdapter',
        constructorArguments: [
          usdtTokenAddress,
          usdtChainlinkPriceFeeder,
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
          'contracts/BondNoTreasury.sol:BondNoTreasury',
        constructorArguments: [],
      });
    } catch (error) {
      console.error(error);
    }
  }
};

export default deployBond;
deployBond.tags = ['BondV31'];
deployBond.dependencies = [];
