import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { constants } from 'ethers';
import { waitSeconds } from '../helper/helpers';

async function getImplementationAddress(proxyAddress: string) {
  const implHex = await ethers.provider.getStorageAt(
    proxyAddress,
    '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'
  );
  return ethers.utils.hexStripZeros(implHex);
}

const deployPay: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, ethers } = hre;
  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  /// Token Address: Mainnet
  const wbtcTokenAddress = '0x321162cd933e2be498cd2267a90534a804051b11';
  const wethTokenAddress = '0x74b23882a30290451a17c44f4f05243b6b58c76d';
  const wftmTokenAddress = '0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83';
  const fraxTokenAddress = '0xdc301622e621166bd8e82f2ca0a26c13ad0be355';
  const booTokenAddress = '0x841fad6eae12c286d1fd18d1d525dffa75c7effe';
  const spiritTokenAddress = '0x5cc61a78f164885776aa610fb0fe1257df78e59b';
  const geistTokenAddress = '0xd8321aa83fb0a4ecd6348d4577431310a6e0814d';
  const lqdrTokenAddress = '0x10b620b2dbac4faa7d7ffd71da486f5d44cd86f9';
  const hectorTokenAddress = '0x5c4fdfc5233f935f20d2adba572f770c2e377ab0';
  const daiTokenAddress = '0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e';
  const usdcTokenAddress = '0x04068da6c83afcfa0e13ba15a6696662335d5b75';
  const usdtTokenAddress = '0x049d68029688eabf473097a2fc38ef61633a3c7a';
  const busdTokenAddress = '0x4fabb145d64652a948d72533023f6e7a623c7c53';
  const torTokenAddress = '0x74e23df9110aa9ea0b6ff2faee01e740ca1c642e';

  const payLogic = await deploy('HectorPay', {
    from: deployer.address,
    args: [],
    log: true,
  });
  await waitSeconds(5);

  const params = [payLogic.address, deployer.address];
  const payFactory = await deploy('HectorPayFactory', {
    from: deployer.address,
    args: params,
    log: true,
  });
  const payFactoryContract = await ethers.getContract(
    'HectorPayFactory',
    deployer
  );

  await waitSeconds(10);
  try {
    (await payFactoryContract.createHectorPayContract(wbtcTokenAddress)).wait();
  } catch (_) {}

  await waitSeconds(10);
  try {
    (await payFactoryContract.createHectorPayContract(wethTokenAddress)).wait();
  } catch (_) {}

  await waitSeconds(10);
  try {
    (await payFactoryContract.createHectorPayContract(wftmTokenAddress)).wait();
  } catch (_) {}

  await waitSeconds(10);
  try {
    (await payFactoryContract.createHectorPayContract(fraxTokenAddress)).wait();
  } catch (_) {}

  await waitSeconds(10);
  try {
    (await payFactoryContract.createHectorPayContract(booTokenAddress)).wait();
  } catch (_) {}

  await waitSeconds(10);
  try {
    (
      await payFactoryContract.createHectorPayContract(spiritTokenAddress)
    ).wait();
  } catch (_) {}

  await waitSeconds(10);
  try {
    (
      await payFactoryContract.createHectorPayContract(geistTokenAddress)
    ).wait();
  } catch (_) {}

  await waitSeconds(10);
  try {
    (await payFactoryContract.createHectorPayContract(lqdrTokenAddress)).wait();
  } catch (_) {}

  await waitSeconds(10);
  try {
    (
      await payFactoryContract.createHectorPayContract(hectorTokenAddress)
    ).wait();
  } catch (_) {}

  await waitSeconds(10);
  try {
    (await payFactoryContract.createHectorPayContract(daiTokenAddress)).wait();
  } catch (_) {}

  await waitSeconds(10);
  try {
    (await payFactoryContract.createHectorPayContract(usdcTokenAddress)).wait();
  } catch (_) {}
  await waitSeconds(10);
  try {
    (await payFactoryContract.createHectorPayContract(usdtTokenAddress)).wait();
  } catch (_) {}
  await waitSeconds(10);
  try {
    (await payFactoryContract.createHectorPayContract(busdTokenAddress)).wait();
  } catch (_) {}
  await waitSeconds(10);
  try {
    await payFactoryContract.createHectorPayContract(torTokenAddress);
  } catch (_) {}

  if (hre.network.name !== 'localhost' && hre.network.name !== 'hardhat') {
    await waitSeconds(10);
    console.log('=====> Verifing ....');
    try {
      await hre.run('verify:verify', {
        address: payFactory.address,
        contract: 'contracts/HectorPay/HectorPayFactory.sol:HectorPayFactory',
        constructorArguments: params,
      });
    } catch (_) {}
    await waitSeconds(2);
    try {
      await hre.run('verify:verify', {
        address: payLogic.address,
        contract: 'contracts/HectorPay/HectorPay.sol:HectorPay',
        constructorArguments: [],
      });
    } catch (_) {}
  }
};

export default deployPay;
deployPay.tags = ['Pay'];
deployPay.dependencies = [];
