const hre = require("hardhat");
const BigNumber = require("bignumber.js");
const { boolean } = require("hardhat/internal/core/params/argumentTypes");
const { helpers } = require("../helper");
const { waitSeconds } = require("../helper/helpers");
const exec = require("child_process").exec;

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const prod_mode = true;

  const _hec = prod_mode ? '0x5C4FDfc5233f935f20D2aDbA572F770c2E377Ab0' : '0x55639b1833Ddc160c18cA60f5d0eC9286201f525';
  const _sHec = prod_mode ? '0x75bdeF24285013387A47775828bEC90b91Ca9a5F' : '0x71264c23604fa78D1eFcc32af1c73714F33dCdb4';
  const _wsHec = prod_mode ? '0x94CcF60f700146BeA8eF7832820800E2dFa92EdA' : '0x6225eeA79a0baF0c7e368Db4de1e8066589815B1';
  const _spookySwapFactory = prod_mode ? '0x152eE697f2E276fA89E96742e9bB9aB1F2E61bE3' : '0xEE4bC42157cf65291Ba2FE839AE127e3Cc76f741';
  const _lockAddressRegistry = prod_mode ? '0x55639b1833Ddc160c18cA60f5d0eC9286201f525' : '0x2D86a40Ff217493cCE3a23627F6A749dAe1f9018';
  const _tokenVault = prod_mode ? '0x1fA6693d9933CC7f578CDd35071FC6d6cc8451E0' : '0x4b7dC9E2Cc8B97Fe6073d03667Aed96c071c532B';
  const _maxPercentage = 100;
  const _voteDelay = 604800;

  const lockFarm = ['0x80993B75e38227f1A3AF6f456Cf64747F0E21612', '0xd7faE64DD872616587Cc8914d4848947403078B8'];
  const stakingToken = ['0x5C4FDfc5233f935f20D2aDbA572F770c2E377Ab0', '0x0b9589A2C1379138D4cC5043cE551F466193c8dE'];

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const gas = await ethers.provider.getGasPrice();
  console.log("Gas Price: ", gas);

  const votingFactory = await ethers.getContractFactory("Voting");
  console.log("Deploying Voting Contract...");

  const votingContract = await hre.upgrades.deployProxy(
    votingFactory,
    [_hec, _sHec, _wsHec, _spookySwapFactory, _tokenVault, _maxPercentage, _voteDelay],
    {
      gas: gas,
      initializer: "initialize",
    }
  );
  console.log("Voting contract deployed to:", votingContract.address);

  // Add LockFarms
  for (let i = 0; i < lockFarm.length; i++) {
    await votingContract.addLockFarmForOwner(lockFarm[i], stakingToken[i], _lockAddressRegistry);
    await waitSeconds(3);
  }

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
