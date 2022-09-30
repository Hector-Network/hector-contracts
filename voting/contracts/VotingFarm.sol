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
}

interface FNFT {
    function balanceOf(address) external view returns (uint256);

    function tokenOfOwnerByIndex(address, uint256)
        external
        view
        returns (uint256);
}

interface SpookyLP {
    function name() external view returns (string memory);

    function symbol() external view returns (string memory);

    function token0() external view returns (address token0);

    function token1() external view returns (address token1);
}

contract VotingFarm is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IERC20 public HEC; // HEC
    FNFT public fNFT; // FNFT
    LockFarm public lockFarm; // LockFarm

    address public admin; //Admin address to manage farms like add/deprecate/resurrect

    uint256 public totalWeight; // total weights of the farms
    uint256 public maxPercentage = 80; // max percentage for each farm

    // Time delays
    uint256 public voteDelay = 604800; // Production Mode
    mapping(address => uint256) public lastVote; // msg.sender => time of users last vote

    mapping(address => uint256) public farmWeights; // farm => weight

    address[] internal farms;
    mapping(address => bool) public farmStatus; // farm => bool : false = deprecated

    mapping(address => mapping(address => uint256)) public votes; // msg.sender => votes
    mapping(address => address[]) public farmVote; // msg.sender => farms
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
        for (uint256 i = 0; i < farms.length; i++) {
            if (farmStatus[farms[i]]) tempFarms[i] = farms[i];
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
    function validFarms(address[] memory _farms) internal view returns (bool) {
        bool flag = true;
        address prevFarm = _farms[0];

        // Compare inputted farms to old farms
        if (_farms.length == getFarmsLength()) flag = false;

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
    function validFarm(address _farm) internal view returns (bool) {
        bool flag = true;
        address[] memory _farms = getFarms();

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
            _weights[i] = (_prevWeight * _weight) / _prevUsedWeight;
        }

        _vote(_owner, _farmVote, _weights);
    }

    function _vote(
        address _owner,
        address[] memory _farmVote,
        uint256[] memory _weights
    ) internal {
        require(validFarms(_farmVote), 'Invalid Farms');
        require(validPercentageForFarms(_weights), 'Invalid weights');

        uint256 _farmCnt = _farmVote.length;
        uint256 _weight = getWeightByUser(_owner);
        uint256 _totalVoteWeight = 0;
        uint256 _usedWeight = 0;

        for (uint256 i = 0; i < _farmCnt; i++) {
            _totalVoteWeight = _totalVoteWeight.add(_weights[i]);
        }
        require(_totalVoteWeight == 100, 'Invalid percentage');
        _reset(_owner);

        for (uint256 i = 0; i < _farmCnt; i++) {
            address _farm = _farmVote[i];
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
        emit FarmVoted(_owner);
    }

    // Can vote by owner
    function canVote() public view returns (bool) {
        uint256 time = block.timestamp - lastVote[msg.sender];
        uint256 userWeight = getWeightByUser(msg.sender);
        if (userWeight > 0 && time > voteDelay) return true;
        else return false;
    }

    function getWeightByUser(address owner) public view returns (uint256) {
        uint256 hecBalance = HEC.balanceOf(owner);
        uint256 fnftBalance = fNFT.balanceOf(owner);
        uint256 hecAmountByFNFT = 0;
        uint256 totalWeightByUser = 0;

        // Get All Balance By user both of HEC and FNFT
        for (uint256 i = 0; i < fnftBalance; i++) {
            uint256 tokenOfOwnerByIndex = fNFT.tokenOfOwnerByIndex(owner, i);
            (, uint256 _hecAmount, , , , , ) = lockFarm.fnfts(
                tokenOfOwnerByIndex
            );
            hecAmountByFNFT += _hecAmount;
        }

        totalWeightByUser = hecBalance.add(hecAmountByFNFT);

        return totalWeightByUser;
    }

    // Get each farm's weights percentage
    function getFarmsWeights() external view returns (uint256[] memory) {
        address[] memory _validFarms = getFarms();
        uint256[] memory _validFarmsWeights = new uint256[](_validFarms.length);
        for (uint256 i = 0; i < _validFarms.length; i++) {
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
        require(msg.sender == admin, '!admin');
        admin = _admin;
        emit SetAdmin(admin, _admin);
    }

    // Verify the LP token
    function verifyFarm(address _farm) internal view returns (bool) {
        SpookyLP _spookyLP = SpookyLP(_farm);
        if (
            _spookyLP.token0() != address(0) && _spookyLP.token1() != address(0)
        ) return true;
        else return false;
    }

    // Add new farm
    function addFarmForOwner(address _farm) external returns (address) {
        require((msg.sender == admin), '!admin');
        require(verifyFarm(_farm), 'Invalid farm added');
        require(validFarm(_farm), 'Already existed farm');

        farms.push(_farm);
        farmStatus[_farm] = true;

        emit FarmAddedByOwner(_farm);
        return _farm;
    }

    // Deprecate existing farm
    function deprecateFarm(address _farm) external {
        require((msg.sender == admin), '!admin');
        require(farmStatus[_farm], 'farm is not active');
        farmStatus[_farm] = false;
        emit FarmDeprecated(_farm);
    }

    // Bring Deprecated farm back into use
    function resurrectFarm(address _farm) external {
        require((msg.sender == admin), '!admin');
        require(!farmStatus[_farm], 'farm is active');
        farmStatus[_farm] = true;
        emit FarmResurrected(_farm);
    }

    // Length of Farms
    function length() external view returns (uint256) {
        return farms.length;
    }

    // Set configuration
    function setConfiguration(
        address _fnft,
        address _hec,
        address _lockFarm
    ) external {
        require((msg.sender == admin), '!admin');
        fNFT = FNFT(_fnft);
        HEC = IERC20(_hec);
        lockFarm = LockFarm(_lockFarm);
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
    event FarmAddedByOwner(address farm);
    event FarmDeprecated(address farm);
    event FarmResurrected(address farm);
    event SetConfiguration(address admin);
    event SetMaxPercentageFarm(uint256 percentage, address admin);
    event SetVoteDelay(uint256 voteDelay, address admin);
    event SetAdmin(address oldAdmin, address newAdmin);
}
