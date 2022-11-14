// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";

import "../lib/Utils.sol";
import "../ITokenTransferProxy.sol";
import "../adapters/IAdapter.sol";
import "../lib/weth/IWETH.sol";
import "../lib/uniswapv2/NewUniswapV2.sol";
import "../lib/curve/Curve.sol";
import "../lib/curve/CurveV2.sol";
import "../lib/weth/WethExchange.sol";

/**
 * @dev This contract will route call to different exchanges
 * 1 - WFTM
 * 2 - UniswapV2Forks
 * 3 - Curve
 * 4 - CurveV2
 * The above are the indexes
 */
abstract contract FantomAdapter01 is
    IAdapter,
    NewUniswapV2,
    WethExchange,
    Curve,
    CurveV2
{
    using SafeMath for uint256;
    uint256 internal _networkFee;

    constructor(address _weth) WethProvider(_weth) {}

    function initialize() external pure {
        revert("METHOD NOT IMPLEMENTED");
    }

    function swap(
        IERC20 fromToken,
        IERC20 toToken,
        uint256 fromAmount,
        uint256 networkFee,
        Utils.Route[] calldata route
    ) external payable override {
        _networkFee = networkFee;
        for (uint256 i = 0; i < route.length; i++) {
            if (route[i].index == 1) {
                //swap on WETH
                swapOnWETH(
                    fromToken,
                    toToken,
                    fromAmount.mul(route[i].percent).div(10000)
                );
            } else if (route[i].index == 2) {
                //swap on uniswapV2Fork
                swapOnUniswapV2Fork(
                    fromToken,
                    toToken,
                    fromAmount.mul(route[i].percent).div(10000),
                    route[i].payload
                );
            } else if (route[i].index == 3) {
                //swap on curve
                swapOnCurve(
                    fromToken,
                    toToken,
                    fromAmount.mul(route[i].percent).div(10000),
                    route[i].targetExchange,
                    route[i].payload
                );
            } else if (route[i].index == 4) {
                //swap on CurveV2
                swapOnCurveV2(
                    fromToken,
                    toToken,
                    fromAmount.mul(route[i].percent).div(10000),
                    route[i].targetExchange,
                    route[i].payload
                );
            } else {
                revert("Index not supported");
            }
        }
    }
}
