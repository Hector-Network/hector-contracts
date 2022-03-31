// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;
import "./RewardReceiver.sol";
library SafeMath {

    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");

        return c;
    }

    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return sub(a, b, "SafeMath: subtraction overflow");
    }

    function sub(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b <= a, errorMessage);
        uint256 c = a - b;

        return c;
    }

    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");

        return c;
    }

    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return div(a, b, "SafeMath: division by zero");
    }

    function div(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b > 0, errorMessage);
        uint256 c = a / b;
        return c;
    }

    function mod(uint256 a, uint256 b) internal pure returns (uint256) {
        return mod(a, b, "SafeMath: modulo by zero");
    }

    function mod(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b != 0, errorMessage);
        return a % b;
    }
}
interface Loggable{
    event Log(address self,string contractName,string functionName,uint value);
}
contract TestToken is IERC20{
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool){
        emit Transfer(sender,recipient,amount);
        return true;
    }
    function approve(address spender, uint256 amount) external override returns (bool){
        emit Approval(msg.sender,spender,amount);
        return true;
    }

    function transfer(address recipient, uint256 amount) external override returns (bool){
        emit Transfer(msg.sender,recipient,amount);
        return true;
    }
}
contract Splitter is RewardReceiver,Loggable{
    using SafeMath for uint;
    struct DistributeState{
        uint ttl;
        uint cumSent;
        uint amount;
    }
    
    function initState(uint amount) internal view returns(DistributeState memory){
        DistributeState memory state;
        state.ttl=(receivers.length).add(1).mul(receivers.length).div(2);
        state.cumSent=0;
        state.amount=amount;
        return state;
    }
    function calcSend(uint i,DistributeState memory state) internal view returns(uint){
        uint toSend=state.amount.mul(i+1).div(state.ttl);
        if(i==receivers.length-1)toSend=state.amount.sub(state.cumSent);
        state.cumSent=state.cumSent.add(toSend);
        return toSend;
    }

    IRewardReceiver[] public receivers;
    
    function onRewardReceived(uint amount) internal override{
        emit Log(address(this),"Splitter","onRewardReceived",amount);
        DistributeState memory state = initState(amount);
        for(uint i=0;i<receivers.length;i++){
            uint toSend=calcSend(i,state);
            IERC20(rewardToken).approve(address(receivers[i]),toSend);
            receivers[i].receiveReward(toSend);
        }
    }

    function register(IRewardReceiver receiver) external onlyOwner{
        receivers.push(receiver);
    }
}
contract LockFarm is RewardReceiver,Loggable{
    string name;
    constructor(string memory _name){
        name=_name;
    }
    function onRewardReceived(uint amount) internal override{
        emit Log(address(this),name,"onRewardReceived",amount);
    }
}
contract StakedHecDistributor is RewardReceiver,Loggable{
    using SafeMath for uint;
    address public oldStaking;
    uint public amountForOldStaking;
    uint public eachEpochAmount;
    IRewardReceiver public shecLockFarm;
    function setShecLockFarm(IRewardReceiver _shecLockFarm) public onlyOwner{
        require(address(_shecLockFarm)!=address(0),"shecLockFarm can't be zero");
        shecLockFarm=_shecLockFarm;
    }
    function setOldStaking(address _oldStaking) public onlyOwner{
        oldStaking=_oldStaking;
    }
    function onRewardReceived(uint amount) internal override{
        emit Log(address(this),"StakedHecDistributor","onRewardReceived",amount);
        
        uint amountForShecLockFarm=amount.div(2);
        IERC20(rewardToken).approve(address(shecLockFarm),amountForShecLockFarm);
        shecLockFarm.receiveReward(amountForShecLockFarm);

        amountForOldStaking = amountForOldStaking.add(amount.sub(amountForShecLockFarm));
        uint epochsPerWeek=21;
        eachEpochAmount = amountForOldStaking.sub(amountForOldStaking.mod(epochsPerWeek)).div(epochsPerWeek);
    }
    function distribute() public{
        amountForOldStaking=amountForOldStaking.sub(eachEpochAmount);
        IERC20(rewardToken).transfer(oldStaking,eachEpochAmount);
    }
}
contract Staking{

}
contract Setup{
    event CreateLog(string contractName,address addr);
    constructor(){
        address rewardToken= address(new TestToken());
        
        LockFarm farm1=new LockFarm("farm1");
        farm1.setRewardToken(rewardToken);

        LockFarm farm2=new LockFarm("farm2");
        farm2.setRewardToken(rewardToken);

        StakedHecDistributor distributor=new StakedHecDistributor();
        distributor.setRewardToken(rewardToken);
        address stakingContract=address(new Staking());
        distributor.setOldStaking(stakingContract);
        LockFarm shecLockFarm=new LockFarm("shecFarm");
        shecLockFarm.setRewardToken(rewardToken);
        distributor.setShecLockFarm(shecLockFarm);

        Splitter splitter=new Splitter();
        splitter.setRewardToken(rewardToken);
        splitter.register(farm1);
        splitter.register(farm2);
        splitter.register(distributor);

        emit CreateLog("rewardToken",rewardToken);
        emit CreateLog("farm1",address(farm1));
        emit CreateLog("farm2",address(farm2));
        emit CreateLog("stakedHecDistributor",address(distributor));
        emit CreateLog("stakingContract",address(stakingContract));
        emit CreateLog("shecLockFarm",address(shecLockFarm));
        emit CreateLog("splitter",address(splitter));

        IERC20(rewardToken).approve(address(splitter),6000);
        splitter.receiveReward(6000);

        distributor.distribute();
        distributor.distribute();
    }
}
