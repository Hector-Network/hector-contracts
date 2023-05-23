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

    /// @notice refund data for subscription plan
    mapping(uint256 => Refund[]) public refunds;

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
        uint256[] calldata _planIds,
        Refund[][] calldata _refunds
    ) external onlyMod {
        uint256 length = _planIds.length;
        if (length != _refunds.length) revert INVALID_PARAM();

        for (uint256 i = 0; i < length; i++) {
            uint256 planId = _planIds[i];
            uint256 subLength = _refunds[i].length;

            for (uint256 j = 0; j < subLength; j++) {
                Refund memory refund = _refunds[i][j];
                if (refund.limitPeriod == 0) revert INVALID_PERIOD();
                if (refund.percent > MULTIPLIER) revert INVALID_PERCENT();

                refunds[planId].push(refund);
            }
        }
    }

    function updateRefund(
        uint256 _planId,
        uint256 _index,
        Refund calldata _refund
    ) external onlyMod {
        if (_index >= refunds[_planId].length) revert INVALID_PARAM();
        if (_refund.limitPeriod == 0) revert INVALID_PERIOD();
        if (_refund.percent > MULTIPLIER) revert INVALID_PERCENT();

        refunds[_planId][_index] = _refund;
    }

    function removeRefund(uint256 _planId, uint256 _index) external onlyMod {
        uint256 length = refunds[_planId].length;
        if (_index >= length) revert INVALID_PARAM();

        refunds[_planId][_index] = refunds[_planId][length - 1];
        delete refunds[_planId][length - 1];
        refunds[_planId].pop();
    }

    /* ======== VIEW FUNCTIONS ======== */

    function allRefundsForPlan(
        uint256 _planId
    ) external view returns (Refund[] memory) {
        return refunds[_planId];
    }

    function getRefundAmount(
        bytes calldata subscription
    ) external view returns (uint256 refundAmount) {
        (uint256 planId, uint48 lastPaidAt, uint256 lastAmountPaid) = abi
            .decode(subscription, (uint256, uint48, uint256));

        uint48 period = uint48(block.timestamp) - lastPaidAt;
        uint48 percent = 0;
        uint256 length = refunds[planId].length;

        for (uint256 i = 0; i < length; i++) {
            Refund memory refund = refunds[planId][i];

            if (percent < refund.percent && period < refund.limitPeriod) {
                percent = refund.percent;
            }
        }

        return (lastAmountPaid * percent) / MULTIPLIER;
    }
}
