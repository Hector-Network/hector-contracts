import axios from "axios";

export type Chain = {
  id: number;
  shortName: string;
  longName: string;
  color: string;
  rpc: [string, ...string[]];
  explorers: [string, ...string[]];
  logo?: any;
  /**
   * This is a rough estimate of the chain's block time in milliseconds.
   * You should use this when polling the blockchain for changes.
   */
  // TODO: Block times can vary based on chain and congestion.
  // Polling could be made more efficient if the `BLOCK_TIME` was
  // dynamically updated. There's no reason to poll more often than
  // the blocks are actually produced.
  millisPerBlock: number;
  token?: {
    name: string;
    symbol: string;
    address: string;
    decimals: number;
    logo: string;
    coingeckoCoinId: string;
  };
};

export const AVALANCHE: Chain = {
  id: 0xa86a,
  shortName: "Avalanche",
  longName: "Avalanche C-Chain",
  color: "#E84142",
  rpc: ["https://api.avax.network/ext/bc/C/rpc"],
  explorers: ["https://snowtrace.io"],
  token: {
    name: "Avalanche",
    symbol: "AVAX",
    address: "FvwEAhmxKfeiG8SnEvq42hc6whRyY3EFYAvebMqDNDGCgxN5Z",
    logo: "https://assets.coingecko.com/coins/images/12559/small/coin-round-red.png?1604021818",
    decimals: 18,
    coingeckoCoinId: "avalanche-2",
  },
  millisPerBlock: 3_500,
};

export const BINANCE: Chain = {
  id: 0x38,
  shortName: "Binance",
  longName: "Binance Smart Chain",
  color: "#F0B90B",
  rpc: [
    "https://bsc-dataseed1.binance.org",
    "https://bsc-dataseed1.defibit.io/",
  ],
  explorers: ["https://bscscan.com"],
  token: {
    name: "BNB",
    symbol: "BNB",
    logo: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png?1644979850",
    address: "BNB",
    decimals: 18,
    coingeckoCoinId: "binancecoin",
  },
  millisPerBlock: 3_500,
};

export const BINANCE_TESTNET: Chain = {
  id: 0x61,
  shortName: "Binance Testnet",
  longName: "Binance Smart Chain Testnet",
  color: "#F0B90B",
  rpc: ["https://endpoints.omniatech.io/v1/bsc/testnet/public"],
  explorers: ["https://testnet.bscscan.com"],
  token: {
    name: "BNB",
    symbol: "BNB",
    logo: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png?1644979850",
    address: "BNB",
    decimals: 18,
    coingeckoCoinId: "binancecoin",
  },
  millisPerBlock: 3_500,
};

export const ETHEREUM: Chain = {
  id: 0x1,
  shortName: "Ethereum",
  longName: "Ethereum",
  color: "#627EEA",
  rpc: ["https://cloudflare-eth.com", "https://main-rpc.linkpool.io"],
  explorers: ["https://etherscan.io"],
  token: {
    name: "Ethereum",
    symbol: "ETH",
    logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png?1595348880",
    address: "0x0000000000000000000000000000000000000000",
    decimals: 18,
    coingeckoCoinId: "ethereum",
  },
  millisPerBlock: 15_000,
};

export const FANTOM_MAINNET: Chain = {
  id: 0xfa,
  shortName: "Fantom",
  longName: "Fantom Opera",
  color: "#1969FF",
  rpc: ["https://rpc.ankr.com/fantom"],
  explorers: ["https://ftmscan.com"],
  token: {
    name: "Fantom",
    symbol: "FTM",
    logo: "https://assets.coingecko.com/coins/images/4001/small/Fantom.png?1558015016",
    address: "0x4e15361fd6b4bb609fa63c81a2be19d873717870",
    decimals: 18,
    coingeckoCoinId: "fantom",
  },
  millisPerBlock: 2_500,
};

export const FANTOM_TESTNET: Chain = {
  id: 0xfa2,
  shortName: "Fantom Testnet",
  longName: "Fantom Testnet",
  color: "#1969FF",
  rpc: ["https://rpc.ankr.com/fantom_testnet/"],
  explorers: ["https://testnet.ftmscan.com"],
  token: {
    name: "Fantom",
    symbol: "FTM",
    logo: "https://assets.coingecko.com/coins/images/4001/small/Fantom.png?1558015016",
    address: "FANTOMTESTNET",
    decimals: 18,
    coingeckoCoinId: "fantom",
  },
  millisPerBlock: 2_500,
};

export const FANTOM = FANTOM_MAINNET;

export const MOONRIVER: Chain = {
  id: 0x505,
  shortName: "Moonriver",
  longName: "Moonriver",
  color: "#53CBC9",
  rpc: [
    "https://rpc.moonriver.moonbeam.network",
    "https://moonriver.api.onfinality.io/public",
  ],
  explorers: ["https://moonriver.moonscan.io"],
  token: {
    name: "Moonriver",
    logo: "https://assets.coingecko.com/coins/images/17984/small/9285.png?1630028620",
    symbol: "MOVR",
    address: "0x98878b06940ae243284ca214f92bb71a2b032b8a",
    decimals: 18,
    coingeckoCoinId: "moonriver",
  },
  millisPerBlock: 15_000,
};

export const POLYGON: Chain = {
  id: 0x89,
  shortName: "Polygon",
  longName: "Polygon",
  color: "#8247E5",
  rpc: ["https://polygon-rpc.com/", "https://rpc-mainnet.matic.network"],
  explorers: ["https://polygonscan.com"],
  token: {
    name: "Polygon",
    logo: "https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png?1624446912",
    symbol: "MATIC",
    address: "0x0000000000000000000000000000000000001010",
    decimals: 18,
    coingeckoCoinId: "matic-network",
  },
  millisPerBlock: 3_000,
};

export const OPTIMISM: Chain = {
  id: 0xa,
  shortName: "Optimism",
  longName: "Optimism",
  color: "#fb0423",
  rpc: ["https://mainnet.optimism.io"],
  explorers: ["https://explorer.optimism.io"],
  token: {
    name: "Optimism",
    logo: "https://assets.coingecko.com/coins/images/25244/small/Optimism.png?1660904599",
    symbol: "OP",
    address: "0x4200000000000000000000000000000000000042",
    decimals: 18,
    coingeckoCoinId: "optimism",
  },
  millisPerBlock: 15_000,
};

export const ARBITRUM: Chain = {
  id: 0xa4b1,
  shortName: "Arbitrum",
  longName: "Arbitrum One",
  color: "#28a0f0",
  rpc: ["https://arb1.arbitrum.io/rpc"],
  explorers: ["https://mainnet.optimism.io"],
  millisPerBlock: 15_000,
};

export async function chainRequest(
  chain: Chain,
  args: {
    method: string;
    params?: unknown[] | object;
  }
): Promise<unknown> {
  const response = await axios.post(chain.rpc[0], {
    jsonrpc: "2.0",
    id: 800000000085, // we don't use id, so it can be anything
    method: args.method,
    params: args.params,
  });
  const body = response.data;

  if (body.error) {
    throw body.error;
  }

  return body.result;
}

export const CHAINS: Chain[] = [
  FANTOM_MAINNET,
  FANTOM_TESTNET,
  BINANCE,
  BINANCE_TESTNET,
  ETHEREUM,
  AVALANCHE,
  MOONRIVER,
  POLYGON,
  OPTIMISM,
  ARBITRUM,
];
