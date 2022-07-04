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
  console.log('StakingToken: ', stakingToken.address);

  await waitSeconds(60);
  // Deploy RewardToken
  const rewardToken = await deployRewardToken();
  console.log('RewardToken: ', rewardToken.address);

  await waitSeconds(60);
  // Deploy Treasury
  const treasury = await deployTreasury(rewardToken.address);
  console.log('Treasury: ', treasury.address);

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
    stakingToken.address,
    rewardToken.address
  );
  console.log('LockFarm: ', lockFarm.address);

  await waitSeconds(60);
  // Deploy sLockFarm
  const sLockFarm = await deploySLockFarm(
    lockAddressRegistry.address,
    stakingToken.address,
    rewardToken.address
  );
  console.log('sLockFarm: ', sLockFarm.address);

  await waitSeconds(60);
  // Deploy Emissionor
  // const treasuryAddress = '0x724c670d0215cC75d990b7D28604A84E1F1caa1c';
  const splitterAddress = '0xBc8fC4220ac10ceA512743d3816AB972243E42AF';
  // const rewardTokenAddress = '0xBa5B18A16d54a9687EFE5eeEbc15c223b575aBfd';
  const emissionor = await deployEmissionor(
    treasury.address,
    splitterAddress,
    rewardToken.address
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
    await waitSeconds(30);
    await lockAddressRegistry.addFarm(sLockFarm.address);
  } catch (_) {}

  // Verify
  await waitSeconds(10);
  console.log('=====> Verifing ....');
  try {
    await hre.run('verify:verify', {
      address: stakingToken.address,
      contract: 'contracts/mock/StakingToken.sol:StakingToken',
      constructorArguments: [],
    });
  } catch (_) {}
  try {
    await hre.run('verify:verify', {
      address: rewardToken.address,
      contract: 'contracts/mock/RewardToken.sol:RewardToken',
      constructorArguments: [],
    });
  } catch (_) {}
  try {
    await hre.run('verify:verify', {
      address: treasury.address,
      contract: 'contracts/mock/Treasury.sol:Treasury',
      constructorArguments: [rewardToken.address],
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
        stakingToken.address,
        rewardToken.address,
      ],
    });
  } catch (_) {}
  try {
    await hre.run('verify:verify', {
      address: sLockFarm.address,
      contract: 'contracts/sLockFarm.sol:sLockFarm',
      constructorArguments: [
        lockAddressRegistry.address,
        stakingToken.address,
        rewardToken.address,
      ],
    });
  } catch (_) {}
  try {
    await hre.run('verify:verify', {
      address: emissionor.address,
      contract: 'contracts/Emissionor.sol:Emissionor',
      constructorArguments: [
        treasury.address,
        splitterAddress,
        rewardToken.address,
      ],
    });
  } catch (_) {}
};

deploy.tags = ['LockFarm'];
export default deploy;
