"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHAINS = exports.chainRequest = exports.ARBITRUM = exports.OPTIMISM = exports.POLYGON = exports.MOONRIVER = exports.FANTOM = exports.FANTOM_TESTNET = exports.FANTOM_MAINNET = exports.ETHEREUM = exports.BINANCE_TESTNET = exports.BINANCE = exports.AVALANCHE = void 0;
var axios_1 = require("axios");
exports.AVALANCHE = {
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
    millisPerBlock: 3500,
};
exports.BINANCE = {
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
    millisPerBlock: 3500,
};
exports.BINANCE_TESTNET = {
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
    millisPerBlock: 3500,
};
exports.ETHEREUM = {
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
    millisPerBlock: 15000,
};
exports.FANTOM_MAINNET = {
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
    millisPerBlock: 2500,
};
exports.FANTOM_TESTNET = {
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
    millisPerBlock: 2500,
};
exports.FANTOM = exports.FANTOM_MAINNET;
exports.MOONRIVER = {
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
    millisPerBlock: 15000,
};
exports.POLYGON = {
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
    millisPerBlock: 3000,
};
exports.OPTIMISM = {
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
    millisPerBlock: 15000,
};
exports.ARBITRUM = {
    id: 0xa4b1,
    shortName: "Arbitrum",
    longName: "Arbitrum One",
    color: "#28a0f0",
    rpc: ["https://arb1.arbitrum.io/rpc"],
    explorers: ["https://mainnet.optimism.io"],
    millisPerBlock: 15000,
};
function chainRequest(chain, args) {
    return __awaiter(this, void 0, void 0, function () {
        var response, body;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, axios_1.default.post(chain.rpc[0], {
                        jsonrpc: "2.0",
                        id: 800000000085,
                        method: args.method,
                        params: args.params,
                    })];
                case 1:
                    response = _a.sent();
                    body = response.data;
                    if (body.error) {
                        throw body.error;
                    }
                    return [2 /*return*/, body.result];
            }
        });
    });
}
exports.chainRequest = chainRequest;
exports.CHAINS = [
    exports.FANTOM_MAINNET,
    exports.FANTOM_TESTNET,
    exports.BINANCE,
    exports.BINANCE_TESTNET,
    exports.ETHEREUM,
    exports.AVALANCHE,
    exports.MOONRIVER,
    exports.POLYGON,
    exports.OPTIMISM,
    exports.ARBITRUM,
];
//# sourceMappingURL=chain.js.map