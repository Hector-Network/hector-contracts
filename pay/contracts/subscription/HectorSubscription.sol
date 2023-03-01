// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {OwnableUpgradeable} from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import {ReentrancyGuardUpgradeable} from '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';

interface Factory {
    function parameter() external view returns (bytes memory);

    function owner() external view returns (address);
}

error INVALID_PARAM();
error INVALID_ADDRESS();
error INVALID_AMOUNT();
error INVALID_TIME();
error INVALID_PLAN();
error INSUFFICIENT_FUND();
error INACTIVE_SUBSCRIPTION();
error ACTIVE_SUBSCRIPTION();
error INVALID_MODERATOR();

contract HectorSubscription is OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    /* ======== STORAGE ======== */

    struct Plan {
        address token; // TOR, WFTM
        uint48 period; // 3 months, 6 months, 12 months
        uint256 amount;
    }

    struct Subscription {
        uint256 planId;
        uint48 expiredAt;
    }

    /// @notice product
    string public product;

    /// @notice treasury wallet
    address public treasury;

    /// @notice subscription plans configurable by admin
    Plan[] public plans;

    /// @notice expire deadline to cancel subscription
    uint48 public expireDeadline = 30 days;

    /// @notice users token balance data
    mapping(address => mapping(address => uint256)) public balanceOf;

    /// @notice users subscription data
    mapping(address => Subscription) public subscriptions;

    /// @notice moderators data
    mapping(address => bool) public moderators;

    /// @notice users refund token balance data
    mapping(address => mapping(address => uint256)) public refundOf;

    /* ======== EVENTS ======== */

    event PlanUpdated(
        uint256 indexed planId,
        address token,
        uint48 period,
        uint256 amount
    );
    event SubscriptionCreated(
        address indexed from,
        uint256 indexed planId,
        uint48 expiredAt
    );
    event SubscriptionSynced(
        address indexed from,
        uint256 indexed planId,
        uint48 expiredAt,
        uint256 amount
    );
    event SubscriptionCancelled(address indexed from, uint256 indexed planId);
    event SubscriptionModified(
        address indexed from,
        uint256 indexed oldPlanId,
        uint256 refundForOldPlan,
        uint256 indexed newPlanId,
        uint256 payForNewPlan,
        uint48 expiredAt
    );
    event PayerDeposit(
        address indexed from,
        address indexed token,
        uint256 amount
    );
    event PayerWithdraw(
        address indexed from,
        address indexed token,
        uint256 amount
    );
    event Refunded(address indexed to, address indexed token, uint256 amount);

    /* ======== INITIALIZATION ======== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() external initializer {
        Factory factory = Factory(msg.sender);

        (product, treasury) = abi.decode(
            factory.parameter(),
            (string, address)
        );

        plans.push(Plan({token: address(0), period: 0, amount: 0}));

        moderators[factory.owner()] = true;

        _transferOwnership(factory.owner());
        __ReentrancyGuard_init();
    }

    /* ======== MODIFIER ======== */

    modifier onlyMod() {
        if (!moderators[msg.sender]) revert INVALID_MODERATOR();
        _;
    }

    modifier onlyValidPlan(uint256 _planId) {
        if (_planId == 0 || _planId >= plans.length) revert INVALID_PLAN();
        _;
    }

    /* ======== POLICY FUNCTIONS ======== */

    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert INVALID_ADDRESS();
        treasury = _treasury;
    }

    function setModerator(address _moderator, bool _approved)
        external
        onlyOwner
    {
        if (_moderator == address(0)) revert INVALID_ADDRESS();
        moderators[_moderator] = _approved;
    }

    /* ======== MODERATOR FUNCTIONS ======== */

    function appendPlan(Plan[] calldata _plans) external onlyMod {
        uint256 length = _plans.length;
        for (uint256 i = 0; i < length; i++) {
            Plan memory _plan = _plans[i];

            if (_plan.token == address(0)) revert INVALID_ADDRESS();
            if (_plan.period == 0) revert INVALID_TIME();
            if (_plan.amount == 0) revert INVALID_AMOUNT();

            plans.push(_plan);

            emit PlanUpdated(
                plans.length - 1,
                _plan.token,
                _plan.period,
                _plan.amount
            );
        }
    }

    function updatePlan(uint256 _planId, Plan calldata _plan)
        external
        onlyMod
        onlyValidPlan(_planId)
    {
        if (_plan.token == address(0)) revert INVALID_ADDRESS();
        if (_plan.period == 0) revert INVALID_TIME();
        if (_plan.amount == 0) revert INVALID_AMOUNT();

        plans[_planId] = _plan;

        emit PlanUpdated(_planId, _plan.token, _plan.period, _plan.amount);
    }

    function updateExpireDeadline(uint48 _expireDeadline) external onlyMod {
        if (_expireDeadline == 0) revert INVALID_TIME();

        expireDeadline = _expireDeadline;
    }

    function refundToTreasury(
        address[] memory _tokens,
        uint256[] memory _amounts
    ) external onlyMod {
        uint256 length = _tokens.length;
        if (length != _amounts.length) revert INVALID_PARAM();

        for (uint256 i = 0; i < length; i++) {
            address token = _tokens[i];
            uint256 amount = _amounts[i];

            if (token == address(0)) revert INVALID_ADDRESS();
            if (amount == 0 || amount > IERC20(token).balanceOf(address(this)))
                revert INVALID_AMOUNT();

            IERC20(token).safeTransfer(treasury, amount);

            emit Refunded(treasury, token, amount);
        }
    }

    function refund(
        address[] memory _tos,
        address[] memory _tokens,
        uint256[] memory _amounts
    ) external onlyMod {
        uint256 length = _tos.length;
        if (length != _tokens.length) revert INVALID_PARAM();
        if (length != _amounts.length) revert INVALID_PARAM();

        for (uint256 i = 0; i < length; i++) {
            address to = _tos[i];

            /// only active subscription
            if (subscriptions[to].planId == 0) {
                continue;
            }

            address token = _tokens[i];
            uint256 amount = _amounts[i];

            if (token == address(0)) revert INVALID_ADDRESS();
            if (
                amount == 0 ||
                amount > IERC20(token).balanceOf(address(this)) ||
                amount > refundOf[to][token]
            ) revert INVALID_AMOUNT();

            unchecked {
                refundOf[to][token] -= amount;
            }

            IERC20(token).safeTransfer(to, amount);

            emit Refunded(to, token, amount);
        }
    }

    /* ======== VIEW FUNCTIONS ======== */

    function allPlans() external view returns (Plan[] memory) {
        return plans;
    }

    function getSubscription(address from)
        external
        view
        returns (
            uint256 planId,
            uint48 expiredAt,
            bool isCancelled,
            bool isActiveForNow,
            uint256 chargeAmount
        )
    {
        Subscription memory subscription = subscriptions[from];
        planId = subscription.planId;
        expiredAt = subscription.expiredAt;

        // cancelled subscription
        if (planId == 0) {
            return (0, expiredAt, true, block.timestamp < expiredAt, 0);
        }

        // before expiration
        if (block.timestamp < expiredAt) {
            isActiveForNow = true;
        } else {
            // after expiration
            Plan memory plan = plans[planId];
            uint256 count = (block.timestamp - expiredAt + plan.period) /
                plan.period;
            uint256 amount = plan.amount * count;
            uint256 balance = balanceOf[from][plan.token];

            if (balance >= amount) {
                isActiveForNow = true;
                chargeAmount = 0;
            } else {
                isActiveForNow = false;
                chargeAmount = amount - balance;
            }
        }
    }

    /* ======== USER FUNCTIONS ======== */

    function deposit(address _token, uint256 _amount) public nonReentrant {
        balanceOf[msg.sender][_token] += _amount;

        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        emit PayerDeposit(msg.sender, _token, _amount);
    }

    function createSubscription(uint256 _planId) public onlyValidPlan(_planId) {
        Subscription storage subscription = subscriptions[msg.sender];

        // check if no or expired subscription
        if (subscription.planId > 0) {
            syncSubscription(msg.sender);

            if (subscription.expiredAt > block.timestamp)
                revert ACTIVE_SUBSCRIPTION();
        }

        Plan memory plan = plans[_planId];

        // Pay first plan
        if (balanceOf[msg.sender][plan.token] < plan.amount)
            revert INSUFFICIENT_FUND();

        unchecked {
            balanceOf[msg.sender][plan.token] -= plan.amount;
        }

        IERC20(plan.token).safeTransfer(treasury, plan.amount);

        // Set subscription
        subscription.planId = _planId;
        subscription.expiredAt = uint48(block.timestamp) + plan.period;

        emit SubscriptionCreated(msg.sender, _planId, subscription.expiredAt);
    }

    function depositAndCreateSubscription(uint256 _planId, uint256 _amount)
        external
    {
        deposit(plans[_planId].token, _amount);
        createSubscription(_planId);
    }

    function syncSubscriptions(address[] memory froms) external {
        uint256 length = froms.length;
        for (uint256 i = 0; i < length; i++) {
            syncSubscription(froms[i]);
        }
    }

    function syncSubscription(address from) public {
        Subscription storage subscription = subscriptions[from];
        uint256 planId = subscription.planId;

        // inactive subscription
        if (planId == 0) return;

        // before expiration
        if (block.timestamp < subscription.expiredAt) return;

        // after expiration
        Plan memory plan = plans[planId];
        uint256 count = (block.timestamp -
            subscription.expiredAt +
            plan.period) / plan.period;
        uint256 amount = plan.amount * count;
        uint256 balance = balanceOf[from][plan.token];

        // not active for now
        if (balance < amount) {
            count = balance / plan.amount;
            amount = plan.amount * count;
        }

        if (count > 0) {
            unchecked {
                balanceOf[from][plan.token] -= amount;
                subscription.expiredAt += uint48(plan.period * count);
            }

            IERC20(plan.token).transfer(treasury, amount);
        }

        // expired for a long time (deadline), then cancel it
        if (subscription.expiredAt + expireDeadline <= block.timestamp) {
            subscription.planId = 0;
        }

        emit SubscriptionSynced(
            from,
            subscription.planId,
            subscription.expiredAt,
            amount
        );
    }

    function cancelSubscription() external {
        syncSubscription(msg.sender);

        uint256 planId = subscriptions[msg.sender].planId;

        // check if active subscription
        if (planId == 0) revert INACTIVE_SUBSCRIPTION();

        subscriptions[msg.sender].planId = 0;

        emit SubscriptionCancelled(msg.sender, planId);
    }

    function modifySubscription(uint256 _newPlanId)
        external
        onlyValidPlan(_newPlanId)
        returns (
            uint256 oldPlanId,
            uint256 payForNewPlan,
            uint256 refundForOldPlan
        )
    {
        // Sync the subscription
        syncSubscription(msg.sender);

        Subscription storage subscription = subscriptions[msg.sender];
        oldPlanId = subscription.planId;

        // If it's cancelled or expired, then create a new subscription rather than modify
        if (oldPlanId == 0) revert INACTIVE_SUBSCRIPTION();
        if (subscription.expiredAt <= block.timestamp)
            revert INSUFFICIENT_FUND();

        Plan memory oldPlan = plans[oldPlanId];
        Plan memory newPlan = plans[_newPlanId];
        uint256 paidForOldPlan = (oldPlan.amount *
            (subscription.expiredAt - block.timestamp)) / oldPlan.period;

        // Two plan's token is the same
        if (oldPlan.token == newPlan.token) {
            // Need to pay more (newPlan.amount - paidForOldPlan)
            if (newPlan.amount > paidForOldPlan) {
                unchecked {
                    payForNewPlan = newPlan.amount - paidForOldPlan;
                }
            }
            // Need to refund (paidForOldPlan - newPlan.amount)
            else if (newPlan.amount < paidForOldPlan) {
                unchecked {
                    refundForOldPlan = paidForOldPlan - newPlan.amount;
                }
            }
        }
        // Two plan's token is the different
        else {
            // Pay new plan
            payForNewPlan = newPlan.amount;

            // Refund old plan
            refundForOldPlan = paidForOldPlan;
        }

        // Pay for new plan
        if (payForNewPlan > 0) {
            if (balanceOf[msg.sender][newPlan.token] < payForNewPlan)
                revert INSUFFICIENT_FUND();

            unchecked {
                balanceOf[msg.sender][newPlan.token] -= payForNewPlan;
            }

            IERC20(newPlan.token).safeTransfer(treasury, payForNewPlan);
        }
        // Refund for old plan
        if (refundForOldPlan > 0) {
            unchecked {
                refundOf[msg.sender][oldPlan.token] += refundForOldPlan;
            }
        }

        // Set subscription
        subscription.planId = _newPlanId;
        subscription.expiredAt = uint48(block.timestamp) + newPlan.period;

        emit SubscriptionModified(
            msg.sender,
            oldPlanId,
            refundForOldPlan,
            _newPlanId,
            payForNewPlan,
            subscription.expiredAt
        );
    }

    function withdraw(address _token, uint256 _amount) external {
        syncSubscription(msg.sender);

        if (_token == address(0)) revert INVALID_ADDRESS();
        if (_amount == 0) revert INVALID_AMOUNT();
        if (balanceOf[msg.sender][_token] < _amount) revert INVALID_AMOUNT();

        unchecked {
            balanceOf[msg.sender][_token] -= _amount;
        }

        IERC20(_token).safeTransfer(msg.sender, _amount);

        emit PayerWithdraw(msg.sender, _token, _amount);
    }

    function withdrawAll(address _token) external returns (uint256 amount) {
        syncSubscription(msg.sender);

        if (_token == address(0)) revert INVALID_ADDRESS();

        amount = balanceOf[msg.sender][_token];

        if (amount > 0) {
            balanceOf[msg.sender][_token] = 0;
            IERC20(_token).safeTransfer(msg.sender, amount);

            emit PayerWithdraw(msg.sender, _token, amount);
        }
    }
}
