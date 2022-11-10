const ethers = require("ethers");
const { abis, addresses } = require("../contracts");

async function runCronJob(contract, provider, label) {
  console.log("Sending transaction...", label);

  try {
    const gasPrice = (await provider.getGasPrice()) * 1.3;

    // Specify custom tx overrides, such as gas price https://docs.ethers.io/ethers.js/v5-beta/api-contract.html#overrides
    const overrides = {
      gasPrice: parseInt(gasPrice).toString(),
      gasLimit: process.env.GAS_LIMIT,
    };

    const tx = await contract.emitReward(overrides);
    const successMessage = `Calling update: Transaction sent https://ftmscan.com/tx/${tx.hash}`;
    console.log(label, successMessage);
  } catch (err) {
    const errorMessage = `Warning: Transaction failed: ${err.message}`;
    console.error(errorMessage);
    return err;
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

exports.handler = async function () {
  console.log("Starting...");
  // Load Contract ABIs

  const EmissionorAbi = abis.Emissionor;

  console.log("Contract ABIs loaded");

  // Initialize Fantom wallet
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.FTM_RPC_URL
  );
  let wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  wallet = wallet.connect(provider);
  console.log("Fantom wallet loaded");

  // Load FTM contract
  const EmissionorContract = new ethers.Contract(
    addresses.EmissionorAddress,
    EmissionorAbi,
    wallet
  );

  console.log("Contract EmissionorContract loaded");

  await runCronJob(EmissionorContract, provider, "emitRewards");

  console.log("Job Completed");
  return true;
};
