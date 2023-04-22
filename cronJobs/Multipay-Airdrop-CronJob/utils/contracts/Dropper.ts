import { ContractInterface, ethers } from "ethers";
import { DROPPER_FACTORY } from "../constants";
import { CHAINS, Chain } from "../chain";

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

  const provider = new ethers.providers.JsonRpcProvider(chain.rpc[0]);
  const gasPrice = await provider.getGasPrice();
  const gas_factor = process.env.GAS_PREMIUM_FACTOR
    ? process.env.GAS_PREMIUM_FACTOR
    : "1.2";
  const adjustedGasPrice = gasPrice.mul(parseFloat(gas_factor) * 100).div(100);

  // Specify custom tx overrides, such as gas price https://docs.ethers.io/ethers.js/v5-beta/api-contract.html#overrides
  const overrides = {
    gasPrice: adjustedGasPrice.toString(),
    gasLimit: process.env.GAS_LIMIT,
  };

  const privateKey = process.env.PRIVATE_KEY || "";

  const signer = new ethers.Wallet(privateKey, provider);

  const hectorDroperFactory = DROPPER_FACTORY.find(
    (c) => c.id == chain.id
  )?.address;

  if (hectorDroperFactory && hectorDroperFactory.length > 0) {
    const contract = new ethers.Contract(hectorDroperFactory, ABI, signer);
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
}
