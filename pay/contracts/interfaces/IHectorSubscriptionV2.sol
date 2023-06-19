// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

import {IHectorSubscriptionBase} from './IHectorSubscriptionBase.sol';

interface IHectorSubscriptionV2 is IHectorSubscriptionBase {
    struct Plan {
        address token;
        uint48 period;
        uint256 price; // USD price
        bytes data;
    }

    struct Subscription {
        uint256 planId;
        uint48 expiredAt;
        uint48 lastPaidAt;
        uint256 lastAmountPaidInUsd; // plan price in USD
        uint256 lastAmountPaid; // plan token amount paid
    }

    function getPlan(uint256 planId) external view returns (Plan memory);
}
