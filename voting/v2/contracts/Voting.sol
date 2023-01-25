// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol';
import './interface/IVoting.sol';

/** HECTOR VOTING CONTRACT **/
contract Voting is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
	using SafeMathUpgradeable for uint256;
	using SafeERC20Upgradeable for IERC20Upgradeable;

	string public version;
	IERC20Upgradeable public HEC; // HEC
	IERC20Upgradeable internal sHEC; // sHEC
	wsHEC internal wsHec; // wsHEC
	TokenVault internal tokenVault;

	struct FarmInfo {
		address voter;
		LockFarm _lockFarm;
		uint256 _farmWeight;
		uint256 time;
	}

	uint256 public totalWeight; // Total weights of the farms
	uint256 public maxPercentage; // Max percentage for each farm
	uint256 public voteDelay; // Production Mode
	uint256 public totalFarmVoteCount; // Total farm voted count

	mapping(LockFarm => uint256) public farmWeights; // Return farm weights
	LockFarm[] public farms; // Farms array
	mapping(LockFarm => bool) public farmStatus; // Return status of the farm
	mapping(LockFarm => FNFT) public fnft; // Return FNFT for each LockFarm
	mapping(LockFarm => IERC20Upgradeable) public stakingToken; // Return staking token for eack LockFarm
	mapping(address => string) public stakingTokenSymbol; // Return symbol for staking token
	mapping(IERC20Upgradeable => LockFarm) public lockFarmByERC20; // Return staking token for each LockFarm
	mapping(LockFarm => LockAddressRegistry) public lockAddressRegistry; // Return LockAddressRegistry by LockFarm
	mapping(FNFT => bool) public canVoteByFNFT; // Return status of user can vote by FNFT
	mapping(FNFT => mapping(uint256 => uint256)) public lastVotedByFNFT; // Return last time of voted FNFT
	mapping(uint256 => FarmInfo) public farmInfos;
	mapping(address => mapping(LockFarm => uint256)) public userWeight; // Return user's voting weigths by lockfarm
	mapping(address => uint256) public totalUserWeight; // Return total user's voting weigths
	mapping(address => bool) public lpTokens; // Return status of the lpToken
	uint256 public voteResetIndex;
	uint256 public lastTimeByOwner;

	// Modifiers
	modifier hasVoted(
		address voter,
		FNFT _fnft,
		uint256[] memory fnftIds
	) {
		bool flag = true;
		for (uint256 i = 0; i < getFarmsLength(); i++) {
			LockFarm _lockFarm = getFarmsByIndex(i);
			if (address(_fnft) != address(0) && address(_lockFarm) != address(0) && fnftIds.length > 0) {
				for (uint256 j = 0; j < fnftIds.length; j++) {
					require(_fnft.ownerOf(fnftIds[j]) == voter, 'FNFT: Invalid owner');
					uint256 lastVoted = lastVotedByFNFT[_fnft][fnftIds[j]]; // time of the last voted
					uint256 time = block.timestamp - lastVoted;
					if (time < voteDelay) {
						flag = false;
						break;
					}
				}
			}
		}
		require(flag, 'You voted in the last voted period days');
		_;
	}

	/**
	 * @dev sets initials
	 */
	function initialize(
		string memory _version,
		address _hec,
		address _sHec,
		address _wsHec,
		TokenVault _tokenVault,
		uint256 _maxPercentage,
		uint256 _voteDelay
	) public initializer {
		version = _version;
		HEC = IERC20Upgradeable(_hec);
		sHEC = IERC20Upgradeable(_sHec);
		wsHec = wsHEC(_wsHec);
		tokenVault = _tokenVault;
		maxPercentage = _maxPercentage;
		voteDelay = _voteDelay;
		__Context_init_unchained();
		__Ownable_init_unchained();
		__ReentrancyGuard_init_unchained();
	}

	// Return the farms list
	function getFarms() public view returns (LockFarm[] memory) {
		LockFarm[] memory tempFarms = new LockFarm[](farms.length);
		for (uint256 i = 0; i < farms.length; i++) {
			if (farmStatus[farms[i]]) tempFarms[i] = farms[i];
		}
		return tempFarms;
	}

	// Return the farm by index
	function getFarmsByIndex(uint256 index) internal view returns (LockFarm) {
		LockFarm[] memory tempFarms = new LockFarm[](farms.length);
		for (uint256 i = 0; i < farms.length; i++) {
			if (farmStatus[farms[i]]) tempFarms[i] = farms[i];
		}
		return tempFarms[index];
	}

	// Return farms length
	function getFarmsLength() public view returns (uint256) {
		LockFarm[] memory _farms = getFarms();
		return _farms.length;
	}

	// Reset every new tern if thers are some old voting history
	function reset() internal {
		if (totalFarmVoteCount > 0) {
			uint256 lastIndex = voteResetIndex;
			uint256 resetedWeights;
			for (uint256 i = voteResetIndex; i < totalFarmVoteCount; i++) {
				uint256 time = block.timestamp - farmInfos[i].time;
				if (time > voteDelay) {
					LockFarm _farm = farmInfos[i]._lockFarm;
					uint256 _votes = farmInfos[i]._farmWeight;
					address _voter = farmInfos[i].voter;
					totalWeight = totalWeight - _votes;
					farmWeights[_farm] = farmWeights[_farm] - _votes;
					userWeight[_voter][_farm] = userWeight[_voter][_farm] - _votes;
					totalUserWeight[_voter] = totalUserWeight[_voter] - _votes;
					lastIndex = i + 1;
					resetedWeights += _votes;
				}
			}

			if (voteResetIndex != lastIndex) voteResetIndex = lastIndex;

			emit Reset(voteResetIndex, resetedWeights);
		}
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
	function validPercentageForFarms(uint256[] memory _weights) internal view returns (bool) {
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
		uint256[] memory _weights,
		FNFT _fnft,
		uint256[] memory _fnftIds
	) internal {
		uint256 _weight = getWeightByUser(_fnft, _fnftIds);
		uint256 _totalVotePercentage = 0;

		for (uint256 i = 0; i < _farmVote.length; i++) {
			_totalVotePercentage = _totalVotePercentage.add(_weights[i]);
		}
		require(_totalVotePercentage == 100, 'Weights total percentage is not 100%');

		// Reset every term for old data
		reset();

		for (uint256 i = 0; i < _farmVote.length; i++) {
			LockFarm _farm = _farmVote[i];
			uint256 _farmWeight = _weights[i].mul(_weight).div(_totalVotePercentage);
			totalWeight = totalWeight.add(_farmWeight);
			farmWeights[_farm] = farmWeights[_farm].add(_farmWeight);
			userWeight[_owner][_farm] = userWeight[_owner][_farm] + _farmWeight;
			totalUserWeight[_owner] = totalUserWeight[_owner] + _farmWeight;

			// Store all voting infos
			if (_farmWeight != 0) {
				farmInfos[totalFarmVoteCount] = FarmInfo(_owner, _farm, _farmWeight, block.timestamp);
				totalFarmVoteCount++;
			}
		}

		for (uint256 j = 0; j < _fnftIds.length; j++) {
			lastVotedByFNFT[_fnft][_fnftIds[j]] = block.timestamp;
		}

		emit FarmVoted(_owner);
	}

	function _voteByTime(
		address _owner,
		LockFarm[] memory _farmVote,
		uint256[] memory _weights,
		FNFT _fnft,
		uint256[] memory _fnftIds,
		uint256 time
	) internal {
		uint256 _weight = getWeightByUser(_fnft, _fnftIds);
		uint256 _totalVotePercentage = 0;

		for (uint256 i = 0; i < _farmVote.length; i++) {
			_totalVotePercentage = _totalVotePercentage.add(_weights[i]);
		}
		require(_totalVotePercentage == 100, 'Weights total percentage is not 100%');

		// Reset every term for old data
		reset();

		for (uint256 i = 0; i < _farmVote.length; i++) {
			LockFarm _farm = _farmVote[i];
			uint256 _farmWeight = _weights[i].mul(_weight).div(_totalVotePercentage);
			totalWeight = totalWeight.add(_farmWeight);
			farmWeights[_farm] = farmWeights[_farm].add(_farmWeight);
			userWeight[_owner][_farm] = userWeight[_owner][_farm] + _farmWeight;
			totalUserWeight[_owner] = totalUserWeight[_owner] + _farmWeight;

			if (_farmWeight != 0) {
				// Store all voting infos
				farmInfos[totalFarmVoteCount] = FarmInfo(_owner, _farm, _farmWeight, time);
				totalFarmVoteCount++;
			}
		}

		for (uint256 j = 0; j < _fnftIds.length; j++) {
			lastVotedByFNFT[_fnft][_fnftIds[j]] = time;
		}

		emit FarmVoted(_owner);
	}

	// Can vote by owner
	function canVote(address owner) public view returns (bool) {
		// Check Farm is existed
		if (getFarmsLength() == 0) return false;
		// Check status by user
		bool _checkBalanceFNFT = checkBalanceFNFT(owner);

		if (!_checkBalanceFNFT) return false;
		else if (_checkBalanceFNFT) {
			bool _checkVotedFNFT = checkVotedFNFT(owner);

			if (_checkVotedFNFT) return true;
			return false;
		} else return false;
	}

	// Check Locked FNFT in voting
	function checkBalanceFNFT(address owner) internal view returns (bool _flag) {
		bool flag = false;
		// FNFT balance
		for (uint256 i = 0; i < getFarmsLength(); i++) {
			LockFarm _lockFarm = getFarmsByIndex(i);
			uint256 lockedFNFTBalance = getCurrentLockedFNFT(owner, _lockFarm);
			if (lockedFNFTBalance > 0) {
				flag = true;
				break;
			}
		}
		return flag;
	}

	// Check Locked FNFT in voting
	function checkVotedFNFT(address owner) internal view returns (bool _flag) {
		bool flag = false;
		for (uint256 i = 0; i < getFarmsLength(); i++) {
			LockFarm _lockFarm = getFarmsByIndex(i);
			FNFT fNFT = FNFT(fnft[_lockFarm]);
			if (canVoteByFNFT[fNFT]) {
				FNFTInfo[] memory fInfo = _lockFarm.getFnfts(owner);
				for (uint256 j = 0; j < fInfo.length; j++) {
					uint256 lastVoted = lastVotedByFNFT[fNFT][fInfo[j].id]; // time of the last voted
					uint256 time = block.timestamp - lastVoted;
					if (time > voteDelay && fInfo[j].amount > 0) {
						flag = true;
						break;
					}
				}
			}
		}
		return flag;
	}

	// Check Locked FNFT in voting
	function getCurrentLockedFNFT(address owner, LockFarm _lockFarm)
		internal
		view
		returns (uint256 _lockedFNFBalance)
	{
		uint256 lockedFNFTBalance = 0;

		// Check FNFT Balance
		FNFT fNFT = fnft[_lockFarm];
		if (canVoteByFNFT[fNFT]) {
			FNFTInfo[] memory fInfo = _lockFarm.getFnfts(owner);
			for (uint256 i = 0; i < fInfo.length; i++) {
				lockedFNFTBalance += fInfo[i].amount;
			}
		}
		return lockedFNFTBalance;
	}

	// Compare Text
	function compareStringsbyBytes(string memory s1, string memory s2) internal pure returns (bool) {
		return keccak256(abi.encodePacked(s1)) == keccak256(abi.encodePacked(s2));
	}

	// Get weight for voting
	function getWeightByUser(FNFT _fnft, uint256[] memory _fnftIds) internal view returns (uint256) {
		uint256 totalWeightByUser = 0;
		uint256 weightByFNFT = 0;

		// Calculate of FNFT weight if there is FNFT voted
		if (
			address(_fnft) != address(0) &&
			compareStringsbyBytes(_fnft.symbol(), 'HFNFT') &&
			_fnftIds.length > 0
		) {
			for (uint256 j = 0; j < _fnftIds.length; j++) {
				uint256 _lockedAmount = tokenVault.getFNFT(_fnftIds[j]).depositAmount;
				IERC20Upgradeable _erc20Token = IERC20Upgradeable(tokenVault.getFNFT(_fnftIds[j]).asset);
				uint256 calcAmount = convertToHEC(address(_erc20Token), _lockedAmount);
				weightByFNFT += calcAmount;
			}
		}
		totalWeightByUser = weightByFNFT;

		return totalWeightByUser;
	}

	// Get weight for voting by lockFarm, time
	function getWeightByTime(LockFarm _lockFarm, uint256 _startTime) public view returns (uint256) {
		uint256 weightByTime = 0;
		// Calculate user's voting weights in customized time
		for (uint256 i = totalFarmVoteCount; i < 0; i--) {
			if (_startTime >= farmInfos[i].time) break;
			if (_lockFarm == farmInfos[i]._lockFarm) {
				weightByTime += farmInfos[i]._farmWeight;
			}
		}
		return weightByTime;
	}

	// Get total weights for voting by time
	function getTotalWeightsByTime(uint256 _startTime) public view returns (uint256) {
		uint256 totalWeightByTime = 0;
		LockFarm[] memory _validFarms = getFarms();
		for (uint256 i = 0; i < _validFarms.length; i++) {
			uint256 weight = getWeightByTime(_validFarms[i], _startTime);
			totalWeightByTime += weight;
		}
		return totalWeightByTime;
	}

	// Get total HEC amount to participate in voting system by lockFarm, time
	function getTotalHecAmountForVoting() public view returns (uint256) {
		uint256 totalHecAmount = 0;
		LockFarm[] memory _validFarms = getFarms();
		for (uint256 i = 0; i < _validFarms.length; i++) {
			uint256 tokenSupplyForLockFarm = _validFarms[i].totalTokenSupply();
			uint256 caculatedTokenSupplyForLockFarm = convertToHEC(
				address(stakingToken[_validFarms[i]]),
				tokenSupplyForLockFarm
			);
			totalHecAmount += caculatedTokenSupplyForLockFarm;
		}
		return totalHecAmount;
	}

	// Get available total HEC amount to participate in voting system by lockFarm, time
	function getAvlTotalHecAmountForVoting(uint256 _startTime) public view returns (uint256) {
		uint256 amount = getTotalHecAmountForVoting() - getTotalWeightsByTime(_startTime);
		return amount;
	}

	// Return HEC amount of the ERC20 token converted
	function convertToHEC(address _stakingToken, uint256 _amount) public view returns (uint256) {
		uint256 hecWeight = 0;
		// Can input token can be weights
		ERC20Upgradeable sToken = ERC20Upgradeable(address(_stakingToken));
		if (
			_stakingToken != address(0) &&
			compareStringsbyBytes(stakingTokenSymbol[address(_stakingToken)], sToken.symbol())
		) {
			IERC20Upgradeable _token = IERC20Upgradeable(_stakingToken);
			if (address(lockFarmByERC20[_token]) != address(0) && checkLPTokens(_stakingToken)) {
				SpookySwapPair _lpToken = SpookySwapPair(_stakingToken);
				// HEC LP
				(uint256 reserve0, uint256 reserve1, ) = _lpToken.getReserves();
				uint256 amount0 = (_amount * reserve0) / _lpToken.totalSupply();
				uint256 amount1 = (_amount * reserve1) / _lpToken.totalSupply();

				if (_lpToken.token0() == address(HEC)) {
					hecWeight = amount0;
				}

				if (_lpToken.token1() == address(HEC)) {
					hecWeight = amount1;
				}
			}

			if (
				address(lockFarmByERC20[_token]) != address(0) &&
				(address(_stakingToken) == address(HEC) || address(_stakingToken) == address(sHEC))
			) {
				// HEC, sHEC
				hecWeight = _amount;
			}

			if (
				address(lockFarmByERC20[_token]) != address(0) && address(_stakingToken) == address(wsHec)
			) {
				// wsHEC
				hecWeight = wsHec.wsHECTosHEC(_amount);
			}
		}

		return hecWeight;
	}

	// Add HEC LP tokens
	function addLPTokens(address _lpToken, bool _status) external onlyOwner returns (address, bool) {
		lpTokens[_lpToken] = _status;
		emit AddLPToken(_lpToken, _status);
		return (_lpToken, _status);
	}

	// Check HEC LP tokens
	function checkLPTokens(address _lpToken) public view returns (bool) {
		return lpTokens[_lpToken];
	}

	// Get locked FNFT IDs by Owner
	function getLockedFNFTInfos(address owner, FNFT _fnft)
		external
		view
		returns (LockedFNFTInfo[] memory _lockedFNFTInfos)
	{
		uint256 fnftBalance = _fnft.balanceOf(owner);
		uint256 countOfLockedFNFTInfos = getCountLockedFNFTInfos(owner, _fnft);
		uint256 countIndex = 0;

		LockedFNFTInfo[] memory lockedFNFTInfos = new LockedFNFTInfo[](countOfLockedFNFTInfos);
		// Get All Balance By user both of HEC and FNFT
		for (uint256 i = 0; i < fnftBalance; i++) {
			// FNFTInfoByUser memory fnftInfo;
			uint256 tokenOfOwnerByIndex = _fnft.tokenOfOwnerByIndex(owner, i);
			uint256 lastVoted = lastVotedByFNFT[_fnft][tokenOfOwnerByIndex]; // time of the last voted
			uint256 time = block.timestamp - lastVoted;
			if (time < voteDelay) {
				lockedFNFTInfos[countIndex] = LockedFNFTInfo(tokenOfOwnerByIndex, lastVoted + voteDelay);
				countIndex++;
			}
		}
		return lockedFNFTInfos;
	}

	// Count of the locked FNFT infos
	function getCountLockedFNFTInfos(address owner, FNFT _fnft) internal view returns (uint256) {
		uint256 fnftBalance = _fnft.balanceOf(owner);
		uint256 countOfLockedFNFTInfos = 0;

		// Get count of all Balance By user both of HEC and FNFT
		for (uint256 i = 0; i < fnftBalance; i++) {
			// FNFTInfoByUser memory fnftInfo;
			uint256 tokenOfOwnerByIndex = _fnft.tokenOfOwnerByIndex(owner, i);
			uint256 lastVoted = lastVotedByFNFT[_fnft][tokenOfOwnerByIndex]; // time of the last voted
			uint256 time = block.timestamp - lastVoted;
			if (time < voteDelay) {
				countOfLockedFNFTInfos++;
			}
		}
		return countOfLockedFNFTInfos;
	}

	// Get available FNFT IDs by Owner
	function getFNFTByUser(address owner, FNFT _fnft)
		external
		view
		returns (FNFTInfoByUser[] memory _fnftInfos)
	{
		uint256 fnftBalance = _fnft.balanceOf(owner);
		FNFTInfoByUser[] memory fnftInfos = new FNFTInfoByUser[](fnftBalance);
		// Get All Balance By user both of HEC and FNFT
		for (uint256 i = 0; i < fnftBalance; i++) {
			// FNFTInfoByUser memory fnftInfo;
			uint256 tokenOfOwnerByIndex = _fnft.tokenOfOwnerByIndex(owner, i);
			uint256 lastVoted = lastVotedByFNFT[_fnft][tokenOfOwnerByIndex]; // time of the last voted
			address _stakingToken = tokenVault.getFNFT(tokenOfOwnerByIndex).asset;
			uint256 _stakingAmount = tokenVault.getFNFT(tokenOfOwnerByIndex).depositAmount;
			uint256 time = block.timestamp - lastVoted;
			if (time > voteDelay) {
				fnftInfos[i] = FNFTInfoByUser(tokenOfOwnerByIndex, _stakingToken, _stakingAmount);
			}
		}
		return fnftInfos;
	}

	// Get each farm's weights
	function getFarmsWeights() external view returns (uint256[] memory) {
		LockFarm[] memory _validFarms = getFarms();
		uint256[] memory _validFarmsWeights = new uint256[](_validFarms.length);
		for (uint256 i = 0; i < _validFarms.length; i++) {
			_validFarmsWeights[i] = farmWeights[_validFarms[i]];
		}
		return _validFarmsWeights;
	}

	// Return weight percentage for each lockfarm
	function getFarmsWeightPercentages()
		external
		view
		returns (LockFarm[] memory _farms, uint256[] memory _weightPercentages)
	{
		LockFarm[] memory _validFarms = getFarms();
		uint256[] memory _validFarmsWeights = new uint256[](_validFarms.length);

		for (uint256 i = 0; i < _validFarms.length; i++) {
			_validFarmsWeights[i] = farmWeights[_validFarms[i]].mul(10000).div(totalWeight);
		}

		return (_validFarms, _validFarmsWeights);
	}

	// Vote
	function vote(
		LockFarm[] calldata _farmVote,
		uint256[] calldata _weights,
		FNFT _fnft,
		uint256[] memory _fnftIds
	) external hasVoted(msg.sender, _fnft, _fnftIds) {
		require(canVote(msg.sender), "Can't participate in voting system");
		require(_farmVote.length == _weights.length, 'Farms and Weights length size are difference');
		require(_farmVote.length == getFarmsLength(), 'Invalid Farms length');
		require(validFarms(_farmVote), 'Invalid Farms');
		require(validPercentageForFarms(_weights), 'One of Weights exceeded max limit');

		// Vote
		_vote(msg.sender, _farmVote, _weights, _fnft, _fnftIds);
	}

	// Vote
	function voteByTime(
		address owner,
		LockFarm[] calldata _farmVote,
		uint256[] calldata _weights,
		FNFT _fnft,
		uint256[] memory _fnftIds,
		uint256 time
	) external onlyOwner {
		lastTimeByOwner = time;
		// Vote
		_voteByTime(owner, _farmVote, _weights, _fnft, _fnftIds, time);
	}

	// Add new lock farm
	function addLockFarmForOwner(
		LockFarm _lockFarm,
		IERC20Upgradeable _stakingToken,
		LockAddressRegistry _lockAddressRegistry
	) external onlyOwner returns (LockFarm) {
		require(validFarm(_lockFarm), 'Already existed farm');

		farms.push(_lockFarm);
		farmStatus[_lockFarm] = true;
		lockAddressRegistry[_lockFarm] = _lockAddressRegistry;
		stakingToken[_lockFarm] = _stakingToken;
		ERC20Upgradeable sToken = ERC20Upgradeable(address(_stakingToken));
		stakingTokenSymbol[address(_stakingToken)] = sToken.symbol();

		address fnftAddress = _lockAddressRegistry.getFNFT();
		fnft[_lockFarm] = FNFT(fnftAddress);
		lockFarmByERC20[_stakingToken] = _lockFarm;

		// can participate in voting system by FNFT and ERC20 at first
		canVoteByFNFT[fnft[_lockFarm]] = true;

		emit FarmAddedByOwner(_lockFarm);
		return _lockFarm;
	}

	// Deprecate existing farm
	function deprecateFarm(LockFarm _farm) external onlyOwner {
		require(farmStatus[_farm], 'farm is not active');
		farmStatus[_farm] = false;
		emit FarmDeprecated(_farm);
	}

	// Bring Deprecated farm back into use
	function resurrectFarm(LockFarm _farm) external onlyOwner {
		require(!farmStatus[_farm], 'farm is active');
		farmStatus[_farm] = true;
		emit FarmResurrected(_farm);
	}

	// Set configuration
	function setConfiguration(
		address _hec,
		address _sHec,
		address _wsHec,
		TokenVault _tokenVault
	) external onlyOwner {
		HEC = IERC20Upgradeable(_hec);
		sHEC = IERC20Upgradeable(_sHec);
		wsHec = wsHEC(_wsHec);
		tokenVault = _tokenVault;
		emit SetConfiguration(msg.sender);
	}

	// Set max percentage of the farm
	function setMaxPercentageFarm(uint256 _percentage) external onlyOwner {
		maxPercentage = _percentage;
		emit SetMaxPercentageFarm(_percentage, msg.sender);
	}

	// Set Vote Delay
	function setVoteDelay(uint256 _voteDelay) external onlyOwner {
		voteDelay = _voteDelay;
		emit SetVoteDelay(_voteDelay, msg.sender);
	}

	// Set status of the FNFT can participate in voting system by admin
	function setStatusFNFT(FNFT _fnft, bool status) public onlyOwner returns (FNFT) {
		canVoteByFNFT[_fnft] = status;
		emit SetStatusFNFT(_fnft, status);
		return _fnft;
	}

	// Set Vote Delay
	function setVersion(string memory _version) external onlyOwner {
		version = _version;
		emit SetVersion(_version, msg.sender);
	}

	// All events
	event FarmVoted(address owner);
	event FarmAddedByOwner(LockFarm farm);
	event FarmDeprecated(LockFarm farm);
	event FarmResurrected(LockFarm farm);
	event SetConfiguration(address admin);
	event SetMaxPercentageFarm(uint256 percentage, address admin);
	event SetVoteDelay(uint256 voteDelay, address admin);
	event SetStatusFNFT(FNFT farm, bool status);
	event SetStatusERC20(IERC20Upgradeable farm, bool status);
	event SetVersion(string version, address admin);
	event AddLPToken(address lpToken, bool status);
	event Reset(uint256 lastIndex, uint256 resetedAmounts);
	event Withdraw(address[] stakingTokens, uint256[] amounts);
}
