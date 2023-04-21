// Subgraphs
export const DROPPER_SUBGRAPH = [
  { id: 0xa86a, url: process.env.ETH_RPC_URL }, // Avalanche
  { id: 0x38, url: process.env.BSC_RPC_URL }, // Binance
  { id: 0x61, url: process.env.BSCTEST_RPC_URL }, // Binance Testnet
  { id: 0x1, url: process.env.ETH_RPC_URL }, // Ethereum
  {
    id: 0xfa,
    url: process.env.FTM_RPC_URL,
  }, // Fantom
  {
    id: 0xfa2,
    url: process.env.FTMTEST_RPC_URL,
  }, // Fantom Testnet
  { id: 0x505, url: process.env.MOONRIVER_RPC_URL }, // Moonriver
  { id: 0x89, url: process.env.POLYGON_RPC_URL }, // Polygon
];

export const DROPPER_FACTORY = [
  { id: 0xa86a, address: process.env.DROPPER_FACTORY_AVAX }, // Avalanche
  { id: 0x38, address: process.env.DROPPER_FACTORY_BSC }, // Binance
  { id: 0x61, address: process.env.DROPPER_FACTORY_BSCTEST }, // Binance Testnet
  { id: 0x1, address: process.env.DROPPER_FACTORY_ETH }, // Ethereum
  { id: 0xfa, address: process.env.DROPPER_FACTORY_FTM }, // Fantom
  { id: 0xfa2, address: process.env.DROPPER_FACTORY_FTMTEST }, // Fantom Testnet
  { id: 0x505, address: process.env.DROPPER_FACTORY_MOON }, // Moonriver
  { id: 0x89, address: process.env.DROPPER_FACTORY_POLYGON }, // Polygon
];
