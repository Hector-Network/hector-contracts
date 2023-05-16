// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

interface IHectorPay {
    function activeStreamsByRemoveEnded(
        address from
    ) external returns (uint256 count);
}
