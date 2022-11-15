// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface ISwap {
    function swap(
        uint8 tokenIndexFrom,
        uint8 tokenIndexTo,
        uint256 dx,
        uint256 minDy,
        uint256 deadline
    ) external;
}