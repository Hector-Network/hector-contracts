import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { waitSeconds } from '../helper/helpers';
import { constants, utils } from 'ethers';

const deployBond: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, ethers } = hre;
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  const hectorToken = await deploy('HectorToken', {
    from: deployer.address,
    args: [],
    log: true,
  });

  const principle = await deploy('MockPrinciple', {
    from: deployer.address,
    args: [],
    log: true,
  });

  const params = [
    'TestBond',
    hectorToken.address,
    principle.address,
    deployer.address,
    constants.AddressZero,
  ];
  const hectorBondNoTreasuryDepository = await deploy(
    'HectorBondNoTreasuryDepository',
    {
      from: deployer.address,
      args: params,
      log: true,
    }
  );

  const controlVariable = 2;
  const vestingTerm = 5;
  const minimumPrice = 1500;
  const maxPayout = 500;
  const fee = 500;
  const maxDebt = utils.parseUnits('2000', 9);
  const totalSupply = utils.parseEther('5000');
  const initialDebt = utils.parseUnits('100', 9);
  const contract = await ethers.getContract(
    'HectorBondNoTreasuryDepository',
    deployer
  );
  await contract.initializeBondTerms(
    controlVariable,
    vestingTerm,
    minimumPrice,
    maxPayout,
    fee,
    maxDebt,
    totalSupply,
    initialDebt
  );
  await contract.setLockingDiscount(5 * 24 * 3600, 500); // 5 days lock - 5%
  await contract.setLockingDiscount(5 * 7 * 24 * 3600, 1000); // 7 weeks lock - 10%
  await contract.setLockingDiscount(5 * 30 * 24 * 3600, 1500); // 5 months lock - 15%

  if (hre.network.name !== 'localhost' && hre.network.name !== 'hardhat') {
    await waitSeconds(10);
    console.log('=====> Verifing ....');
    try {
      await hre.run('verify:verify', {
        address: hectorToken.address,
        contract: 'contracts/HEC.sol:HectorToken',
        constructorArguments: [],
      });
    } catch (_) {}
    try {
      await hre.run('verify:verify', {
        address: principle.address,
        contract: 'contracts/mock/MockPrinciple.sol:MockPrinciple',
        constructorArguments: [],
      });
    } catch (_) {}
    try {
      await hre.run('verify:verify', {
        address: hectorBondNoTreasuryDepository.address,
        contract:
          'contracts/HectorBondNoTreasuryDepository.sol:HectorBondNoTreasuryDepository',
        constructorArguments: params,
      });
    } catch (_) {}
  }
};

export default deployBond;
deployBond.tags = ['Bond'];
deployBond.dependencies = [];
