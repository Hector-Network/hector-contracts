// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface IRouter {
    /**
     * @dev Certain routers/exchanges needs to be initialized.
     * This method will be called from HectorSwapper
     */
    function initialize(bytes calldata data) external;

    /**
     * @dev Returns unique identifier for the router
     */
    function getKey() external pure returns (bytes32);

    event Swapped(
        bytes16 uuid,
        address initiator,
        address indexed beneficiary,
        address indexed srcToken,
        address indexed destToken,
        uint256 srcAmount,
        uint256 receivedAmount,
        uint256 expectedAmount
    );

    event Bought(
        bytes16 uuid,
        address initiator,
        address indexed beneficiary,
        address indexed srcToken,
        address indexed destToken,
        uint256 srcAmount,
        uint256 receivedAmount
    );

    event FeeTaken(uint256 fee, uint256 partnerShare, uint256 paraswapShare);
}