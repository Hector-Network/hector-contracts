const { ethers, upgrades } = require("hardhat");
const BigNumber = require("bignumber.js");

async function main() {
  const _partnerSharePercent = 8500;
  const _maxFeePercent = 500;
  const _feeClaimer = "0xda66b6206bbaea5213A5065530858a3fD6ee1ec4";
  const _HectorRFQ = "0xda66b6206bbaea5213A5065530858a3fD6ee1ec4";

  // const [deployer] = await ethers.getSigners();
  // console.log("Deploying contracts with the account:", deployer.address);
  // console.log("Account balance:", (await deployer.getBalance()).toString());
  // const gas = await ethers.provider.getGasPrice();
  // console.log("Gas Price: ", gas.toNumber());

  // TokenTransferProxy
  // const TokenTransferProxy = await ethers.getContractFactory("TokenTransferProxy");
  // console.log("Deploying TokenTransferProxy Contract...");
  // const tokenTransferProxy = await TokenTransferProxy.deploy();
  // await tokenTransferProxy.deployed();

  // // HectorSwapper
  // const HectorSwapperContract = await ethers.getContractFactory("HectorSwapper");
  // console.log("Deploying HectorSwapper Contract...");
  // // const v1contract = await upgrades.deploy(V1contract, {
  // //   constructorArgs: [_feeClaimer],
  // //   unsafeAllow: ["constructor", "state-variable-immutable", "delegatecall"],
  // // });
  // const hectorSwapperContract = await HectorSwapperContract.deploy(_feeClaimer);
  // await hectorSwapperContract.deployed();
  var abi = [{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"contract IWETH","name":"token","type":"address"}],"name":"withdrawAllWETH","outputs":[],"stateMutability":"nonpayable","type":"function"}]
var iface = new ethers.utils.Interface(abi)
var id = iface.getSighash('withdrawAllWETH');
  console.log(id);
  // const tokenTransferProxyAddress = await hectorSwapperContract.getTokenTransferProxy();

  // // MultiPath
  // const MultiPathContract = await ethers.getContractFactory("MultiPath");
  // console.log("Deploying MultiPath Contract...");
  // const multiPathContract = await MultiPathContract.deploy(_partnerSharePercent, _maxFeePercent, _feeClaimer);
  // await multiPathContract.deployed();

  // // SimpleSwap
  // // const SimpleSwapContract = await ethers.getContractFactory("HectorSwapper");
  // // console.log("Deploying HectorSwapper V1 Contract...");
  // // const simpleSwapContract = await SimpleSwapContract.deploy(_partnerSharePercent, _maxFeePercent, _feeClaimer);
  // // await simpleSwapContract.deployed();
  // // console.log("SimpleSwap: ", simpleSwapContract.address);

  // // Expose Contracts Addresses
  // console.log("HectorSwapper:", hectorSwapperContract.address);
  // console.log("TokenTransferProxy:", tokenTransferProxyAddress);
  // console.log("MultiPath: ", multiPathContract.address);

  // // Set Configuration
  // const abiCoder = ethers.utils.defaultAbiCoder;
  // const whiteListRole = await hectorSwapperContract.WHITELISTED_ROLE();
  // const routerRole = await hectorSwapperContract.ROUTER_ROLE();

  // await hectorSwapperContract.grantRole(routerRole, multiPathContract.address);
  // await hectorSwapperContract.setImplementation("0xa94e78ef", multiPathContract.address);
  // await hectorSwapperContract.setImplementation("0x46c67b6d", multiPathContract.address);

  // // Verify
  // await hre.run("verify:verify", {
  //   address: multiPathContract.address,
  //   contract: "contracts/MultiPath.sol:MultiPath",
  //   constructorArguments: [_partnerSharePercent, _maxFeePercent, _feeClaimer],
  // });

  // // await hre.run("verify:verify", {
  // //   address: tokenTransferProxy.address,
  // //   contract: "contracts/TokenTransferProxy.sol:TokenTransferProxy",
  // //   constructorArguments: [],
  // // });

  // await hre.run("verify:verify", {
  //   address: hectorSwapperContract.address,
  //   contract: "contracts/HectorSwapper.sol:HectorSwapper",
  //   constructorArguments: [_feeClaimer],
  // });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
