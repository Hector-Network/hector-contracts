// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

import '@openzeppelin/contracts/access/Ownable.sol';

import './interfaces/ILockAddressRegistry.sol';
import './interfaces/IEmissionor.sol';
import './interfaces/ITokenVault.sol';
import './interfaces/IFNFT.sol';

contract LockAccessControl is Ownable {
    ILockAddressRegistry internal addressProvider;

    /* ======= CONSTRUCTOR ======= */

    constructor(address provider) {
        addressProvider = ILockAddressRegistry(provider);
    }

    /* ======= MODIFIER ======= */

    modifier onlyTokenVault() {
        require(
            _msgSender() == addressProvider.getTokenVault(),
            'AccessControl: Invalid token vault'
        );
        _;
    }

    modifier onlyFarm() {
        require(
            addressProvider.isFarm(_msgSender()),
            'AccessControl: Invalid farm'
        );
        _;
    }

    ///////////////////////////////////////////////////////
    //               MANAGER CALLED FUNCTIONS            //
    ///////////////////////////////////////////////////////

    function setAddressProvider(address provider) external onlyOwner {
        addressProvider = ILockAddressRegistry(provider);
    }

    ///////////////////////////////////////////////////////
    //                INTERNAL FUNCTIONS                 //
    ///////////////////////////////////////////////////////

    function getTokenVault() internal view returns (ITokenVault) {
        return ITokenVault(addressProvider.getTokenVault());
    }

    function getFNFT() internal view returns (IFNFT) {
        return IFNFT(addressProvider.getFNFT());
    }

    function getEmissionor() internal view returns (IEmissionor) {
        return IEmissionor(addressProvider.getEmissionor());
    }
}
