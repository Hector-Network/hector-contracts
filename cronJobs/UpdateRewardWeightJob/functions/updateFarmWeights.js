const ethers = require('ethers');
const { abis, addresses } = require('../contracts');

async function updateFarmWeights(wallet) {
    console.log('Sending transaction...');

    try {
      // Specify custom tx overrides, such as gas price https://docs.ethers.io/ethers.js/v5-beta/api-contract.html#overrides
      const overrides = { gasPrice: process.env.DEFAULT_GAS_PRICE, gasLimit: process.env.GAS_LIMIT };
      var rewardWeight = new ethers.Contract(addresses.RewardWeightAddress, abis.rewardWeightABI, wallet);

      const tx = await rewardWeight.updateFarmsWeightPercentages(overrides);
      const successMessage = `Calling updateFarmsWeightPercentages: Transaction sent https://ftmscan.com/tx/${tx.hash}`;
      console.log(successMessage)
      
    } catch (err) {
      const errorMessage = `Warning: Transaction failed: ${err.message}`;
      console.error(errorMessage)
      return err;
    }
}

exports.handler = async function() {
  console.log('Starting...');

  // Initialize Fantom wallet
  const provider = new ethers.providers.JsonRpcProvider(process.env.FTM_RPC_URL);
  let wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  wallet = wallet.connect(provider)
  console.log('Fantom wallet loaded');

  //Send tokens to Staking contract
  await updateFarmWeights(wallet);
  
}