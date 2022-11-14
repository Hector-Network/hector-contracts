// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface IHectorSwapperV5 {
    function hasRole(bytes32 role, address account) external view returns (bool);
}