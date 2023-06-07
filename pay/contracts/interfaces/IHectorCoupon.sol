// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

interface IHectorCoupon {
    struct Pay {
        /// @notice product
        string product;
        /// @notice payer address
        address payer;
        /// @notice payment token
        address token;
        /// @notice payment amount/price
        uint256 amount;
    }

    function tryApplyCoupon(
        Pay calldata pay,
        bytes calldata couponInfo,
        bytes calldata signature
    ) external view returns (bool isValid, uint256 id, uint256 newAmount);

    function applyCoupon(
        Pay calldata pay,
        bytes calldata couponInfo,
        bytes calldata signature
    ) external returns (bool isValid, uint256 id, uint256 newAmount);
}
