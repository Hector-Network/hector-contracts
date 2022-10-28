const ethers = require('ethers');
const { abis, addresses } = require('../contracts');

async function sendRewards(wallet) {
    console.log('Sending transaction...');

    try {
      var hecToken = new ethers.Contract(addresses.hecAddress, abis.hecABI, wallet);
      const rewardPerRebaseEpoch = await getRewardsPerEpoch(wallet);
      var hecDecimals = await hecToken.decimals();
      var numberOfTokens = ethers.utils.parseUnits(rewardPerRebaseEpoch.toString(), hecDecimals);

      const hecWithSigner = hecToken.connect(wallet);
      const hecBalance = await hecWithSigner.balanceOf(wallet.address);
      const availableBalance = ethers.utils.parseUnits(hecBalance.toString(), hecDecimals);

      // Specify custom tx overrides, such as gas price https://docs.ethers.io/ethers.js/v5-beta/api-contract.html#overrides
      //const overrides = { gasPrice: process.env.DEFAULT_GAS_PRICE, gasLimit: process.env.GAS_LIMIT };

      if (availableBalance.gt(numberOfTokens)) {
        const tx = await hecWithSigner.transfer(process.env.STAKING_CONTRACT, numberOfTokens);
        const successMessage = `Transaction sent https://ftmscan.com/tx/${tx.hash}`;
        console.log(successMessage)
      }
      else
        console.log("Insufficient HEC balance!")
      
    } catch (err) {
      const errorMessage = `Warning: Transaction failed: ${err.message}`;
      console.error(errorMessage)
      return err;
    }
}

async function getRewardsPerEpoch(wallet) {
  //Get circulating sHEC supply from 0x75bdef24285013387a47775828bec90b91ca9a5f
  const sHectorToken = new ethers.Contract(
                                          addresses.sHectorTokenAddress,
                                          abis.sHectorTokenABI,
                                          wallet);

   let circulatingSupply = await sHectorToken.circulatingSupply();
   let decimals = await sHectorToken.decimals();
   let apr = process.env.REBASE_APR;
   const HOURS_IN_A_YEAR = 8760;
   const HOURS_PER_REBASE = 8;
   let rewardPerRebaseEpoch = (((circulatingSupply / 10 ** decimals) * apr) / HOURS_IN_A_YEAR) * HOURS_PER_REBASE;

  return rewardPerRebaseEpoch.toFixed(4);
}

exports.handler = async function() {
  console.log('Starting...');

  // Initialize Fantom wallet
  const provider = new ethers.providers.JsonRpcProvider(process.env.FTM_RPC_URL);
  let wallet = new ethers.Wallet(process.env.REBASE_WALLET_PRIVATE_KEY, provider);

  wallet = wallet.connect(provider)
  console.log('Fantom wallet loaded');

  //Send tokens to Staking contract
  await sendRewards(wallet);
  
}