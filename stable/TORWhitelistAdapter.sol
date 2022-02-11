// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.7.5;
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
interface ITORMintStrategy{
    function tryMint(address recipient,uint amount) external returns(bool);
}
interface ITORMintRedeemStrategy{
    function canMint(address recipient,uint torAmount,address stableToken) external returns(bool);
    function canRedeem(address recipient,uint torAmount,address stableToken) external returns(bool);
}
contract TORWhitelistAdapter is ITORMintRedeemStrategy,Ownable{
    function canMint(address recipient,uint torAmount,address stableToken) override external returns(bool){
        return ITORMintStrategy(0x44FC4DB9793969019800B5FdeD3b3CF40CF85E75).tryMint(recipient,torAmount);
    }
    function canRedeem(address recipient,uint torAmount,address stableToken) override external returns(bool){
        return recipient==owner();
    }
}
