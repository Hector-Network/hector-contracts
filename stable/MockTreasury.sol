// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.7.5;
interface ITreasury{
    function mintRewards( address _recipient, uint _amount ) external;
}
interface IERC20{
    function mint(address account_, uint256 amount_) external;
}
contract MockTreasury is ITreasury{
    modifier onlyOwner() {
        require( _owner == msg.sender, "Ownable: caller is not the owner" );
        _;
    }
    address public _owner;
    address public minter;
    address public hec;
    constructor(){
        _owner=msg.sender;
    }
    function setHec(address _hec) external onlyOwner(){
        hec=_hec;
    }
    function mintRewards( address _recipient, uint _amount ) override external{
        require(msg.sender==minter);
        IERC20(hec).mint(_recipient,_amount);
    }
    function setMinter(address _minter) external onlyOwner(){
        minter=_minter;
    }
}
