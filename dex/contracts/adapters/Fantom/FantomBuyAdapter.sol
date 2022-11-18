// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "../../lib/uniswapv2/NewUniswapV2.sol";
import "../../lib/augustus-rfq/AugustusRFQ.sol";
import "../IBuyAdapter.sol";

/**
 * @dev This contract will route call to:
 * 1- UniswapV2Forks
 * 2- AugustusRFQ
 * The above are the indexes
 */
contract FantomBuyAdapter is IBuyAdapter, NewUniswapV2, AugustusRFQ {
    using SafeMath for uint256;

    constructor(address _weth) WethProvider(_weth) {}

    function initialize(bytes calldata) external pure override {
        revert("METHOD NOT IMPLEMENTED");
    }

    function buy(
        uint256 index,
        IERC20 fromToken,
        IERC20 toToken,
        uint256 maxFromAmount,
        uint256 toAmount,
        address targetExchange,
        bytes calldata payload
    ) external payable override {
        if (index == 1) {
            buyOnUniswapFork(fromToken, toToken, maxFromAmount, toAmount, payload);
        } else if (index == 2) {
            buyOnAugustusRFQ(fromToken, toToken, maxFromAmount, toAmount, targetExchange, payload);
        } else {
            revert("Index not supported");
        }
    }
}