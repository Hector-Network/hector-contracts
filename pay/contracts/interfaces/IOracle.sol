// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IOracle {
    function viewPriceInUSD() external view returns (uint256);
}
