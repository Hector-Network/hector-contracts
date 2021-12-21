// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.7.5;
interface IOwnable {
  function manager() external view returns (address);

  function renounceManagement() external;
  
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
        emit OwnershipPushed( address(0), _owner );
    }

    function manager() public view override returns (address) {
        return _owner;
    }

    modifier onlyManager() {
        require( _owner == msg.sender, "Ownable: caller is not the owner" );
        _;
    }

    function renounceManagement() public virtual override onlyManager() {
        emit OwnershipPushed( _owner, address(0) );
        _owner = address(0);
    }

    function pushManagement( address newOwner_ ) public virtual override onlyManager() {
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
interface IBond{
    function bondPriceInUSD() external view returns ( uint price_ );
}
contract HectorBondPriceUsdDecimals is Ownable{
    mapping(address=>uint8) public decimals;
    function addBondDecimals(address _bond,uint8 _decimals) public onlyManager{
        decimals[_bond]=_decimals;
    }
    function removeBondDecimals(address _bond,uint8 _decimals) public onlyManager{
        if(decimals[_bond]==_decimals)delete decimals[_bond];
    }
    function bondPriceUSD(address _bond) external view returns(uint){
        return IBond(_bond).bondPriceInUSD();
    }
}
