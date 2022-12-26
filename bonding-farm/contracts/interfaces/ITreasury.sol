// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ITreasury {
    function mintRewards(address _recipient, uint256 _amount) external;
}
