// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.17;

import {OwnableUpgradeable} from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';

import {IHectorRefund} from '../interfaces/IHectorRefund.sol';

error INVALID_MODERATOR();
error INVALID_ADDRESS();
error INVALID_PARAM();
error INVALID_PERIOD();
error INVALID_PERCENT();

contract HectorRefund is IHectorRefund, OwnableUpgradeable {
    /* ======== STORAGE ======== */

    /// @notice moderators data
    mapping(address => bool) public moderators;

    /// @notice refund data for subscription plan of product
    mapping(bytes32 => mapping(uint256 => Refund[])) public refunds;

    /// @notice multiplier
    uint256 public constant MULTIPLIER = 10000;

    /* ======== INITIALIZATION ======== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() external initializer {
        moderators[msg.sender] = true;

        __Ownable_init();
    }

    /* ======== MODIFIER ======== */

    modifier onlyMod() {
        if (!moderators[msg.sender]) revert INVALID_MODERATOR();
        _;
    }

    /* ======== POLICY FUNCTIONS ======== */

    function setModerator(address moderator, bool approved) external onlyOwner {
        if (moderator == address(0)) revert INVALID_ADDRESS();
        moderators[moderator] = approved;
    }

    /* ======== MODERATOR FUNCTIONS ======== */

    function appendRefund(
        string calldata _product,
        uint256[] calldata _planIds,
        Refund[][] calldata _refunds
    ) external onlyMod {
        uint256 length = _planIds.length;
        if (length != _refunds.length) revert INVALID_PARAM();

        bytes32 product = keccak256(bytes(_product));

        for (uint256 i = 0; i < length; i++) {
            uint256 planId = _planIds[i];
            uint256 subLength = _refunds[i].length;

            for (uint256 j = 0; j < subLength; j++) {
                Refund memory refund = _refunds[i][j];
                if (refund.limitPeriod == 0) revert INVALID_PERIOD();
                if (refund.percent > MULTIPLIER) revert INVALID_PERCENT();

                refunds[product][planId].push(refund);
            }
        }
    }

    function updateRefund(
        string calldata _product,
        uint256 _planId,
        uint256 _index,
        Refund calldata _refund
    ) external onlyMod {
        bytes32 product = keccak256(bytes(_product));
        if (_index >= refunds[product][_planId].length) revert INVALID_PARAM();
        if (_refund.limitPeriod == 0) revert INVALID_PERIOD();
        if (_refund.percent > MULTIPLIER) revert INVALID_PERCENT();

        refunds[product][_planId][_index] = _refund;
    }

    function removeRefund(
        string calldata _product,
        uint256 _planId,
        uint256 _index
    ) external onlyMod {
        bytes32 product = keccak256(bytes(_product));
        uint256 length = refunds[product][_planId].length;
        if (_index >= length) revert INVALID_PARAM();

        refunds[product][_planId][_index] = refunds[product][_planId][
            length - 1
        ];
        delete refunds[product][_planId][length - 1];
        refunds[product][_planId].pop();
    }

    /* ======== VIEW FUNCTIONS ======== */

    function allRefundsForPlan(
        string calldata _product,
        uint256 _planId
    ) external view returns (Refund[] memory) {
        bytes32 product = keccak256(bytes(_product));

        return refunds[product][_planId];
    }

    function getRefundAmount(
        bytes calldata subscription
    ) external view returns (uint256 refundAmount) {
        (
            bytes32 product,
            uint256 planId,
            uint48 lastPaidAt,
            uint256 lastAmountPaid
        ) = abi.decode(subscription, (bytes32, uint256, uint48, uint256));

        uint48 period = uint48(block.timestamp) - lastPaidAt;
        uint48 percent = 0;
        uint256 length = refunds[product][planId].length;

        for (uint256 i = 0; i < length; i++) {
            Refund memory refund = refunds[product][planId][i];

            if (percent < refund.percent && period < refund.limitPeriod) {
                percent = refund.percent;
            }
        }

        return (lastAmountPaid * percent) / MULTIPLIER;
    }
}
