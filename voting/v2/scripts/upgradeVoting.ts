const { ethers, upgrades } = require('hardhat');

const UPGRADEABLE_PROXY = process.env.VOTING_ADDRESS;

async function main() {
	const [deployer] = await ethers.getSigners();

	console.log('Deploying contracts with the account:', deployer.address);
	console.log('Account balance:', (await deployer.getBalance()).toString());

	const gas = await ethers.provider.getGasPrice();
	const UpgradeContract = await ethers.getContractFactory('Voting');
	console.log('Upgrading Voting...');
	let upgrade = await upgrades.upgradeProxy(UPGRADEABLE_PROXY, UpgradeContract, {
		gasPrice: gas,
	});

	console.log('Voting contract upgraded to:', upgrade.address);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
