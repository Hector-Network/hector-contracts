// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';

interface LockFarm {
    function fnfts(uint256)
        external
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256
        );
    
    function pendingReward(uint256 fnftId) external view returns(uint256 reward);
}

interface FNFT {
    function balanceOf(address) external view returns (uint256);

    function tokenOfOwnerByIndex(address, uint256)
        external
        view
        returns (uint256);
}

contract VotingFarm is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IERC20 public HEC; // HEC

    address public admin; //Admin address to manage farms like add/deprecate/resurrect

    uint256 public totalWeight; // total weights of the farms
    uint256 public maxPercentage = 100; // max percentage for each farm

    // Time delays
    uint256 public voteDelay = 604800; // Production Mode
    mapping(address => uint256) public lastVote; // msg.sender => time of users last vote

    mapping(LockFarm => uint256) public farmWeights; // farm => weight

    LockFarm[] internal farms;
    mapping(LockFarm => bool) public farmStatus; // farm => bool : false = deprecated

    mapping(address => mapping(LockFarm => uint256)) public votes; // msg.sender => votes
    mapping(address => LockFarm[]) public farmVote; // msg.sender => farms
    mapping(LockFarm => FNFT) public fnft; // farm => fnft
    mapping(address => uint256) public usedWeights; // msg.sender => total voting weights of user

    // Modifiers
    modifier hasVoted(address voter) {
        uint256 time = block.timestamp - lastVote[voter];
        require(time > voteDelay, 'You voted in the last 7 days');
        uint256 userWeight = getWeightByUser(msg.sender);
        require(userWeight > 0, 'Your HEC balanace is zero');
        _;
    }

    constructor(
        address _hec
    ) {
        HEC = IERC20(_hec);
        admin = msg.sender;
    }

    function getFarms() public view returns (LockFarm[] memory) {
        LockFarm[] memory tempFarms = new LockFarm[](farms.length);
        for (uint256 i = 0; i < farms.length; i++) {
            if (farmStatus[farms[i]]) tempFarms[i] = farms[i];
        }
        return tempFarms;
    }

    function getFarmsByIndex(uint256 index) public view returns (LockFarm) {
        LockFarm[] memory tempFarms = new LockFarm[](farms.length);
        for (uint256 i = 0; i < farms.length; i++) {
            if (farmStatus[farms[i]]) tempFarms[i] = farms[i];
        }
        return tempFarms[index];
    }

    function getFarmsLength() public view returns (uint256) {
        LockFarm[] memory _farms = getFarms();
        return _farms.length;
    }

    // Reset votes to 0
    function reset() external {
        _reset(msg.sender);
    }

    // Reset votes to 0
    function _reset(address _owner) internal {
        LockFarm[] storage _farmVote = farmVote[_owner];
        uint256 _farmVoteCnt = _farmVote.length;

        for (uint256 i = 0; i < _farmVoteCnt; i++) {
            LockFarm _farm = _farmVote[i];
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
    function validFarms(LockFarm[] memory _farms) internal view returns (bool) {
        bool flag = true;
        LockFarm prevFarm = _farms[0];

        // Check new inputted address is already existed on Voting farms array
        for (uint256 i = 1; i < _farms.length; i++) {
            if (prevFarm == _farms[i]) {
                flag = false;
                break;
            }
            prevFarm = _farms[i];
        }

        // Check Farms Status
        for (uint256 i = 0; i < _farms.length; i++) {
            if (!farmStatus[_farms[i]]) {
                flag = false;
                break;
            }
        }

        return flag;
    }


    // Check farm is already existed when admin added
    function validFarm(LockFarm _farm) internal view returns (bool) {
        bool flag = true;
        LockFarm[] memory _farms = getFarms();

        // Check new inputted address is already existed on Voting farms array
        for (uint256 i = 0; i < _farms.length; i++) {
            if (_farm == _farms[i]) {
                flag = false;
                break;
            }
        }
        return flag;
    }

    // Verify farm's percentage is valid
    function validPercentageForFarms(uint256[] memory _weights)
        internal
        view
        returns (bool)
    {
        bool flag = true;
        for (uint256 i = 0; i < _weights.length; i++) {
            if (_weights[i] > maxPercentage) {
                flag = false;
                break;
            }
        }
        return flag;
    }

    function _vote(
        address _owner,
        LockFarm[] memory _farmVote,
        uint256[] memory _weights
    ) internal {
        uint256 _farmCnt = _farmVote.length;
        uint256 _weight = getWeightByUser(_owner);
        uint256 _totalVoteWeight = 0;
        uint256 _usedWeight = 0;

        for (uint256 i = 0; i < _farmCnt; i++) {
            _totalVoteWeight = _totalVoteWeight.add(_weights[i]);
        }
        require(
            _totalVoteWeight == 100,
            'Weights total percentage is not 100%'
        );
        _reset(_owner);
        

        for (uint256 i = 0; i < _farmCnt; i++) {
            LockFarm _farm = _farmVote[i];
            uint256 _farmWeight = _weights[i].mul(_weight).div(
                _totalVoteWeight
            );

            _usedWeight = _usedWeight.add(_farmWeight);
            totalWeight = totalWeight.add(_farmWeight);
            farmWeights[_farm] = farmWeights[_farm].add(_farmWeight);
            farmVote[_owner].push(_farm);
            votes[_owner][_farm] = _farmWeight;
        }

        usedWeights[_owner] = _usedWeight;
        lastVote[msg.sender] = block.timestamp;
        emit FarmVoted(_owner);
    }

    // Can vote by owner
    function canVote(address owner) public view returns (bool) {
        // Check Farm is existed
        if(getFarmsLength() == 0) return false;

        uint256 time = block.timestamp - lastVote[owner];
        uint256 userWeight = getWeightByUser(owner);
        if (userWeight > 0 && time > voteDelay) return true;
        else return false;
    }

    function getWeightByUser(address owner) public view returns (uint256) {
        uint256 hecBalance = HEC.balanceOf(owner);
        uint256 hecAmountByFNFT = 0;
        uint256 totalWeightByUser = 0;

        for(uint256 i = 0; i < getFarmsLength(); i++) {
            LockFarm _lockFarm = getFarmsByIndex(i);
            FNFT fNFT = fnft[_lockFarm];
            uint256 fnftBalance = fNFT.balanceOf(owner);
            // Get All Balance By user both of HEC and FNFT
            for (uint256 j = 0; j < fnftBalance; j++) {
                uint256 tokenOfOwnerByIndex = fNFT.tokenOfOwnerByIndex(owner, j);
                (, uint256 _hecAmount, , , , , ) = _lockFarm.fnfts(
                    tokenOfOwnerByIndex
                );
                hecAmountByFNFT += _hecAmount;
            }
        }

        totalWeightByUser = hecBalance.add(hecAmountByFNFT);

        return totalWeightByUser;
    }

    // Get each farm's weights percentage
    function getFarmsWeights() external view returns (uint256[] memory) {
        LockFarm[] memory _validFarms = getFarms();
        uint256[] memory _validFarmsWeights = new uint256[](_validFarms.length);
        for (uint256 i = 0; i < _validFarms.length; i++) {
            _validFarmsWeights[i] = farmWeights[_validFarms[i]];
        }
        return _validFarmsWeights;
    }

    // Get current locked Hec balance for each user
    function getCurrentLockedHEC(address owner) external view returns (uint256) {
        uint256 hecAmountByFNFT = 0;

        for(uint256 i = 0; i < getFarmsLength(); i++) {
            LockFarm _lockFarm = getFarmsByIndex(i);
            FNFT fNFT = fnft[_lockFarm];
            uint256 fnftBalance = fNFT.balanceOf(owner);
            // Get All Balance By user both of HEC and FNFT
            for (uint256 j = 0; j < fnftBalance; j++) {
                uint256 tokenOfOwnerByIndex = fNFT.tokenOfOwnerByIndex(owner, j);
                (, uint256 _hecAmount, , , , , ) = _lockFarm.fnfts(
                    tokenOfOwnerByIndex
                );
                hecAmountByFNFT += _hecAmount;
            }
        }

        return hecAmountByFNFT;
    }

    // Get current claimable balance for each user
    function getClaimableHEC(address owner) external view returns (uint256) {
        uint256 totalPendingReward = 0;

        for(uint256 i = 0; i < getFarmsLength(); i++) {
            LockFarm _lockFarm = getFarmsByIndex(i);
            FNFT fNFT = fnft[_lockFarm];
            uint256 fnftBalance = fNFT.balanceOf(owner);
            // Get All Balance By user both of HEC and FNFT
            for (uint256 j = 0; j < fnftBalance; j++) {
                uint256 tokenOfOwnerByIndex = fNFT.tokenOfOwnerByIndex(owner, j);
                uint256 pendingReward = _lockFarm.pendingReward(tokenOfOwnerByIndex);
                totalPendingReward += pendingReward;
            }
        }

        return totalPendingReward;
    }

    // Vote with HEC on a farm
    function vote(LockFarm[] calldata _farmVote, uint256[] calldata _weights)
        external
        hasVoted(msg.sender)
    {
        require(
            _farmVote.length == _weights.length,
            'Farms and Weights length size are difference'
        );
        require(_farmVote.length == getFarmsLength(), 'Invalid Farms length');
        require(validFarms(_farmVote), 'Invalid Farms');
        require(
            validPercentageForFarms(_weights),
            'One of Weights exceeded max limit'
        );

        _vote(msg.sender, _farmVote, _weights);
    }

    function setAdmin(address _admin) external {
        require(msg.sender == admin, '!admin');
        admin = _admin;
        emit SetAdmin(admin, _admin);
    }

    // Add new lock farm
    function addLockFarmForOwner(LockFarm _lockFarm, FNFT _fnft) external returns (LockFarm) {
        require(msg.sender == admin, '!admin');
        require(validFarm(_lockFarm), 'Already existed farm');

        farms.push(_lockFarm);
        farmStatus[_lockFarm] = true;
        fnft[_lockFarm] = _fnft;

        emit FarmAddedByOwner(_lockFarm);
        return _lockFarm;
    }

    // Deprecate existing farm
    function deprecateFarm(LockFarm _farm) external {
        require((msg.sender == admin), '!admin');
        require(farmStatus[_farm], 'farm is not active');
        farmStatus[_farm] = false;
        emit FarmDeprecated(_farm);
    }

    // Bring Deprecated farm back into use
    function resurrectFarm(LockFarm _farm) external {
        require((msg.sender == admin), '!admin');
        require(!farmStatus[_farm], 'farm is active');
        farmStatus[_farm] = true;
        emit FarmResurrected(_farm);
    }

    // Set configuration
    function setConfiguration(
        address _hec
    ) external {
        require((msg.sender == admin), '!admin');
        HEC = IERC20(_hec);
        emit SetConfiguration(msg.sender);
    }

    // Set max percentage of the farm
    function setMaxPercentageFarm(uint256 _percentage) external {
        require((msg.sender == admin), '!admin');
        maxPercentage = _percentage;
        emit SetMaxPercentageFarm(_percentage, msg.sender);
    }

    // Set Vote Delay
    function setVoteDelay(uint256 _voteDelay) external {
        require((msg.sender == admin), '!admin');
        voteDelay = _voteDelay;
        emit SetVoteDelay(_voteDelay, admin);
    }

    event FarmVoted(address owner);
    event FarmAddedByOwner(LockFarm farm);
    event FarmDeprecated(LockFarm farm);
    event FarmResurrected(LockFarm farm);
    event SetConfiguration(address admin);
    event SetMaxPercentageFarm(uint256 percentage, address admin);
    event SetVoteDelay(uint256 voteDelay, address admin);
    event SetAdmin(address oldAdmin, address newAdmin);
}
