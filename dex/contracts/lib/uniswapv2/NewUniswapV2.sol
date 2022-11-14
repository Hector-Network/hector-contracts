// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "./NewUniswapV2Lib.sol";
import "../../lib/Utils.sol";
import "../../lib/weth/IWETH.sol";

abstract contract NewUniswapV2 {
    using SafeMath for uint256;

    // Pool bits are 255-161: fee, 160: direction flag, 159-0: address
    uint256 constant FEE_OFFSET = 161;
    uint256 constant DIRECTION_FLAG =
        0x0000000000000000000000010000000000000000000000000000000000000000;
    address internal _toToken;

    struct UniswapV2Data {
        address weth;
        uint256[] pools;
    }

    function swapOnUniswapV2Fork(
        IERC20 fromToken,
        IERC20 toToken,
        uint256 fromAmount,
        bytes calldata payload
    ) internal {
        UniswapV2Data memory data = abi.decode(payload, (UniswapV2Data));
        _toToken = address(toToken);
        _swapOnUniswapV2Fork(
            address(fromToken),
            fromAmount,
            data.weth,
            data.pools
        );
    }

    function _swapOnUniswapV2Fork(
        address tokenIn,
        uint256 amountIn,
        address weth,
        uint256[] memory pools
    ) private returns (uint256 tokensBought) {
        uint256 pairs = pools.length;

        require(pairs != 0, "At least one pool required");

        bool tokensBoughtEth;

        if (tokenIn == Utils.ethAddress()) {
            IWETH(weth).deposit{value: amountIn}();
            require(IWETH(weth).transfer(address(uint160(pools[0])), amountIn));
        } else {
            TransferHelper.safeTransfer(
                tokenIn,
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
                i + 1 == pairs ? address(this) : address(uint160(pools[i + 1])),
                ""
            );
        }

        if (tokensBoughtEth) {
            IWETH(weth).withdraw(tokensBought);
        }
    }
}
