// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.17;

import {OwnableUpgradeable} from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import {TransparentUpgradeableProxy} from '@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol';

import {IHectorSubscriptionV2Factory} from '../interfaces/IHectorSubscriptionV2Factory.sol';

error INVALID_PRODUCT();
error INVALID_ADDRESS();

contract HectorSubscriptionV2ProxyFactory is
    IHectorSubscriptionV2Factory,
    OwnableUpgradeable
{
    /* ======== STORAGE ======== */

    struct Subscription {
        string product;
        address subscription;
    }

    address public hectorSubscriptionProxyLogic;
    address public upgradeableAdmin;

    address public couponService;
    address public refundService;
    address public priceOracleAggregator;

    bytes public parameter;
    Subscription[] public getHectorSubscriptionProxyByIndex;
    mapping(bytes32 => address) public getHectorSubscriptionProxyContractByName;

    /* ======== EVENTS ======== */

    event HectorSubscriptionProxyCreated(
        string product,
        address hectorSubscriptionProxy
    );

    /* ======== INITIALIZATION ======== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _hectorSubscriptionProxyLogic,
        address _upgradeableAdmin
    ) external initializer {
        if (
            _hectorSubscriptionProxyLogic == address(0) ||
            _upgradeableAdmin == address(0)
        ) revert INVALID_ADDRESS();

        hectorSubscriptionProxyLogic = _hectorSubscriptionProxyLogic;
        upgradeableAdmin = _upgradeableAdmin;

        __Ownable_init();
    }

    /* ======== POLICY FUNCTIONS ======== */

    function setHectorSubscriptionProxyLogic(
        address _hectorSubscriptionProxyLogic
    ) external onlyOwner {
        if (_hectorSubscriptionProxyLogic == address(0))
            revert INVALID_ADDRESS();
        hectorSubscriptionProxyLogic = _hectorSubscriptionProxyLogic;
    }

    function setUpgradeableAdmin(address _upgradeableAdmin) external onlyOwner {
        if (_upgradeableAdmin == address(0)) revert INVALID_ADDRESS();
        upgradeableAdmin = _upgradeableAdmin;
    }

    function createHectorSubscriptionProxyContract(
        string calldata _product,
        address _treasury
    ) external onlyOwner returns (address hectorSubscriptionProxyContract) {
        bytes memory product = bytes(_product);
        if (product.length == 0) revert INVALID_PRODUCT();
        if (_treasury == address(0)) revert INVALID_ADDRESS();

        // set the parameter storage slot so the contract can query it
        parameter = abi.encode(product, _treasury);
        // use CREATE2 so we can get a deterministic address based on the product
        hectorSubscriptionProxyContract = address(
            new TransparentUpgradeableProxy{salt: keccak256(product)}(
                hectorSubscriptionProxyLogic,
                upgradeableAdmin,
                abi.encodeWithSignature('initialize()')
            )
        );
        // CREATE2 can return address(0), add a check to verify this isn't the case
        // See: https://eips.ethereum.org/EIPS/eip-1014
        require(hectorSubscriptionProxyContract != address(0));

        // Append the new contract address to the array of deployed contracts
        getHectorSubscriptionProxyByIndex.push(
            Subscription({
                product: _product,
                subscription: hectorSubscriptionProxyContract
            })
        );

        // Append the new contract address to the mapping of deployed contracts
        getHectorSubscriptionProxyContractByName[
            keccak256(product)
        ] = hectorSubscriptionProxyContract;

        emit HectorSubscriptionProxyCreated(
            _product,
            hectorSubscriptionProxyContract
        );
    }

    /* ======== VIEW FUNCTIONS ======== */

    function factoryOwner() external view returns (address) {
        return owner();
    }

    function isDeployedHectorSubscriptionProxyContractByProduct(
        string calldata _product
    ) external view returns (bool isDeployed) {
        isDeployed =
            getHectorSubscriptionProxyContractByName[
                keccak256(bytes(_product))
            ] !=
            address(0);
    }
}
