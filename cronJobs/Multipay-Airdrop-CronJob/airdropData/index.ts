import releaseAirdrops from "./releaseAirdrops";
import { Chain, CHAINS } from "../utils/chain";
import { getDropperSubgraphURL } from "../utils/util";

export default async function () {
  try {
    for (let i = 0; i < CHAINS.length; i++) {
      console.log(`Start Airdrop CronJob on chain ${CHAINS[i].shortName}...`);
      const uri = getDropperSubgraphURL(CHAINS[i]);
      //If subgraph link is available
      if (uri.length > 0) await releaseAirdrops(CHAINS[i].id);
    }
  } catch (e) {
    console.log(e);
  }
}
