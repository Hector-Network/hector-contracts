// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.7;
interface ITreasury{
    function mintRewards( address _recipient, uint _amount ) external;
    function manage( address _token, uint _amount ) external;
}
interface IERC20{
    function mint(address account_, uint256 amount_) external;
    function transfer(address recipient, uint256 amount) external returns (bool);
}
contract MockTreasury is ITreasury{
    modifier onlyOwner() {
        require( _owner == msg.sender, "Ownable: caller is not the owner" );
        _;
    }
    address public _owner;
    address public minter;
    address public hec;
    address public reserveManager;
    constructor(){
        _owner=msg.sender;
    }
    function setHec(address _hec) external onlyOwner(){
        hec=_hec;
    }
    function mintRewards( address _recipient, uint _amount ) override external{
        require(msg.sender==minter,"only minter can mint");
        IERC20(hec).mint(_recipient,_amount);
    }
    function manage( address _token, uint _amount ) override external {
        require(msg.sender==reserveManager,"only manager can manage");
        IERC20(_token).transfer(msg.sender,_amount);
    }
    function setMinter(address _minter) external onlyOwner(){
        minter=_minter;
    }
    function setReserveManager(address _reserveManager) external onlyOwner(){
        reserveManager=_reserveManager;
    }
}
