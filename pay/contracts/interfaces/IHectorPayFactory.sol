// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

interface IHectorPayFactory {
    function parameter() external view returns (address);

    function validator() external view returns (address);

    function activeStreamsByRemoveEnded(
        address from
    ) external returns (uint256 count);
}
