import { Voting } from './../types';
import { Contract } from 'ethers';
import exec from 'child_process';
require('dotenv').config();
const hre = require('hardhat');

export const deployContract = async <ContractType extends Contract>(
	contractName: string,
	args: any[],
	libraries?: {}
) => {
	const signers = await hre.ethers.getSigners();
	const contract = (await (
		await hre.ethers.getContractFactory(contractName, signers[0], {
			libraries: {
				...libraries,
			},
		})
	).deploy()) as ContractType;

	const txInit = await contract.connect(signers[0]).initialize(...args);
	await txInit.wait();

	return contract;
};

export const deployVoting = async (
	_verion: any,
	_hec: any,
	_sHec: any,
	_wsHec: any,
	_tokenVault: any,
	_maxPercentage: any,
	_voteDelay: any
) => {
	return await deployContract<Voting>('Voting', [
		_verion,
		_hec,
		_sHec,
		_wsHec,
		_tokenVault,
		_maxPercentage,
		_voteDelay,
	]);
};
