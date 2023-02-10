// SPDX-License-Identifier: AGPL-3.0-or-later
pragma abicoder v2;
pragma solidity 0.8.9;

import '@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@chainlink/contracts/src/v0.8/AutomationCompatible.sol';

import './interfaces/IPriceOracleAggregator.sol';

interface IOwnableUpgradeable {
    function policy() external view returns (address);

    function renounceManagement() external;

    function pushManagement(address newOwner_) external;

    function pullManagement() external;
}

abstract contract OwnableUpgradeable is
    IOwnableUpgradeable,
    Initializable,
    ContextUpgradeable
{
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

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    function __Ownable_init() internal onlyInitializing {
        __Ownable_init_unchained();
    }

    function __Ownable_init_unchained() internal onlyInitializing {
        _owner = msg.sender;
        emit OwnershipPushed(address(0), _owner);
    }

    function policy() public view override returns (address) {
        return _owner;
    }

    modifier onlyPolicy() {
        require(_owner == msg.sender, 'Ownable: caller is not the owner');
        _;
    }

    function renounceManagement() public virtual override onlyPolicy {
        emit OwnershipPushed(_owner, address(0));
        _owner = address(0);
    }

    function pushManagement(address newOwner_)
        public
        virtual
        override
        onlyPolicy
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

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[49] private __gap;
}

interface ILockAddressRegistry {
    function getFNFT() external view returns (address);

    function getFarm(uint256 index) external view returns (address);
}

interface ILockFarm {
    function claim(uint256 fnftId) external;

    function rewardToken() external view returns (address);

    function pendingReward(uint256 fnftId)
        external
        view
        returns (uint256 reward);
}

error INVALID_ADDRESS();
error INVALID_AMOUNT();
error INVALID_INTERVAL();
error NOT_OWNER();
error ALREADY_ENABLED();
error ALREADY_DISABLED();
error NOT_ALLOWED_TOKEN();

