import { ethers } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

import {
    deployVotingFarm,
    waitSeconds
} from '../helper';

const deploy: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const signers = await ethers.getSigners();
  const deployer = signers[0];

  const _fnft =  "0xD13B8382fF3c1628547c91C001f8d97c21413671";
  const _hec = "0x55639b1833Ddc160c18cA60f5d0eC9286201f525";
  const _lockFarm = "0x3b503F665039d532bef21E6Df3Ed474f4d810eF6";

  // Deploy VotingFarm
  const votingFarm = await deployVotingFarm(
    _fnft,
    _hec,
    _lockFarm
  );
  console.log('VotingFarm: ', votingFarm.address);

  await waitSeconds(10);

  try {
    await hre.run('verify:verify', {
      address: votingFarm.address,
      contract: 'contracts/VotingFarm.sol:VotingFarm',
      constructorArguments: [
        _fnft,
        _hec,
        _lockFarm
      ],
    });
  } catch (_) {}
};

deploy.tags = ['VotingFarm'];
export default deploy;
