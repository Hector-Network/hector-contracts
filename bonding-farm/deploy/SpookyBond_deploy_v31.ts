import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { waitSeconds } from '../helper/helpers';
import { ethers } from 'hardhat';
import { constants } from 'ethers';

async function getImplementationAddress(proxyAddress: string) {
	const implHex = await ethers.provider.getStorageAt(proxyAddress, '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc');
	return ethers.utils.hexStripZeros(implHex);
}

const deployBond: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const { deployments, ethers } = hre;
	const { deploy } = deployments;
	const [deployer] = await ethers.getSigners();

	/// Token Address
	const daiTokenAddress = '0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e';
	const usdcTokenAddress = '0x04068da6c83afcfa0e13ba15a6696662335d5b75';
	const booTokenAddress = '0x841FAD6EAe12c286d1Fd18d1d525DFfA75C7EFFE';

	const principleAddresses = [daiTokenAddress, usdcTokenAddress];

	/// Oracle Address
	const daiChainlinkPriceFeeder = '0x91d5DEFAFfE2854C7D02F50c80FA1fdc8A721e52';
	const usdcChainlinkPriceFeeder = '0x2553f4eeb82d5A26427b8d1106C51499CBa5D99c';
	const booChainlinkPriceFeeder = '0xc8c80c17f05930876ba7c1dd50d9186213496376';

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
	const priceOracleAggregatorContract = await ethers.getContract('PriceOracleAggregator', deployer);

	/// BOO ChainlinkUSDAdapter
	await waitSeconds(5);
	const booChainlinkUSDAdapter = await deploy('BOOChainlinkUSDAdapter', {
		contract: 'ChainlinkUSDAdapter',
		from: deployer.address,
		args: [booTokenAddress, booChainlinkPriceFeeder, constants.AddressZero, priceOracleAggregator.address],
		log: true,
	});
	await waitSeconds(5);
	(await priceOracleAggregatorContract.updateOracleForAsset(booTokenAddress, booChainlinkUSDAdapter.address)).wait();

	/// DAI ChainlinkUSDAdapter
	await waitSeconds(5);
	const daiChainlinkUSDAdapter = await deploy('DAIChainlinkUSDAdapter', {
		contract: 'ChainlinkUSDAdapter',
		from: deployer.address,
		args: [daiTokenAddress, daiChainlinkPriceFeeder, constants.AddressZero, priceOracleAggregator.address],
		log: true,
	});
	await waitSeconds(5);
	(await priceOracleAggregatorContract.updateOracleForAsset(daiTokenAddress, daiChainlinkUSDAdapter.address)).wait();

	/// USDC ChainlinkUSDAdapter
	await waitSeconds(5);
	const usdcChainlinkUSDAdapter = await deploy('USDCChainlinkUSDAdapter', {
		contract: 'ChainlinkUSDAdapter',
		from: deployer.address,
		args: [usdcTokenAddress, usdcChainlinkPriceFeeder, constants.AddressZero, priceOracleAggregator.address],
		log: true,
	});
	await waitSeconds(5);
	(await priceOracleAggregatorContract.updateOracleForAsset(usdcTokenAddress, usdcChainlinkUSDAdapter.address)).wait();

	/// BondV31
	await waitSeconds(5);
	const params = ['Boo Bonding Farm', booTokenAddress, deployer.address, priceOracleAggregator.address, lockFarmAddress, fnftAddress, tokenVaultAddress];
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
	const hectorBondNoTreasuryDepositoryImplementation = await getImplementationAddress(hectorBondNoTreasuryDepository.address);

	/// BondV31 Initialize
	const contract = await ethers.getContract('BondNoTreasury', deployer);

	/// Initial Params
	const fundRecipient = '0xBF014a15198EDcFcb2921dE7099BF256DB31c4ba'; //Waiting to get real wallet from spooky
	const feeBps = 220; //2.2%
	const feeRecipients = ['0x08d2C94F47b5Ca3C3193e599276AAbF24aADc9a1']; //change to LIVE address: 0x677d6EC74fA352D4Ef9B1886F6155384aCD70D90
	const weightBps = [10000];
	const autoStakingFeeBps = 0;
	const autoStakingFeeRecipient = '0xBF014a15198EDcFcb2921dE7099BF256DB31c4ba';
	const minimumPrice = 32000000; // 0.32 10^8

	await waitSeconds(5);
	(await contract.setMinPrice(minimumPrice)).wait();
	await waitSeconds(5);
	(await contract.initializeFundRecipient(fundRecipient, feeBps)).wait();
	await waitSeconds(5);
	(await contract.initializeFeeRecipient(feeRecipients, weightBps)).wait();
	await waitSeconds(5);
	//NO AutoStaking FOR Boo Bonding Farm
	(await contract.initializeAutoStakingFee(false, autoStakingFeeRecipient, autoStakingFeeBps)).wait();
	await waitSeconds(5);
	(await contract.initializeDepositTokens(principleAddresses)).wait();

	await waitSeconds(5);
	(await contract.setLockingDiscount(5 * 24 * 3600, 50)).wait(); // 5 days lock - 0.5%
	await waitSeconds(5);
	(await contract.setLockingDiscount(2.5 * 7 * 24 * 3600, 250)).wait(); // 2.5 weeks lock - 2.5%
	await waitSeconds(5);
	(await contract.setLockingDiscount(5 * 7 * 24 * 3600, 300)).wait(); // 5 weeks lock - 3%

	if (hre.network.name !== 'localhost' && hre.network.name !== 'hardhat') {
		await waitSeconds(10);
		console.log('=====> Verifing ....');
		try {
			await hre.run('verify:verify', {
				address: priceOracleAggregator.address,
				contract: 'contracts/oracle/PriceOracleAggregator.sol:PriceOracleAggregator',
				constructorArguments: [],
			});
		} catch (_) {}
		await waitSeconds(10);
		try {
			await hre.run('verify:verify', {
				address: booChainlinkUSDAdapter.address,
				contract: 'contracts/oracle/ChainlinkUSDAdapter.sol:ChainlinkUSDAdapter',
				constructorArguments: [booTokenAddress, booChainlinkPriceFeeder, constants.AddressZero, priceOracleAggregator.address],
			});
		} catch (_) {}
		await waitSeconds(10);
		try {
			await hre.run('verify:verify', {
				address: daiChainlinkUSDAdapter.address,
				contract: 'contracts/oracle/ChainlinkUSDAdapter.sol:ChainlinkUSDAdapter',
				constructorArguments: [daiTokenAddress, daiChainlinkPriceFeeder, constants.AddressZero, priceOracleAggregator.address],
			});
		} catch (_) {}
		await waitSeconds(10);
		try {
			await hre.run('verify:verify', {
				address: usdcChainlinkUSDAdapter.address,
				contract: 'contracts/oracle/ChainlinkUSDAdapter.sol:ChainlinkUSDAdapter',
				constructorArguments: [usdcTokenAddress, usdcChainlinkPriceFeeder, constants.AddressZero, priceOracleAggregator.address],
			});
		} catch (_) {}
		await waitSeconds(10);
		try {
			await hre.run('verify:verify', {
				address: hectorBondNoTreasuryDepositoryImplementation,
				contract: 'contracts/BondNoTreasury.sol:BondNoTreasury',
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
