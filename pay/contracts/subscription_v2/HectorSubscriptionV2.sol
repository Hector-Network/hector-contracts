// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IERC20Metadata} from '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {OwnableUpgradeable} from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import {ReentrancyGuardUpgradeable} from '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';

import {IHectorSubscriptionV2Factory} from '../interfaces/IHectorSubscriptionV2Factory.sol';
import {IHectorSubscriptionV2} from '../interfaces/IHectorSubscriptionV2.sol';
import {IHectorCoupon} from '../interfaces/IHectorCoupon.sol';
import {IHectorRefund} from '../interfaces/IHectorRefund.sol';
import {IHectorDiscount} from '../interfaces/IHectorDiscount.sol';
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
    mapping(address => bool) public subscriptionByMod;

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
        uint48 lastPaidAt,
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
    event RefundedByMod(
        address indexed to,
        address indexed token,
        uint256 amount
    );
    event FundedByMod(address indexed token, uint256 amount);

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

    /* ======== INTERNAL FUNCTIONS ======== */

    function viewPriceInUSD(address token) internal view returns (uint256) {
        return
            IPriceOracleAggregator(factory.priceOracleAggregator())
                .viewPriceInUSD(token);
    }

    function getTokenAmount(
        uint256 price,
        address token
    ) internal view returns (uint256) {
        uint256 tokenPrice = viewPriceInUSD(token);

        return
            price.mulDiv(
                10 ** IERC20Metadata(token).decimals(),
                tokenPrice,
                Math.Rounding.Up
            );
    }

    function applyCoupon(
        address token,
        uint256 amount,
        bytes calldata couponInfo,
        bytes calldata signature
    ) internal returns (bool, uint256, uint256) {
        return
            IHectorCoupon(factory.couponService()).applyCoupon(
                IHectorCoupon.Pay({
                    product: product,
                    payer: msg.sender,
                    token: token,
                    amount: amount
                }),
                couponInfo,
                signature
            );
    }

    function getRefundAmount(
        uint256 planId,
        uint48 lastPaidAt,
        uint256 lastAmountPaid
    ) internal view returns (uint256) {
        return
            IHectorRefund(factory.refundService()).getRefundAmount(
                abi.encode(
                    keccak256(bytes(product)),
                    planId,
                    lastPaidAt,
                    lastAmountPaid
                )
            );
    }

    function getDiscountedPrice(
        uint256 planId
    ) internal view returns (uint256) {
        return
            IHectorDiscount(factory.discountService()).getDiscountedPrice(
                abi.encode(
                    keccak256(bytes(product)),
                    planId,
                    plans[planId].token,
                    plans[planId].price
                )
            );
    }

    function fund(address from, address token, uint256 amount) internal {
        if (amount == 0) return;

        if (subscriptionByMod[from]) {
            emit FundedByMod(token, amount);
        } else {
            IERC20(token).safeTransfer(treasury, amount);

            emit Funded(token, amount);
        }
    }

    function refund(address to, address token, uint256 amount) internal {
        if (amount == 0) return;

        if (subscriptionByMod[to]) {
            emit RefundedByMod(to, token, amount);
        } else {
            IERC20(token).safeTransfer(to, amount);

            emit Refunded(to, token, amount);
        }
    }

    /* ======== VIEW FUNCTIONS ======== */

    function allPlans() external view returns (Plan[] memory) {
        return plans;
    }

    function allPlansWithTokenPrice()
        external
        view
        returns (
            Plan[] memory,
            uint256[] memory,
            uint256[] memory,
            uint256[] memory
        )
    {
        uint256 length = plans.length;
        uint256[] memory planDiscountedPrices = new uint256[](length);
        uint256[] memory tokenPrices = new uint256[](length);
        uint256[] memory tokenAmounts = new uint256[](length);

        for (uint256 i = 1; i < length; i++) {
            Plan memory plan = plans[i];
            uint256 planDiscountedPrice = getDiscountedPrice(i);

            planDiscountedPrices[i] = planDiscountedPrice;
            tokenPrices[i] = viewPriceInUSD(plan.token);
            tokenAmounts[i] = getTokenAmount(planDiscountedPrice, plan.token);
        }

        return (plans, planDiscountedPrices, tokenPrices, tokenAmounts);
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

        // cancelled subscription
        if (planId == 0) {
            return (0, expiredAt, true, block.timestamp < expiredAt, expiredAt);
        }

        Plan memory plan = plans[planId];
        uint256 discountedPrice = getDiscountedPrice(planId);
        uint256 price = viewPriceInUSD(plan.token);

        dueDate =
            expiredAt +
            uint48(
                ((price * balanceOf[from][plan.token]) /
                    (discountedPrice *
                        10 ** IERC20Metadata(plan.token).decimals())) *
                    plan.period
            );
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

        Plan memory newPlan = plans[_newPlanId];
        uint256 newPlanDiscountedPrice = getDiscountedPrice(_newPlanId);

        uint256 refundPrice = getRefundAmount(
            oldPlanId,
            subscription.lastPaidAt,
            subscription.lastAmountPaidInUsd
        );

        // Pay for new plan
        uint256 payForNewPlan;
        if (refundPrice < newPlanDiscountedPrice) {
            payForNewPlan = getTokenAmount(
                newPlanDiscountedPrice - refundPrice,
                newPlan.token
            );
        }

        // Deposit more to pay for new plan
        if (balanceOf[msg.sender][newPlan.token] < payForNewPlan) {
            unchecked {
                amountToDeposit =
                    payForNewPlan -
                    balanceOf[msg.sender][newPlan.token];
            }
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
        uint256 planDiscountedPrice = getDiscountedPrice(_planId);
        uint256 amount = getTokenAmount(planDiscountedPrice, plan.token);

        // Deposit more to pay for new plan
        if (balanceOf[msg.sender][plan.token] < amount) {
            unchecked {
                amountToDeposit = amount - balanceOf[msg.sender][plan.token];
            }
        }
    }

    function toCreateSubscritpionWithCoupon(
        uint256 _planId,
        bytes calldata _couponInfo,
        bytes calldata _signature
    ) public onlyValidPlan(_planId) returns (uint256 amountToDeposit) {
        Subscription storage subscription = subscriptions[msg.sender];

        // check if no or expired subscription
        if (subscription.planId > 0) {
            syncSubscription(msg.sender);

            if (subscription.expiredAt > block.timestamp) return 0;
        }

        Plan memory plan = plans[_planId];
        uint256 planDiscountedPrice = getDiscountedPrice(_planId);

        // check if coupon is valid
        (, , uint256 newPrice) = applyCoupon(
            plan.token,
            planDiscountedPrice,
            _couponInfo,
            _signature
        );

        uint256 amount = getTokenAmount(newPrice, plan.token);

        // Deposit more to pay for new plan
        if (balanceOf[msg.sender][plan.token] < amount) {
            unchecked {
                amountToDeposit = amount - balanceOf[msg.sender][plan.token];
            }
        }
    }

    /* ======== USER FUNCTIONS ======== */

    function deposit(address _token, uint256 _amount) public nonReentrant {
        unchecked {
            balanceOf[msg.sender][_token] += _amount;
        }

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
        uint256 planDiscountedPrice = getDiscountedPrice(_planId);
        uint256 amount = getTokenAmount(planDiscountedPrice, plan.token);

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
        subscription.lastAmountPaidInUsd = planDiscountedPrice;
        subscription.lastAmountPaid = amount;

        // Set subscription by Mod
        subscriptionByMod[msg.sender] = false;

        emit SubscriptionCreated(
            msg.sender,
            _planId,
            planDiscountedPrice,
            amount,
            subscription.expiredAt
        );
    }

    function createSubscriptionWithCoupon(
        uint256 _planId,
        bytes calldata _couponInfo,
        bytes calldata _signature
    ) public onlyValidPlan(_planId) {
        Subscription storage subscription = subscriptions[msg.sender];

        // check if no or expired subscription
        if (subscription.planId > 0) {
            syncSubscription(msg.sender);

            if (subscription.expiredAt > block.timestamp)
                revert ACTIVE_SUBSCRIPTION();
        }

        Plan memory plan = plans[_planId];
        uint256 planDiscountedPrice = getDiscountedPrice(_planId);

        // check if coupon is valid
        (bool isValid, uint256 couponId, uint256 newPrice) = applyCoupon(
            plan.token,
            planDiscountedPrice,
            _couponInfo,
            _signature
        );
        if (!isValid) revert INVALID_COUPON();

        uint256 amount = getTokenAmount(newPrice, plan.token);

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

        // Set subscription by Mod
        subscriptionByMod[msg.sender] = false;

        emit SubscriptionCreatedWithCoupon(
            msg.sender,
            _planId,
            couponId,
            newPrice,
            amount,
            subscription.expiredAt
        );
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
        uint256 planDiscountedPrice = getDiscountedPrice(planId);
        uint256 amount = getTokenAmount(planDiscountedPrice, plan.token);

        uint256 count = (block.timestamp -
            subscription.expiredAt +
            plan.period) / plan.period;
        uint256 totalAmount = amount * count;
        uint256 balance = balanceOf[from][plan.token];

        // not active for now
        if (balance < totalAmount) {
            unchecked {
                count = balance / amount;
                totalAmount = amount * count;
            }
        }

        uint256 fundAmount = subscription.lastAmountPaid + totalAmount;
        subscription.lastAmountPaid = 0;
        subscription.lastAmountPaidInUsd = 0;

        // Set subscription
        if (count > 0) {
            unchecked {
                balanceOf[from][plan.token] -= totalAmount;
                subscription.expiredAt += uint48(plan.period * count);
                subscription.lastPaidAt = subscription.expiredAt - plan.period;
            }

            if (subscription.expiredAt > block.timestamp) {
                unchecked {
                    fundAmount -= amount;
                }
                subscription.lastAmountPaidInUsd = planDiscountedPrice;
                subscription.lastAmountPaid = amount;
            }
        }

        // fund to Treasury
        fund(from, plans[planId].token, fundAmount);

        // expired for a long time (deadline), then cancel it
        if (subscription.expiredAt + expireDeadline <= block.timestamp) {
            subscription.planId = 0;
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

    function syncSubscriptions(address[] memory froms) external {
        uint256 length = froms.length;
        for (uint256 i = 0; i < length; i++) {
            syncSubscription(froms[i]);
        }
    }

    function cancelSubscription() external {
        syncSubscription(msg.sender);

        Subscription storage subscription = subscriptions[msg.sender];
        uint256 planId = subscription.planId;

        // check if active subscription
        if (planId == 0) revert INACTIVE_SUBSCRIPTION();

        // refund
        uint256 refundAmount = getRefundAmount(
            planId,
            subscription.lastPaidAt,
            subscription.lastAmountPaid
        );
        refund(msg.sender, plans[planId].token, refundAmount);

        // fund to Treasury
        fund(
            msg.sender,
            plans[planId].token,
            subscription.lastAmountPaid - refundAmount
        );

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
        uint256 newPlanDiscountedPrice = getDiscountedPrice(_newPlanId);

        uint256 refundPrice = getRefundAmount(
            oldPlanId,
            subscription.lastPaidAt,
            subscription.lastAmountPaidInUsd
        );
        uint256 refundAmount = getRefundAmount(
            oldPlanId,
            subscription.lastPaidAt,
            subscription.lastAmountPaid
        );

        // Pay for new plan
        uint256 payForNewPlan;
        uint256 priceForNewPlan;
        if (refundPrice < newPlanDiscountedPrice) {
            unchecked {
                priceForNewPlan = newPlanDiscountedPrice - refundPrice;
            }
            refundAmount = 0;

            payForNewPlan = getTokenAmount(priceForNewPlan, newPlan.token);

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
        else {
            refundAmount =
                (refundAmount * (refundPrice - newPlanDiscountedPrice)) /
                refundPrice;
            refund(msg.sender, plans[oldPlanId].token, refundAmount);
        }

        // fund to Treasury
        fund(
            msg.sender,
            plans[oldPlanId].token,
            subscription.lastAmountPaid - refundAmount
        );

        // Set subscription
        subscription.planId = _newPlanId;
        subscription.expiredAt = uint48(block.timestamp) + newPlan.period;
        subscription.lastPaidAt = uint48(block.timestamp);
        subscription.lastAmountPaidInUsd = priceForNewPlan;
        subscription.lastAmountPaid = payForNewPlan;

        // Set subscription by Mod
        subscriptionByMod[msg.sender] = false;

        emit SubscriptionModified(
            msg.sender,
            oldPlanId,
            _newPlanId,
            priceForNewPlan,
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
        if (_amount > 0) {
            balanceOf[_to][_token] += _amount;
            emit PayerDeposit(_to, _token, _amount);
        }

        // Pay first plan
        Plan memory plan = plans[_planId];
        uint256 planDiscountedPrice = getDiscountedPrice(_planId);
        uint256 amount = getTokenAmount(planDiscountedPrice, plan.token);

        if (balanceOf[_to][plan.token] < amount) revert INSUFFICIENT_FUND();

        unchecked {
            balanceOf[_to][plan.token] -= amount;
        }

        // Set subscription
        subscription.planId = _planId;
        subscription.expiredAt = uint48(block.timestamp) + plan.period;
        subscription.lastPaidAt = uint48(block.timestamp);
        subscription.lastAmountPaidInUsd = planDiscountedPrice;
        subscription.lastAmountPaid = amount;

        // Set subscription by Mod
        subscriptionByMod[_to] = true;

        emit SubscriptionCreated(
            _to,
            _planId,
            planDiscountedPrice,
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
        if (_amount > 0) {
            balanceOf[_to][_token] += _amount;
            emit PayerDeposit(_to, _token, _amount);
        }

        Plan memory newPlan = plans[_newPlanId];
        uint256 newPlanDiscountedPrice = getDiscountedPrice(_newPlanId);

        uint256 refundPrice = getRefundAmount(
            oldPlanId,
            subscription.lastPaidAt,
            subscription.lastAmountPaidInUsd
        );
        uint256 refundAmount = getRefundAmount(
            oldPlanId,
            subscription.lastPaidAt,
            subscription.lastAmountPaid
        );

        // Pay for new plan
        uint256 payForNewPlan;
        uint256 priceForNewPlan;
        if (refundPrice < newPlanDiscountedPrice) {
            unchecked {
                priceForNewPlan = newPlanDiscountedPrice - refundPrice;
            }
            refundAmount = 0;

            payForNewPlan = getTokenAmount(priceForNewPlan, newPlan.token);

            if (balanceOf[_to][newPlan.token] < payForNewPlan)
                revert INSUFFICIENT_FUND();

            unchecked {
                balanceOf[_to][newPlan.token] -= payForNewPlan;
            }
        }
        // Refund for old plan
        else {
            refundAmount =
                (refundAmount * (refundPrice - newPlanDiscountedPrice)) /
                refundPrice;
            refund(_to, plans[oldPlanId].token, refundAmount);
        }

        // fund to Treasury
        fund(
            _to,
            plans[oldPlanId].token,
            subscription.lastAmountPaid - refundAmount
        );

        // Set subscription
        subscription.planId = _newPlanId;
        subscription.expiredAt = uint48(block.timestamp) + newPlan.period;
        subscription.lastPaidAt = uint48(block.timestamp);
        subscription.lastAmountPaidInUsd = priceForNewPlan;
        subscription.lastAmountPaid = payForNewPlan;

        // Set subscription by Mod
        subscriptionByMod[_to] = true;

        emit SubscriptionModified(
            _to,
            oldPlanId,
            _newPlanId,
            priceForNewPlan,
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
        uint256 refundAmount = getRefundAmount(
            planId,
            subscription.lastPaidAt,
            subscription.lastAmountPaid
        );
        refund(_to, plans[planId].token, refundAmount);

        // fund to Treasury
        fund(
            _to,
            plans[planId].token,
            subscription.lastAmountPaid - refundAmount
        );

        // Set subscription
        subscription.planId = 0;
        subscription.expiredAt = uint48(block.timestamp);
        subscription.lastAmountPaidInUsd = 0;
        subscription.lastAmountPaid = 0;

        emit SubscriptionCancelled(_to, planId);
    }
}
