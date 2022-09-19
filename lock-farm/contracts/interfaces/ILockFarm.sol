// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

interface ILockFarm {
    struct FNFTInfo {
        uint256 id;
        uint256 amount;
        uint256 startTime;
        uint256 secs;
        uint256 multiplier;
        uint256 rewardDebt;
        uint256 pendingReward;
    }

    event Stake(
        address indexed account,
        uint256 indexed fnftId,
        uint256 amount,
        uint256 secs
    );
    event Withdraw(
        address indexed account,
        uint256 indexed fnftId,
        uint256 amount
    );
    event Claim(
        address indexed account,
        uint256 indexed fnftId,
        uint256 amount
    );
    event MultipliersUpdated(
        uint256 lockedStakeMaxMultiplier,
        uint256 lockedStakeTimeForMaxMultiplier
    );
}
