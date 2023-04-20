import fetch from "cross-fetch";
import { releaseAirdrops } from "../utils/contracts/dropper";
import { execute, makePromise } from "apollo-link";
import { createHttpLink } from "apollo-link-http";
import gql from "graphql-tag";
import { Chain, CHAINS } from "../utils/chain";
import { getCurrentTimeInSecond, getDropperSubgraphURL } from "../utils/util";
import { Airdrop, AirdropInfo } from "./interface";

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

    while (1) {
      const filteredAirdropData = await filterAirdrops(
        chain,
        perPage,
        dataCount
      );

      console.log("filteredAirdropData", filteredAirdropData);
      const airdropInfos: AirdropInfo[] =
        filteredAirdropData?.data?.hectorDropperContracts;

      console.log("airdropInfos", airdropInfos);

      let contracts: string[] = airdropInfos.map(
        (contract) => contract.address
      );
      let users = airdropInfos.map((contract) =>
        contract.airdrops.map((airdrop) => airdrop.from.address)
      );
      let indexes = airdropInfos.map((contract) =>
        contract.airdrops.map((airdrop) => airdrop.index)
      );

      console.log("contracts", contracts);
      console.log("users", users);
      console.log("indexes", indexes);

      let usersLength = 0;
      for (let i = 0; i < users.length; i++) {
        usersLength += users[i].length;
      }

      if (contracts.length > 0 && usersLength > 0) {
        //const result = await callReleaseAirdrops(chain, users, contracts);
        //if (result == false) break;
      } else {
        break;
      }

      dataCount += perPage;
    }
  } catch (error) {
    console.log(error);
    return;
  }
}

export async function filterAirdrops(
  chain: Chain,
  first: number,
  skip: number
) {
  const uri = getDropperSubgraphURL(chain);
  const link = createHttpLink({ uri, fetch });
  const query: string = `
    query {
            hectorDropperContracts {
              address
              airdrops(first: ${first}, skip: ${skip}, where: {status: "0"}) {
                from {
                  address
                }
                index
              }
            }
        }`;

  const operation = {
    query: gql(query),
  };

  return await makePromise(execute(link, operation));
}
