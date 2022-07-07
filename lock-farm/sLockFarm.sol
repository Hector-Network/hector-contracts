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

contract sLockFarm is
    ILockFarm,
    RewardReceiver,
    LockAccessControl,
    ReentrancyGuard,
    Pausable
{
    using SafeERC20 for IERC20;

    IERC20 stakingToken;

    uint256 public totalReward;
    uint256 public totalRewardPeriod;
    uint256 public beginRewardTimestamp;
    uint256 public totalTokenSupply;
    uint256 public totalTokenBoostedSupply;
    uint256 public accTokenPerShare;
    uint256 public lastRewardTimestamp;
    uint256 public rewardAmount;

    uint256 public lockedStakeMaxMultiplier = 2e6; // 6 decimals of precision. 1x = 1000000
    uint256 public lockedStakeTimeForMaxMultiplier = 3 * 365 * 86400; // 3 years
    uint256 public lockedStakeMinTime = 7 days;

    mapping(uint256 => FNFTInfo) public fnfts;

    uint256 private constant MULTIPLIER_BASE = 0;
    uint256 private constant PRICE_PRECISION = 1e6;
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

        updateFarm();

        uint256 multiplier = stakingMultiplier(secs);
        uint256 boostedAmount = (amount * multiplier) / PRICE_PRECISION;

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
        info.multiplier = multiplier;
        info.rewardDebt = (boostedAmount * accTokenPerShare) / SHARE_MULTIPLIER;
        info.pendingReward = 0;

        emit Stake(msg.sender, fnftId, amount, secs);
    }

    function withdraw(uint256 fnftId) external nonReentrant whenNotPaused {
        require(getFNFT().ownerOf(fnftId) == msg.sender, 'Farm: Invalid owner');

        updateFarm();

        getTokenVault().withdraw(msg.sender, fnftId);
        FNFTInfo memory info = fnfts[fnftId];

        processReward(msg.sender, fnftId);

        uint256 boostedAmount = (info.amount * info.multiplier) /
            PRICE_PRECISION;

        totalTokenSupply -= info.amount;
        totalTokenBoostedSupply -= boostedAmount;

        delete fnfts[fnftId];

        emit Withdraw(msg.sender, fnftId, info.amount);
    }

    function claim(uint256 fnftId) external nonReentrant whenNotPaused {
        require(getFNFT().ownerOf(fnftId) == msg.sender, 'Farm: Invalid owner');

        updateFarm();

        FNFTInfo storage info = fnfts[fnftId];

        processReward(msg.sender, fnftId);

        uint256 boostedAmount = (info.amount * info.multiplier) /
            PRICE_PRECISION;
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
        external
        view
        returns (uint256 reward)
    {
        require(lastRewardTimestamp > 0, 'Farm: No reward yet');

        uint256 accTokenPerShare_ = accTokenPerShare;
        if (
            block.timestamp > lastRewardTimestamp &&
            totalTokenBoostedSupply != 0
        ) {
            uint256 multiplier = block.timestamp - lastRewardTimestamp;
            uint256 tokenReward = (multiplier * totalReward) /
                totalRewardPeriod;
            accTokenPerShare_ += ((tokenReward * SHARE_MULTIPLIER) /
                totalTokenBoostedSupply);
        }

        FNFTInfo memory info = fnfts[fnftId];
        uint256 boostedAmount = (info.amount * info.multiplier) /
            PRICE_PRECISION;

        reward =
            (boostedAmount * accTokenPerShare_) /
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

    function setMultipliers(
        uint256 _lockedStakeMaxMultiplier,
        uint256 _lockedStakeTimeForMaxMultiplier
    ) external onlyOwner whenNotPaused {
        require(
            _lockedStakeMaxMultiplier > MULTIPLIER_BASE,
            'Farm: Invalid multiplier'
        );
        require(
            _lockedStakeTimeForMaxMultiplier >= 1,
            'Farm: Invalid multiplier'
        );

        lockedStakeMaxMultiplier = _lockedStakeMaxMultiplier;
        lockedStakeTimeForMaxMultiplier = _lockedStakeTimeForMaxMultiplier;

        emit MultipliersUpdated(
            lockedStakeMaxMultiplier,
            lockedStakeTimeForMaxMultiplier
        );
    }

    ///////////////////////////////////////////////////////
    //                  INTERNAL FUNCTIONS               //
    ///////////////////////////////////////////////////////

    function onRewardReceived(uint256 amount) internal virtual override {
        uint256 end = getEmissionor().getEndTime();

        if (beginRewardTimestamp == 0) {
            beginRewardTimestamp = block.timestamp;
            lastRewardTimestamp = block.timestamp;
        }

        totalReward += amount;
        totalRewardPeriod = end - beginRewardTimestamp + 1;
    }

    function processReward(address to, uint256 fnftId) internal {
        FNFTInfo storage info = fnfts[fnftId];
        uint256 boostedAmount = (info.amount * info.multiplier) /
            PRICE_PRECISION;
        uint256 pending = (boostedAmount * accTokenPerShare) /
            SHARE_MULTIPLIER -
            info.rewardDebt;

        if (pending > 0) {
            info.pendingReward += pending;

            uint256 claimedAmount = safeRewardTransfer(to, info.pendingReward);
            emit Claim(to, fnftId, claimedAmount);

            info.pendingReward -= claimedAmount;
            rewardAmount -= claimedAmount;
        }
    }

    function safeRewardTransfer(address to, uint256 amount)
        internal
        returns (uint256)
    {
        uint256 rewardTokenBal = IERC20(rewardToken).balanceOf(address(this));

        if (rewardTokenBal == 0) {
            return 0;
        }

        if (amount > rewardTokenBal) {
            IERC20(rewardToken).safeTransfer(to, rewardTokenBal);
            return rewardTokenBal;
        } else {
            IERC20(rewardToken).safeTransfer(to, amount);
            return amount;
        }
    }

    function updateFarm() internal {
        if (
            totalReward == 0 ||
            totalRewardPeriod == 0 ||
            lastRewardTimestamp == 0
        ) {
            return;
        }
        if (block.timestamp <= lastRewardTimestamp) {
            return;
        }
        if (totalTokenBoostedSupply == 0) {
            lastRewardTimestamp = block.timestamp;
            return;
        }

        uint256 multiplier = block.timestamp - lastRewardTimestamp;
        uint256 tokenReward = (multiplier * totalReward) / totalRewardPeriod;
        rewardAmount += tokenReward;
        accTokenPerShare += ((tokenReward * SHARE_MULTIPLIER) /
            totalTokenBoostedSupply);
        lastRewardTimestamp = block.timestamp;
    }
}
