import hre from 'hardhat';
const BigNumber = require('bignumber.js');
const { boolean } = require('hardhat/internal/core/params/argumentTypes');
import { waitSeconds } from '../helper';

async function main() {
	const version = '2.0';
	const prod_mode = process.env.PROD_MODE == 'true' ? true : false;
	const [deployer] = await hre.ethers.getSigners();
	const _hec = prod_mode
		? '0x5C4FDfc5233f935f20D2aDbA572F770c2E377Ab0'
		: '0x55639b1833Ddc160c18cA60f5d0eC9286201f525';
	const _sHec = prod_mode
		? '0x75bdeF24285013387A47775828bEC90b91Ca9a5F'
		: '0x71264c23604fa78D1eFcc32af1c73714F33dCdb4';
	const _wsHec = prod_mode
		? '0x94CcF60f700146BeA8eF7832820800E2dFa92EdA'
		: '0x6225eeA79a0baF0c7e368Db4de1e8066589815B1';
	const _hecUsdc = prod_mode
		? '0x0b9589A2C1379138D4cC5043cE551F466193c8dE'
		: '0x9C4Ee29CD1C219623eBEA40A42b5af11414D7C90';
	const _hecTor = prod_mode
		? '0x4339b475399ad7226be3ad2826e1d78bbfb9a0d9'
		: '0xd02a80B4A58308B1aD8652abe348Ae2Ca241E636';
	const _lockAddressRegistry = prod_mode
		? '0x55639b1833Ddc160c18cA60f5d0eC9286201f525'
		: '0x2D86a40Ff217493cCE3a23627F6A749dAe1f9018';
	const _tokenVault = prod_mode
		? '0x1fA6693d9933CC7f578CDd35071FC6d6cc8451E0'
		: '0x4b7dC9E2Cc8B97Fe6073d03667Aed96c071c532B';
	const _maxPercentage = 100;
	const _voteDelay = prod_mode ? 604800 : 5;

	const lockFarm = prod_mode
		? [
				'0x80993B75e38227f1A3AF6f456Cf64747F0E21612',
				'0xd7faE64DD872616587Cc8914d4848947403078B8',
				'0xB13610B4e7168f664Fcef2C6EbC58990Ae835Ff1',
		  ]
		: [
				'0xC464e6d45004Bf56772E70e22d9cF61C5Ae63970',
				'0x55869De94AB1F18295C1C5aC3C1c80995F2D5a2E',
				'0x9DF988299260F5A21C3b903630cF53e1C5688990',
				'0xE54C5c3C00Ca22c7Bf471923F17f41Fc94a8F31c',
				'0x6B047365B1C75772f7CaF922FD71c8106F2B0c71',
				'0xea08E048643Bf498741774348Ae7aFb16B9DbA40',
				'0x9391abd498Ecb2Be226e446a76a8b9C61932856C',
				'0x0112F57a5EF77b7D074D7213127Df8E907D017bE',
				'0xDb798136b7Eb1167fe3242cdb34af0f1a890EC20',
		  ];

	const stakingToken = prod_mode
		? [_hec, _hecUsdc, _hecTor]
		: [_hec, _hec, _hec, _hec, _hec, _sHec, _wsHec, _hecUsdc, _hecTor];

	console.log({ prod_mode });
	console.log('Deploying contracts with the account:', deployer.address);
	console.log('Account balance:', (await deployer.getBalance()).toString());

	const gas = await hre.ethers.provider.getGasPrice();
	console.log('Gas Price: ', gas);

	const votingFactory = await hre.ethers.getContractFactory('Voting');
	console.log('Deploying Voting Contract...');

	const votingContract = await hre.upgrades.deployProxy(
		votingFactory,
		[
			version,
			_hec,
			_sHec,
			_wsHec,
			_tokenVault,
			_maxPercentage,
			_voteDelay,
		],
		{
			gas: gas,
			initializer: 'initialize',
		}
	);
	console.log('Voting contract deployed to:', votingContract.address);

	// Add LockFarms
	for (let i = 0; i < lockFarm.length; i++) {
		await votingContract.addLockFarmForOwner(lockFarm[i], stakingToken[i], _lockAddressRegistry);
		await waitSeconds(3);
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
