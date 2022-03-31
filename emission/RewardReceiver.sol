// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;
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
        _newOwner = address(0);
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
interface IERC20{
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}
interface IRewardReceiver{
    function receiveReward(uint amount) external;
}
abstract contract RewardReceiver is IRewardReceiver,Ownable{
    address public rewardToken;
    function receiveReward(uint amount) external override{
        require(rewardToken!=address(0),"rewardToken is not set");
        IERC20(rewardToken).transferFrom(msg.sender,address(this),amount);
        onRewardReceived(amount);
    }
    function onRewardReceived(uint amount) internal virtual;
    function setRewardToken(address _rewardToken) external onlyOwner{
        require(rewardToken==address(0)&&_rewardToken!=address(0),"rewardToken can be set only once to non-zero address");
        rewardToken=_rewardToken;
    }
}
