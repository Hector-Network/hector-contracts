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
exports.filterAirdrops = void 0;
var cross_fetch_1 = require("cross-fetch");
var dropper_1 = require("../utils/contracts/dropper");
var apollo_link_1 = require("apollo-link");
var apollo_link_http_1 = require("apollo-link-http");
var graphql_tag_1 = require("graphql-tag");
var chain_1 = require("../utils/chain");
var util_1 = require("../utils/util");
function callReleaseAirdrops(chain, froms, indexes) {
    return __awaiter(this, void 0, void 0, function () {
        var status;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, dropper_1.releaseAirdrops)(chain, froms, indexes)];
                case 1:
                    status = _a.sent();
                    if (status == 0x1) {
                        return [2 /*return*/, true];
                    }
                    return [2 /*return*/, false];
            }
        });
    });
}
function default_1(chainId) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var chain, currentTimestamp, perPage, dataCount, filteredAirdropData, airdropInfos, contracts, users, indexes, usersLength, i, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log("\nStart Airdrop...\n");
                    chain = chain_1.CHAINS.find(function (c) { return c.id == chainId; });
                    if (chain == undefined) {
                        console.error("Chain with ID ".concat(chainId, " not found."));
                        return [2 /*return*/];
                    }
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 6, , 7]);
                    return [4 /*yield*/, (0, util_1.getCurrentTimeInSecond)()];
                case 2:
                    currentTimestamp = _b.sent();
                    perPage = 100;
                    dataCount = 0;
                    _b.label = 3;
                case 3:
                    if (!1) return [3 /*break*/, 5];
                    return [4 /*yield*/, filterAirdrops(chain, perPage, dataCount)];
                case 4:
                    filteredAirdropData = _b.sent();
                    console.log("filteredAirdropData", filteredAirdropData);
                    airdropInfos = (_a = filteredAirdropData === null || filteredAirdropData === void 0 ? void 0 : filteredAirdropData.data) === null || _a === void 0 ? void 0 : _a.hectorDropperContracts;
                    console.log("airdropInfos", airdropInfos);
                    contracts = airdropInfos.map(function (contract) { return contract.address; });
                    users = airdropInfos.map(function (contract) {
                        return contract.airdrops.map(function (airdrop) { return airdrop.from.address; });
                    });
                    indexes = airdropInfos.map(function (contract) {
                        return contract.airdrops.map(function (airdrop) { return airdrop.index; });
                    });
                    console.log("contracts", contracts);
                    console.log("users", users);
                    console.log("indexes", indexes);
                    usersLength = 0;
                    for (i = 0; i < users.length; i++) {
                        usersLength += users[i].length;
                    }
                    if (contracts.length > 0 && usersLength > 0) {
                        //const result = await callReleaseAirdrops(chain, users, contracts);
                        //if (result == false) break;
                    }
                    else {
                        return [3 /*break*/, 5];
                    }
                    dataCount += perPage;
                    return [3 /*break*/, 3];
                case 5: return [3 /*break*/, 7];
                case 6:
                    error_1 = _b.sent();
                    console.log(error_1);
                    return [2 /*return*/];
                case 7: return [2 /*return*/];
            }
        });
    });
}
exports.default = default_1;
function filterAirdrops(chain, first, skip) {
    return __awaiter(this, void 0, void 0, function () {
        var uri, link, query, operation;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    uri = (0, util_1.getDropperSubgraphURL)(chain);
                    link = (0, apollo_link_http_1.createHttpLink)({ uri: uri, fetch: cross_fetch_1.default });
                    query = "\n    query {\n            hectorDropperContracts {\n              address\n              airdrops(first: ".concat(first, ", skip: ").concat(skip, ", where: {status: \"0\"}) {\n                from {\n                  address\n                }\n                index\n              }\n            }\n        }");
                    operation = {
                        query: (0, graphql_tag_1.default)(query),
                    };
                    return [4 /*yield*/, (0, apollo_link_1.makePromise)((0, apollo_link_1.execute)(link, operation))];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
exports.filterAirdrops = filterAirdrops;
//# sourceMappingURL=releaseAirdrops.js.map