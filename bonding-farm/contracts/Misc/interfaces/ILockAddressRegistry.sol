// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

interface ILockAddressRegistry {
    function initialize(
        address admin,
        address tokenVault,
        address fnft,
        address emissionor
    ) external;

    function getAdmin() external view returns (address);

    function setAdmin(address admin) external;

    function getTokenVault() external view returns (address);

    function setTokenVault(address vault) external;

    function getFNFT() external view returns (address);

    function setFNFT(address fnft) external;

    function getEmissionor() external view returns (address);

    function setEmissionor(address emissionor) external;

    function getFarm(uint256 index) external view returns (address);

    function addFarm(address farm) external;

    function setIsFarm(address farm, bool value) external;

    function isFarm(address farm) external view returns (bool);

    function getAddress(bytes32 id) external view returns (address);
}
