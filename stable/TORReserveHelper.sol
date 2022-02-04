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
interface IOwnable {
    function owner() external view returns (address);

    function renounceManagement(string memory confirm) external;

    function pushManagement( address newOwner_ ) external;

    function pullManagement() external;
}

contract Ownable is IOwnable {

    address internal _owner;
    address internal _newOwner;

    event OwnershipPushed(address indexed previousOwner, address indexed newOwner);
    event OwnershipPulled(address indexed previousOwner, address indexed newOwner);

    constructor () {
        _owner = msg.sender;
        emit OwnershipPulled( address(0), _owner );
    }

    function owner() public view override returns (address) {
        return _owner;
    }

    modifier onlyOwner() {
        require( _owner == msg.sender, "Ownable: caller is not the owner" );
        _;
    }

    function renounceManagement(string memory confirm) public virtual override onlyOwner() {
        require(
            keccak256(abi.encodePacked(confirm)) == keccak256(abi.encodePacked("confirm renounce")),
            "Ownable: renouce needs 'confirm renounce' as input"
        );
        emit OwnershipPushed( _owner, address(0) );
        _owner = address(0);
    }

    function pushManagement( address newOwner_ ) public virtual override onlyOwner() {
        require( newOwner_ != address(0), "Ownable: new owner is the zero address");
        emit OwnershipPushed( _owner, newOwner_ );
        _newOwner = newOwner_;
    }

    function pullManagement() public virtual override {
        require( msg.sender == _newOwner, "Ownable: must be new owner to pull");
        emit OwnershipPulled( _owner, _newOwner );
        _owner = _newOwner;
    }
}
interface IERC20 {
    function decimals() external view returns(uint8);
    function balanceOf(address owner) external view returns(uint);
    function totalSupply() external view returns(uint);
}
interface ITORReserveHelper{
    function getTorReserveAndSupply() view external returns(uint reserve,uint totalSupply);//reserve 1e18,totalSupply 1e18
}
contract TORReserveHelper is Ownable,ITORReserveHelper{
    using SafeMath for uint;

    address[] public treasuryStables;

    function toE18(uint amount, uint8 decimals) public pure returns (uint){
        if(decimals==18)return amount;
        else if(decimals>18) return amount.div(10**(decimals-18));
        else return amount.mul(10**(18-decimals));
    }

    function getTorReserveAndSupply() view override external returns(uint reserve,uint totalSupply){
        reserve=0;
        for(uint i=0;i<treasuryStables.length;i++) {
            reserve=reserve.add(toE18(IERC20(treasuryStables[i]).balanceOf(0xCB54EA94191B280C296E6ff0E37c7e76Ad42dC6A),IERC20(treasuryStables[i]).decimals()));
        }
        totalSupply=IERC20(0x74E23dF9110Aa9eA0b6ff2fAEE01e740CA1c642e).totalSupply();
    }

    function add(address _stableToken) external onlyOwner() {
        require(_stableToken != address(0));
        for(uint i=0;i<treasuryStables.length;i++) {
            if(treasuryStables[i] == _stableToken) {
                return;
            }
        }
        treasuryStables.push(_stableToken);
    }
    
    function remove(address _stableToken) external onlyOwner() returns (bool) {
        require(_stableToken != address(0));
        for(uint i=0;i<treasuryStables.length;i++) {
            if(treasuryStables[i] == _stableToken) {
                for(uint j=i;j<treasuryStables.length-1;j++) {
                    treasuryStables[j] = treasuryStables[j+1];
                }
                treasuryStables.pop();
                return true;
            }
        }
        return false;
    }
}
