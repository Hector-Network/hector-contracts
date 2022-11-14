// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";

import "../ITokenTransferProxy.sol";
import "../HectorStorage.sol";
import "../routers/IRouter.sol";
import "../lib/Utils.sol";
import "../lib/weth/IWETH.sol";
import "../lib/uniswapv2/NewUniswapV2Lib.sol";

abstract contract NewUniswapV2Router is HectorStorage, IRouter {
    using SafeMath for uint256;

    address constant ETH_IDENTIFIER =
        address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);
    // Pool bits are 255-161: fee, 160: direction flag, 159-0: address
    uint256 constant FEE_OFFSET = 161;
    uint256 constant DIRECTION_FLAG =
        0x0000000000000000000000010000000000000000000000000000000000000000;

    function initialize() external pure {
        revert("METHOD NOT IMPLEMENTED");
    }

    function getKey() external pure override returns (bytes32) {
        return keccak256(abi.encodePacked("UNISWAP_DIRECT_ROUTER", "2.0.0"));
    }

    function swapOnUniswapV2Fork(
        address tokenIn,
        uint256 amountIn,
        uint256 amountOutMin,
        address weth,
        uint256[] calldata pools
    ) external payable {
        _swap(tokenIn, amountIn, amountOutMin, weth, pools);
    }

    function buyOnUniswapV2Fork(
        address tokenIn,
        uint256 amountInMax,
        uint256 amountOut,
        address weth,
        uint256[] calldata pools
    ) external payable {
        _buy(tokenIn, amountInMax, amountOut, weth, pools);
    }

    function transferTokens(
        address token,
        address from,
        address to,
        uint256 amount
    ) private {
        ITokenTransferProxy(tokenTransferProxy).transferFrom(
            token,
            from,
            to,
            amount
        );
    }

    function _swap(
        address tokenIn,
        uint256 amountIn,
        uint256 amountOutMin,
        address weth,
        uint256[] memory pools
    ) private returns (uint256 tokensBought) {
        uint256 pairs = pools.length;

        require(pairs != 0, "At least one pool required");

        bool tokensBoughtEth;

        if (tokenIn == ETH_IDENTIFIER) {
            require(amountIn == msg.value, "Incorrect amount of ETH sent");
            IWETH(weth).deposit{value: msg.value}();
            require(
                IWETH(weth).transfer(address(uint160(pools[0])), msg.value)
            );
        } else {
            transferTokens(
                tokenIn,
                msg.sender,
                address(uint160(pools[0])),
                amountIn
            );
            tokensBoughtEth = weth != address(0);
        }

        tokensBought = amountIn;

        for (uint256 i = 0; i < pairs; ++i) {
            uint256 p = pools[i];
            address pool = address(uint160(p));
            bool direction = p & DIRECTION_FLAG == 0;

            tokensBought = NewUniswapV2Lib.getAmountOut(
                tokensBought,
                pool,
                direction,
                p >> FEE_OFFSET
            );
            (uint256 amount0Out, uint256 amount1Out) = direction
                ? (uint256(0), tokensBought)
                : (tokensBought, uint256(0));
            IUniswapV2Pair(pool).swap(
                amount0Out,
                amount1Out,
                i + 1 == pairs
                    ? (tokensBoughtEth ? address(this) : msg.sender)
                    : address(uint160(pools[i + 1])),
                ""
            );
        }

        if (tokensBoughtEth) {
            IWETH(weth).withdraw(tokensBought);
            TransferHelper.safeTransferETH(msg.sender, tokensBought);
        }

        require(
            tokensBought >= amountOutMin,
            "UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT"
        );
    }

    function _buy(
        address tokenIn,
        uint256 amountInMax,
        uint256 amountOut,
        address weth,
        uint256[] memory pools
    ) private returns (uint256 tokensSold) {
        uint256 pairs = pools.length;

        require(pairs != 0, "At least one pool required");

        uint256[] memory amounts = new uint256[](pairs + 1);

        amounts[pairs] = amountOut;

        for (uint256 i = pairs; i != 0; --i) {
            uint256 p = pools[i - 1];
            amounts[i - 1] = NewUniswapV2Lib.getAmountIn(
                amounts[i],
                address(uint160(p)),
                p & DIRECTION_FLAG == 0,
                p >> FEE_OFFSET
            );
        }

        tokensSold = amounts[0];
        require(
            tokensSold <= amountInMax,
            "UniswapV2Router: INSUFFICIENT_INPUT_AMOUNT"
        );
        bool tokensBoughtEth;

        if (tokenIn == ETH_IDENTIFIER) {
            TransferHelper.safeTransferETH(
                msg.sender,
                msg.value.sub(tokensSold)
            );
            IWETH(weth).deposit{value: tokensSold}();
            require(
                IWETH(weth).transfer(address(uint160(pools[0])), tokensSold)
            );
        } else {
            transferTokens(
                tokenIn,
                msg.sender,
                address(uint160(pools[0])),
                tokensSold
            );
            tokensBoughtEth = weth != address(0);
        }

        for (uint256 i = 0; i < pairs; ++i) {
            uint256 p = pools[i];
            (uint256 amount0Out, uint256 amount1Out) = p & DIRECTION_FLAG == 0
                ? (uint256(0), amounts[i + 1])
                : (amounts[i + 1], uint256(0));
            IUniswapV2Pair(address(uint160(p))).swap(
                amount0Out,
                amount1Out,
                i + 1 == pairs
                    ? (tokensBoughtEth ? address(this) : msg.sender)
                    : address(uint160(pools[i + 1])),
                ""
            );
        }

        if (tokensBoughtEth) {
            IWETH(weth).withdraw(amountOut);
            TransferHelper.safeTransferETH(msg.sender, amountOut);
        }
    }
}
