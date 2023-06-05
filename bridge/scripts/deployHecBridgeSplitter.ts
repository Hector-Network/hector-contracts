import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { waitSeconds } from '../helper/helpers';
import { ethers } from 'hardhat';
import { constants } from 'ethers';

async function getImplementationAddress(proxyAddress: string) {
	const implHex = await ethers.provider.getStorageAt(proxyAddress, '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc');
	return ethers.utils.hexStripZeros(implHex);
}

const deployHecBridgeSplitter: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const { deployments, ethers } = hre;
	const { deploy } = deployments;
	const [deployer] = await ethers.getSigners();

	const squidRouter = '0xce16f69375520ab01377ce7b88f5ba8c48f8d666';
	const CountDest = 2;

	const HecBridgeSplitter = await deploy('HecBridgeSplitter', {
		from: deployer.address,
		args: [],
		log: true,
		proxy: {
			proxyContract: 'OpenZeppelinTransparentProxy',
			execute: {
				methodName: 'initialize',
				args: [CountDest, squidRouter],
			},
		},
	});
	const HecBridgeSplitterImplementation = await getImplementationAddress(HecBridgeSplitter.address);

	if (hre.network.name !== 'localhost' && hre.network.name !== 'hardhat') {
		await waitSeconds(10);
		console.log('=====> Verifing ....');
		try {
			await hre.run('verify:verify', {
				address: HecBridgeSplitterImplementation,
				contract: 'contracts/HecBridgeSplitter.sol:HecBridgeSplitter',
				constructorArguments: [],
			});
		} catch (_) {}
		await waitSeconds(10);
	}
};

export default deployHecBridgeSplitter;
deployHecBridgeSplitter.tags = ['HecBridgeSplitter'];
deployHecBridgeSplitter.dependencies = [];
