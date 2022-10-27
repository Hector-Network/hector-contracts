import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import { deployVotingFarm, waitSeconds } from '../helper';

const deploy: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const prod_mode = false;
	const _hec = prod_mode ? '' : '0x55639b1833Ddc160c18cA60f5d0eC9286201f525';
	const _sHec = prod_mode ? '' : '0x71264c23604fa78D1eFcc32af1c73714F33dCdb4';
	const _usdc = prod_mode ? '' : '0x6f3da9C6700cAfBAb0323cF344F58C54B3ddB66b';
	const _spookySwapFactory = prod_mode ? '' : '0xEE4bC42157cf65291Ba2FE839AE127e3Cc76f741';
	const _spookySwapRotuer = prod_mode ? '' : '0xa6AD18C2aC47803E193F75c3677b14BF19B94883';
	const _lockAddressRegistry = prod_mode ? '' : '0x2D86a40Ff217493cCE3a23627F6A749dAe1f9018';
	const _tokenVault = prod_mode ? '' : '0x4b7dC9E2Cc8B97Fe6073d03667Aed96c071c532B';

	// Deploy VotingFarm
	const votingFarm = await deployVotingFarm(_hec, _sHec, _usdc, _spookySwapFactory, _spookySwapRotuer, _tokenVault);
	console.log('VotingFarm: ', votingFarm.address);
	await waitSeconds(10);

	const lockFarm = prod_mode
		? [
				'0xA8Da61Aa8Bf842108E6B56fe2413c5202bC29314',
				'0x154DB5831563dE6A5106F009F90c8E8F22aa0256',
				'0x17Bc07cbc957c00A975e69d44F5f710b94842C00',
				'0x3725d31991D4C3A2EF35eD629a6b5091902c39dA',
				'0x1b7B4A3E58fB537808b0DbA080a9669aC1835893',
				'0xA618A41Aee8877360fad7f16bB118b4bCc35313C',
				'0xAbC608aeA6faF6cA40eB6Ef150f09734E600b038',
				'0xeA829Ec1951f7b9AE7F3ffa3a249E702b222564c',
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
		  ];
	const stakingToken = prod_mode
		? [
				'0x55639b1833Ddc160c18cA60f5d0eC9286201f525',
				'0x55639b1833Ddc160c18cA60f5d0eC9286201f525',
				'0x55639b1833Ddc160c18cA60f5d0eC9286201f525',
				'0x55639b1833Ddc160c18cA60f5d0eC9286201f525',
				'0x55639b1833Ddc160c18cA60f5d0eC9286201f525',
				'0x71264c23604fa78D1eFcc32af1c73714F33dCdb4',
				'0x6225eeA79a0baF0c7e368Db4de1e8066589815B1',
				'0x9C4Ee29CD1C219623eBEA40A42b5af11414D7C90',
		  ]
		: [
				'0x55639b1833Ddc160c18cA60f5d0eC9286201f525',
				'0x55639b1833Ddc160c18cA60f5d0eC9286201f525',
				'0x55639b1833Ddc160c18cA60f5d0eC9286201f525',
				'0x55639b1833Ddc160c18cA60f5d0eC9286201f525',
				'0x55639b1833Ddc160c18cA60f5d0eC9286201f525',
				'0x71264c23604fa78D1eFcc32af1c73714F33dCdb4',
				'0x6225eeA79a0baF0c7e368Db4de1e8066589815B1',
				'0x9C4Ee29CD1C219623eBEA40A42b5af11414D7C90',
		  ];

	// Add LockFarms
	for (let i = 0; i < lockFarm.length; i++) {
		await votingFarm.addLockFarmForOwner(lockFarm[i], stakingToken[i], _lockAddressRegistry);
		await waitSeconds(3);
	}

	// Set vote delay time
	// await votingFarm.setVoteDelay(1800);

	try {
		await hre.run('verify:verify', {
			address: votingFarm.address,
			contract: 'contracts/VotingFarm.sol:VotingFarm',
			constructorArguments: [_hec, _sHec, _usdc, _spookySwapFactory, _spookySwapRotuer, _tokenVault],
		});
	} catch (_) {}
};

deploy.tags = ['VotingFarm'];
export default deploy;
