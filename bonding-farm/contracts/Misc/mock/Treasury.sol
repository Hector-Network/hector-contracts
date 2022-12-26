// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

import './RewardToken.sol';

contract Treasury {
    RewardToken public rewardToken;

    constructor(address _rewardToken) {
        rewardToken = RewardToken(_rewardToken);
    }

    function mintRewards(address _recipient, uint256 _amount) external {
        rewardToken.mint(_recipient, _amount);
    }
}
