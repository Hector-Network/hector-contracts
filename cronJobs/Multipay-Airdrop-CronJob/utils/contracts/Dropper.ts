import { ContractInterface, ethers } from "ethers";
import {
  HECTOR_SUBSCRIPTION,
  DROPPER_FACTORY,
  HECTOR_DROPPER,
} from "../constants";
import { CHAINS, Chain } from "../chain";

export async function releaseAirdrops(
  chain: Chain,
  froms: string[],
  indexes: string[]
) {
  const ABI: ContractInterface = [
    {
      inputs: [
        { internalType: "address[]", name: "froms", type: "address[]" },
        { internalType: "uint256[]", name: "indexes", type: "uint256[]" },
      ],
      name: "releaseAirdrops",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
  ];

  const provider = new ethers.providers.JsonRpcProvider(chain.rpc[0]);

  const privateKey = process.env.PRIVATE_KEY || "";

  const signer = new ethers.Wallet(privateKey, provider);

  const hectorDropper = HECTOR_DROPPER.find((c) => c.id == chain.id)?.address;

  if (hectorDropper && hectorDropper.length > 0) {
    const contract = new ethers.Contract(hectorDropper, ABI, signer);
    const tx = await contract.releaseAirdrops(froms, indexes);
    const receipt = await tx.wait();
    console.log("transactionHash:", receipt.transactionHash);
    return receipt.status;
  } else {
    return false;
  }
}
