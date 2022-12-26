// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import './interfaces/IRewardReceiver.sol';

abstract contract RewardReceiver is IRewardReceiver, Ownable {
    address public rewardToken;

    function receiveReward(uint256 amount) external override {
        require(rewardToken != address(0), 'rewardToken is not set');
        IERC20(rewardToken).transferFrom(msg.sender, address(this), amount);
        onRewardReceived(amount);
    }

    function onRewardReceived(uint256 amount) internal virtual;

    function setRewardToken(address _rewardToken) external onlyOwner {
        require(
            rewardToken == address(0) && _rewardToken != address(0),
            'rewardToken can be set only once to non-zero address'
        );
        rewardToken = _rewardToken;
    }
}
