// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../Utils.sol";
import "../weth/IWETH.sol";
import "./ICurve.sol";

contract Curve {
    address internal __toToken;

    struct CurveData {
        int128 i;
        int128 j;
        uint256 deadline;
        bool underlyingSwap;
    }

    function swapOnCurve(
        IERC20 fromToken,
        IERC20 toToken,
        uint256 fromAmount,
        address exchange,
        bytes calldata payload
    ) internal {
        __toToken = address(toToken);

        CurveData memory curveData = abi.decode(payload, (CurveData));

        Utils.approve(address(exchange), address(fromToken), fromAmount);

        if (curveData.underlyingSwap) {
            ICurvePool(exchange).exchange_underlying(
                curveData.i,
                curveData.j,
                fromAmount,
                1
            );
        } else {
            if (address(fromToken) == Utils.ethAddress()) {
                ICurveEthPool(exchange).exchange{value: fromAmount}(
                    curveData.i,
                    curveData.j,
                    fromAmount,
                    1
                );
            } else {
                ICurvePool(exchange).exchange(
                    curveData.i,
                    curveData.j,
                    fromAmount,
                    1
                );
            }
        }
    }
}
