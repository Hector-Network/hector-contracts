// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

interface IHectorDropper {
    function releaseAirdrops(
        address[] calldata froms,
        uint256[] calldata indexes
    ) external;
}
