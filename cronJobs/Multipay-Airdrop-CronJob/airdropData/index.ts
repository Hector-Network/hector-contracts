import releaseAirdrops from "./releaseAirdrops";
import { Chain, CHAINS } from "../utils/chain";

export default async function () {
  try {
    for (let i = 0; i < CHAINS.length; i++) {
      console.log(`Start Airdrop CronJob on chain ${CHAINS[i].shortName}...`);
      await releaseAirdrops(CHAINS[i].id);
    }
  } catch (e) {
    console.log(e);
  }
}
