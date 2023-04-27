import syncSubscriptions from "./syncSubscriptions";
import { Chain, CHAINS } from "../utils/chain";
import { getSubscriptionSubgraphURL } from "../utils/util";

export default async function () {
  try {
    for (let i = 0; i < CHAINS.length; i++) {
      console.log(
        `Start SyncSubscription CronJob on chain ${CHAINS[i].shortName}...`
      );
      const uri = getSubscriptionSubgraphURL(CHAINS[i]);
      //If subgraph link is available
      if (uri.length > 0) await syncSubscriptions(CHAINS[i].id);
    }
  } catch (e) {
    console.log(e);
  }
}
