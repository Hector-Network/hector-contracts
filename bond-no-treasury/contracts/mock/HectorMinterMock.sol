// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;
interface IERC20{
    function transfer(address recipient, uint256 amount) external returns (bool);
}
interface ITreasury {
    function mintRewards(address _recipient, uint256 _amount) external;
}
contract HectorMinterMock is ITreasury{
    address public owner;
    address public rewardManager;
    IERC20 public hector;
    modifier onlyOwner() {
        require( owner == msg.sender, "caller is not the owner" );
        _;
    }
    constructor(){owner=msg.sender;}
    function setHector(address _hector) external onlyOwner{
        hector=IERC20(_hector);
    }
    function setRewardManager(address _rewardManager) external onlyOwner{
        rewardManager=_rewardManager;
    }
    function mintRewards(address _recipient, uint256 _amount) external override{
        require(msg.sender == rewardManager, "only reward manager can mintReward");
        hector.transfer(_recipient,_amount);
    }
}
