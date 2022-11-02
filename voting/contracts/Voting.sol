// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';

interface IOwnable {
	function owner() external view returns (address);

	function renounceManagement(string memory confirm) external;

	function pushManagement(address newOwner_) external;

	function pullManagement() external;
}

// Ownable
contract Ownable is IOwnable {
	address internal _owner;
	address internal _newOwner;

	event OwnershipPushed(address indexed previousOwner, address indexed newOwner);
	event OwnershipPulled(address indexed previousOwner, address indexed newOwner);

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

	function renounceManagement(string memory confirm) public virtual override onlyOwner {
		require(keccak256(abi.encodePacked(confirm)) == keccak256(abi.encodePacked('confirm renounce')), "Ownable: renouce needs 'confirm renounce' as input");
		emit OwnershipPushed(_owner, address(0));
		_owner = address(0);
		_newOwner = address(0);
	}

	function pushManagement(address newOwner_) public virtual override onlyOwner {
		require(newOwner_ != address(0), 'Ownable: new owner is the zero address');
		emit OwnershipPushed(_owner, newOwner_);
		_newOwner = newOwner_;
	}

	function pullManagement() public virtual override {
		require(msg.sender == _newOwner, 'Ownable: must be new owner to pull');
		emit OwnershipPulled(_owner, _newOwner);
		_owner = _newOwner;
	}
}

// Structure of FNFT
struct FNFTInfo {
	uint256 id;
	uint256 amount;
	uint256 startTime;
	uint256 secs;
	uint256 multiplier;
	uint256 rewardDebt;
	uint256 pendingReward;
}

// Interface of the LockFarm
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

	function pendingReward(uint256 fnftId) external view returns (uint256 reward);

	function getFnfts(address owner) external view returns (FNFTInfo[] memory infos);

	function totalTokenSupply() external view returns (uint256 _totalTokenSupply);
}

// Interface of the FNFT
interface FNFT {
	function balanceOf(address) external view returns (uint256);

	function tokenOfOwnerByIndex(address, uint256) external view returns (uint256);

	function ownerOf(uint256 tokenId) external view returns (address);

	function symbol() external view returns (string memory);
}

// Structure of FNFT voted info
struct FNFTInfoByUser {
	uint256 fnftId; // FNFT id
	address stakingToken; // The token being stored
	uint256 depositAmount; // How many tokens
}

// Interface of the TokenVault
interface TokenVault {
	struct FNFTConfig {
		address asset; // The token being stored
		uint256 depositAmount; // How many tokens
		uint256 endTime; // Time lock expiry
	}

	function getFNFT(uint256 fnftId) external view returns (FNFTConfig memory);
}

// Interface of the LockAddressRegistry
interface LockAddressRegistry {
	function getTokenVault() external view returns (address);

	function getEmissionor() external view returns (address);

	function getFNFT() external view returns (address);
}

// Interface of the SpookySwap Liqudity ERC20
interface SpookySwapPair {
	function MINIMUM_LIQUIDITY() external pure returns (uint256);

	function factory() external view returns (address);

	function token0() external view returns (address);

	function token1() external view returns (address);

	function getReserves()
		external
		view
		returns (
			uint112 reserve0,
			uint112 reserve1,
			uint32 blockTimestampLast
		);

	function price0CumulativeLast() external view returns (uint256);

	function price1CumulativeLast() external view returns (uint256);

	function totalSupply() external view returns (uint256);
}

// Interface of the SpookySwap Factory
interface SpookySwapFactory {
	function getPair(address tokenA, address tokenB) external view returns (address pair);

	function createPair(address tokenA, address tokenB) external returns (address pair);
}

// Interface of the SpookySwap Router
interface SpookySwapRouter {
	function WETH() external view returns (address weth);

	function quote(
		uint256 amountA,
		uint256 reserveA,
		uint256 reserveB
	) external pure returns (uint256 amountB);

	function getAmountOut(
		uint256 amountIn,
		uint256 reserveIn,
		uint256 reserveOut
	) external pure returns (uint256 amountOut);

