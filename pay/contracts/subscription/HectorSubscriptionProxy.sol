// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {OwnableUpgradeable} from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';

import {IHectorSubscriptionFactory} from '../interfaces/IHectorSubscriptionFactory.sol';
import {IHectorSubscription} from '../interfaces/IHectorSubscription.sol';

error INVALID_ADDRESS();
error INVALID_MODERATOR();

contract HectorSubscriptionProxy is IHectorSubscription, OwnableUpgradeable {
    /* ======== STORAGE ======== */

    /// @notice product
    string public product;

    /// @notice subscription plans configurable by admin
    /// @dev plans[0] is free-plan
    Plan[] public plans;

    /// @notice users subscription data
    mapping(address => Subscription) public subscriptions;

    /// @notice moderators data
    mapping(address => bool) public moderators;

    /* ======== INITIALIZATION ======== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() external initializer {
        IHectorSubscriptionFactory factory = IHectorSubscriptionFactory(
            msg.sender
        );

        product = abi.decode(factory.parameter(), (string));

        moderators[factory.factoryOwner()] = true;

        _transferOwnership(factory.factoryOwner());
    }

    /* ======== MODIFIER ======== */

    modifier onlyMod() {
        if (!moderators[msg.sender]) revert INVALID_MODERATOR();
        _;
    }

    /* ======== POLICY FUNCTIONS ======== */

    function setModerator(
        address _moderator,
        bool _approved
    ) external onlyOwner {
        if (_moderator == address(0)) revert INVALID_ADDRESS();
        moderators[_moderator] = _approved;
    }

    /* ======== MODERATOR FUNCTIONS ======== */

    function appendPlan(Plan[] calldata _plans) external onlyMod {
        uint256 length = _plans.length;
        for (uint256 i = 0; i < length; i++) {
            plans.push(_plans[i]);
        }
    }

    function updatePlan(uint256 _planId, Plan calldata _plan) external onlyMod {
        plans[_planId] = _plan;
    }

    function updateSubscription(
        address _to,
        Subscription calldata _subscription
    ) external onlyMod {
        subscriptions[_to] = _subscription;
    }

    /* ======== VIEW FUNCTIONS ======== */

    function allPlans() external view returns (Plan[] memory) {
        return plans;
    }

    function getPlan(uint256 _planId) external view returns (Plan memory) {
        return plans[_planId];
    }

    function getPlanToken(uint256 _planId) external view returns (address) {
        return plans[_planId].token;
    }

    function getPlanData(uint256 _planId) external view returns (bytes memory) {
        return plans[_planId].data;
    }

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
        )
    {
        Subscription memory subscription = subscriptions[from];

        planId = subscription.planId;
        expiredAt = subscription.expiredAt;
        isCancelled = planId == 0;
        isActiveForNow = block.timestamp < expiredAt;
        dueDate = expiredAt;
    }
}
