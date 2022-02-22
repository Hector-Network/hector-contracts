// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.7.5;
interface IOwnable {
    function owner() external view returns (address);

    function renounceManagement(string memory confirm) external;

    function pushManagement( address newOwner_ ) external;

    function pullManagement() external;
}
interface IWhitelist{
    function add(address wallet) external;
    function minted(address wallet) external view returns(uint);
}
contract BatchWhitelistHelper{
    IWhitelist constant whitelist=IWhitelist(0x44FC4DB9793969019800B5FdeD3b3CF40CF85E75);
    mapping(address=>uint) public minted;
    address immutable _owner;
    constructor(){
        _owner=msg.sender;
    }
    function owner() public view returns (address) {
        return _owner;
    }

    modifier onlyOwner() {
        require( _owner == msg.sender, "Ownable: caller is not the owner" );
        _;
    }
    function add(address[] memory addresses) public onlyOwner(){
        for(uint i=0;i<addresses.length;i++){
            if(whitelist.minted(addresses[i])==0){
                whitelist.add(addresses[i]);
            }
        }
    }
    function receiveOwnership() public onlyOwner(){
        IOwnable(address(whitelist)).pullManagement();
    }
    function returnOwnership() public onlyOwner(){
        IOwnable(address(whitelist)).pushManagement(msg.sender);
    }
}
