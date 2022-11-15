// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../WethProvider.sol";
import "./IWooPP.sol";
import "../Utils.sol";
import "../weth/IWETH.sol";

abstract contract WooFiAdapter is WethProvider {
    struct WooFiData {
        address rebateTo;
    }

    function swapOnWooFi(
        IERC20 fromToken,
        IERC20 toToken,
        uint256 fromAmount,
        address exchange,
        bytes calldata payload
    ) internal {
        WooFiData memory wooFiData = abi.decode(payload, (WooFiData));

        address _fromToken = address(fromToken) == Utils.ethAddress() ? WETH : address(fromToken);
        address _toToken = address(toToken) == Utils.ethAddress() ? WETH : address(toToken);

        if (address(fromToken) == Utils.ethAddress()) {
            IWETH(WETH).deposit{ value: fromAmount }();
        }

        Utils.approve(exchange, _fromToken, fromAmount);
        address quoteToken = IWooPP(exchange).quoteToken();
        if (address(_fromToken) == quoteToken) {
            IWooPP(exchange).sellQuote(address(_toToken), fromAmount, 1, address(this), wooFiData.rebateTo);
        } else if (address(_toToken) == quoteToken) {
            IWooPP(exchange).sellBase(address(_fromToken), fromAmount, 1, address(this), wooFiData.rebateTo);
        } else {
            revert("One of the tokens must be quoteToken");
        }

        if (address(toToken) == Utils.ethAddress()) {
            IWETH(WETH).withdraw(IERC20(WETH).balanceOf(address(this)));
        }
    }
}