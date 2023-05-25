import { HecBridgeSplitter } from './../types';
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

export const deployHecBridgeSplitter = async (_countDest: any, _bridge: any) => {
	return await deployContract<HecBridgeSplitter>('HecBridgeSplitter', [
		_countDest,
		_bridge,
	]);
};
