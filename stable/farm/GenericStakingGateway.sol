// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.7.5;
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

    function sqrrt(uint256 a) internal pure returns (uint c) {
        if (a > 3) {
            c = a;
            uint b = add( div( a, 2), 1 );
            while (b < c) {
                c = b;
                b = div( add( div( a, b ), b), 2 );
            }
        } else if (a != 0) {
            c = 1;
        }
    }
}
interface IERC20 {
    function decimals() external view returns (uint8);

    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function transfer(address recipient, uint256 amount) external returns (bool);

    function allowance(address owner, address spender) external view returns (uint256);

    function approve(address spender, uint256 amount) external returns (bool);

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 value);

    event Approval(address indexed owner, address indexed spender, uint256 value);
}
interface IStakingRewards {
    // Views

    function balanceOf(address account) external view returns (uint);

    function earned(address account) external view returns (uint);

    function getRewardForDuration() external view returns (uint);

    function lastTimeRewardApplicable() external view returns (uint);

    function rewardPerToken() external view returns (uint);

    function rewardsDistribution() external view returns (address);

    function rewardsToken() external view returns (IERC20);

    function totalSupply() external view returns (uint);

    function rewardRate() external view returns(uint);

    function periodFinish() external view returns(uint);

    function rewardsDuration() external view returns(uint);

    function stakingToken() external view returns(IERC20);

    // Mutative

    function exit() external;

    function getReward() external;

    function stake(uint amount) external;

    function withdraw(uint amount) external;
}
interface IPricer{
    //price for 1 token unit (10**tokenDecimals), price is in 1e18
    function price(IERC20 token) external view returns(uint);
}
contract GenericStakingGateway{
    using SafeMath for uint;
    
    function getStakingInfo(IStakingRewards stakingRewards,IPricer stakingTokenPricer,IPricer rewardTokenPricer,address wallet) external view returns(
        uint _tvl,//1e18
        uint _apr,//1e8
        uint _begin,
        uint _finish,
        uint _userStakedAmount,
        uint _userStakedValue,//1e18
        uint _userEarnedAmount,
        uint _userEarnedValue//1e18
    ){
        _tvl = tvl(stakingRewards,stakingTokenPricer);
        _apr = apr(stakingRewards,rewardTokenPricer,_tvl);
        _finish = stakingRewards.periodFinish();
        _begin =_finish.sub(stakingRewards.rewardsDuration());
        _userEarnedAmount = stakingRewards.earned(wallet);
        _userEarnedValue = value(stakingRewards.rewardsToken(),rewardTokenPricer,_userEarnedAmount);
        _userStakedAmount = stakingRewards.balanceOf(wallet);
        _userStakedValue = value(stakingRewards.stakingToken(),stakingTokenPricer,_userStakedAmount);
    }

    function value(IERC20 token,IPricer pricer,uint amount) public view returns(uint){
        return amount.mul(pricer.price(token)).div(10**token.decimals());
    }

    function tvl(IStakingRewards stakingRewards,IPricer stakingTokenPricer) public view returns(uint){
        return value(stakingRewards.stakingToken(),stakingTokenPricer,stakingRewards.totalSupply());
    }
    function apr(IStakingRewards stakingRewards,IPricer rewardTokenPricer,uint _tvl) public view returns(uint){
        return value(stakingRewards.rewardsToken(),rewardTokenPricer,stakingRewards.rewardRate().mul(31536000)).mul(1e8).div(_tvl);
    }
}
