async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const rewardWeightFac = await ethers.getContractFactory("RewardWeight");
  const rewardWeight = await rewardWeightFac.deploy();
  console.log("Deployed RewardWeight Contract Address: ", rewardWeight.address);
 
    console.log('Verifying RewardWeight contract in 5 minutes...');
    await sleep(60000 * 5);
    await run("verify:verify", {
        address: rewardWeight.address,
        constructorArguments: [],
    });

  const Splitter = await ethers.getContractFactory("Splitter");
  const rewardWeightAddr = "0xedf87F3bC57d8f04AAf1e0d94Bb3719f883F7a52";
  const splitter = await Splitter.deploy(rewardWeightAddr);
  console.log("Deployed Splitter Contract Address: ", splitter.address);

  console.log('Verifying Splitter contract in 5 minutes...');
    await sleep(60000 * 3);
    await run("verify:verify", {
        address: splitter.address,
        constructorArguments: [rewardWeightAddr],
    });

    const stakedHecFac = await ethers.getContractFactory("StakedHecDistributor");
    //https://ftmscan.com/address/0x8Ed4c6dF48b4Ce7f620700998b694C460A78123F#readContract
    const sHecLockFarmContractAddr = "0x90d12710a7F2E718152F046eADad20B9B31784aE";
    const rewardTokenAddr = "0x5a7C0f1901FfB91D26744f75f4bbb1f5EE92F486";
    const stakingContractAddr = "0xB226b3cF83dD9F42689b757e2F633540A97231B9";
    const emissionorContractAddr = "0x794DF18Aee0eB31cCB16463BE6c5B68297f8BC06";
    const epochLength = 3600;
    const nextEpochBlock = 40986250;
    const stakedHecContract = await stakedHecFac.deploy(sHecLockFarmContractAddr,rewardTokenAddr, stakingContractAddr, emissionorContractAddr, epochLength, nextEpochBlock);
    console.log("Deployed StakedHecDistributor Contract Address: ", stakedHecContract.address);
    const stakedHecAddr = stakedHecContract.address;

    console.log('Verifying StakedHecDistributor contract in 5 minutes...');
    await sleep(60000 * 3);
    await run("verify:verify", {
        address: stakedHecAddr,
        constructorArguments: [sHecLockFarmContractAddr,rewardTokenAddr, stakingContractAddr, emissionorContractAddr, epochLength, nextEpochBlock ],
    });


}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });