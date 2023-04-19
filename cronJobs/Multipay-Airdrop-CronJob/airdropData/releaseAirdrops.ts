import fetch from "cross-fetch";
import { releaseAirdrops } from "../utils/contracts/dropper";
import { execute, makePromise } from "apollo-link";
import { createHttpLink } from "apollo-link-http";
import gql from "graphql-tag";
import { Chain, CHAINS } from "../utils/chain";
import { getCurrentTimeInSecond, getDropperSubgraphURL } from "../utils/util";
import { Airdrop } from "./interface";

async function callReleaseAirdrops(
  chain: Chain,
  froms: string[],
  indexes: string[]
) {
  const status = await releaseAirdrops(chain, froms, indexes);
  if (status == 0x1) {
    return true;
  }
  return false;
}

export default async function (chainId: number) {
  console.log("\nStart Airdrop...\n");
  const chain = CHAINS.find((c) => c.id == chainId);
  if (chain == undefined) {
    console.error(`Chain with ID ${chainId} not found.`);
    return;
  }
  try {
    const currentTimestamp = await getCurrentTimeInSecond();
    const perPage = 100;
    let dataCount = 0;

    //Get a list of Dropper contract from factory
    //iterate through each dropper for a list of Inprogress airdrop
    //call releaseAirdrops

    // while (1) {
    //   const filteredAirdropData: Airdrop = await filterAirdrops(
    //     chain,
    //     perPage,
    //     dataCount,
    //     currentTimestamp,
    //     "lte"
    //   );
    //   const subscriptionInfos: SubscriptionInfo[] =
    //     filteredAirdropData?.data?.hectorSubscriptionContracts;

    //   let contracts: string[] = subscriptionInfos.map(
    //     (contract) => contract.address
    //   );
    //   let users: string[] = subscriptionInfos.map((contract) =>
    //     contract.subscriptions.map((subscription) => subscription.user.address)
    //   );

    //   let usersLength = 0;
    //   for (let i = 0; i < users.length; i++) {
    //     usersLength += users[i].length;
    //   }

    //   if (contracts.length > 0 && usersLength > 0) {
    //     const result = await callReleaseAirdrops(chain, users, contracts);
    //     if (result == false) break;
    //   } else {
    //     break;
    //   }

    //   dataCount += perPage;
    // }
  } catch (error) {
    return;
  }
}

export async function filterAirdrops(
  chain: Chain,
  first: number,
  skip: number,
  currentTimestamp: number,
  expiredOptions: string
) {
  const uri = getDropperSubgraphURL(chain);
  const link = createHttpLink({ uri, fetch });
  const query1: string = `
    query {
            hectorDropperContracts(first: 5) {
              id
              address
              factory {
                id
              }
              token {
                id
              }
              airdrops(first: 10) {
                from {
                  address
                }
                tos {
                  address
                }
                amountPerRecipient
                releaseTime
                status
              }
            }
        }`;
  const query: string = `
    query {
            hectorSubscriptionContracts {
              address
              product
              subscriptions(first: ${first}, skip: ${skip}, where: {expiredAt_${expiredOptions}: ${currentTimestamp},  plan_: {id_gt: "0"}}) {
                contract {
                  address
                }
                user {
                  address
                }
              }
            }
        }`;
  const operation = {
    query: gql(query),
  };

  return await makePromise(execute(link, operation));
}
