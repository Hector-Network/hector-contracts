import releaseAirDrops from "./airdropData";
import syncSubscriptions from "./syncSubscriptionData";

export async function releaseAirdrop(event, context, callback) {
  await releaseAirDrops();
}

export async function syncSubscription(event, context, callback) {
  await syncSubscriptions();
}
