// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

interface IHectorSubscriptionFactory {
    function parameter() external view returns (bytes memory);

    function factoryOwner() external view returns (address);
}
