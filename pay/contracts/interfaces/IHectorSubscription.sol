// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

interface IHectorSubscription {
    struct Plan {
        address token;
        uint48 period;
        uint256 amount;
        bytes data;
    }

    struct Subscription {
        uint256 planId;
        uint48 expiredAt;
    }

    function getPlan(uint256 planId) external view returns (Plan memory);

    function getSubscription(
        address from
    )
        external
        view
        returns (
            uint256 planId,
            uint48 expiredAt,
            bool isCancelled,
            bool isActiveForNow,
            uint48 dueDate
        );
}
