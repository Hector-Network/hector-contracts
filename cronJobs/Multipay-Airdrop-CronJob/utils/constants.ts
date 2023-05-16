export const MULTIPAY_SUBGRAPH = [
  { id: 0xa86a, url: process.env.AVAX_MULTIPAY_SUBGRAPH }, // Avalanche
  { id: 0x38, url: process.env.BSC_MULTIPAY_SUBGRAPH }, // Binance
  { id: 0x61, url: process.env.BSCTEST_MULTIPAY_SUBGRAPH }, // Binance Testnet
  { id: 0x1, url: process.env.ETH_MULTIPAY_SUBGRAPH }, // Ethereum
  {
    id: 0xfa,
    url: process.env.FTM_MULTIPAY_SUBGRAPH,
  }, // Fantom
  {
    id: 0xfa2,
    url: process.env.FTMTEST_MULTIPAY_SUBGRAPH,
  }, // Fantom Testnet
  { id: 0x505, url: process.env.MOONRIVER_MULTIPAY_SUBGRAPH }, // Moonriver
  { id: 0x89, url: process.env.POLYGON_MULTIPAY_SUBGRAPH }, // Polygon
];

export const SUBSCRIPTION_SUBGRAPH = [
  { id: 0xa86a, url: process.env.AVAX_SUBSCRIPTION_SUBGRAPH }, // Avalanche
  { id: 0x38, url: process.env.BSC_SUBSCRIPTION_SUBGRAPH }, // Binance
  { id: 0x61, url: process.env.BSCTEST_SUBSCRIPTION_SUBGRAPH }, // Binance Testnet
  { id: 0x1, url: process.env.ETH_SUBSCRIPTION_SUBGRAPH }, // Ethereum
  {
    id: 0xfa,
    url: process.env.FTM_SUBSCRIPTION_SUBGRAPH,
  }, // Fantom
  {
    id: 0xfa2,
    url: process.env.FTMTEST_SUBSCRIPTION_SUBGRAPH,
  }, // Fantom Testnet
  { id: 0x505, url: process.env.MOONRIVER_SUBSCRIPTION_SUBGRAPH }, // Moonriver
  { id: 0x89, url: process.env.POLYGON_SUBSCRIPTION_SUBGRAPH }, // Polygon
];

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

export const SUBSCRIPTION_FACTORY = [
  { id: 0xa86a, address: process.env.SUBSCRIPTION_FACTORY_AVAX }, // Avalanche
  { id: 0x38, address: process.env.SUBSCRIPTION_FACTORY_BSC }, // Binance
  { id: 0x61, address: process.env.SUBSCRIPTION_FACTORY_BSCTEST }, // Binance Testnet
  { id: 0x1, address: process.env.SUBSCRIPTION_FACTORY_ETH }, // Ethereum
  { id: 0xfa, address: process.env.SUBSCRIPTION_FACTORY_FTM }, // Fantom
  { id: 0xfa2, address: process.env.SUBSCRIPTION_FACTORY_FTMTEST }, // Fantom Testnet
  { id: 0x505, address: process.env.SUBSCRIPTION_FACTORY_MOON }, // Moonriver
  { id: 0x89, address: process.env.SUBSCRIPTION_FACTORY_POLYGON }, // Polygon
];

export const MultiPayFactory = [
  { id: 0xa86a, address: process.env.MULTIPAY_FACTORY_AVAX }, // Avalanche
  { id: 0x38, address: process.env.MULTIPAY_FACTORY_BSC }, // Binance
  { id: 0x61, address: process.env.MULTIPAY_FACTORY_BSCTEST }, // Binance Testnet
  { id: 0x1, address: process.env.MULTIPAY_FACTORY_ETH }, // Ethereum
  { id: 0xfa, address: process.env.MULTIPAY_FACTORY_FTM }, // Fantom
  { id: 0xfa2, address: process.env.MULTIPAY_FACTORY_FTMTEST }, // Fantom Testnet
  { id: 0x505, address: process.env.MULTIPAY_FACTORY_MOON }, // Moonriver
  { id: 0x89, address: process.env.MULTIPAY_FACTORY_POLYGON }, // Polygon
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

export const HECTOR_DROPPER = [
  { id: 0xa86a, address: "" }, // Avalanche
  { id: 0x38, address: "" }, // Binance
  { id: 0x61, address: "" }, // Binance Testnet
  { id: 0x1, address: "" }, // Ethereum
  { id: 0xfa, address: "0x3356b5c256720b15325104e0652429a9e2d51630" }, // Fantom
  { id: 0xfa2, address: "0x3356b5c256720b15325104e0652429a9e2d51630" }, // Fantom Testnet
  { id: 0x505, address: "" }, // Moonriver
  { id: 0x89, address: "" }, // Polygon
];
