import releaseAirDrops from "./airdropData";

export async function releaseAirdrop(event, context, callback) {
  await releaseAirDrops();
}
