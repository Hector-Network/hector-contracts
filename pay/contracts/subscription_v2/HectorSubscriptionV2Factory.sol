// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.17;

import {OwnableUpgradeable} from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import {TransparentUpgradeableProxy} from '@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol';

import {IHectorSubscriptionV2Factory} from '../interfaces/IHectorSubscriptionV2Factory.sol';

interface ISubscription {
    function syncSubscriptions(address[] memory froms) external;
}

error INVALID_PRODUCT();
error INVALID_ADDRESS();

contract HectorSubscriptionV2Factory is
    IHectorSubscriptionV2Factory,
    OwnableUpgradeable
{
    /* ======== STORAGE ======== */

    struct Subscription {
        string product;
        address subscription;
    }

    address public hectorSubscriptionLogic;
    address public upgradeableAdmin;

    address public couponService;
    address public refundService;
    address public discountService;
    address public priceOracleAggregator;

    bytes public parameter;
    Subscription[] public getHectorSubscriptionByIndex;
    mapping(bytes32 => address) public getHectorSubscriptionContractByName;

    /* ======== EVENTS ======== */

    event HectorSubscriptionCreated(string product, address hectorSubscription);

    /* ======== INITIALIZATION ======== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _hectorSubscriptionLogic,
        address _upgradeableAdmin,
        address _couponService,
        address _refundService,
        address _discountService,
        address _priceOracleAggregator
    ) external initializer {
        if (
            _hectorSubscriptionLogic == address(0) ||
            _upgradeableAdmin == address(0) ||
            _couponService == address(0) ||
            _refundService == address(0) ||
            _discountService == address(0) ||
            _priceOracleAggregator == address(0)
        ) revert INVALID_ADDRESS();

        hectorSubscriptionLogic = _hectorSubscriptionLogic;
        upgradeableAdmin = _upgradeableAdmin;
        couponService = _couponService;
        refundService = _refundService;
        discountService = _discountService;
        priceOracleAggregator = _priceOracleAggregator;

        __Ownable_init();
    }

    /* ======== POLICY FUNCTIONS ======== */

    function setHectorSubscriptionLogic(
        address _hectorSubscriptionLogic
    ) external onlyOwner {
        if (_hectorSubscriptionLogic == address(0)) revert INVALID_ADDRESS();
        hectorSubscriptionLogic = _hectorSubscriptionLogic;
    }

    function setUpgradeableAdmin(address _upgradeableAdmin) external onlyOwner {
        if (_upgradeableAdmin == address(0)) revert INVALID_ADDRESS();
        upgradeableAdmin = _upgradeableAdmin;
    }

    function setCoupon(address _couponService) external onlyOwner {
        if (_couponService == address(0)) revert INVALID_ADDRESS();
        couponService = _couponService;
    }

    function setRefund(address _refundService) external onlyOwner {
        if (_refundService == address(0)) revert INVALID_ADDRESS();
        refundService = _refundService;
    }

    function setDiscount(address _discountService) external onlyOwner {
        if (_discountService == address(0)) revert INVALID_ADDRESS();
        discountService = _discountService;
    }

    function setPriceOracleAggregator(
        address _priceOracleAggregator
    ) external onlyOwner {
        if (_priceOracleAggregator == address(0)) revert INVALID_ADDRESS();
        priceOracleAggregator = _priceOracleAggregator;
    }

    function createHectorSubscriptionContract(
        string calldata _product,
        address _treasury
    ) external onlyOwner returns (address hectorSubscriptionContract) {
        bytes memory product = bytes(_product);
        if (product.length == 0) revert INVALID_PRODUCT();
        if (_treasury == address(0)) revert INVALID_ADDRESS();

        // set the parameter storage slot so the contract can query it
        parameter = abi.encode(product, _treasury);
        // use CREATE2 so we can get a deterministic address based on the product
        hectorSubscriptionContract = address(
            new TransparentUpgradeableProxy{salt: keccak256(product)}(
                hectorSubscriptionLogic,
                upgradeableAdmin,
                abi.encodeWithSignature('initialize()')
            )
        );
        // CREATE2 can return address(0), add a check to verify this isn't the case
        // See: https://eips.ethereum.org/EIPS/eip-1014
        require(hectorSubscriptionContract != address(0));

        // Append the new contract address to the array of deployed contracts
        getHectorSubscriptionByIndex.push(
            Subscription({
                product: _product,
                subscription: hectorSubscriptionContract
            })
        );

        // Append the new contract address to the mapping of deployed contracts
        getHectorSubscriptionContractByName[
            keccak256(product)
        ] = hectorSubscriptionContract;

        emit HectorSubscriptionCreated(_product, hectorSubscriptionContract);
    }

    /* ======== VIEW FUNCTIONS ======== */

    function factoryOwner() external view returns (address) {
        return owner();
    }

    function isDeployedHectorSubscriptionContractByProduct(
        string calldata _product
    ) external view returns (bool isDeployed) {
        isDeployed =
            getHectorSubscriptionContractByName[keccak256(bytes(_product))] !=
            address(0);
    }

    /* ======== PUBLIC FUNCTIONS ======== */

    function syncSubscriptions(
        address[] memory subscriptionContracts,
        address[][] memory froms
    ) external {
        uint256 length = subscriptionContracts.length;

        if (length != froms.length) revert INVALID_ADDRESS();

        for (uint256 i = 0; i < length; i++) {
            ISubscription(subscriptionContracts[i]).syncSubscriptions(froms[i]);
        }
    }
}
