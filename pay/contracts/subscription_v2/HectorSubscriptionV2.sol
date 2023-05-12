// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {OwnableUpgradeable} from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import {ReentrancyGuardUpgradeable} from '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';

import {IHectorSubscriptionV2Factory} from '../interfaces/IHectorSubscriptionV2Factory.sol';
import {IHectorSubscriptionV2} from '../interfaces/IHectorSubscriptionV2.sol';
import {IHectorCoupon} from '../interfaces/IHectorCoupon.sol';
import {IHectorRefund} from '../interfaces/IHectorRefund.sol';
import {IPriceOracleAggregator} from '../interfaces/IPriceOracleAggregator.sol';

import {Math} from '../libraries/Math.sol';

error INVALID_PARAM();
error INVALID_ADDRESS();
error INVALID_PRICE();
error INVALID_AMOUNT();
error INVALID_TIME();
error INVALID_PLAN();
error INSUFFICIENT_FUND();
error INACTIVE_SUBSCRIPTION();
error ACTIVE_SUBSCRIPTION();
error INVALID_MODERATOR();
error INVALID_COUPON();

contract HectorSubscriptionV2 is
    IHectorSubscriptionV2,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;
    using Math for uint256;

    /* ======== STORAGE ======== */

    /// @notice subscription factory
    IHectorSubscriptionV2Factory factory;

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

    /* ======== EVENTS ======== */

    event PlanUpdated(
        uint256 indexed planId,
        address token,
        uint48 period,
        uint256 price,
        bytes data
    );
    event SubscriptionCreated(
        address indexed from,
        uint256 indexed planId,
        uint256 lastAmountPaidInUsd,
        uint256 lastAmountPaid,
        uint48 expiredAt
    );
    event SubscriptionCreatedWithCoupon(
        address indexed from,
        uint256 indexed planId,
        uint256 indexed couponId,
        uint256 lastAmountPaidInUsd,
        uint256 lastAmountPaid,
        uint48 expiredAt
    );
    event SubscriptionSynced(
        address indexed from,
        uint256 indexed planId,
        uint256 lastPaidAt,
        uint256 lastAmountPaidInUsd,
        uint256 lastAmountPaid,
        uint256 amount,
        uint48 expiredAt
    );
    event SubscriptionCancelled(address indexed from, uint256 indexed planId);
    event SubscriptionModified(
        address indexed from,
        uint256 indexed oldPlanId,
        uint256 indexed newPlanId,
        uint256 lastAmountPaidInUsd,
        uint256 lastAmountPaid,
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
    event Funded(address indexed token, uint256 amount);

    /* ======== INITIALIZATION ======== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() external initializer {
        factory = IHectorSubscriptionV2Factory(msg.sender);

        (product, treasury) = abi.decode(
            factory.parameter(),
            (string, address)
        );

        // free-plan
        plans.push(Plan({token: address(0), period: 0, price: 0, data: ''}));
        emit PlanUpdated(0, address(0), 0, 0, '');

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
        if (factory.couponService() == address(0)) revert INVALID_COUPON();
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
            if (_plan.price == 0) revert INVALID_PRICE();

            plans.push(_plan);

            emit PlanUpdated(
                plans.length - 1,
                _plan.token,
                _plan.period,
                _plan.price,
                _plan.data
            );
        }
    }

    function updatePlan(
        uint256[] calldata _planIds,
        Plan[] calldata _plans
    ) external onlyMod {
        uint256 length = _planIds.length;
        if (length != _plans.length) revert INVALID_PARAM();

        for (uint256 i = 0; i < length; i++) {
            uint256 _planId = _planIds[i];
            Plan memory _plan = _plans[i];

            if (_planId == 0) {
                if (_plan.token != address(0)) revert INVALID_ADDRESS();
                if (_plan.period != 0) revert INVALID_TIME();
                if (_plan.price != 0) revert INVALID_PRICE();
            } else {
                if (_plan.token == address(0)) revert INVALID_ADDRESS();
                if (_plan.period == 0) revert INVALID_TIME();
                if (_plan.price == 0) revert INVALID_PRICE();
            }

            plans[_planId] = _plan;

            emit PlanUpdated(
                _planId,
                _plan.token,
                _plan.period,
                _plan.price,
                _plan.data
            );
        }
    }

    function updateExpireDeadline(uint48 _expireDeadline) external onlyMod {
        if (_expireDeadline == 0) revert INVALID_TIME();

        expireDeadline = _expireDeadline;
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
        uint256 price = IPriceOracleAggregator(factory.priceOracleAggregator())
            .viewPriceInUSD(plan.token);

        dueDate =
            expiredAt +
            uint48(
                ((price * balanceOf[from][plan.token]) / plan.price) *
                    plan.period
            );
        isActiveForNow = block.timestamp < dueDate;

        // expired for a long time (deadline), then it's cancelled
        if (dueDate + expireDeadline <= block.timestamp) {
            planId = 0;
        }
    }

    function viewPriceInUSD(address _token) public view returns (uint256) {
        return
            IPriceOracleAggregator(factory.priceOracleAggregator())
                .viewPriceInUSD(_token);
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

        Plan memory newPlan = plans[_newPlanId];

        uint256 refundPrice = IHectorRefund(factory.refundService())
            .getRefundAmount(
                abi.encode(
                    oldPlanId,
                    subscription.lastPaidAt,
                    subscription.lastAmountPaidInUsd
                )
            );

        // Pay for new plan
        uint256 payForNewPlan;
        if (refundPrice < newPlan.price) {
            uint256 price = IPriceOracleAggregator(
                factory.priceOracleAggregator()
            ).viewPriceInUSD(newPlan.token);
            payForNewPlan = (newPlan.price - refundPrice).ceilDiv(price);
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
        uint256 price = IPriceOracleAggregator(factory.priceOracleAggregator())
            .viewPriceInUSD(plan.token);
        uint256 amount = plan.price.ceilDiv(price);

        // Deposit more to pay for new plan
        if (balanceOf[msg.sender][plan.token] < amount) {
            amountToDeposit = amount - balanceOf[msg.sender][plan.token];
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
        (, , uint256 newPrice) = IHectorCoupon(factory.couponService())
            .applyCoupon(
                IHectorCoupon.Pay({
                    product: product,
                    payer: msg.sender,
                    token: plan.token,
                    amount: plan.price
                }),
                couponInfo,
                signature
            );

        uint256 price = IPriceOracleAggregator(factory.priceOracleAggregator())
            .viewPriceInUSD(plan.token);
        uint256 amount = newPrice.ceilDiv(price);

        // Deposit more to pay for new plan
        if (balanceOf[msg.sender][plan.token] < amount) {
            amountToDeposit = amount - balanceOf[msg.sender][plan.token];
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
        uint256 price = IPriceOracleAggregator(factory.priceOracleAggregator())
            .viewPriceInUSD(plan.token);
        uint256 amount = plan.price.ceilDiv(price);

        // Pay first plan
        if (balanceOf[msg.sender][plan.token] < amount) {
            deposit(plan.token, amount - balanceOf[msg.sender][plan.token]);
        }

        unchecked {
            balanceOf[msg.sender][plan.token] -= amount;
        }

        // Set subscription
        subscription.planId = _planId;
        subscription.expiredAt = uint48(block.timestamp) + plan.period;
        subscription.lastPaidAt = uint48(block.timestamp);
        subscription.lastAmountPaidInUsd = plan.price;
        subscription.lastAmountPaid = amount;

        emit SubscriptionCreated(
            msg.sender,
            _planId,
            plan.price,
            amount,
            subscription.expiredAt
        );
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
        (bool isValid, uint256 couponId, uint256 newPrice) = IHectorCoupon(
            factory.couponService()
        ).applyCoupon(
                IHectorCoupon.Pay({
                    product: product,
                    payer: msg.sender,
                    token: plan.token,
                    amount: plan.price
                }),
                couponInfo,
                signature
            );
        if (!isValid) revert INVALID_COUPON();

        uint256 price = IPriceOracleAggregator(factory.priceOracleAggregator())
            .viewPriceInUSD(plan.token);
        uint256 amount = newPrice.ceilDiv(price);

        // Pay first plan
        if (balanceOf[msg.sender][plan.token] < amount) {
            deposit(plan.token, amount - balanceOf[msg.sender][plan.token]);
        }

        unchecked {
            balanceOf[msg.sender][plan.token] -= amount;
        }

        // Set subscription
        subscription.planId = _planId;
        subscription.expiredAt = uint48(block.timestamp) + plan.period;
        subscription.lastPaidAt = uint48(block.timestamp);
        subscription.lastAmountPaidInUsd = newPrice;
        subscription.lastAmountPaid = amount;

        emit SubscriptionCreatedWithCoupon(
            msg.sender,
            _planId,
            couponId,
            newPrice,
            amount,
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

        // fund to Treasury
        uint256 fundAmount = subscription.lastAmountPaid;
        if (fundAmount > 0) {
            subscription.lastAmountPaid = 0;

            address token = plans[planId].token;

            IERC20(token).safeTransfer(treasury, fundAmount);

            emit Funded(token, fundAmount);
        }

        // after expiration
        Plan memory plan = plans[planId];
        uint256 price = IPriceOracleAggregator(factory.priceOracleAggregator())
            .viewPriceInUSD(plan.token);
        uint256 amount = plan.price.ceilDiv(price);

        uint256 count = (block.timestamp -
            subscription.expiredAt +
            plan.period) / plan.period;
        uint256 totalAmount = amount * count;
        uint256 balance = balanceOf[from][plan.token];

        // not active for now
        if (balance < totalAmount) {
            count = balance / amount;
            totalAmount = amount * count;
        }

        if (count > 0) {
            unchecked {
                balanceOf[from][plan.token] -= totalAmount;
                subscription.expiredAt += uint48(plan.period * count);
                subscription.lastPaidAt = subscription.expiredAt - plan.period;
                subscription.lastAmountPaidInUsd = plan.price;
                subscription.lastAmountPaid = amount;
            }
        }

        // expired for a long time (deadline), then cancel it
        if (subscription.expiredAt + expireDeadline <= block.timestamp) {
            subscription.planId = 0;
            subscription.lastAmountPaidInUsd = 0;
            subscription.lastAmountPaid = 0;
        }

        emit SubscriptionSynced(
            from,
            subscription.planId,
            subscription.lastPaidAt,
            subscription.lastAmountPaidInUsd,
            subscription.lastAmountPaid,
            totalAmount,
            subscription.expiredAt
        );
    }

    function cancelSubscription() external {
        syncSubscription(msg.sender);

        Subscription storage subscription = subscriptions[msg.sender];
        uint256 planId = subscription.planId;

        // check if active subscription
        if (planId == 0) revert INACTIVE_SUBSCRIPTION();

        // refund
        uint256 refundAmount = IHectorRefund(factory.refundService())
            .getRefundAmount(
                abi.encode(
                    planId,
                    subscription.lastPaidAt,
                    subscription.lastAmountPaid
                )
            );
        if (refundAmount > 0) {
            address token = plans[planId].token;

            IERC20(token).safeTransfer(msg.sender, refundAmount);

            emit Refunded(msg.sender, token, refundAmount);
        }

        // fund to Treasury
        uint256 fundAmount = subscription.lastAmountPaid - refundAmount;
        if (fundAmount > 0) {
            address token = plans[planId].token;

            IERC20(token).safeTransfer(treasury, fundAmount);

            emit Funded(token, fundAmount);
        }

        // Set subscription
        subscription.planId = 0;
        subscription.expiredAt = uint48(block.timestamp);
        subscription.lastAmountPaidInUsd = 0;
        subscription.lastAmountPaid = 0;

        emit SubscriptionCancelled(msg.sender, planId);
    }

    function modifySubscription(
        uint256 _newPlanId
    ) external onlyValidPlan(_newPlanId) {
        // Sync the subscription
        syncSubscription(msg.sender);

        Subscription storage subscription = subscriptions[msg.sender];
        uint256 oldPlanId = subscription.planId;

        // If it's cancelled or expired, then create a new subscription rather than modify
        if (oldPlanId == 0 || subscription.expiredAt <= block.timestamp)
            revert INACTIVE_SUBSCRIPTION();

        Plan memory newPlan = plans[_newPlanId];

        uint256 refundPrice = IHectorRefund(factory.refundService())
            .getRefundAmount(
                abi.encode(
                    oldPlanId,
                    subscription.lastPaidAt,
                    subscription.lastAmountPaidInUsd
                )
            );
        uint256 refundAmount = IHectorRefund(factory.refundService())
            .getRefundAmount(
                abi.encode(
                    oldPlanId,
                    subscription.lastPaidAt,
                    subscription.lastAmountPaid
                )
            );

        // Pay for new plan
        uint256 payForNewPlan;
        if (refundPrice < newPlan.price) {
            uint256 price = IPriceOracleAggregator(
                factory.priceOracleAggregator()
            ).viewPriceInUSD(newPlan.token);
            payForNewPlan = (newPlan.price - refundPrice).ceilDiv(price);

            if (balanceOf[msg.sender][newPlan.token] < payForNewPlan) {
                deposit(
                    newPlan.token,
                    payForNewPlan - balanceOf[msg.sender][newPlan.token]
                );
            }

            unchecked {
                balanceOf[msg.sender][newPlan.token] -= payForNewPlan;
            }
        }
        // Refund for old plan
        else if (refundPrice > newPlan.price) {
            uint256 refundForOldPlan = (refundAmount *
                (refundPrice - newPlan.price)) / refundPrice;
            if (refundForOldPlan > 0) {
                address token = plans[oldPlanId].token;

                IERC20(token).safeTransfer(msg.sender, refundForOldPlan);

                emit Refunded(msg.sender, token, refundForOldPlan);
            }
        }

        // fund to Treasury
        uint256 fundAmount = subscription.lastAmountPaid - refundAmount;
        if (fundAmount > 0) {
            address token = plans[oldPlanId].token;

            IERC20(token).safeTransfer(treasury, fundAmount);

            emit Funded(token, fundAmount);
        }

        // Set subscription
        subscription.planId = _newPlanId;
        subscription.expiredAt = uint48(block.timestamp) + newPlan.period;
        subscription.lastPaidAt = uint48(block.timestamp);
        subscription.lastAmountPaidInUsd = newPlan.price;
        subscription.lastAmountPaid = payForNewPlan;

        emit SubscriptionModified(
            msg.sender,
            oldPlanId,
            _newPlanId,
            newPlan.price,
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
        uint256 price = IPriceOracleAggregator(factory.priceOracleAggregator())
            .viewPriceInUSD(plan.token);
        uint256 amount = plan.price.ceilDiv(price);

        if (balanceOf[_to][plan.token] < amount) revert INSUFFICIENT_FUND();

        unchecked {
            balanceOf[_to][plan.token] -= amount;
        }

        // Set subscription
        subscription.planId = _planId;
        subscription.expiredAt = uint48(block.timestamp) + plan.period;
        subscription.lastPaidAt = uint48(block.timestamp);
        subscription.lastAmountPaidInUsd = plan.price;
        subscription.lastAmountPaid = amount;

        emit SubscriptionCreated(
            _to,
            _planId,
            plan.price,
            amount,
            subscription.expiredAt
        );
    }

    function modifySubscriptionByMod(
        address _to,
        uint256 _newPlanId,
        address _token,
        uint256 _amount
    ) external onlyValidPlan(_newPlanId) onlyMod {
        // Sync the subscription
        syncSubscription(_to);

        Subscription storage subscription = subscriptions[_to];
        uint256 oldPlanId = subscription.planId;

        // If it's cancelled or expired, then create a new subscription rather than modify
        if (oldPlanId == 0 || subscription.expiredAt <= block.timestamp)
            revert INACTIVE_SUBSCRIPTION();

        // deposit token
        balanceOf[_to][_token] += _amount;
        emit PayerDeposit(_to, _token, _amount);

        Plan memory newPlan = plans[_newPlanId];

        uint256 refundPrice = IHectorRefund(factory.refundService())
            .getRefundAmount(
                abi.encode(
                    oldPlanId,
                    subscription.lastPaidAt,
                    subscription.lastAmountPaidInUsd
                )
            );
        uint256 refundAmount = IHectorRefund(factory.refundService())
            .getRefundAmount(
                abi.encode(
                    oldPlanId,
                    subscription.lastPaidAt,
                    subscription.lastAmountPaid
                )
            );

        // Pay for new plan
        uint256 payForNewPlan;
        if (refundPrice < newPlan.price) {
            uint256 price = IPriceOracleAggregator(
                factory.priceOracleAggregator()
            ).viewPriceInUSD(newPlan.token);
            payForNewPlan = (newPlan.price - refundPrice).ceilDiv(price);

            if (balanceOf[_to][newPlan.token] < payForNewPlan)
                revert INSUFFICIENT_FUND();

            unchecked {
                balanceOf[_to][newPlan.token] -= payForNewPlan;
            }
        }
        // Refund for old plan
        else if (refundPrice > newPlan.price) {
            uint256 refundForOldPlan = (refundAmount *
                (refundPrice - newPlan.price)) / refundPrice;
            if (refundForOldPlan > 0) {
                address token = plans[oldPlanId].token;

                emit Refunded(_to, token, refundForOldPlan);
            }
        }

        // fund to Treasury
        uint256 fundAmount = subscription.lastAmountPaid - refundAmount;
        if (fundAmount > 0) {
            address token = plans[oldPlanId].token;

            emit Funded(token, fundAmount);
        }

        // Set subscription
        subscription.planId = _newPlanId;
        subscription.expiredAt = uint48(block.timestamp) + newPlan.period;
        subscription.lastPaidAt = uint48(block.timestamp);
        subscription.lastAmountPaidInUsd = newPlan.price;
        subscription.lastAmountPaid = payForNewPlan;

        emit SubscriptionModified(
            _to,
            oldPlanId,
            _newPlanId,
            newPlan.price,
            payForNewPlan,
            subscription.expiredAt
        );
    }

    function cancelSubscriptionByMod(address _to) external onlyMod {
        syncSubscription(_to);

        Subscription storage subscription = subscriptions[_to];
        uint256 planId = subscription.planId;

        // check if active subscription
        if (planId == 0) revert INACTIVE_SUBSCRIPTION();

        // refund
        uint256 refundAmount = IHectorRefund(factory.refundService())
            .getRefundAmount(
                abi.encode(
                    planId,
                    subscription.lastPaidAt,
                    subscription.lastAmountPaid
                )
            );
        if (refundAmount > 0) {
            address token = plans[planId].token;

            emit Refunded(msg.sender, token, refundAmount);
        }

        // fund to Treasury
        uint256 fundAmount = subscription.lastAmountPaid - refundAmount;
        if (fundAmount > 0) {
            address token = plans[planId].token;

            emit Funded(token, fundAmount);
        }

        // Set subscription
        subscription.planId = 0;
        subscription.expiredAt = uint48(block.timestamp);
        subscription.lastAmountPaidInUsd = 0;
        subscription.lastAmountPaid = 0;

        emit SubscriptionCancelled(_to, planId);
    }
}
