import releaseAirDrops from "../airdropData";

export async function releaseAirdrop(event) {
  return {
    message: "Go Serverless v3! Your function executed successfully!",
    input: event,
  };
  //releaseAirDrops();
}
