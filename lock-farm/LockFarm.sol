// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@openzeppelin/contracts/security/Pausable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';

import './RewardReceiver.sol';
import './LockAccessControl.sol';

import './interfaces/ILockFarm.sol';
import './interfaces/ITokenVault.sol';
import './interfaces/IFNFT.sol';

contract LockFarm is
    ILockFarm,
    RewardReceiver,
    LockAccessControl,
    ReentrancyGuard,
    Pausable
{
    using SafeERC20 for IERC20;

    IERC20 stakingToken;

    uint256 public accTokenPerShare;
    uint256 public totalTokenSupply;
    uint256 public totalTokenBoostedSupply;

    uint256 public lockedStakeMaxMultiplier = 3e6; // 6 decimals of precision. 1x = 1000000
    uint256 public lockedStakeTimeForMaxMultiplier = 3 * 365 * 86400; // 3 years
    uint256 public lockedStakeMinTime = 7 days;

    mapping(uint256 => FNFTInfo) public fnfts;

    uint256 private constant MULTIPLIER_BASE = 1e6;
    uint256 private constant SHARE_MULTIPLIER = 1e12;

    /* ======= CONSTRUCTOR ======= */

    constructor(
        address provider,
        address _stakingToken,
        address _rewardToken
    ) LockAccessControl(provider) {
        require(_stakingToken != address(0), 'Farm: Invalid staking token');

        stakingToken = IERC20(_stakingToken);
        rewardToken = _rewardToken;
    }

    ///////////////////////////////////////////////////////
    //               USER CALLED FUNCTIONS               //
    ///////////////////////////////////////////////////////

    function stake(uint256 amount, uint256 secs)
        external
        nonReentrant
        whenNotPaused
    {
        require(amount > 0, 'Farm: Invalid amount');
        require(
            secs > 0 &&
                secs >= lockedStakeMinTime &&
                secs <= lockedStakeTimeForMaxMultiplier,
            'Farm: Invalid secs'
        );

        uint256 multiplier = stakingMultiplier(secs);
        uint256 boostedAmount = (amount * multiplier) / MULTIPLIER_BASE;

        totalTokenSupply += amount;
        totalTokenBoostedSupply += boostedAmount;

        uint256 fnftId = getTokenVault().mint(
            msg.sender,
            ITokenVault.FNFTConfig({
                asset: address(stakingToken),
                depositAmount: amount,
                endTime: block.timestamp + secs
            })
        );

        FNFTInfo storage info = fnfts[fnftId];
        info.amount = amount;
        info.multiplier = stakingMultiplier(secs);
        info.rewardDebt = (boostedAmount * accTokenPerShare) / SHARE_MULTIPLIER;
        info.pendingReward = 0;

        emit Stake(msg.sender, fnftId, amount, secs);
    }

    function withdraw(uint256 fnftId) external nonReentrant whenNotPaused {
        require(getFNFT().ownerOf(fnftId) != msg.sender, 'Farm: Invalid owner');

        getTokenVault().withdraw(msg.sender, fnftId);
        FNFTInfo storage info = fnfts[fnftId];
        emit Withdraw(msg.sender, fnftId, info.amount);

        uint256 reward = pendingReward(fnftId);
        if (reward > 0) {
            uint256 sentReward = safeRewardTransfer(msg.sender, reward);
            emit Claim(msg.sender, fnftId, sentReward);

            info.pendingReward = reward - sentReward;
        }

        uint256 boostedAmount = (info.amount * info.multiplier) /
            MULTIPLIER_BASE;

        totalTokenSupply -= info.amount;
        totalTokenBoostedSupply -= boostedAmount;

        info.amount = 0;
        info.multiplier = 0;
        info.rewardDebt = (boostedAmount * accTokenPerShare) / SHARE_MULTIPLIER;
    }

    function claim(uint256 fnftId) external nonReentrant whenNotPaused {
        require(getFNFT().ownerOf(fnftId) != msg.sender, 'Farm: Invalid owner');

        FNFTInfo storage info = fnfts[fnftId];

        uint256 reward = pendingReward(fnftId);
        if (reward > 0) {
            uint256 sentReward = safeRewardTransfer(msg.sender, reward);
            emit Claim(msg.sender, fnftId, sentReward);

            info.pendingReward = reward - sentReward;
        }

        uint256 boostedAmount = (info.amount * info.multiplier) /
            MULTIPLIER_BASE;
        info.rewardDebt = (boostedAmount * accTokenPerShare) / SHARE_MULTIPLIER;
    }

    ///////////////////////////////////////////////////////
    //                  VIEW FUNCTIONS                   //
    ///////////////////////////////////////////////////////

    function stakingMultiplier(uint256 secs)
        public
        view
        returns (uint256 multiplier)
    {
        multiplier =
            MULTIPLIER_BASE +
            (secs * (lockedStakeMaxMultiplier - MULTIPLIER_BASE)) /
            lockedStakeTimeForMaxMultiplier;
        if (multiplier > lockedStakeMaxMultiplier)
            multiplier = lockedStakeMaxMultiplier;
    }

    function pendingReward(uint256 fnftId)
        public
        view
        returns (uint256 reward)
    {
        FNFTInfo memory info = fnfts[fnftId];
        uint256 boostedAmount = (info.amount * info.multiplier) /
            MULTIPLIER_BASE;

        reward =
            (boostedAmount * accTokenPerShare) /
            SHARE_MULTIPLIER +
            info.pendingReward -
            info.rewardDebt;
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

    ///////////////////////////////////////////////////////
    //                  INTERNAL FUNCTIONS               //
    ///////////////////////////////////////////////////////

    function onRewardReceived(uint256 amount) internal virtual override {
        accTokenPerShare +=
            (amount * SHARE_MULTIPLIER) /
            totalTokenBoostedSupply;
    }

    function safeRewardTransfer(address to, uint256 amount)
        internal
        returns (uint256)
    {
        uint256 rewardTokenBal = IERC20(rewardToken).balanceOf(address(this));
        if (amount > rewardTokenBal) {
            IERC20(rewardToken).safeTransfer(to, rewardTokenBal);
            return rewardTokenBal;
        } else {
            IERC20(rewardToken).safeTransfer(to, amount);
            return amount;
        }
    }
}
