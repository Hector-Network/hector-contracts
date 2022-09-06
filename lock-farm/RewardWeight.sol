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
    address[] public receivers;
    uint MAX_PERCENTAGE_VALUE = 10000;
    uint8 MAX_RECEIVER_CONTRACTS = 20;
    uint8 MAX_RECEIVER_CONTRACTS_ALLOWED = 51;

    //Triggered When registering a new reward contract
    event RegisterReceiverEvent(address receiver, uint weightPercentage);
    //Triggered when a new reward weight contract is set
    event SetRewardWeightContractEvent(address receiver, uint oldValue, uint newValue);
    //Triggered when the receiver contract is activated/deactivated
    event UpdateReceiverStatusEvent(address receiver, bool oldValue, bool newValue);
    //Triggered when MAX_RECEIVER_CONTRACTS is updated
    event UpdateMaxReceiversEvent(uint8 oldValue, uint8 newValue);

    /**
        @notice register receiver to receive weight, weight (100%=10000, 40%=4000, 4%=400)
        @param receiver address
        @param weightPercentage uint
     */
    function register(address receiver, uint weightPercentage) external onlyOwner{
        require(receiver != address(0), "Must be greater than 0");
        uint currentWeightTotal = getTotalWeightPercentage();

        require(weightPercentage <= MAX_PERCENTAGE_VALUE - currentWeightTotal, "Total percentage must be less than 100%");
        require(receivers.length < MAX_RECEIVER_CONTRACTS, "Maximum number of receivers reached.");

        receivers.push(receiver);
        receiversInfo[receiver] = ReceiverPoolInfo(weightPercentage, true);

        emit RegisterReceiverEvent(receiver, weightPercentage);
    }

     /**
        @notice set the new value for MAX_RECEIVER_CONTRACTS
        @param newValue uint8
     */
    function updateMaxReceivers(uint8 newValue) external onlyOwner {
        require(newValue > 0,"Invalid max value.");
        require(newValue < MAX_RECEIVER_CONTRACTS_ALLOWED, "Maximum number of receivers reached.");

        
        uint8 oldValue = MAX_RECEIVER_CONTRACTS;
        MAX_RECEIVER_CONTRACTS = newValue;

        emit UpdateMaxReceiversEvent(oldValue, newValue);
    }
    
    function getTotalWeightPercentage() view internal returns (uint total) {
        //Prevent Gas Exhaustion
        uint8 totalReceivers = uint8((receivers.length > MAX_RECEIVER_CONTRACTS) ? MAX_RECEIVER_CONTRACTS : receivers.length);
        total = 0;

       for(uint i=0;i < totalReceivers; i++)  {
            ReceiverPoolInfo storage info = receiversInfo[address(receivers[i])];
           if (info.isActive) total += info.rewardWeightPercentage;
       }
    }

    /**
        @notice Update weight percentage for receiver contract (100%=10000, 40%=4000, 4%=400)
        @param receiver address
        @param weightPercentage uint
     */
    function setRewardWeight(address receiver, uint weightPercentage) external onlyOwner {
        require(weightPercentage > 0, "Must be greater than 0");
         uint currentWeightTotal = getTotalWeightPercentage();

        require(weightPercentage <= MAX_PERCENTAGE_VALUE - currentWeightTotal, "Total percentage must be less than 100%");

        uint oldValue = receiversInfo[receiver].rewardWeightPercentage;

        receiversInfo[receiver].rewardWeightPercentage = weightPercentage;

        emit SetRewardWeightContractEvent(receiver, oldValue, weightPercentage);
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

        bool oldValue = receiversInfo[receiver].isActive;
        receiversInfo[receiver].isActive = status;

        emit UpdateReceiverStatusEvent(receiver, oldValue, status);
    }
}
