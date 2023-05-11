import { ContractInterface, ethers } from "ethers";
import { DROPPER_FACTORY } from "../constants";
import { CHAINS, Chain } from "../chain";
import { getUpdatedGas } from "../util";

export async function releaseAirdrops(
  chain: Chain,
  froms: string[][],
  indexes: string[][],
  dropperContracts: string[]
) {
  const ABI: ContractInterface = [
    {
      inputs: [
        {
          internalType: "address[]",
          name: "dropperContracts",
          type: "address[]",
        },
        { internalType: "address[][]", name: "froms", type: "address[][]" },
        {
          internalType: "uint256[][]",
          name: "indexes",
          type: "uint256[][]",
        },
      ],
      name: "releaseAirdrops",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
  ];

  try {
    const provider = new ethers.providers.JsonRpcProvider(chain.rpc[0]);
    const adjustedGasPrice = await getUpdatedGas(provider);

    // Specify custom tx overrides, such as gas price https://docs.ethers.io/ethers.js/v5-beta/api-contract.html#overrides
    const overrides = {
      gasPrice: adjustedGasPrice.toString(),
      gasLimit: process.env.GAS_LIMIT,
    };
    const privateKey = process.env.PRIVATE_KEY || "";

    const signer = new ethers.Wallet(privateKey, provider);

    const hectorDropperFactory = DROPPER_FACTORY.find(
      (c) => c.id == chain.id
    )?.address;

    if (hectorDropperFactory && hectorDropperFactory.length > 0) {
      const contract = new ethers.Contract(hectorDropperFactory, ABI, signer);
      const tx = await contract.releaseAirdrops(
        dropperContracts,
        froms,
        indexes,
        overrides
      );
      const receipt = await tx.wait();
      console.log("transactionHash:", receipt.transactionHash);
      return receipt.status;
    } else {
      return false;
    }
  } catch (error) {
    console.log("Error in utils.contracts.releaseAirdrops", error);
    return false;
  }
}
