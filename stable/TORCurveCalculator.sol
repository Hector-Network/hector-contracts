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
interface ICurvePool{
    function totalSupply() external view returns (uint);
    function balances(uint idx) external view returns(uint);
}
contract TORCurveCalculator{
    using SafeMath for uint;
    ICurvePool public constant torPool=ICurvePool(0x24699312CB27C26Cfc669459D670559E5E44EE60);
    ICurvePool public constant c2pool=ICurvePool(0x27E611FD27b276ACbd5Ffd632E5eAEBEC9761E40);
    function getAmounts(uint _lpAmount) external view returns(uint _torAmount,uint _daiAmount, uint _usdcAmount){
        if(_lpAmount==0)return (0,0,0);
        _torAmount=_lpAmount.mul(torPool.balances(0)).div(torPool.totalSupply());
        uint c2lpAmount=_lpAmount.mul(torPool.balances(1)).div(torPool.totalSupply());
        _daiAmount=c2lpAmount.mul(c2pool.balances(0)).div(c2pool.totalSupply());
        _usdcAmount=c2lpAmount.mul(c2pool.balances(1)).div(c2pool.totalSupply());
    }
}
