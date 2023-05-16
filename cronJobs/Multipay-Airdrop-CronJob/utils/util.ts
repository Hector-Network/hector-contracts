import fetch from "node-fetch";
import {
  DROPPER_SUBGRAPH,
  MULTIPAY_SUBGRAPH,
  SUBSCRIPTION_SUBGRAPH,
} from "./constants";
import { Chain } from "./chain";
import { ContractInterface, ethers, BigNumber, providers } from "ethers";
import * as fs from "fs";

export function getMultiPaySubgraphURL(chain: Chain): string {
  const subgraph = MULTIPAY_SUBGRAPH.find(
    (subgraph) => subgraph.id == chain.id
  );
  if (subgraph && subgraph.url) {
    return subgraph.url;
  }
  return "";
}

export function getSubscriptionSubgraphURL(chain: Chain): string {
  const subgraph = SUBSCRIPTION_SUBGRAPH.find(
    (subgraph) => subgraph.id == chain.id
  );
  if (subgraph && subgraph.url) {
    return subgraph.url;
  }
  return "";
}

export function getDropperSubgraphURL(chain: Chain): string {
  const subgraph = DROPPER_SUBGRAPH.find((subgraph) => subgraph.id == chain.id);
  if (subgraph && subgraph.url) {
    return subgraph.url;
  }
  return "";
}

/**
 * Get current UTC timestamp in second
 */
export async function getCurrentTimeInSecond(): Promise<number> {
  try {
    const r = await (
      await fetch("https://timeapi.io/api/Time/current/zone?timeZone=UTC")
    ).json();

    return Math.trunc(new Date(`${r.dateTime}Z`).getTime() / 1000);
  } catch (error) {
    console.log(error);
    return Math.trunc(new Date().getTime() / 1000);
  }
}

export async function getUpdatedGas(
  provider: providers.JsonRpcProvider
): Promise<BigNumber> {
  const gasPrice = await provider.getGasPrice();
  try {
    const gas_factor = process.env.GAS_PREMIUM_FACTOR
      ? process.env.GAS_PREMIUM_FACTOR
      : "1.2";
    const adjustedGasPrice = gasPrice
      .mul(parseFloat(gas_factor) * 100)
      .div(100);
    return adjustedGasPrice;
  } catch (error) {
    console.log(error);
    return gasPrice;
  }
}
