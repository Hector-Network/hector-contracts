// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

interface IOwnable {
    function owner() external view returns (address);

    function renounceManagement(string memory confirm) external;

    function pushManagement(address newOwner_) external;

    function pullManagement() external;
}

contract Ownable is IOwnable {
    address internal _owner;
    address internal _newOwner;

    event OwnershipPushed(
        address indexed previousOwner,
        address indexed newOwner
    );
    event OwnershipPulled(
        address indexed previousOwner,
        address indexed newOwner
    );

    constructor() {
        _owner = msg.sender;
        emit OwnershipPulled(address(0), _owner);
    }

    function owner() public view override returns (address) {
        return _owner;
    }

    modifier onlyOwner() {
        require(_owner == msg.sender, 'Ownable: caller is not the owner');
        _;
    }

    function renounceManagement(string memory confirm)
        public
        virtual
        override
        onlyOwner
    {
        require(
            keccak256(abi.encodePacked(confirm)) ==
                keccak256(abi.encodePacked('confirm renounce')),
            "Ownable: renouce needs 'confirm renounce' as input"
        );
        emit OwnershipPushed(_owner, address(0));
        _owner = address(0);
        _newOwner = address(0);
    }

    function pushManagement(address newOwner_)
        public
        virtual
        override
        onlyOwner
    {
        require(
            newOwner_ != address(0),
            'Ownable: new owner is the zero address'
        );
        emit OwnershipPushed(_owner, newOwner_);
        _newOwner = newOwner_;
    }

    function pullManagement() public virtual override {
        require(msg.sender == _newOwner, 'Ownable: must be new owner to pull');
        emit OwnershipPulled(_owner, _newOwner);
        _owner = _newOwner;
    }
}

interface IVotingFarm {
    function getFarmsWeightPercentages()
        external
        view
        returns (address[] memory _farms, uint256[] memory _weightPercentages);
}

