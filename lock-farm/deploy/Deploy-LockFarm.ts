import { deployRewardWeight, deploySplitter } from './../helper/contracts';
import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import {
  deployStakingToken,
  deployRewardToken,
  deployTreasury,
  deployLockAddressRegistry,
  deployFNFT,
  deployTokenVault,
  deployLockFarm,
  deploySLockFarm,
  deployEmissionor,
  waitSeconds,
} from '../helper';

const deploy: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const signers = await ethers.getSigners();
  const deployer = signers[0];

  // Deploy StakingToken
  const stakingTokenAddress = '0xc625fa79F79c34Dc38ed717161B76Be01975cf29';
  // console.log('StakingToken: ', stakingToken.address);

  // await waitSeconds(60);
  // Deploy RewardToken
  const rewardTokenAddress = '0x55639b1833Ddc160c18cA60f5d0eC9286201f525';
  // console.log('RewardToken: ', rewardToken.address);

  await waitSeconds(60);
  // Deploy Treasury
  const treasury = await deployTreasury();
  console.log('Treasury: ', treasury.address);
  // Set Hector
  try {
    await treasury.setHector(rewardTokenAddress);
  } catch (_) {}

  await waitSeconds(60);
  // Deploy LockAddressRegistry
  const lockAddressRegistry = await deployLockAddressRegistry();
  console.log('LockAddressRegistry: ', lockAddressRegistry.address);

  await waitSeconds(60);
  // Deploy FNFT
  const fnft = await deployFNFT(lockAddressRegistry.address);
  console.log('FNFT: ', fnft.address);

  await waitSeconds(60);
  // Deploy TokenVault
  const tokenVault = await deployTokenVault(lockAddressRegistry.address);
  console.log('TokenVault: ', tokenVault.address);

  await waitSeconds(60);
  // Deploy LockFarm
  const lockFarm = await deployLockFarm(
    lockAddressRegistry.address,
    'LockFarm #1',
    stakingTokenAddress,
    rewardTokenAddress
  );
  console.log('LockFarm: ', lockFarm.address);

  await waitSeconds(60);
  // Deploy RewardWeight
  const rewardWeight = await deployRewardWeight();
  try {
    await rewardWeight.register(lockFarm.address, 400);
  } catch (_) {}
  console.log('RewardWeight: ', rewardWeight.address);

  await waitSeconds(60);
  // Deploy SplitterD
  const splitter = await deploySplitter(rewardWeight.address);
  console.log('Splitter: ', splitter.address);
  // Register & Set Reward Token
  try {
    await splitter.setRewardToken(rewardTokenAddress);
    await splitter.register(lockFarm.address);
  } catch (_) {}

  await waitSeconds(60);
  // Deploy Emissionor
  // const treasuryAddress = '0x724c670d0215cC75d990b7D28604A84E1F1caa1c';
  // const rewardTokenAddress = '0xBa5B18A16d54a9687EFE5eeEbc15c223b575aBfd';
  const emissionor = await deployEmissionor(
    treasury.address,
    splitter.address,
    rewardTokenAddress
  );
  console.log('Emissionor: ', emissionor.address);

  await waitSeconds(60);
  // Register Addressses
  try {
    await lockAddressRegistry.initialize(
      deployer.address,
      tokenVault.address,
      fnft.address,
      emissionor.address
    );
    await waitSeconds(30);
    await lockAddressRegistry.addFarm(lockFarm.address);
  } catch (_) {}
  // Set Reward Manager
  try {
    await treasury.setRewardManager(emissionor.address);
  } catch (_) {}

  // Verify
  await waitSeconds(10);
  console.log('=====> Verifing ....');
  // try {
  //   await hre.run('verify:verify', {
  //     address: stakingToken.address,
  //     contract: 'contracts/WrappedToken.sol:WrappedToken',
  //     constructorArguments: [
  //       'Hector',
  //       'HEC',
  //       '0x55639b1833Ddc160c18cA60f5d0eC9286201f525',
  //     ],
  //   });
  // } catch (_) {}
  // try {
  //   await hre.run('verify:verify', {
  //     address: rewardToken.address,
  //     contract: 'contracts/mock/RewardToken.sol:RewardToken',
  //     constructorArguments: [],
  //   });
  // } catch (_) {}
  try {
    await hre.run('verify:verify', {
      address: treasury.address,
      contract: 'contracts/mock/HectorMinterMock.sol:HectorMinterMock',
      constructorArguments: [],
    });
  } catch (_) {}
  try {
    await hre.run('verify:verify', {
      address: lockAddressRegistry.address,
      contract: 'contracts/LockAddressRegistry.sol:LockAddressRegistry',
      constructorArguments: [],
    });
  } catch (_) {}
  try {
    await hre.run('verify:verify', {
      address: fnft.address,
      contract: 'contracts/FNFT.sol:FNFT',
      constructorArguments: [lockAddressRegistry.address],
    });
  } catch (_) {}
  try {
    await hre.run('verify:verify', {
      address: tokenVault.address,
      contract: 'contracts/TokenVault.sol:TokenVault',
      constructorArguments: [lockAddressRegistry.address],
    });
  } catch (_) {}
  try {
    await hre.run('verify:verify', {
      address: lockFarm.address,
      contract: 'contracts/LockFarm.sol:LockFarm',
      constructorArguments: [
        lockAddressRegistry.address,
        'LockFarm #1',
        stakingTokenAddress,
        rewardTokenAddress,
      ],
    });
  } catch (_) {}
  try {
    await hre.run('verify:verify', {
      address: rewardWeight.address,
      contract: 'contracts/RewardWeight.sol:RewardWeight',
      constructorArguments: [],
    });
  } catch (_) {}
  try {
    await hre.run('verify:verify', {
      address: rewardWeight.address,
      contract: 'contracts/SplitterDistributor.sol:Splitter',
      constructorArguments: [rewardWeight.address],
    });
  } catch (_) {}
  try {
    await hre.run('verify:verify', {
      address: emissionor.address,
      contract: 'contracts/Emissionor.sol:Emissionor',
      constructorArguments: [
        treasury.address,
        splitter.address,
        rewardTokenAddress,
      ],
    });
  } catch (_) {}
};

deploy.tags = ['LockFarm'];
export default deploy;
