// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;
pragma abicoder v2;

import "../Utils.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ISwap.sol";

contract SaddleAdapter {
    address internal _saddleToken;
    struct SaddleData {
        uint8 i;
        uint8 j;
        uint256 deadline;
    }

    function swapOnSaddle(
        IERC20 fromToken,
        IERC20 toToken,
        uint256 fromAmount,
        address exchange,
        bytes calldata payload
    ) internal {
        _saddleToken = address(toToken);
        SaddleData memory data = abi.decode(payload, (SaddleData));

        Utils.approve(address(exchange), address(fromToken), fromAmount);

        ISwap(exchange).swap(data.i, data.j, fromAmount, 1, data.deadline);
    }
}