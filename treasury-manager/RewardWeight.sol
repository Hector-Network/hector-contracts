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


contract RewardWeight is Ownable{

    struct ReceiverPoolInfo {
        uint rewardWeightPercentage;    //100%=10000, 40%=4000, 4%=400
        bool isActive;
    }

    mapping(address => ReceiverPoolInfo) public receiversInfo;

    /**
        @notice register receiver to receive weight, weight (100%=10000, 40%=4000, 4%=400)
        @param receiver address
        @param weightPercentage uint
     */
    function register(address receiver, uint weightPercentage) external onlyOwner{
        require(receiver != address(0), "Invalid receiver");
        require(weightPercentage > 0, "Invalid reward weight");

        receiversInfo[receiver] = ReceiverPoolInfo(weightPercentage, true);
    }

    /**
        @notice Update weight percentage for receiver contract (100%=10000, 40%=4000, 4%=400)
        @param receiver address
        @param weightPercentage uint
     */
    function setRewardWeight(address receiver, uint weightPercentage) external onlyOwner {
        require(weightPercentage > 0, "Invalid reward weight");
        receiversInfo[receiver].rewardWeightPercentage = weightPercentage;
    }

    /**
        @notice Get weight percentage from a receiver contract (100%=10000, 40%=4000, 4%=400)
        @param receiver address
     */
    function getRewardWeight(address receiver) view external returns(uint weightPercentage) {
        require(receiver != address(0), "Invalid receiver");

        if (receiversInfo[receiver].isActive)
            weightPercentage = receiversInfo[receiver].rewardWeightPercentage;
        else
            weightPercentage = 0;
    }

    /**
        @notice Update the active status of the receiver contract
        @param receiver address
        @param status bool
     */
    function updateReceiverStatus(address receiver, bool status) external onlyOwner {
        require(receiver != address(0), "Invalid receiver");
        receiversInfo[receiver].isActive = status;
    }
}