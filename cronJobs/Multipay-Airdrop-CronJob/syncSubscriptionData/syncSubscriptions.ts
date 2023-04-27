import fetch from "cross-fetch";
import { syncSubscriptions } from "../utils/contracts/subscription";
import { execute, makePromise } from "apollo-link";
import { createHttpLink } from "apollo-link-http";
import gql from "graphql-tag";
import { Chain, CHAINS } from "../utils/chain";
import {
  getCurrentTimeInSecond,
  getSubscriptionSubgraphURL,
} from "../utils/util";
import {
  Subscription,
  SubscriptionInfo,
  SubscriptionsData,
} from "../utils/interface";

async function callSyncSubscriptions(
  chain: Chain,
  users: string[][],
  contracts: string[]
) {
  const status = await syncSubscriptions(chain, users, contracts);
  if (status == 0x1) {
    return true;
  }
  return false;
}

export default async function (chainId: number) {
  console.log("Start Synching Subscription...");
  const chain = CHAINS.find((c) => c.id == chainId);
  if (chain == undefined) {
    console.error(`Chain with ID ${chainId} not found.`);
    return;
  }
  try {
    const currentTimestamp = await getCurrentTimeInSecond();
    const perPage = 100;
    let dataCount = 0;

    while (1) {
      const filteredSubscriptionsData: SubscriptionsData =
        await filterSubscriptions(
          chain,
          perPage,
          dataCount,
          currentTimestamp,
          "lte"
        );
      const subscriptionInfos: SubscriptionInfo[] =
        filteredSubscriptionsData?.data?.hectorSubscriptionContracts;

      let contracts: string[] = subscriptionInfos.map(
        (contract) => contract.address
      );
      let users: string[][] = subscriptionInfos.map((contract) =>
        contract.subscriptions.map((subscription) => subscription.user.address)
      );

      let usersLength = 0;
      for (let i = 0; i < users.length; i++) {
        usersLength += users[i].length;
      }

      if (contracts.length > 0 && usersLength > 0) {
        console.log(`Initializing Sync Subscription on chain ${chainId}...\n`);
        const result = await callSyncSubscriptions(chain, users, contracts);
        if (result == false) break;
        console.log(`Syncing Subscription completed on chain ${chainId}\n`);
      } else {
        console.log(`No Subscription to sync on chain ${chainId}\n`);
        break;
      }

      dataCount += perPage;
    }
  } catch (error) {
    return;
  }
}

export async function filterSubscriptions(
  chain: Chain,
  first: number,
  skip: number,
  currentTimestamp: number,
  expiredOptions: string
) {
  const uri = getSubscriptionSubgraphURL(chain);
  const link = createHttpLink({ uri, fetch });
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
