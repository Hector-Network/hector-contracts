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
import './interfaces/IEmissionor.sol';

contract LockFarm is
    ILockFarm,
    RewardReceiver,
    LockAccessControl,
    ReentrancyGuard,
    Pausable
{
    using SafeERC20 for IERC20;

    string public name;
    IERC20 immutable stakingToken;

    uint256 public totalReward;
    uint256 public totalTokenSupply;
    uint256 public totalTokenBoostedSupply;
    uint256 public accTokenPerShare;
    uint256 public periodFinish;
    uint256 public rewardRate;
    uint256 public lastUpdateTime;

    uint256 public lockedStakeMaxMultiplier = 3e6; // 6 decimals of precision. 1x = 1000000
    uint256 public lockedStakeTimeForMaxMultiplier = 3 * 365 * 86400; // 3 years
    uint256 public constant lockedStakeMinTime = 7 days;

    mapping(uint256 => FNFTInfo) public fnfts;
    mapping(address => uint256) public userRemainingRewards;

    uint256 private constant MULTIPLIER_BASE = 1e6;
    uint256 private constant PRICE_PRECISION = 1e6;
    uint256 private constant SHARE_MULTIPLIER = 1e12;

    /* ======= CONSTRUCTOR ======= */

    constructor(
        address provider,
        string memory _name,
        address _stakingToken,
        address _rewardToken
    ) LockAccessControl(provider) {
        require(_stakingToken != address(0), 'Farm: Invalid staking token');

        name = _name;
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
        info.id = fnftId;
        info.amount = amount;
        info.startTime = block.timestamp;
        info.secs = secs;
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

        uint256 boostedAmount = processReward(msg.sender, fnftId);

        userRemainingRewards[msg.sender] += info.pendingReward;

        totalTokenSupply -= info.amount;
        totalTokenBoostedSupply -= boostedAmount;

        delete fnfts[fnftId];

        emit Withdraw(msg.sender, fnftId, info.amount);
    }

    function claim(uint256 fnftId) external nonReentrant whenNotPaused {
        require(getFNFT().ownerOf(fnftId) == msg.sender, 'Farm: Invalid owner');

        updateFarm();

        processReward(msg.sender, fnftId);
    }

    function claim() external nonReentrant whenNotPaused {
        uint256 amount = userRemainingRewards[msg.sender];
        require(amount > 0, 'Farm: no remaining rewards');

        userRemainingRewards[msg.sender] =
            amount -
            safeRewardTransfer(msg.sender, amount);
    }

    ///////////////////////////////////////////////////////
    //                  VIEW FUNCTIONS                   //
    ///////////////////////////////////////////////////////

    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalTokenBoostedSupply == 0) {
            return accTokenPerShare;
        }

        uint256 multiplier = lastTimeRewardApplicable() - lastUpdateTime;
        uint256 tokenReward = rewardRate * multiplier;

        return
            accTokenPerShare +
            ((tokenReward * SHARE_MULTIPLIER) / totalTokenBoostedSupply);
    }

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
        FNFTInfo memory info = fnfts[fnftId];
        uint256 boostedAmount = (info.amount * info.multiplier) /
            PRICE_PRECISION;

        reward =
            (boostedAmount * rewardPerToken()) /
            SHARE_MULTIPLIER +
            info.pendingReward -
            info.rewardDebt;
    }

    function getFnfts(address owner)
        external
        view
        returns (FNFTInfo[] memory infos)
    {
        uint256 balance = getFNFT().balanceOf(owner);

        infos = new FNFTInfo[](balance);

        for (uint256 i = 0; i < balance; i++) {
            uint256 fnftId = getFNFT().tokenOfOwnerByIndex(owner, i);
            infos[i] = fnfts[fnftId];
        }
    }

    function getAPR() external view returns (uint256) {
        if (totalTokenSupply == 0) {
            return 0;
        }

        return
            (365 * 24 * 3600 * rewardRate * MULTIPLIER_BASE) / totalTokenSupply;
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

    function setName(string memory _name) external onlyOwner whenNotPaused {
        name = _name;
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
        updateFarm();

        uint256 endTime = getEmissionor().getEndTime();
        uint256 rewardsDuration;

        if (periodFinish > 0) {
            rewardsDuration = endTime - periodFinish;
        } else {
            rewardsDuration = endTime - block.timestamp + 1;
        }

        if (block.timestamp >= periodFinish) {
            rewardRate = amount / rewardsDuration;
        } else {
            uint256 remaining = periodFinish - block.timestamp;
            uint256 leftover = remaining * rewardRate;
            rewardRate = (amount + leftover) / rewardsDuration;
        }

        lastUpdateTime = block.timestamp;
        periodFinish = endTime;
        totalReward += amount;
    }

    function processReward(address to, uint256 fnftId)
        internal
        returns (uint256)
    {
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
        }

        info.rewardDebt = (boostedAmount * accTokenPerShare) / SHARE_MULTIPLIER;

        return boostedAmount;
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
        accTokenPerShare = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
    }
}
