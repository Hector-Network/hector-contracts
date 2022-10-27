// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';

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

    function pendingReward(uint256 fnftId)
        external
        view
        returns (uint256 reward);

    function getFnfts(address owner)
        external
        view
        returns (FNFTInfo[] memory infos);

    function totalTokenSupply()
        external
        view
        returns (uint256 _totalTokenSupply);
}

// Interface of the FNFT
interface FNFT {
    function balanceOf(address) external view returns (uint256);

    function tokenOfOwnerByIndex(address, uint256)
        external
        view
        returns (uint256);

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
    function getPair(address tokenA, address tokenB)
        external
        view
        returns (address pair);

    function createPair(address tokenA, address tokenB)
        external
        returns (address pair);
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

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts);

    function getAmountsIn(uint256 amountOut, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts);
}

// Voting Contract
contract VotingFarm is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IERC20 public HEC; // HEC
    IERC20 internal sHEC; // HEC
    IERC20 internal USDC; // HEC
    SpookySwapFactory internal spookySwapFactory;
    SpookySwapRouter internal spookySwapRouter;
    TokenVault internal tokenVault;

    struct DepositInfo {
        address owner;
        IERC20 stakingToken;
        uint256 depositAmount;
        uint256 depositTime;
    }

    struct FarmInfo {
        LockFarm _lockFarm;
        uint256 _farmWeight;
        uint256 time;
    }

    address public admin; //Admin address to manage farms like add/deprecate/resurrect
    uint256 public totalWeight; // Total weights of the farms
    uint256 public maxPercentage = 100; // Max percentage for each farm
    uint256 public voteDelay = 604800; // Production Mode

    mapping(LockFarm => uint256) public farmWeights; // Return farm weights
    LockFarm[] internal farms; // Farms array
    mapping(LockFarm => bool) public farmStatus; // Return status of the farm
    mapping(LockFarm => FNFT) public fnft; // Return FNFT for each LockFarm
    mapping(LockFarm => IERC20) public stakingToken; // Return staking token for eack LockFarm
    mapping(IERC20 => LockFarm) internal lockFarmByERC20; // Return staking token for each LockFarm
    mapping(LockFarm => LockAddressRegistry) internal lockAddressRegistry; // Return LockAddressRegistry by LockFarm
    mapping(FNFT => bool) internal canVoteByFNFT; // Return status of user can vote by FNFT
    mapping(IERC20 => bool) internal canVoteByERC20; // Return status of user can vote by StakingToken
    mapping(FNFT => mapping(uint256 => uint256)) internal lastVotedByFNFT; // Return last time of voted FNFT
    FarmInfo[] internal farmInfo; // Store the every farmInfo
    DepositInfo[] internal depositInfo; // Store the every deposit info by ERC20 token
    mapping(address => LockFarm[]) internal farmVote; // Return farm weights by user

    // Modifiers
    modifier hasVoted(
        address voter,
        FNFT _fnft,
        uint256[] memory fnftIds
    ) {
        bool flag = true;
        for (uint256 i = 0; i < getFarmsLength(); i++) {
            LockFarm _lockFarm = getFarmsByIndex(i);
            if (
                address(_fnft) != address(0) &&
                address(_lockFarm) != address(0) &&
                fnftIds.length > 0
            ) {
                for (uint256 j = 0; j < fnftIds.length; j++) {
                    require(
                        _fnft.ownerOf(fnftIds[j]) == voter,
                        'FNFT: Invalid owner'
                    );
                    uint256 lastVoted = lastVotedByFNFT[_fnft][fnftIds[j]]; // time of the last voted
                    uint256 time = block.timestamp - lastVoted;
                    if (time < voteDelay) {
                        flag = false;
                        break;
                    }
                }
            }
        }
        require(flag, 'You voted in the last 7 days');
        _;
    }

    // Constructor
    constructor(
        address _hec,
        address _sHec,
        address _usdc,
        SpookySwapFactory _spookySwapFactory,
        SpookySwapRouter _spookySwapRouter,
        TokenVault _tokenVault
    ) {
        HEC = IERC20(_hec);
        sHEC = IERC20(_sHec);
        USDC = IERC20(_usdc);
        spookySwapFactory = _spookySwapFactory;
        spookySwapRouter = _spookySwapRouter;
        tokenVault = _tokenVault;
        admin = msg.sender;
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
    function reset(address _owner) internal {
        for (uint256 j = 0; j < farmInfo.length; j++) {
            uint256 time = block.timestamp - farmInfo[j].time;
            if (
                time > voteDelay &&
                farmInfo[j].time > 0 &&
                farmInfo[j]._farmWeight > 0
            ) {
                LockFarm _farm = farmInfo[j]._lockFarm;
                uint256 _votes = farmInfo[j]._farmWeight;
                if (_votes > 0) {
                    totalWeight = totalWeight - _votes;
                    farmWeights[_farm] = farmWeights[_farm] - _votes;
                    farmInfo[j]._farmWeight = 0;
                    farmInfo[j].time = 0;
                }
            }
        }
        emit ResetByUser(_owner);
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
        uint256[] memory _weights,
        IERC20 _stakingToken,
        uint256 _erc20Amount,
        FNFT _fnft,
        uint256[] memory _fnftIds
    ) internal {
        uint256 _weight = getWeightByUser(
            _stakingToken,
            _erc20Amount,
            _fnft,
            _fnftIds
        );
        uint256 _totalVotePercentage = 0;
        uint256 _usedWeight = 0;
        // Transfer ERC20 token to voting contract
        if (address(_stakingToken) != address(0) && _erc20Amount > 0)
            _stakingToken.transferFrom(_owner, address(this), _erc20Amount);

        for (uint256 i = 0; i < _farmVote.length; i++) {
            _totalVotePercentage = _totalVotePercentage.add(_weights[i]);
        }
        require(
            _totalVotePercentage == 100,
            'Weights total percentage is not 100%'
        );

        // Reset every tern for old data
        reset(_owner);

        for (uint256 i = 0; i < _farmVote.length; i++) {
            LockFarm _farm = _farmVote[i];
            uint256 _farmWeight = _weights[i].mul(_weight).div(
                _totalVotePercentage
            );
            _usedWeight = _usedWeight.add(_farmWeight);
            totalWeight = totalWeight.add(_farmWeight);
            farmWeights[_farm] = farmWeights[_farm].add(_farmWeight);
            farmVote[_owner].push(_farm);
            // Store all voting infos
            farmInfo.push(FarmInfo(_farm, _farmWeight, block.timestamp));
        }
        // Store ERC20 token info
        if (_erc20Amount > 0) {
            depositInfo.push(
                DepositInfo(
                    _owner,
                    _stakingToken,
                    _erc20Amount,
                    block.timestamp
                )
            );
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
        bool _checkBalance = checkBalance(owner);
        // Check FNFT is already voted
        bool _checkVotedFNFT = checkVotedFNFT(owner);
        if (!_checkBalance && !_checkVotedFNFT) return false;
        if (_checkBalance || !_checkVotedFNFT) return true;
        else return false;
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
    function withdraw()
        external
        returns (IERC20[] memory _stakingTokens, uint256[] memory _amounts)
    {
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
                if (
                    owner == depositInfo[j].owner &&
                    _stakingToken == depositInfo[j].stakingToken
                ) {
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
            if (totalAmount > 0)
                stakingTokens[i].safeTransfer(owner, totalAmount);
        }
        reset(owner);
        emit Withdraw(stakingTokens, amounts);
        return (stakingTokens, amounts);
    }

    // Check Locked FNFT in voting
    function checkBalance(address owner) internal view returns (bool _flag) {
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
            if (canVoteByFNFT[fNFT]) {
                FNFTInfo[] memory fInfo = _lockFarm.getFnfts(owner);
                for (uint256 j = 0; j < fInfo.length; j++) {
                    uint256 lastVoted = lastVotedByFNFT[fNFT][fInfo[j].id]; // time of the last voted
                    uint256 time = block.timestamp - lastVoted;
                    if (time < voteDelay) {
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

    // Check ERC20 balance in voting
    function getCurrentERC20(address owner, LockFarm _lockFarm)
        internal
        view
        returns (uint256 _erc20Balance)
    {
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
    function compareStringsbyBytes(string memory s1, string memory s2)
        internal
        pure
        returns (bool)
    {
        return
            keccak256(abi.encodePacked(s1)) == keccak256(abi.encodePacked(s2));
    }

    // Get weight for voting
    function getWeightByUser(
        IERC20 _stakingToken,
        uint256 _erc20Amount,
        FNFT _fnft,
        uint256[] memory _fnftIds
    ) internal view returns (uint256) {
        uint256 totalWeightByUser = 0;
        uint256 weightByFNFT = 0;

        // Calculate of FNFT weight if there is FNFT voted
        if (
            address(_fnft) != address(0) &&
            compareStringsbyBytes(_fnft.symbol(), 'HFNFT') &&
            _fnftIds.length > 0
        ) {
            for (uint256 j = 0; j < _fnftIds.length; j++) {
                uint256 _lockedAmount = tokenVault
                    .getFNFT(_fnftIds[j])
                    .depositAmount;
                IERC20 _erc20Token = IERC20(
                    tokenVault.getFNFT(_fnftIds[j]).asset
                );
                uint256 calcAmount = calcERC20Weight(
                    _erc20Token,
                    _lockedAmount
                );
                weightByFNFT += calcAmount;
            }
        }
        // Calculate of ERC20 token weight if there is ERC20 voted
        uint256 erc20Weight = calcERC20Weight(_stakingToken, _erc20Amount);

        totalWeightByUser = weightByFNFT + erc20Weight;

        return totalWeightByUser;
    }

    // Return weight of the ERC20 token
    function calcERC20Weight(IERC20 _stakingToken, uint256 _erc20Amount)
        internal
        view
        returns (uint256)
    {
        uint256 weight = 0;
        // Check LP token
        SpookySwapPair _lpToken = SpookySwapPair(address(_stakingToken));
        ERC20 erc20StakingToken = ERC20(address(_stakingToken));
        if (
            address(lockFarmByERC20[erc20StakingToken]) != address(0) &&
            compareStringsbyBytes(erc20StakingToken.symbol(), 'spLP') &&
            _lpToken.factory() == address(spookySwapFactory)
        ) {
            // HEC-USDC LP
            (uint256 reserve0, uint256 reserve1, ) = _lpToken.getReserves();
            uint256 amount0 = (_erc20Amount * reserve0) /
                _lpToken.totalSupply();
            uint256 amount1 = (_erc20Amount * reserve1) /
                _lpToken.totalSupply();
            address[] memory path = new address[](2);
            path[0] = address(HEC);
            path[1] = address(USDC);

            if (_lpToken.token0() == address(HEC)) {
                uint256[] memory amounts = spookySwapRouter.getAmountsIn(
                    amount1,
                    path
                );
                weight = amount0 + amounts[0];
            }

            if (_lpToken.token1() == address(HEC)) {
                uint256[] memory amounts = spookySwapRouter.getAmountsIn(
                    amount0,
                    path
                );
                weight = amount1 + amounts[0];
            }
        } else {
            if (address(lockFarmByERC20[erc20StakingToken]) != address(0)) {
                // StakingToken is valid for participating Voting System
                // HEC
                if (
                    address(_stakingToken) == address(HEC) ||
                    address(_stakingToken) == address(sHEC)
                ) {
                    weight = _erc20Amount;
                } else {
                    // Other Wrapped Tokens - wsHEC
                    uint256 totalAmount = _erc20Amount;
                    address[] memory path = new address[](4);
                    path[0] = address(HEC);
                    path[1] = address(USDC);
                    path[2] = spookySwapRouter.WETH();
                    path[3] = address(_stakingToken);
                    uint256[] memory amounts = spookySwapRouter.getAmountsIn(
                        totalAmount,
                        path
                    );
                    weight = amounts[0];
                }
            }
        }
        return weight;
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
            address _stakingToken = tokenVault
                .getFNFT(tokenOfOwnerByIndex)
                .asset;
            uint256 _stakingAmount = tokenVault
                .getFNFT(tokenOfOwnerByIndex)
                .depositAmount;
            uint256 time = block.timestamp - lastVoted;
            if (time > voteDelay) {
                fnftInfos[i] = FNFTInfoByUser(
                    tokenOfOwnerByIndex,
                    _stakingToken,
                    _stakingAmount
                );
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

    // Vote
    function vote(
        LockFarm[] calldata _farmVote,
        uint256[] calldata _weights,
        IERC20 _stakingToken,
        uint256 _erc20Amount,
        FNFT _fnft,
        uint256[] memory _fnftIds
    ) external hasVoted(msg.sender, _fnft, _fnftIds) {
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
        // Check allowance of the staking token
        if (address(_stakingToken) != address(0) && _erc20Amount > 0) {
            uint256 allowance = _stakingToken.allowance(
                msg.sender,
                address(this)
            );
            require(
                allowance > _erc20Amount,
                'ERC20: transfer amount exceeds allowance'
            );
        }
        // Vote
        _vote(
            msg.sender,
            _farmVote,
            _weights,
            _stakingToken,
            _erc20Amount,
            _fnft,
            _fnftIds
        );
    }

    // Set Admin role
    function setAdmin(address _admin) external {
        require(msg.sender == admin, '!admin');
        admin = _admin;
        emit SetAdmin(admin, _admin);
    }

    // Reset By Admin
    function resetByAdmin() external {
        require(msg.sender == admin, '!admin');
        totalWeight = 0;
        for (uint256 i = 0; i < getFarmsLength(); i++) {
            LockFarm _lockFarm = getFarmsByIndex(i);
            farmWeights[_lockFarm] = 0;
        }
        emit Reset(admin);
    }

    // Add new lock farm
    function addLockFarmForOwner(
        LockFarm _lockFarm,
        IERC20 _stakingToken,
        LockAddressRegistry _lockAddressRegistry
    ) external returns (LockFarm) {
        require(msg.sender == admin, '!admin');
        require(validFarm(_lockFarm), 'Already existed farm');

        farms.push(_lockFarm);
        farmStatus[_lockFarm] = true;
        lockAddressRegistry[_lockFarm] = _lockAddressRegistry;
        stakingToken[_lockFarm] = _stakingToken;

        address fnftAddress = _lockAddressRegistry.getFNFT();
        fnft[_lockFarm] = FNFT(fnftAddress);
        lockFarmByERC20[_stakingToken] = _lockFarm;

        // can participate in voting system by FNFT and ERC20 at first
        canVoteByFNFT[fnft[_lockFarm]] = true;
        canVoteByERC20[_stakingToken] = true;

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
        address _hec,
        address _sHec,
        SpookySwapFactory _spookySwapFactory,
        SpookySwapRouter _spookySwapRouter
    ) external {
        require((msg.sender == admin), '!admin');
        HEC = IERC20(_hec);
        sHEC = IERC20(_sHec);
        spookySwapRouter = _spookySwapRouter;
        spookySwapFactory = _spookySwapFactory;
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

    // Set status of the FNFT can participate in voting system by admin
    function setStatusFNFT(LockFarm _lockFarm, bool status)
        public
        returns (LockFarm)
    {
        require(msg.sender == admin, '!admin');
        canVoteByFNFT[fnft[_lockFarm]] = status;
        emit SetStatusFNFT(_lockFarm, status);
        return _lockFarm;
    }

    // Set status of the ERC20 can participate in voting system by admin
    function setStatusERC20(LockFarm _lockFarm, bool status)
        public
        returns (LockFarm)
    {
        require(msg.sender == admin, '!admin');
        canVoteByERC20[stakingToken[_lockFarm]] = status;
        emit SetStatusERC20(_lockFarm, status);
        return _lockFarm;
    }

    // All events
    event FarmVoted(address owner);
    event FarmAddedByOwner(LockFarm farm);
    event FarmDeprecated(LockFarm farm);
    event FarmResurrected(LockFarm farm);
    event SetConfiguration(address admin);
    event SetMaxPercentageFarm(uint256 percentage, address admin);
    event SetVoteDelay(uint256 voteDelay, address admin);
    event SetStatusFNFT(LockFarm farm, bool status);
    event SetStatusERC20(LockFarm farm, bool status);
    event SetAdmin(address oldAdmin, address newAdmin);
    event Reset(address Admin);
    event ResetByUser(address Owner);
    event Withdraw(IERC20[] stakingTokens, uint256[] amounts);
}
