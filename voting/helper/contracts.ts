import {
  Voting
} from './../types';
import { Contract } from 'ethers';

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
  ).deploy(...args)) as ContractType;

  return contract;
};

export const deployVoting = async (
  _hec: any,
  _sHec: any,
  _wsHec: any,
  _usdc: any,
  _spookySwapFactory: any,
  _spookySwapRotuer: any,
) => {
  return await deployContract<Voting>('Voting', [
    _hec, _sHec, _wsHec, _usdc, _spookySwapFactory, _spookySwapRotuer
  ]);
};