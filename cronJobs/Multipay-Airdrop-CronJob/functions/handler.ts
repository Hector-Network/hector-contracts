import ethers from "ethers";
import { abis, addresses } from "../contracts";
import { CHAINS, FANTOM } from "../utils/chain";

export async function releaseAirdrop(event) {
  return {
    message: "Go Serverless v3! Your function executed successfully!",
    input: event,
  };
}
