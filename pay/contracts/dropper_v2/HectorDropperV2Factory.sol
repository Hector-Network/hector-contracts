// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.17;

import {OwnableUpgradeable} from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import {TransparentUpgradeableProxy} from '@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol';

import {IHectorDropperV2Factory} from '../interfaces/IHectorDropperV2Factory.sol';

error INVALID_ADDRESS();
error INVALID_AMOUNT();
error INVALID_PARAM();
error INVALID_LENGTH();

contract HectorDropperV2Factory is IHectorDropperV2Factory, OwnableUpgradeable {
    /* ======== STORAGE ======== */

    address public hectorDropperLogic;
    address public upgradeableAdmin;
    address public validator;

    address public parameter;
    uint256 public getHectorDropperContractCount;
    address[1000000000] public getHectorDropperContractByIndex;
    mapping(address => address) public getHectorDropperContractByToken;

    /* ======== EVENTS ======== */

    event HectorDropperCreated(address token, address hectorDropper);

    /* ======== INITIALIZATION ======== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _hectorDropperLogic,
        address _upgradeableAdmin
    ) external initializer {
        if (
            _hectorDropperLogic == address(0) || _upgradeableAdmin == address(0)
        ) revert INVALID_ADDRESS();

        hectorDropperLogic = _hectorDropperLogic;
        upgradeableAdmin = _upgradeableAdmin;

        __Ownable_init();
    }

    /* ======== POLICY FUNCTIONS ======== */

    function setHectorDropperLogic(
        address _hectorDropperLogic
    ) external onlyOwner {
        if (_hectorDropperLogic == address(0)) revert INVALID_ADDRESS();
        hectorDropperLogic = _hectorDropperLogic;
    }

    function setUpgradeableAdmin(address _upgradeableAdmin) external onlyOwner {
        if (_upgradeableAdmin == address(0)) revert INVALID_ADDRESS();
        upgradeableAdmin = _upgradeableAdmin;
    }

    function setValidator(address _validator) external onlyOwner {
        validator = _validator;
    }

    /* ======== VIEW FUNCTIONS ======== */

    function factoryOwner() external view returns (address) {
        return owner();
    }

    function isDeployedHectorDropperContractByToken(
        address _token
    ) external view returns (bool isDeployed) {
        isDeployed = getHectorDropperContractByToken[_token] != address(0);
    }

    /* ======== PUBLIC FUNCTIONS ======== */

    function createHectorDropperContract(
        address _token
    ) external returns (address hectorDropperContract) {
        if (_token == address(0)) revert INVALID_ADDRESS();

        // set the parameter storage slot so the contract can query it
        parameter = _token;
        // use CREATE2 so we can get a deterministic address based on the token
        hectorDropperContract = address(
            new TransparentUpgradeableProxy{
                salt: bytes32(uint256(uint160(_token)))
            }(
                hectorDropperLogic,
                upgradeableAdmin,
                abi.encodeWithSignature('initialize()')
            )
        );
        // CREATE2 can return address(0), add a check to verify this isn't the case
        // See: https://eips.ethereum.org/EIPS/eip-1014
        require(hectorDropperContract != address(0));

        // Append the new contract address to the array of deployed contracts
        uint256 index = getHectorDropperContractCount;
        getHectorDropperContractByIndex[index] = hectorDropperContract;
        unchecked {
            getHectorDropperContractCount = index + 1;
        }

        // Append the new contract address to the mapping of deployed contracts
        getHectorDropperContractByToken[_token] = hectorDropperContract;

        emit HectorDropperCreated(_token, hectorDropperContract);
    }
}
