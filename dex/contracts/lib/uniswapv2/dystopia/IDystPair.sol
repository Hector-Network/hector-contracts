// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface IDystPair {
    function getAmountOut(uint256, address) external view returns (uint256);

    function token0() external returns (address);

    function token1() external returns (address);

    function swap(
        uint256 amount0Out,
        uint256 amount1Out,
        address to,
        bytes calldata data
    ) external;

    function stable() external returns (bool);
}