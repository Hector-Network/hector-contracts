// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;


interface IRewardWeight{
    function getRewardWeight(address receiver) view external returns(uint);
    function setRewardWeight(address receiver, uint weightPercentage) external;
}


contract Voting {

    IRewardWeight public rewardWeightContract;

    event SetRewardWeightContractEvent(address oldReceiver, address newReceiver);
  
    constructor(address _rewardWeightContract) {
        require( _rewardWeightContract != address(0) );
        rewardWeightContract = IRewardWeight(_rewardWeightContract);
    }
    
    function updateFarmRewardWeight(address[] farms, uint[] weightBps) internal override{
       
       require(farms.length>0,"there shall be at least one farm");
        require(farms.length==weightBps.length,"number of farms and number of weightBps should match");

        for(uint i=0;i<farms.length;i++){
            require(weightBps[i]>0,"all weight in weightBps should be greater than 0");
            rewardWeightContract.setRewardWeight(farms[i], weightBps[i]);
        }
    }

     /**
        @notice set the governance contract for reward weight percentage 
        @param _rewardWeightContract address
     */
    function setRewardContract(address _rewardWeightContract) external onlyOwner {
        require(_rewardWeightContract != address(0),"Invalid reward weight address");
        address oldContract = address(rewardWeightContract);

        rewardWeightContract = IRewardWeight(_rewardWeightContract);

        emit SetRewardWeightContractEvent(oldContract, _rewardWeightContract);
    }
}
