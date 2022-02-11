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
interface ICurve{
    function balances(uint i) view external returns(uint);
    function totalSupply() external view returns(uint);
}
interface ITORCurveHelper{
    function getPoolPercentageWithMint(uint _torAmount) view external returns(uint percentage);//tor percentage 10000 = 100%
    function getPoolPercentageWithRedeem(uint _torAmount) view external returns(uint percentage);//tor percentage 5000 = 50%
}
contract TORCurveHelper is ITORCurveHelper{
    using SafeMath for uint;
    function getTorAndDaiAndUsdc() view public returns(uint torAmount,uint daiAmount,uint usdcAmount){//1e18 for torAmount and stableAmount
        torAmount=ICurve(0x24699312CB27C26Cfc669459D670559E5E44EE60).balances(0);
        uint c2Amount=ICurve(0x24699312CB27C26Cfc669459D670559E5E44EE60).balances(1);
        ICurve c2pool=ICurve(0x27E611FD27b276ACbd5Ffd632E5eAEBEC9761E40);
        usdcAmount=c2pool.balances(1).mul(1e12).mul(c2Amount).div(c2pool.totalSupply());
        daiAmount=c2pool.balances(0).mul(c2Amount).div(c2pool.totalSupply());
    }
    function getPoolPercentageWithMint(uint _torAmount) override view external returns(uint percentage){//tor percentage 10000 = 100%
        (uint torAmount,uint daiAmount,uint usdcAmount)=getTorAndDaiAndUsdc();
        percentage=torAmount.add(_torAmount).mul(1e4).div(torAmount.add(daiAmount).add(usdcAmount));
    }
    function getPoolPercentageWithRedeem(uint _torAmount) override view external returns(uint percentage){//tor percentage 5000 = 50%
        (uint torAmount,uint daiAmount,uint usdcAmount)=getTorAndDaiAndUsdc();
        percentage=torAmount.sub(_torAmount).mul(1e4).div(torAmount.add(daiAmount).add(usdcAmount));
    }
}
