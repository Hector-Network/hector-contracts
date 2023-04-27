// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {OwnableUpgradeable} from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import {ReentrancyGuardUpgradeable} from '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';

import {IHectorSubscriptionFactory} from '../interfaces/IHectorSubscriptionFactory.sol';
import {IHectorSubscription} from '../interfaces/IHectorSubscription.sol';
import {IHectorCoupon} from '../interfaces/IHectorCoupon.sol';

error INVALID_PARAM();
error INVALID_ADDRESS();
error INVALID_AMOUNT();
error INVALID_TIME();
error INVALID_PLAN();
error INSUFFICIENT_FUND();
error INACTIVE_SUBSCRIPTION();
error ACTIVE_SUBSCRIPTION();
error INVALID_MODERATOR();
error INVALID_COUPON();

contract HectorSubscription is
    IHectorSubscription,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    /* ======== STORAGE ======== */

    /// @notice subscription factory
    IHectorSubscriptionFactory factory;

    /// @notice product
    string public product;

    /// @notice treasury wallet
    address public treasury;

    /// @notice subscription plans configurable by admin
    /// @dev plans[0] is free-plan
    Plan[] public plans;

    /// @notice expire deadline to cancel subscription
    uint48 public expireDeadline;

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
        uint256 amount,
        bytes data
    );
    event SubscriptionCreated(
        address indexed from,
        uint256 indexed planId,
        uint48 expiredAt
    );
    event SubscriptionCreatedWithCoupon(
        address indexed from,
        uint256 indexed planId,
        uint256 indexed couponId,
        uint256 amount,
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
        factory = IHectorSubscriptionFactory(msg.sender);

        (product, treasury) = abi.decode(
            factory.parameter(),
            (string, address)
        );

        // free-plan
        plans.push(Plan({token: address(0), period: 0, amount: 0, data: ''}));

        moderators[factory.factoryOwner()] = true;

        expireDeadline = 30 days;

        _transferOwnership(factory.factoryOwner());
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

    modifier onlyHasCoupon() {
        if (factory.coupon() == address(0)) revert INVALID_COUPON();
        _;
    }

    /* ======== POLICY FUNCTIONS ======== */

    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert INVALID_ADDRESS();
        treasury = _treasury;
    }

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
            Plan memory _plan = _plans[i];

            if (_plan.token == address(0)) revert INVALID_ADDRESS();
            if (_plan.period == 0) revert INVALID_TIME();
            if (_plan.amount == 0) revert INVALID_AMOUNT();

            plans.push(_plan);

            emit PlanUpdated(
                plans.length - 1,
                _plan.token,
                _plan.period,
                _plan.amount,
                _plan.data
            );
        }
    }

    function updatePlan(uint256 _planId, Plan calldata _plan) external onlyMod {
        if (_planId == 0) {
            if (_plan.token != address(0)) revert INVALID_ADDRESS();
            if (_plan.period != 0) revert INVALID_TIME();
            if (_plan.amount != 0) revert INVALID_AMOUNT();
        } else {
            if (_plan.token == address(0)) revert INVALID_ADDRESS();
            if (_plan.period == 0) revert INVALID_TIME();
            if (_plan.amount == 0) revert INVALID_AMOUNT();
        }

        plans[_planId] = _plan;

        emit PlanUpdated(
            _planId,
            _plan.token,
            _plan.period,
            _plan.amount,
            _plan.data
        );
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

    function getPlan(uint256 _planId) external view returns (Plan memory) {
        return plans[_planId];
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

        // cancelled subscription
        if (planId == 0) {
            return (0, expiredAt, true, block.timestamp < expiredAt, expiredAt);
        }

        Plan memory plan = plans[planId];
        dueDate =
            expiredAt +
            uint48((balanceOf[from][plan.token] / plan.amount) * plan.period);
        isActiveForNow = block.timestamp < dueDate;

        // expired for a long time (deadline), then it's cancelled
        if (dueDate + expireDeadline <= block.timestamp) {
            planId = 0;
        }
    }

    function toModifySubscription(
        uint256 _newPlanId
    ) public onlyValidPlan(_newPlanId) returns (uint256 amountToDeposit) {
        // Sync the subscription
        syncSubscription(msg.sender);

        Subscription storage subscription = subscriptions[msg.sender];
        uint256 oldPlanId = subscription.planId;

        // If it's cancelled or expired, then create a new subscription rather than modify
        if (oldPlanId == 0) return 0;
        if (subscription.expiredAt <= block.timestamp) return 0;

        Plan memory oldPlan = plans[oldPlanId];
        Plan memory newPlan = plans[_newPlanId];
        uint256 paidForOldPlan = (oldPlan.amount *
            (subscription.expiredAt - block.timestamp)) / oldPlan.period;
        uint256 payForNewPlan;

        // Two plan's token is the same
        if (oldPlan.token == newPlan.token) {
            // Need to pay more (newPlan.amount - paidForOldPlan)
            if (newPlan.amount > paidForOldPlan) {
                unchecked {
                    payForNewPlan = newPlan.amount - paidForOldPlan;
                }
            }
        }
        // Two plan's token is the different
        else {
            payForNewPlan = newPlan.amount;
        }

        // Deposit more to pay for new plan
        if (balanceOf[msg.sender][newPlan.token] < payForNewPlan) {
            amountToDeposit =
                payForNewPlan -
                balanceOf[msg.sender][newPlan.token];
        }
    }

    function toCreateSubscription(
        uint256 _planId
    ) public onlyValidPlan(_planId) returns (uint256 amountToDeposit) {
        Subscription storage subscription = subscriptions[msg.sender];

        // check if no or expired subscription
        if (subscription.planId > 0) {
            syncSubscription(msg.sender);

            if (subscription.expiredAt > block.timestamp) return 0;
        }

        Plan memory plan = plans[_planId];

        // Deposit more to pay for new plan
        if (balanceOf[msg.sender][plan.token] < plan.amount) {
            amountToDeposit = plan.amount - balanceOf[msg.sender][plan.token];
        }
    }

    function toCreateSubscritpionWithCoupon(
        uint256 _planId,
        bytes calldata couponInfo,
        bytes calldata signature
    )
        public
        onlyValidPlan(_planId)
        onlyHasCoupon
        returns (uint256 amountToDeposit)
    {
        Subscription storage subscription = subscriptions[msg.sender];

        // check if no or expired subscription
        if (subscription.planId > 0) {
            syncSubscription(msg.sender);

            if (subscription.expiredAt > block.timestamp) return 0;
        }

        Plan memory plan = plans[_planId];

        // check if coupon is valid
        (, , uint256 newAmount) = IHectorCoupon(factory.coupon()).applyCoupon(
            IHectorCoupon.Pay({
                product: product,
                payer: msg.sender,
                token: plan.token,
                amount: plan.amount
            }),
            couponInfo,
            signature
        );

        // Deposit more to pay for new plan
        if (balanceOf[msg.sender][plan.token] < newAmount) {
            amountToDeposit = newAmount - balanceOf[msg.sender][plan.token];
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
        if (balanceOf[msg.sender][plan.token] < plan.amount) {
            deposit(
                plan.token,
                plan.amount - balanceOf[msg.sender][plan.token]
            );
        }

        unchecked {
            balanceOf[msg.sender][plan.token] -= plan.amount;
        }

        // Set subscription
        subscription.planId = _planId;
        subscription.expiredAt = uint48(block.timestamp) + plan.period;

        IERC20(plan.token).safeTransfer(treasury, plan.amount);

        emit SubscriptionCreated(msg.sender, _planId, subscription.expiredAt);
    }

    function createSubscriptionWithCoupon(
        uint256 _planId,
        bytes calldata couponInfo,
        bytes calldata signature
    ) public onlyValidPlan(_planId) onlyHasCoupon {
        Subscription storage subscription = subscriptions[msg.sender];

        // check if no or expired subscription
        if (subscription.planId > 0) {
            syncSubscription(msg.sender);

            if (subscription.expiredAt > block.timestamp)
                revert ACTIVE_SUBSCRIPTION();
        }

        Plan memory plan = plans[_planId];

        // check if coupon is valid
        (bool isValid, uint256 couponId, uint256 newAmount) = IHectorCoupon(
            factory.coupon()
        ).applyCoupon(
                IHectorCoupon.Pay({
                    product: product,
                    payer: msg.sender,
                    token: plan.token,
                    amount: plan.amount
                }),
                couponInfo,
                signature
            );
        if (!isValid) revert INVALID_COUPON();

        // Pay first plan
        if (balanceOf[msg.sender][plan.token] < newAmount) {
            deposit(plan.token, newAmount - balanceOf[msg.sender][plan.token]);
        }

        unchecked {
            balanceOf[msg.sender][plan.token] -= newAmount;
        }

        // Set subscription
        subscription.planId = _planId;
        subscription.expiredAt = uint48(block.timestamp) + plan.period;

        IERC20(plan.token).safeTransfer(treasury, newAmount);

        emit SubscriptionCreatedWithCoupon(
            msg.sender,
            _planId,
            couponId,
            newAmount,
            subscription.expiredAt
        );
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

            IERC20(plan.token).safeTransfer(treasury, amount);
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

    function modifySubscription(
        uint256 _newPlanId
    )
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
        if (oldPlanId == 0 || subscription.expiredAt <= block.timestamp)
            revert INACTIVE_SUBSCRIPTION();

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
            if (balanceOf[msg.sender][newPlan.token] < payForNewPlan) {
                deposit(
                    newPlan.token,
                    payForNewPlan - balanceOf[msg.sender][newPlan.token]
                );
            }

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

    /* ======== CROSS CHAIN FUNCTIONS ======== */

    function createSubscriptionByMod(
        address _to,
        uint256 _planId,
        address _token,
        uint256 _amount
    ) external onlyValidPlan(_planId) onlyMod {
        Subscription storage subscription = subscriptions[_to];

        // check if no or expired subscription
        if (subscription.planId > 0) {
            syncSubscription(_to);

            if (subscription.expiredAt > block.timestamp)
                revert ACTIVE_SUBSCRIPTION();
        }

        // deposit token
        balanceOf[_to][_token] += _amount;
        emit PayerDeposit(_to, _token, _amount);

        // Pay first plan
        Plan memory plan = plans[_planId];

        if (balanceOf[_to][plan.token] < plan.amount)
            revert INSUFFICIENT_FUND();

        unchecked {
            balanceOf[_to][plan.token] -= plan.amount;
        }

        // Set subscription
        subscription.planId = _planId;
        subscription.expiredAt = uint48(block.timestamp) + plan.period;

        emit SubscriptionCreated(_to, _planId, subscription.expiredAt);
    }

    function modifySubscriptionByMod(
        address _to,
        uint256 _newPlanId,
        address _token,
        uint256 _amount
    )
        external
        onlyValidPlan(_newPlanId)
        onlyMod
        returns (
            uint256 oldPlanId,
            uint256 payForNewPlan,
            uint256 refundForOldPlan
        )
    {
        // Sync the subscription
        syncSubscription(_to);

        Subscription storage subscription = subscriptions[_to];
        oldPlanId = subscription.planId;

        // If it's cancelled or expired, then create a new subscription rather than modify
        if (oldPlanId == 0 || subscription.expiredAt <= block.timestamp)
            revert INACTIVE_SUBSCRIPTION();

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

        // deposit token
        balanceOf[_to][_token] += _amount;
        emit PayerDeposit(_to, _token, _amount);

        // Pay for new plan
        if (payForNewPlan > 0) {
            if (balanceOf[_to][newPlan.token] < payForNewPlan)
                revert INSUFFICIENT_FUND();

            unchecked {
                balanceOf[_to][newPlan.token] -= payForNewPlan;
            }
        }
        // Refund for old plan
        if (refundForOldPlan > 0) {
            unchecked {
                refundOf[_to][oldPlan.token] += refundForOldPlan;
            }
        }

        // Set subscription
        subscription.planId = _newPlanId;
        subscription.expiredAt = uint48(block.timestamp) + newPlan.period;

        emit SubscriptionModified(
            _to,
            oldPlanId,
            refundForOldPlan,
            _newPlanId,
            payForNewPlan,
            subscription.expiredAt
        );
    }

    function cancelSubscriptionByMod(address _to) external onlyMod {
        syncSubscription(_to);

        uint256 planId = subscriptions[_to].planId;

        // check if active subscription
        if (planId == 0) revert INACTIVE_SUBSCRIPTION();

        subscriptions[_to].planId = 0;

        emit SubscriptionCancelled(_to, planId);
    }
}