contract RewardWeight is Ownable {
    struct ReceiverPoolInfo {
        uint256 rewardWeightPercentage; //100%=10000, 40%=4000, 4%=400
        bool isActive;
    }

    mapping(address => ReceiverPoolInfo) public receiversInfo;
    address[] public receivers;
    uint256 MAX_PERCENTAGE_VALUE = 10000;
    uint8 MAX_RECEIVER_CONTRACTS = 20;
    uint8 MAX_RECEIVER_CONTRACTS_ALLOWED = 51;

    address public votingFarm;
    mapping(address => bool) public moderators; //moderators array

    //Triggered When registering a new reward contract
    event RegisterReceiverEvent(address receiver, uint256 weightPercentage);
    //Triggered when a new reward weight contract is set
    event SetRewardWeightContractEvent(
        address receiver,
        uint256 oldValue,
        uint256 newValue
    );
    //Triggered when the receiver contract is activated/deactivated
    event UpdateReceiverStatusEvent(
        address receiver,
        bool oldValue,
        bool newValue
    );
    //Triggered when MAX_RECEIVER_CONTRACTS is updated
    event UpdateMaxReceiversEvent(uint8 oldValue, uint8 newValue);

    /* ====== CONSTRUCTOR ====== */

    constructor(address _votingFarm) {
        require(_votingFarm != address(0));

        votingFarm = _votingFarm;
        moderators[msg.sender] = true;
    }

    /* ====== MODIFIER ====== */

    modifier onlyMod() {
        require(moderators[msg.sender], 'Non Moderator');
        _;
    }

    /* ====== POLICY FUNCTIONS ====== */

    /**
        @notice update voting farm
        @param _votingFarm address
     */
    function updateVotingFarm(address _votingFarm) external onlyOwner {
        require(_votingFarm != address(0), 'Invalid address');
        votingFarm = _votingFarm;
    }

    /**
        @notice add or remove moderator
        @param moderator address
        @param approved bool
     */
    function setModerator(address moderator, bool approved) external onlyOwner {
        require(moderator != address(0), 'Invalid address');
        moderators[moderator] = approved;
    }

    /**
        @notice register receiver to receive weight, weight (100%=10000, 40%=4000, 4%=400)
        @param receiver address
        @param weightPercentage uint
     */
    function register(address receiver, uint256 weightPercentage)
        external
        onlyOwner
    {
        require(receiver != address(0), 'Invalid receiver');
        require(weightPercentage > 0, 'Must be greater than 0');

        uint256 currentWeightTotal = getTotalWeightPercentage();
        require(
            weightPercentage <= MAX_PERCENTAGE_VALUE - currentWeightTotal,
            'Total percentage must be less than 100%'
        );
        require(
            receivers.length < MAX_RECEIVER_CONTRACTS,
            'Maximum number of receivers reached.'
        );

        receivers.push(receiver);
        receiversInfo[receiver] = ReceiverPoolInfo(weightPercentage, true);

        emit RegisterReceiverEvent(receiver, weightPercentage);
    }

    /**
        @notice set the new value for MAX_RECEIVER_CONTRACTS
        @param newValue uint8
     */
    function updateMaxReceivers(uint8 newValue) external onlyOwner {
        require(newValue > 0, 'Invalid max value.');
        require(
            newValue < MAX_RECEIVER_CONTRACTS_ALLOWED,
            'Maximum number of receivers reached.'
        );

        uint8 oldValue = MAX_RECEIVER_CONTRACTS;
        MAX_RECEIVER_CONTRACTS = newValue;

        emit UpdateMaxReceiversEvent(oldValue, newValue);
    }

    /* ====== MODERATOR FUNCTIONS ====== */

    /**
        @notice Update weight percentage for receiver contract (100%=10000, 40%=4000, 4%=400)
        @param receiver address
        @param weightPercentage uint
     */
    function updateRewardWeight(address receiver, uint256 weightPercentage)
        external
        onlyMod
    {
        require(receiver != address(0), 'Invalid receiver');
        require(weightPercentage > 0, 'Must be greater than 0');

        uint256 oldValue = receiversInfo[receiver].rewardWeightPercentage;
        receiversInfo[receiver].rewardWeightPercentage = weightPercentage;

        uint256 currentWeightTotal = getTotalWeightPercentage();
        require(
            currentWeightTotal <= MAX_PERCENTAGE_VALUE,
            'Total percentage must be less than 100%'
        );

        emit SetRewardWeightContractEvent(receiver, oldValue, weightPercentage);
    }

    /**
        @notice Update weight percentage for farms
     */
    function updateFarmsWeightPercentages() external onlyMod {
        (
            address[] memory _farms,
            uint256[] memory _weightPercentages
        ) = IVotingFarm(votingFarm).getFarmsWeightPercentages();
        updateRewardWeights(_farms, _weightPercentages);
    }

    /**
        @notice Update the active status of the receiver contract
        @param receiver address
        @param status bool
     */
    function updateReceiverStatus(address receiver, bool status)
        external
        onlyMod
    {
        require(receiver != address(0), 'Invalid receiver');

        bool oldValue = receiversInfo[receiver].isActive;
        receiversInfo[receiver].isActive = status;

        uint256 currentWeightTotal = getTotalWeightPercentage();
        require(
            currentWeightTotal <= MAX_PERCENTAGE_VALUE,
            'Total percentage must be less than 100%'
        );

        emit UpdateReceiverStatusEvent(receiver, oldValue, status);
    }

    /* ====== VIEW FUNCTIONS ====== */

    /**
        @notice Get weight percentage from a receiver contract (100%=10000, 40%=4000, 4%=400)
        @param receiver address
     */
    function getRewardWeight(address receiver)
        external
        view
        returns (uint256 weightPercentage)
    {
        require(receiver != address(0), 'Invalid receiver');

        if (receiversInfo[receiver].isActive)
            weightPercentage = receiversInfo[receiver].rewardWeightPercentage;
        else weightPercentage = 0;
    }

    /**
        @notice Get weight percentage from all receiver contracts (100%=10000, 40%=4000, 4%=400)
     */
    function getAllRewardWeights()
        external
        view
        returns (
            address[] memory receivers_,
            uint256[] memory weightPercentages_
        )
    {
        uint256 length = receivers.length;

        receivers_ = receivers;
        weightPercentages_ = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            address receiver = receivers[i];
            if (receiversInfo[receiver].isActive) {
                weightPercentages_[i] = receiversInfo[receiver]
                    .rewardWeightPercentage;
            } else {
                weightPercentages_[i] = 0;
            }
        }
    }

    /* ====== INTERNAL FUNCTIONS ====== */

    function getTotalWeightPercentage() internal view returns (uint256 total) {
        //Prevent Gas Exhaustion
        uint8 totalReceivers = uint8(
            (receivers.length > MAX_RECEIVER_CONTRACTS)
                ? MAX_RECEIVER_CONTRACTS
                : receivers.length
        );
        total = 0;

        for (uint256 i = 0; i < totalReceivers; i++) {
            ReceiverPoolInfo storage info = receiversInfo[
                address(receivers[i])
            ];
            if (info.isActive) total += info.rewardWeightPercentage;
        }
    }

    /**
        @notice Update weight percentage for receiver contracts (100%=10000, 40%=4000, 4%=400)
        @param _receivers address array
        @param _weightPercentages uint array
     */
    function updateRewardWeights(
        address[] memory _receivers,
        uint256[] memory _weightPercentages
    ) internal {
        uint256 length = _receivers.length;
        require(length == _weightPercentages.length, 'Length should match');

        for (uint256 i = 0; i < length; i++) {
            address receiver = _receivers[i];
            uint256 weightPercentage = _weightPercentages[i];

            require(receiver != address(0), 'Invalid receiver');
            require(weightPercentage > 0, 'Must be greater than 0');

            receiversInfo[receiver].rewardWeightPercentage = weightPercentage;
        }

        uint256 currentWeightTotal = getTotalWeightPercentage();
        require(
            currentWeightTotal <= MAX_PERCENTAGE_VALUE,
            'Total percentage must be less than 100%'
        );
    }
}
