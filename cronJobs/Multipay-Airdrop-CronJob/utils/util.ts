import fetch from "node-fetch";
import { DROPPER_SUBGRAPH } from "./constants";
import { Chain } from "./chain";

export function getDropperSubgraphURL(chain: Chain): string {
  const subgraph = DROPPER_SUBGRAPH.find((subgraph) => subgraph.id == chain.id);
  if (subgraph) {
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