	function getAmountIn(
		uint256 amountOut,
		uint256 reserveIn,
		uint256 reserveOut
	) external pure returns (uint256 amountIn);

	function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts);

	function getAmountsIn(uint256 amountOut, address[] calldata path) external view returns (uint256[] memory amounts);
}

// Interface of the wsHEC
interface wsHEC {
	function wsHECTosHEC(uint256 _amount) external view returns (uint256);
}

// Voting Contract
contract Voting is ReentrancyGuard, Ownable {
	using SafeERC20 for IERC20;
	using SafeMath for uint256;

	IERC20 public HEC; // HEC
	IERC20 internal sHEC; // sHEC
	IERC20 internal USDC; // USDC
	wsHEC internal wsHec; // wsHEC
	SpookySwapFactory internal spookySwapFactory;
	SpookySwapRouter internal spookySwapRouter;

	struct DepositInfo {
		address owner;
		IERC20 stakingToken;
		uint256 depositAmount;
		uint256 depositTime;
	}

	struct FarmInfo {
		address voter;
		LockFarm _lockFarm;
		uint256 _farmWeight;
		uint256 time;
	}

	uint256 public totalWeight; // Total weights of the farms
	uint256 public maxPercentage = 100; // Max percentage for each farm
	uint256 public voteDelay = 604800; // Production Mode

	mapping(LockFarm => uint256) public farmWeights; // Return farm weights
	LockFarm[] internal farms; // Farms array
	mapping(LockFarm => bool) public farmStatus; // Return status of the farm
	mapping(LockFarm => FNFT) public fnft; // Return FNFT for each LockFarm
	mapping(LockFarm => TokenVault) public tokenVault; // Return TokenVault for each LockFarm
	mapping(FNFT => TokenVault) public tokenVaultByFNFT; // Return TokenVault for each FNFT
	mapping(LockFarm => IERC20) public stakingToken; // Return staking token for eack LockFarm
	mapping(IERC20 => LockFarm) internal lockFarmByERC20; // Return staking token for each LockFarm
	mapping(LockFarm => LockAddressRegistry) internal lockAddressRegistry; // Return LockAddressRegistry by LockFarm
	mapping(FNFT => bool) internal canVoteByFNFT; // Return status of user can vote by FNFT
	mapping(IERC20 => bool) internal canVoteByERC20; // Return status of user can vote by StakingToken
	mapping(FNFT => mapping(uint256 => uint256)) internal lastVotedByFNFT; // Return last time of voted FNFT
	FarmInfo[] internal farmInfo; // Store the every farmInfo
	DepositInfo[] internal depositInfo; // Store the every deposit info by ERC20 token
	mapping(address => LockFarm[]) internal farmVote; // Return farm list by user voted
	mapping(address => mapping(LockFarm => uint256)) public userWeight; // Return user's voting weigths by lockfarm
	mapping(address => uint256) public totalUserWeight; // Return total user's voting weigths

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

	// Constructor
	constructor(
		address _hec,
		address _sHec,
		address _wsHec,
		address _usdc,
		SpookySwapFactory _spookySwapFactory,
		SpookySwapRouter _spookySwapRouter
	) {
		HEC = IERC20(_hec);
		sHEC = IERC20(_sHec);
		wsHec = wsHEC(_wsHec);
		USDC = IERC20(_usdc);
		spookySwapFactory = _spookySwapFactory;
		spookySwapRouter = _spookySwapRouter;
		_owner = msg.sender;
		emit OwnershipPulled(address(0), _owner);
	}

	// Return the farms list
	function getFarms() public view returns (LockFarm[] memory) {
		uint256 _farmsLength = 0;
		for (uint256 i = 0; i < farms.length; i++) {
			if (farmStatus[farms[i]]) _farmsLength = _farmsLength + 1;
		}

		LockFarm[] memory tempFarms = new LockFarm[](_farmsLength);
		uint256 k = 1;
		for (uint256 j = 0; j < farms.length; j++) {
			if (farmStatus[farms[j]]) {
				tempFarms[k - 1] = farms[j];
			} else {
				k--;
			}
			k++;
		}

		return tempFarms;
	}

	// Return the farm by index
	function getFarmsByIndex(uint256 index) internal view returns (LockFarm) {
		LockFarm[] memory _farms = getFarms();
		return _farms[index];
	}

	// Return farms length
	function getFarmsLength() public view returns (uint256) {
		LockFarm[] memory _farms = getFarms();
		return _farms.length;
	}

	// Reset every new tern if thers are some old voting history
	function reset() internal {
		for (uint256 j = 0; j < farmInfo.length; j++) {
			uint256 time = block.timestamp - farmInfo[j].time;
			if (time > voteDelay && farmInfo[j].time > 0 && farmInfo[j]._farmWeight > 0) {
				LockFarm _farm = farmInfo[j]._lockFarm;
				uint256 _votes = farmInfo[j]._farmWeight;
				address _voter = farmInfo[j].voter;
				if (_votes > 0) {
					totalWeight = totalWeight - _votes;
					farmWeights[_farm] = farmWeights[_farm] - _votes;
					userWeight[_voter][_farm] = userWeight[_voter][_farm] - _votes;
					totalUserWeight[_voter] = totalUserWeight[_voter] - _votes;
					farmInfo[j]._farmWeight = 0;
					farmInfo[j].time = 0;
				}
			}
		}
		emit Reset();
	}

	// Reset All voting Data and withdraw all token to users for their votes
	function resetByOwner() external onlyOwner {
		voteDelay = 0;

		reset();

		voteDelay = 604800;

		emit ResetByOwner(_owner);
	}

	// Verify farms array is valid
	function validFarms(LockFarm[] memory _farms) internal view returns (bool) {
		bool flag = true;
		LockFarm prevFarm = _farms[0];
		// Check new inputted address is already existed on Voting farms array
		for (uint256 i = 1; i < getFarmsLength(); i++) {
			if (prevFarm == _farms[i]) {
				flag = false;
				break;
			}
			prevFarm = _farms[i];
		}
		// Check Farms Status
		for (uint256 i = 0; i < getFarmsLength(); i++) {
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
		IERC20 _stakingToken,
		uint256 _amount,
		FNFT _fnft,
		uint256[] memory _fnftIds
	) internal {
		uint256 _weight = getWeightByUser(_stakingToken, _amount, _fnft, _fnftIds);
		uint256 _totalVotePercentage = 0;
		// Transfer ERC20 token to voting contract
		if (address(_stakingToken) != address(0) && _amount > 0) _stakingToken.transferFrom(_owner, address(this), _amount);

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
			farmVote[_owner].push(_farm);
			userWeight[_owner][_farm] = userWeight[_owner][_farm] + _farmWeight;
			totalUserWeight[_owner] = totalUserWeight[_owner] + _farmWeight;
			// Store all voting infos
			farmInfo.push(FarmInfo(_owner, _farm, _farmWeight, block.timestamp));
		}
		// Store ERC20 token info
		if (_amount > 0) {
			depositInfo.push(DepositInfo(_owner, _stakingToken, _amount, block.timestamp));
		}

		for (uint256 j = 0; j < _fnftIds.length; j++) {
			lastVotedByFNFT[_fnft][_fnftIds[j]] = block.timestamp;
		}

		emit FarmVoted(_owner);
	}

	// Can vote by owner
	function canVote(address owner) public view returns (bool) {
		// Check Farm is existed
		if (getFarmsLength() == 0) return false;
		// Check status by user
		bool _checkBalanceFNFT = checkBalanceFNFT(owner);
		bool _checkBalanceStakingToken = checkBalanceStakingToken(owner);

		if (!_checkBalanceFNFT && !_checkBalanceStakingToken) return false;
		else if (_checkBalanceStakingToken) return true;
		else if (_checkBalanceFNFT) {
			bool _checkVotedFNFT = checkVotedFNFT(owner);

			if (_checkVotedFNFT) return true;
			return false;
		} else return false;
	}

	// Can withdraw by owner
	function canWithdraw(address owner) public view returns (bool) {
		bool flag = false;
		// Check Farm is existed
		if (getFarmsLength() == 0) flag = false;
		for (uint256 j = 0; j < depositInfo.length; j++) {
			if (owner == depositInfo[j].owner) {
				uint256 time = block.timestamp - depositInfo[j].depositTime;
				if (time > voteDelay && depositInfo[j].depositAmount > 0) {
					flag = true;
					break;
				}
			}
		}
		return flag;
	}

	// Withdraw the ERC20 token By User
	function withdraw() external returns (IERC20[] memory _stakingTokens, uint256[] memory _amounts) {
		address owner = address(msg.sender);
		require(canWithdraw(owner), "Can't withdraw");
		IERC20[] memory stakingTokens = new IERC20[](getFarmsLength());
		uint256[] memory amounts = new uint256[](getFarmsLength());
		for (uint256 i = 0; i < getFarmsLength(); i++) {
			LockFarm _lockFarm = getFarmsByIndex(i);
			IERC20 _stakingToken = stakingToken[_lockFarm];
			stakingTokens[i] = _stakingToken;
			uint256 totalAmount = 0;
			for (uint256 j = 0; j < depositInfo.length; j++) {
				if (owner == depositInfo[j].owner && _stakingToken == depositInfo[j].stakingToken) {
					uint256 time = block.timestamp - depositInfo[j].depositTime;
					if (time > voteDelay && depositInfo[j].depositAmount > 0) {
						uint256 amount = depositInfo[j].depositAmount;
						totalAmount += amount;
						// Reset ERC20 info
						depositInfo[j].depositAmount = 0;
						depositInfo[j].depositTime = 0;
					}
				}
			}
			amounts[i] = totalAmount;
			if (totalAmount > 0) stakingTokens[i].safeTransfer(owner, totalAmount);
		}
		reset();
		emit Withdraw(stakingTokens, amounts);
		return (stakingTokens, amounts);
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

	function checkBalanceStakingToken(address owner) internal view returns (bool _flag) {
		bool flag = false;
		// ERC20 balance
		for (uint256 i = 0; i < getFarmsLength(); i++) {
			LockFarm _lockFarm = getFarmsByIndex(i);
			uint256 erc20Balance = getCurrentERC20(owner, _lockFarm);
			if (erc20Balance > 0) {
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
			if (canVoteByFNFT[fNFT] && canVoteByERC20[stakingToken[_lockFarm]]) {
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
	function getCurrentLockedFNFT(address owner, LockFarm _lockFarm) internal view returns (uint256 _lockedFNFBalance) {
		if (!canVoteByERC20[stakingToken[_lockFarm]]) return 0;
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

	// Check ERC20 balance in voting
	function getCurrentERC20(address owner, LockFarm _lockFarm) internal view returns (uint256 _erc20Balance) {
		uint256 erc20Balance = 0;

		// Check FNFT Balance
		IERC20 _stakingToken = stakingToken[_lockFarm];
		if (canVoteByERC20[_stakingToken]) {
			uint256 userBalance = _stakingToken.balanceOf(owner);
			erc20Balance += userBalance;
		}
		return erc20Balance;
	}

	// Compare Text
	function compareStringsbyBytes(string memory s1, string memory s2) internal pure returns (bool) {
		return keccak256(abi.encodePacked(s1)) == keccak256(abi.encodePacked(s2));
	}

	// Get weight for voting
	function getWeightByUser(
		IERC20 _stakingToken,
		uint256 _amount,
		FNFT _fnft,
		uint256[] memory _fnftIds
	) internal view returns (uint256) {
		uint256 totalWeightByUser = 0;
		uint256 weightByFNFT = 0;

		// Calculate of FNFT weight if there is FNFT voted
		if (address(_fnft) != address(0) && _fnftIds.length > 0) {
			TokenVault _tokenValut = tokenVaultByFNFT[_fnft];
			for (uint256 j = 0; j < _fnftIds.length; j++) {
				IERC20 _erc20Token = IERC20(_tokenValut.getFNFT(_fnftIds[j]).asset);
				uint256 _lockedAmount = _tokenValut.getFNFT(_fnftIds[j]).depositAmount;
				uint256 calcAmount = convertToHEC(address(_erc20Token), _lockedAmount);
				weightByFNFT += calcAmount;
			}
		}

		// Calculate of ERC20 token weight if there is ERC20 voted
		uint256 erc20Weight = convertToHEC(address(_stakingToken), _amount);
		totalWeightByUser = weightByFNFT + erc20Weight;

		return totalWeightByUser;
	}

	// Return HEC amount of the ERC20 token converted
	function convertToHEC(address _stakingToken, uint256 _amount) public view returns (uint256) {
		uint256 hecWeight = 0;
		// Check LP token
		SpookySwapPair _lpToken = SpookySwapPair(_stakingToken);
		ERC20 _token = ERC20(_stakingToken);
		if (address(lockFarmByERC20[_token]) != address(0) && compareStringsbyBytes(_token.symbol(), 'spLP') && _lpToken.factory() == address(spookySwapFactory)) {
			// HEC-USDC
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

		if (address(lockFarmByERC20[_token]) != address(0) && (address(_stakingToken) == address(HEC) || address(_stakingToken) == address(sHEC))) {
			// HEC, sHEC
			hecWeight = _amount;
		}

		if (address(lockFarmByERC20[_token]) != address(0) && address(_stakingToken) == address(wsHec)) {
			// wsHEC
			hecWeight = wsHec.wsHECTosHEC(_amount);
		}

		return hecWeight;
	}

	// Get available FNFT IDs by Owner
	function getFNFTByUser(address owner, FNFT _fnft) external view returns (FNFTInfoByUser[] memory _fnftInfos) {
		uint256 fnftBalance = _fnft.balanceOf(owner);
		FNFTInfoByUser[] memory fnftInfos = new FNFTInfoByUser[](fnftBalance);
		// Get All Balance By user both of HEC and FNFT
		for (uint256 i = 0; i < fnftBalance; i++) {
			// FNFTInfoByUser memory fnftInfo;
			uint256 tokenOfOwnerByIndex = _fnft.tokenOfOwnerByIndex(owner, i);
			uint256 lastVoted = lastVotedByFNFT[_fnft][tokenOfOwnerByIndex]; // time of the last voted
			TokenVault _tokenVault = tokenVaultByFNFT[_fnft];
			address _stakingToken = _tokenVault.getFNFT(tokenOfOwnerByIndex).asset;
			uint256 _stakingAmount = _tokenVault.getFNFT(tokenOfOwnerByIndex).depositAmount;
			uint256 time = block.timestamp - lastVoted;
			IERC20 _stakingERC20Token = IERC20(_stakingToken);
			if (time > voteDelay && canVoteByERC20[_stakingERC20Token]) {
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
	function getFarmsWeightPercentages() external view returns (LockFarm[] memory _farms, uint256[] memory _weightPercentages) {
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
		IERC20 _stakingToken,
		uint256 _amount,
		FNFT _fnft,
		uint256[] memory _fnftIds
	) external hasVoted(msg.sender, _fnft, _fnftIds) {
		require(canVote(msg.sender), "Can't participate in voting system");
		require(_farmVote.length == _weights.length, 'Farms and Weights length size are difference');
		require(_farmVote.length == getFarmsLength(), 'Invalid Farms length');
		require(validFarms(_farmVote), 'Invalid Farms');
		require(validPercentageForFarms(_weights), 'One of Weights exceeded max limit');
		// Check allowance of the staking token
		if (address(_stakingToken) != address(0) && _amount > 0) {
			uint256 allowance = _stakingToken.allowance(msg.sender, address(this));
			require(allowance > _amount, 'ERC20: transfer amount exceeds allowance');
			require(canVoteByERC20[_stakingToken], 'Deposited ERC20 token is not allowed for voting');
		}
		// Vote
		_vote(msg.sender, _farmVote, _weights, _stakingToken, _amount, _fnft, _fnftIds);
	}

	// Add new lock farm
	function addLockFarmForOwner(
		LockFarm _lockFarm,
		IERC20 _stakingToken,
		LockAddressRegistry _lockAddressRegistry,
		TokenVault _tokenVault
	) external onlyOwner returns (LockFarm) {
		require(validFarm(_lockFarm), 'Already existed farm');

		farms.push(_lockFarm);
		farmStatus[_lockFarm] = true;
		lockAddressRegistry[_lockFarm] = _lockAddressRegistry;
		stakingToken[_lockFarm] = _stakingToken;

		address fnftAddress = _lockAddressRegistry.getFNFT();
		fnft[_lockFarm] = FNFT(fnftAddress);
		lockFarmByERC20[_stakingToken] = _lockFarm;
		tokenVault[_lockFarm] = _tokenVault;
		tokenVaultByFNFT[FNFT(fnftAddress)] = _tokenVault;

		// can participate in voting system by FNFT and ERC20 at first
		canVoteByFNFT[fnft[_lockFarm]] = true;
		canVoteByERC20[_stakingToken] = true;

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
		address _usdc,
		SpookySwapFactory _spookySwapFactory,
		SpookySwapRouter _spookySwapRouter
	) external onlyOwner {
		HEC = IERC20(_hec);
		sHEC = IERC20(_sHec);
		wsHec = wsHEC(_wsHec);
		USDC = IERC20(_usdc);
		spookySwapRouter = _spookySwapRouter;
		spookySwapFactory = _spookySwapFactory;
		emit SetConfiguration(msg.sender);
	}

	// Set LockFarm
	function setLockFarm(
		LockFarm _lockFarm,
		IERC20 _stakingToken,
		TokenVault _tokenVault,
		LockAddressRegistry _lockAddressRegistry
	) external onlyOwner {
		lockAddressRegistry[_lockFarm] = _lockAddressRegistry;
		stakingToken[_lockFarm] = _stakingToken;
		address fnftAddress = _lockAddressRegistry.getFNFT();
		fnft[_lockFarm] = FNFT(fnftAddress);
		lockFarmByERC20[_stakingToken] = _lockFarm;
		tokenVault[_lockFarm] = _tokenVault;
		tokenVaultByFNFT[FNFT(fnftAddress)] = _tokenVault;

		emit SetLockFarm(msg.sender, _lockFarm, _stakingToken, _tokenVault, _lockAddressRegistry);
	}

	// Set max percentage of the farm
	function setMaxPercentageFarm(uint256 _percentage) external onlyOwner {
		maxPercentage = _percentage;
		emit SetMaxPercentageFarm(_percentage, _owner);
	}

	// Set Vote Delay
	function setVoteDelay(uint256 _voteDelay) external onlyOwner {
		voteDelay = _voteDelay;
		emit SetVoteDelay(_voteDelay, _owner);
	}

	// Set status of the FNFT can participate in voting system by admin
	function setStatusFNFT(FNFT _fnft, bool status) public onlyOwner returns (FNFT) {
		canVoteByFNFT[_fnft] = status;
		emit SetStatusFNFT(_fnft, status);
		return _fnft;
	}

	// Set status of the ERC20 can participate in voting system by admin
	function setStatusERC20(IERC20 _stakingToken, bool status) public onlyOwner returns (IERC20) {
		canVoteByERC20[_stakingToken] = status;
		emit SetStatusERC20(_stakingToken, status);
		return _stakingToken;
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
	event SetStatusERC20(IERC20 farm, bool status);
	event Reset();
	event ResetByOwner(address owner);
	event Withdraw(IERC20[] stakingTokens, uint256[] amounts);
	event SetLockFarm(address owner, LockFarm _lockFarm, IERC20 _stakingToken, TokenVault _tokenVault, LockAddressRegistry _lockAddressRegistry);
}
