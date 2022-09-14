// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

import "./interfaces/ILockAddressRegistry.sol";

contract LockAddressRegistry is Ownable, ILockAddressRegistry {
    using Counters for Counters.Counter;

    bytes32 public constant ADMIN = "ADMIN";
    bytes32 public constant TOKEN_VAULT = "TOKEN_VAULT";
    bytes32 public constant FNFT = "FNFT";
    bytes32 public constant EMISSIONOR = "EMISSIONOR";

    mapping(bytes32 => address) private _addresses;

    Counters.Counter private _farmIndexTracker;
    mapping(uint256 => address) private _farms;
    mapping(address => bool) private _isFarm;

    constructor() Ownable() {}

    // Set up all addresses for the registry.
    function initialize(
        address admin,
        address tokenVault,
        address fnft,
        address emissionor
    ) external override onlyOwner {
        _addresses[ADMIN] = admin;
        _addresses[TOKEN_VAULT] = tokenVault;
        _addresses[FNFT] = fnft;
        _addresses[EMISSIONOR] = emissionor;
    }

    function getAdmin() external view override returns (address) {
        return _addresses[ADMIN];
    }

    function setAdmin(address admin) external override onlyOwner {
        _addresses[ADMIN] = admin;
    }

    function getTokenVault() external view override returns (address) {
        return getAddress(TOKEN_VAULT);
    }

    function setTokenVault(address vault) external override onlyOwner {
        _addresses[TOKEN_VAULT] = vault;
    }

    function getFNFT() external view override returns (address) {
        return _addresses[FNFT];
    }

    function setFNFT(address fnft) external override onlyOwner {
        _addresses[FNFT] = fnft;
    }

    function getEmissionor() external view override returns (address) {
        return _addresses[EMISSIONOR];
    }

    function setEmissionor(address emissionor) external override onlyOwner {
        _addresses[EMISSIONOR] = emissionor;
    }

    function getFarm(uint256 index) external view override returns (address) {
        return _farms[index];
    }

    function addFarm(address farm) external override onlyOwner {
        _farms[_farmIndexTracker.current()] = farm;
        _farmIndexTracker.increment();
        _isFarm[farm] = true;
    }

    function setIsFarm(address farm, bool value) external override onlyOwner {
        _isFarm[farm] = value;
    }

    function isFarm(address farm) external view override returns (bool) {
        return _isFarm[farm];
    }

    /**
     * @dev Returns an address by id
     * @return The address
     */
    function getAddress(bytes32 id) public view override returns (address) {
        return _addresses[id];
    }
}
