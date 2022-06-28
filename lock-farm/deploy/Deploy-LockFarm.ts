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
  const stakingToken = await deployStakingToken();
  await stakingToken.mint();
  console.log('StakingTokne: ', stakingToken.address);

  // Deploy RewardToken
  const rewardToken = await deployRewardToken();
  console.log('RewardToken: ', rewardToken.address);

  // Deploy Treasury
  const treasury = await deployTreasury(rewardToken.address);
  console.log('Treasury: ', treasury.address);

  // Deploy LockAddressRegistry
  const lockAddressRegistry = await deployLockAddressRegistry();
  console.log('LockAddressRegistry: ', lockAddressRegistry.address);

  // Deploy FNFT
  const fnft = await deployFNFT(lockAddressRegistry.address);
  console.log('FNFT: ', fnft.address);

  // Deploy TokenVault
  const tokenVault = await deployTokenVault(lockAddressRegistry.address);
  console.log('TokenVault: ', tokenVault.address);

  // Deploy LockFarm
  const lockFarm = await deployLockFarm(
    lockAddressRegistry.address,
    stakingToken.address,
    rewardToken.address
  );
  console.log('LockFarm: ', lockFarm.address);

  // Deploy sLockFarm
  const sLockFarm = await deploySLockFarm(
    lockAddressRegistry.address,
    stakingToken.address,
    rewardToken.address
  );
  console.log('sLockFarm: ', sLockFarm.address);

  // Deploy Emissionor
  const emissionor = await deployEmissionor(
    treasury.address,
    lockFarm.address,
    rewardToken.address
  );
  console.log('Emissionor: ', emissionor.address);

  // Register Addressses
  await lockAddressRegistry.initialize(
    deployer.address,
    tokenVault.address,
    fnft.address,
    emissionor.address
  );
  await lockAddressRegistry.addFarm(lockFarm.address);
  await lockAddressRegistry.addFarm(sLockFarm.address);

  // Verify
  await waitSeconds(2);
  await hre.run('verify:verify', {
    address: stakingToken.address,
    contract: 'contracts/mock/StakingToken.sol:StakingToken',
    constructorArguments: [],
  });
  // await hre.run('verify:verify', {
  //   address: rewardToken.address,
  //   contract: 'contracts/mock/RewardToken.sol:RewardToken',
  //   constructorArguments: [],
  // });
  // await hre.run('verify:verify', {
  //   address: treasury.address,
  //   contract: 'contracts/mock/Treasury.sol:Treasury',
  //   constructorArguments: [rewardToken.address],
  // });
  // await hre.run('verify:verify', {
  //   address: lockAddressRegistry.address,
  //   contract: 'contracts/LockAddressRegistry.sol:LockAddressRegistry',
  //   constructorArguments: [],
  // });
  // await hre.run('verify:verify', {
  //   address: fnft.address,
  //   contract: 'contracts/FNFT.sol:FNFT',
  //   constructorArguments: [lockAddressRegistry.address],
  // });
  // await hre.run('verify:verify', {
  //   address: tokenVault.address,
  //   contract: 'contracts/TokenVault.sol:TokenVault',
  //   constructorArguments: [lockAddressRegistry.address],
  // });
  // await hre.run('verify:verify', {
  //   address: lockFarm.address,
  //   contract: 'contracts/LockFarm.sol:LockFarm',
  //   constructorArguments: [
  //     lockAddressRegistry.address,
  //     stakingToken.address,
  //     rewardToken.address,
  //   ],
  // });
  // await hre.run('verify:verify', {
  //   address: sLockFarm.address,
  //   contract: 'contracts/sLockFarm.sol:sLockFarm',
  //   constructorArguments: [
  //     lockAddressRegistry.address,
  //     stakingToken.address,
  //     rewardToken.address,
  //   ],
  // });
  // await hre.run('verify:verify', {
  //   address: emissionor.address,
  //   contract: 'contracts/Emissionor.sol:Emissionor',
  //   constructorArguments: [
  //     treasury.address,
  //     lockFarm.address,
  //     rewardToken.address,
  //   ],
  // });
};

deploy.tags = ['LockFarm'];
export default deploy;
