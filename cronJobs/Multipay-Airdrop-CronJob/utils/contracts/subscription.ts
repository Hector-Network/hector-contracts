import { ContractInterface, ethers } from "ethers";
import { SUBSCRIPTION_FACTORY } from "../constants";
import { CHAINS, Chain } from "../chain";
import { getUpdatedGas } from "../util";

export async function syncSubscriptions(
  chain: Chain,
  users: string[][],
  contracts: string[]
) {
  console.log("Chain:", chain.shortName);
  console.log("Count of Subscriptions:", users.length);
  const ABI: ContractInterface = [
    {
      inputs: [
        {
          internalType: "address[]",
          name: "subscriptionContracts",
          type: "address[]",
        },
        {
          internalType: "address[][]",
          name: "froms",
          type: "address[][]",
        },
      ],
      name: "syncSubscriptions",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
  ];

  const provider = new ethers.providers.JsonRpcProvider(chain.rpc[0]);
  const adjustedGasPrice = getUpdatedGas(provider);

  // Specify custom tx overrides, such as gas price https://docs.ethers.io/ethers.js/v5-beta/api-contract.html#overrides
  const overrides = {
    gasPrice: adjustedGasPrice.toString(),
    gasLimit: process.env.GAS_LIMIT,
  };

  const privateKey = process.env.PRIVATE_KEY || "";

  const signer = new ethers.Wallet(privateKey, provider);

  const hectorSubscription = SUBSCRIPTION_FACTORY.find(
    (c) => c.id == chain.id
  )?.address;

  if (hectorSubscription && hectorSubscription.length > 0) {
    const contract = new ethers.Contract(hectorSubscription, ABI, signer);
    const tx = await contract.syncSubscriptions(contracts, users, overrides);
    const receipt = await tx.wait();
    console.log("transactionHash:", receipt.transactionHash);
    return receipt.status;
  } else {
    console.log("Chain:", chain.id, " Undefined HectorSubscription Address.");
    return false;
  }
}
