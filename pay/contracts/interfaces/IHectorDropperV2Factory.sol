// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

interface IHectorDropperV2Factory {
    function parameter() external view returns (address);

    function factoryOwner() external view returns (address);

    function validator() external view returns (address);
}
