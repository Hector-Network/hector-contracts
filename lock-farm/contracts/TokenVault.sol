// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@openzeppelin/contracts/security/Pausable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import './LockAccessControl.sol';

import './interfaces/ITokenVault.sol';
import './interfaces/IFNFT.sol';

// Credits to Revest Team
// Github:https://github.com/Revest-Finance/RevestContracts/blob/master/hardhat/contracts/TokenVault.sol
contract TokenVault is
    ITokenVault,
    LockAccessControl,
    Pausable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;

    mapping(uint256 => FNFTConfig) private fnfts;

    bool public lockDisabled;

    /* ======= CONSTRUCTOR ======= */

    constructor(address provider) LockAccessControl(provider) {
    	lockDisabled = false;
    }

    ///////////////////////////////////////////////////////
    //               MANAGER CALLED FUNCTIONS            //
    ///////////////////////////////////////////////////////

    function pause() external onlyOwner whenNotPaused {
        return _pause();
    }

    function unpause() external onlyOwner whenPaused {
        return _unpause();
    }

    function disableLock() external onlyOwner whenNotPaused {
    	require(!lockDisabled, "lock is disabled already");
    	lockDisabled = true;
    }

    ///////////////////////////////////////////////////////
    //               USER CALLED FUNCTIONS               //
    ///////////////////////////////////////////////////////

    function mint(address recipient, FNFTConfig memory fnftConfig)
        external
        override
        onlyFarm
        whenNotPaused
        nonReentrant
        returns (uint256)
    {
        require(recipient != address(0), 'TokenVault: Invalid recipient');
        require(fnftConfig.asset != address(0), 'TokenVault: Invalid asset');
        require(
            fnftConfig.depositAmount > 0,
            'TokenVault: Invalid deposit amount'
        );

        IERC20(fnftConfig.asset).safeTransferFrom(
            recipient,
            address(this),
            fnftConfig.depositAmount
        );

        uint256 fnftId = getFNFT().mint(recipient);
        fnfts[fnftId] = fnftConfig;

        emit FNFTMinted(
            fnftConfig.asset,
            recipient,
            fnftId,
            fnftConfig.depositAmount,
            fnftConfig.endTime
        );

        return fnftId;
    }

    function withdraw(address recipient, uint256 fnftId)
        external
        override
        onlyFarm
        whenNotPaused
        nonReentrant
    {
        require(
            getFNFT().ownerOf(fnftId) == recipient,
            'TokenVault: Invalid recipient'
        );

        FNFTConfig memory fnftConfig = fnfts[fnftId];

        require(lockDisabled || fnftConfig.endTime <= block.timestamp, 'TokenVault: locked');

        getFNFT().burn(fnftId);

        IERC20(fnftConfig.asset).safeTransfer(
            recipient,
            fnftConfig.depositAmount
        );

        delete fnfts[fnftId];
    }

    ///////////////////////////////////////////////////////
    //                  VIEW FUNCTIONS                   //
    ///////////////////////////////////////////////////////

    function getFNFT(uint256 fnftId)
        external
        view
        override
        returns (FNFTConfig memory)
    {
        return fnfts[fnftId];
    }
}
