import { BigNumber } from 'ethers';
import { waitSeconds } from '../helper';
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const _countDest = 2; // Count of the destination wallets, default: 2
  const _bridge = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE";

  const feePercentage = 75;
  const DAO = "0xBF014a15198EDcFcb2921dE7099BF256DB31c4ba";
  const version = "2.0";

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const gas = await ethers.provider.getGasPrice();
  console.log("Gas Price: ", gas);

  const hecBridgeSplitterFactory = await ethers.getContractFactory("HecBridgeSplitter");
  console.log("Deploying HecBridgeSplitter Contract...");

  const hecBridgeSplitterContract = await hre.upgrades.deployProxy(
    hecBridgeSplitterFactory,
    [_countDest, _bridge],
    {
      gas: gas,
      initializer: "initialize",
    }
  );
  console.log("HecBridgeSplitter contract deployed to:", hecBridgeSplitterContract.address);

  // Set Parameter
  console.log("Setting parameters...");
  await hecBridgeSplitterContract.setMinFeePercentage(feePercentage);
  await waitSeconds(3);
  await hecBridgeSplitterContract.setDAOWallet(DAO);
  await waitSeconds(3);
  await hecBridgeSplitterContract.setVersion(version);

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
