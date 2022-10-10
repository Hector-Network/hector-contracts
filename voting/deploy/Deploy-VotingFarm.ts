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

  const _fnft =  "0x669CD4d138669740D8c5a4417B6a7599bfe5434A";
  const _hec = "0x55639b1833Ddc160c18cA60f5d0eC9286201f525";
  const _lockFarm = "0x6Bd2b014547d7e1b05fDe0CB62c8717216c6E9ec";

  // Deploy VotingFarm
  const votingFarm = await deployVotingFarm(
    _hec,
  );
  console.log('VotingFarm: ', votingFarm.address);

  await waitSeconds(10);

  try {
    await hre.run('verify:verify', {
      address: votingFarm.address,
      contract: 'contracts/VotingFarm.sol:VotingFarm',
      constructorArguments: [
        _hec,
      ],
    });
  } catch (_) {}
};

deploy.tags = ['VotingFarm'];
export default deploy;