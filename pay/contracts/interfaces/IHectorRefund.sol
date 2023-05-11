// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

interface IHectorRefund {
    struct Refund {
        uint48 limitPeriod;
        uint48 percent;
    }

    function applyRefund(
        bytes calldata subscription
    ) external view returns (uint256 refundAmount);
}
