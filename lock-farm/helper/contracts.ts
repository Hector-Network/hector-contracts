import { RewardWeight } from './../types/contracts/RewardWeight.sol/RewardWeight';
import {
  FNFT,
  LockAccessControl,
  LockAddressRegistry,
  TokenVault,
  Emissionor,
  LockFarm,
  SLockFarm,
  RewardToken,
  WrappedToken,
  HectorMinterMock,
  Splitter,
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

export const deployLockAddressRegistry = async () => {
  return await deployContract<LockAddressRegistry>('LockAddressRegistry', []);
};

export const deployLockAccessControl = async (provider: any) => {
  return await deployContract<LockAccessControl>('LockAccessControl', [
    provider,
  ]);
};

export const deployFNFT = async (provider: any) => {
  return await deployContract<FNFT>('FNFT', [provider]);
};

export const deployTokenVault = async (provider: any) => {
  return await deployContract<TokenVault>('TokenVault', [provider]);
};

export const deployEmissionor = async (
  treasury: any,
  splitter: any,
  rewardToken: any
) => {
  return await deployContract<Emissionor>('Emissionor', [
    treasury,
    splitter,
    rewardToken,
  ]);
};

export const deployRewardToken = async () => {
  return await deployContract<RewardToken>('RewardToken', []);
};

export const deployStakingToken = async () => {
  return await deployContract<WrappedToken>('WrappedToken', [
    'Hector',
    'HEC',
    '0x55639b1833Ddc160c18cA60f5d0eC9286201f525',
  ]);
};

export const deployTreasury = async () => {
  return await deployContract<HectorMinterMock>('HectorMinterMock', []);
};

export const deployLockFarm = async (
  provider: any,
  name: any,
  stakingToken: any,
  rewardToken: any
) => {
  return await deployContract<LockFarm>('LockFarm', [
    provider,
    name,
    stakingToken,
    rewardToken,
  ]);
};

export const deploySLockFarm = async (
  provider: any,
  stakingToken: any,
  rewardToken: any
) => {
  return await deployContract<SLockFarm>('sLockFarm', [
    provider,
    stakingToken,
    rewardToken,
  ]);
};

export const deployRewardWeight = async () => {
  return await deployContract<RewardWeight>('RewardWeight', []);
};

export const deploySplitter = async (rewardWeightContract: any) => {
  return await deployContract<Splitter>('Splitter', [rewardWeightContract]);
};
