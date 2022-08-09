// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.7;

contract MockOracle {
    uint256 public amountOut = 23e18;

    function consult(address token, uint256 amountIn)
        external
        view
        returns (uint256)
    {
        return amountOut;
    }
}
