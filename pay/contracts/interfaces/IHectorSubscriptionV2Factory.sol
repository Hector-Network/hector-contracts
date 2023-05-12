// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

interface IHectorSubscriptionV2Factory {
    function parameter() external view returns (bytes memory);

    function factoryOwner() external view returns (address);

    function couponService() external view returns (address);

    function refundService() external view returns (address);

    function priceOracleAggregator() external view returns (address);
}
