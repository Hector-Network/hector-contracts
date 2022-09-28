// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';

interface LockFarm {
    function fnfts(uint256) external view returns (uint, uint, uint, uint, uint, uint, uint);
}

interface FNFT {
    function balanceOf(address) external view returns (uint);
    function tokenOfOwnerByIndex(address, uint256) external view returns (uint);
}

contract VotingFarm is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IERC20 public HEC;
    FNFT public fNFT;
    LockFarm public lockFarm;

    address public admin; //Admin address to manage farms like add/deprecate/resurrect

    uint256 public totalWeight;

    // Time delays
    uint256 public voteDelay = 10; // test mode
    uint256 public distributeDelay = 10; // test mode

    // uint256 public voteDelay = 604800; // Production Mode
    // uint256 public distributeDelay = 604800;// Production Mode
    uint256 public lastDistribute;
    mapping(address => uint256) public lastVote; // msg.sender => time of users last vote

    uint256 public lockedTotalWeight;
    uint256 public lockedBalance;
    mapping(address => uint256) public farmWeights; // farm => weight
    mapping(address => bool) public hasDistributed; // farm => bool

    address[] internal farms;
    mapping(address => bool) public farmStatus; // farm => bool : false = deprecated

    mapping(address => mapping(address => uint256)) public votes; // msg.sender => votes
    mapping(address => address[]) public farmVote; // msg.sender => farms
    mapping(address => uint256) public usedWeights; // msg.sender => total voting weights of user

    // Modifiers
    modifier hasVoted(address voter) {
        uint256 time = block.timestamp - lastVote[voter];
        require(time > voteDelay, "You voted in the last 7 days");
        uint256 userWeight = getWeightByUser(msg.sender);
        require(userWeight > 0, "Your HEC balanace is zero");
        _;
    }

    modifier hasDistribute() {
        uint256 time = block.timestamp - lastDistribute;
        require(
            time > distributeDelay,
            "this has been distributed in the last 7 days"
        );
        _;
    }

    constructor(
        address _fnft,
        address _hec,
        address _lockFarm
    ) {
        fNFT = FNFT(_fnft);
        HEC = IERC20(_hec);
        admin = msg.sender;
        lockFarm = LockFarm(_lockFarm);
    }
    
    function getFarms() public view returns (address[] memory) {
        address[] memory tempFarms = new address[](farms.length);
        for(uint i=0; i < farms.length; i++) {
            if(farmStatus[farms[i]])
                tempFarms[i] = farms[i];
        }
        return tempFarms;
    }

    function getFarmsLength() public view returns (uint256) {
        address[] memory _farms = getFarms();
        return _farms.length;
    }

    // Reset votes to 0
    function reset() external {
        _reset(msg.sender);
    }

    // Reset votes to 0
    function _reset(address _owner) internal {
        address[] storage _farmVote = farmVote[_owner];
        uint256 _farmVoteCnt = _farmVote.length;

        for (uint256 i = 0; i < _farmVoteCnt; i++) {
            address _farm = _farmVote[i];
            uint256 _votes = votes[_owner][_farm];

            if (_votes > 0) {
                totalWeight = totalWeight - _votes;
                farmWeights[_farm] = farmWeights[_farm] - _votes;
                votes[_owner][_farm] = 0;
            }
        }

        delete farmVote[_owner];
    }

    // Verify farms array is valid
    function verifyFarms(address[] memory _farms) internal view returns(bool){
        bool flag = true;
        for(uint i=0; i < _farms.length; i++) {
            if(!farmStatus[_farms[i]]){
                flag = false;
                break;
            }
        }
        return flag;
    }

    // Adjusts _owner's votes according to latest _owner's HEC balance
    function revote(address _owner) public {
        address[] memory _farmVote = farmVote[_owner];
        uint256 _farmCnt = _farmVote.length;
        uint256[] memory _weights = new uint256[](_farmCnt);
        uint256 _prevUsedWeight = usedWeights[_owner];
        uint256 _weight = getWeightByUser(_owner);

        for (uint256 i = 0; i < _farmCnt; i++) {
            // other addresses to stop them from gaming the system with outdated votes that dont lose voting power
            uint256 _prevWeight = votes[_owner][_farmVote[i]];
            _weights[i] = _prevWeight * _weight / _prevUsedWeight;
        }

        _vote(_owner, _farmVote, _weights);
    }

    function _vote(
        address _owner,
        address[] memory _farmVote,
        uint256[] memory _weights
    ) internal {
        require(verifyFarms(_farmVote) && _farmVote.length == getFarmsLength(), "Invalid Farms");
        uint256 _farmCnt = _farmVote.length;
        uint256 _weight = getWeightByUser(_owner);
        uint256 _totalVoteWeight = 0;
        uint256 _usedWeight = 0;

        for (uint256 i = 0; i < _farmCnt; i++) {
            _totalVoteWeight = _totalVoteWeight.add(_weights[i]);
        }
        require(_totalVoteWeight == 100, "Invalid percentage");
        _reset(_owner);

        for (uint256 i = 0; i < _farmCnt; i++) {
            address _farm = _farmVote[i];
            uint256 _farmWeight = _weights[i].mul(_weight).div( _totalVoteWeight);

            _usedWeight = _usedWeight.add(_farmWeight);
            totalWeight = totalWeight.add(_farmWeight);
            farmWeights[_farm] = farmWeights[_farm].add(_farmWeight);
            farmVote[_owner].push(_farm);
            votes[_owner][_farm] = _farmWeight;
        }

        usedWeights[_owner] = _usedWeight;
        emit FarmVoted(_owner);
    }

    // Can vote by owner
    function canVote() public view returns(bool) {
        uint256 time = block.timestamp - lastVote[msg.sender];
        uint256 userWeight = getWeightByUser(msg.sender);
        if(userWeight > 0 && time > voteDelay)
            return true;
        else 
            return false;
    }

    function getWeightByUser(address owner) public view returns(uint256) {
        uint256 hecBalance = HEC.balanceOf(owner);
        uint256 fnftBalance = fNFT.balanceOf(owner);
        uint256 hecAmountByFNFT = 0;
        uint256 totalWeightByUser = 0;

        // Get All Balance By user both of HEC and FNFT
        for(uint i = 0; i < fnftBalance; i++) {
            uint256 tokenOfOwnerByIndex = fNFT.tokenOfOwnerByIndex(owner, i);
            ( , uint256 _hecAmount, , , , , ) = lockFarm.fnfts(tokenOfOwnerByIndex);
            hecAmountByFNFT += _hecAmount;
        }

        totalWeightByUser = hecBalance.add(hecAmountByFNFT);

        return totalWeightByUser;
    }

    // Get each farm's weights percentage 
    function getFarmsWeights() external view returns(uint256[] memory){
        address[] memory _validFarms = getFarms();
        uint256[] memory _validFarmsWeights = new uint256[](_validFarms.length);
        for(uint i=0; i < _validFarms.length; i++) {
            _validFarmsWeights[i] = farmWeights[_validFarms[i]];
        }
        return _validFarmsWeights;
    }

    // Vote with HEC on a farm
    function vote(address[] calldata _farmVote, uint256[] calldata _weights)
        external
        hasVoted(msg.sender)
    {
        require(_farmVote.length == _weights.length);
        lastVote[msg.sender] = block.timestamp;
        _vote(msg.sender, _farmVote, _weights);
    }

    function setAdmin(address _admin) external {
        require(msg.sender == admin, "!admin");
        admin = _admin;
    }

    // Add new farm
    function addFarmForOwner(address _farm)
        external
        returns (address)
    {
        require(
            (msg.sender == admin),
            "!admin"
        );
        farms.push(_farm);
        farmStatus[_farm] = true;

        emit FarmAddedByOwner(_farm);
        return _farm;
    }

    // Deprecate existing farm
    function deprecateFarm(address _farm) external {
        require(
            (msg.sender == admin),
            "!admin"
        );
        require(farmStatus[_farm], "farm is not active");
        farmStatus[_farm] = false;
        emit FarmDeprecated(_farm);
    }

    // Bring Deprecated farm back into use
    function resurrectFarm(address _farm) external {
        require(
            (msg.sender == admin),
            "!admin"
        );
        require(!farmStatus[_farm], "farm is active");
        farmStatus[_farm] = true;
        emit FarmResurrected(_farm);
    }

    function length() external view returns (uint256) {
        return farms.length;
    }

    function preDistribute() external nonReentrant hasDistribute {
        lockedTotalWeight = totalWeight;
        for (uint256 i = 0; i < farms.length; i++) {
            hasDistributed[farms[i]] = false;
        }
        lastDistribute = block.timestamp;
        uint256 _balance = HEC.balanceOf(address(this));
        lockedBalance = _balance;
        uint256 _hecRewards = 0;
        
        emit PreDistributed(_hecRewards);
    }

    function distribute(uint256 _start, uint256 _end) external nonReentrant {
        require(_start < _end, "bad _start");
        require(_end <= farms.length, "bad _end");

        if (lockedBalance > 0 && lockedTotalWeight > 0) {
            for (uint256 i = _start; i < _end; i++) {
                address _farm = farms[i];
                if (!hasDistributed[_farm] && farmStatus[_farm]) {
                    uint256 _reward = lockedBalance * farmWeights[_farm] / lockedTotalWeight;
                    if (_reward > 0) {
                        // HEC.safeApprove(_farm, 0);
                        // HEC.safeApprove(_farm, _reward);
                        // Farm(_farm).notifyRewardAmount(_reward);
                    }
                    hasDistributed[_farm] = true;
                }
            }
        }
    }

    event FarmVoted(address owner);
    event FarmAddedByOwner(address farm);
    event FarmDeprecated(address farm);
    event FarmResurrected(address farm);
    event PreDistributed(uint256 spiritRewards);
}