contract HectorLockFarmKeeper is
    PausableUpgradeable,
    OwnableUpgradeable,
    AutomationCompatibleInterface,
    ERC721HolderUpgradeable
{
    using SafeERC20 for IERC20;

    struct ClaimInfo {
        uint256 lastUpdate;
        uint256 interval;
    }

    uint256 public constant MIN_INTERVAL = 1 days;
    uint256 public constant MAX_CLAIMABLE_COUNT = 10;

    /// @notice LockFarm Address Provider
    ILockAddressRegistry public addressProvider;

    /// @notice Price Oracle Aggregator
    IPriceOracleAggregator public priceOracleAggregator;

    /// @notice Receive Fee
    address public DAO;

    /// @notice Base Fee for Performing
    uint256 public baseFee;

    /// @notice FNFT
    IERC721Enumerable public fnft;

    /// @notice Token used to charge fee
    address[] public tokens;
    mapping(address => bool) public isAllowedToken;

    /// @notice FNFT auto claim info
    mapping(uint256 => ClaimInfo) public claimInfo;

    /// @notice wallet => charged fee amount ($)
    mapping(address => uint256) public chargedAmount;

    /// @notice wallet => FNFT => is auto claim
    mapping(address => mapping(uint256 => bool)) public isAuto;

    /// @notice Perform Fee Index
    uint256 private feeIndex;
    mapping(address => uint256) private lastPerformedIndex;

    /* ======== EVENTS ======== */

    event FeeCharged(
        address indexed token,
        address indexed owner,
        uint256 amount
    );

    event AutoClaimEnabled(address indexed owner, uint256 indexed fnftId);

    event AutoClaimDisabled(address indexed owner, uint256 indexed fnftId);

    event AutoClaimed(
        uint256 indexed fnftId,
        address indexed owner,
        uint256 amount
    );

    /* ======== INITIALIZATION ======== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _addressProvider,
        address _priceOracleAggregator,
        address _DAO,
        address[] memory _tokens,
        uint256 _baseFee
    ) external initializer {
        if (_addressProvider == address(0)) revert INVALID_ADDRESS();
        if (_priceOracleAggregator == address(0)) revert INVALID_ADDRESS();
        if (_DAO == address(0)) revert INVALID_ADDRESS();
        if (_baseFee == 0) revert INVALID_AMOUNT();

        addressProvider = ILockAddressRegistry(_addressProvider);
        fnft = IERC721Enumerable(addressProvider.getFNFT());
        priceOracleAggregator = IPriceOracleAggregator(_priceOracleAggregator);
        DAO = _DAO;
        baseFee = _baseFee;

        tokens = _tokens;
        for (uint256 i = 0; i < _tokens.length; i++) {
            if (_tokens[i] == address(0)) revert INVALID_ADDRESS();
            isAllowedToken[_tokens[i]] = true;
        }

        __Ownable_init();
        __Pausable_init();
        __ERC721Holder_init();
    }

    /* ======== POLICY FUNCTIONS ======== */

    function pause() external onlyPolicy whenNotPaused {
        return _pause();
    }

    function unpause() external onlyPolicy whenPaused {
        return _unpause();
    }

    function updatePriceOracleAggregator(address _priceOracleAggregator)
        external
        onlyPolicy
    {
        if (_priceOracleAggregator == address(0)) revert INVALID_ADDRESS();

        priceOracleAggregator = IPriceOracleAggregator(_priceOracleAggregator);
    }

    function updateDAO(address _DAO) external onlyPolicy {
        if (_DAO == address(0)) revert INVALID_ADDRESS();

        DAO = _DAO;
    }

    function addTokens(address[] memory _tokens) external onlyPolicy {
        uint256 length = _tokens.length;

        for (uint256 i = 0; i < length; i++) {
            address token = _tokens[i];
            if (token == address(0)) revert INVALID_ADDRESS();

            tokens.push(token);
            isAllowedToken[token] = true;
        }
    }

    function removeTokens(address[] memory _tokens) external onlyPolicy {
        uint256 length = _tokens.length;

        for (uint256 i = 0; i < length; i++) {
            address token = _tokens[i];
            if (token == address(0)) revert INVALID_ADDRESS();

            for (uint256 j = 0; j < tokens.length; j++) {
                if (tokens[j] == token) {
                    tokens[j] = tokens[tokens.length - 1];
                    delete tokens[tokens.length - 1];
                    tokens.pop();
                    isAllowedToken[token] = false;
                    break;
                }
            }
        }
    }

    function updateBaseFee(uint256 _baseFee) external onlyPolicy {
        if (_baseFee == 0) revert INVALID_AMOUNT();

        baseFee = _baseFee;
    }

    function withdrawFee(address _token) external onlyPolicy {
        uint256 amount = IERC20(_token).balanceOf(address(this));
        if (amount == 0) revert INVALID_AMOUNT();

        IERC20(_token).safeTransfer(DAO, amount);
    }

    /* ======== USER FUNCTIONS ======== */

    function chargeFee(address token, uint256 amount) external whenNotPaused {
        if (!isAllowedToken[token]) revert NOT_ALLOWED_TOKEN();
        if (amount == 0) revert INVALID_AMOUNT();

        chargedAmount[msg.sender] +=
            (priceOracleAggregator.viewPriceInUSD(token) * amount) /
            10**IERC20Metadata(token).decimals();

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit FeeCharged(token, msg.sender, amount);
    }

    function enableAutoClaim(uint256[] memory fnftIds, uint256 interval)
        external
        whenNotPaused
    {
        if (interval < MIN_INTERVAL) revert INVALID_INTERVAL();

        for (uint256 i = 0; i < fnftIds.length; i++) {
            uint256 fnftId = fnftIds[i];
            if (fnft.ownerOf(fnftId) != msg.sender) revert NOT_OWNER();
            if (isAuto[msg.sender][fnftId]) revert ALREADY_ENABLED();

            isAuto[msg.sender][fnftId] = true;
            claimInfo[fnftId].interval = interval;

            emit AutoClaimEnabled(msg.sender, fnftId);
        }
    }

    function disableAutoClaim(uint256[] memory fnftIds) external whenNotPaused {
        for (uint256 i = 0; i < fnftIds.length; i++) {
            uint256 fnftId = fnftIds[i];
            if (fnft.ownerOf(fnftId) != msg.sender) revert NOT_OWNER();
            if (!isAuto[msg.sender][fnftId]) revert ALREADY_DISABLED();

            isAuto[msg.sender][fnftId] = false;

            emit AutoClaimDisabled(msg.sender, fnftId);
        }
    }

    /* ======== VIEW FUNCTIONS ======== */

    function enabledFNFTs(address owner)
        external
        view
        returns (uint256[] memory fnftIds)
    {
        uint256 length = fnft.balanceOf(owner);
        uint256 idx;

        for (uint256 i = 0; i < length; i++) {
            uint256 fnftId = fnft.tokenOfOwnerByIndex(owner, i);
            if (isAuto[owner][fnftId]) idx++;
        }

        fnftIds = new uint256[](idx);
        idx = 0;

        for (uint256 i = 0; i < length; i++) {
            uint256 fnftId = fnft.tokenOfOwnerByIndex(owner, i);
            if (isAuto[owner][fnftId]) fnftIds[idx++] = fnftId;
        }
    }

    function allTokens() external view returns (address[] memory) {
        return tokens;
    }

    /* ======== KEEPER ======== */

    function checkUpkeep(bytes calldata checkData)
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        (uint256 indexFrom, uint256 indexTo) = abi.decode(
            checkData,
            (uint256, uint256)
        );

        uint256[] memory claimableFNFTs = new uint256[](MAX_CLAIMABLE_COUNT);
        uint256 idx;

        uint256 totalSupply = fnft.totalSupply();
        if (indexTo > totalSupply) {
            indexTo = totalSupply;
        }

        for (uint256 i = indexFrom; i < indexTo; i++) {
            uint256 fnftId = fnft.tokenByIndex(i);
            address owner = fnft.ownerOf(fnftId);
            ClaimInfo memory info = claimInfo[fnftId];

            if (
                chargedAmount[owner] >= baseFee &&
                isAuto[owner][fnftId] &&
                block.timestamp >= info.lastUpdate + info.interval &&
                fnft.isApprovedForAll(owner, address(this))
            ) {
                claimableFNFTs[idx++] = fnftId;
            }

            if (idx == MAX_CLAIMABLE_COUNT) {
                break;
            }
        }

        if (idx > 0) {
            upkeepNeeded = true;
            performData = abi.encode(claimableFNFTs);
        }
    }

    function performUpkeep(bytes calldata performData)
        external
        override
        whenNotPaused
    {
        uint256[] memory claimableFNFTs = abi.decode(performData, (uint256[]));

        feeIndex++;

        for (uint256 i = 0; i < MAX_CLAIMABLE_COUNT; i++) {
            uint256 fnftId = claimableFNFTs[i];
            if (fnftId == 0) {
                return;
            }

            address owner = fnft.ownerOf(fnftId);
            if (lastPerformedIndex[owner] < feeIndex) {
                if (chargedAmount[owner] >= baseFee) {
                    unchecked {
                        chargedAmount[owner] -= baseFee;
                        lastPerformedIndex[owner] = feeIndex;
                    }
                } else {
                    continue;
                }
            }

            for (uint256 j = 0; ; j++) {
                address farm = addressProvider.getFarm(j);
                if (farm == address(0)) {
                    break;
                }

                ILockFarm lockFarm = ILockFarm(farm);
                if (lockFarm.pendingReward(fnftId) > 0) {
                    ClaimInfo storage info = claimInfo[fnftId];
                    IERC20 rewardToken = IERC20(lockFarm.rewardToken());

                    fnft.safeTransferFrom(owner, address(this), fnftId);
                    uint256 before = rewardToken.balanceOf(address(this));
                    lockFarm.claim(fnftId); // claim from lock farm
                    uint256 claimedAmount = rewardToken.balanceOf(
                        address(this)
                    ) - before;
                    if (claimedAmount > 0) {
                        rewardToken.safeTransfer(owner, claimedAmount);
                    }
                    fnft.safeTransferFrom(address(this), owner, fnftId);

                    info.lastUpdate = block.timestamp;

                    emit AutoClaimed(fnftId, owner, claimedAmount);

                    break;
                }
            }
        }
    }
}
