// SPDX-License-Identifier: AGPL-3.0-or-later
pragma abicoder v2;
pragma solidity 0.8.9;

import '@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol';

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
    function __Ownable_init() internal initializer {
        __Context_init_unchained();
        __Ownable_init_unchained();
    }

    function __Ownable_init_unchained() internal initializer {
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

    uint256[49] private __gap;
}

library CountersUpgradeable {
    struct Counter {
        uint256 _value; // default: 0
    }

    function init(Counter storage counter, uint256 _initValue) internal {
        counter._value = _initValue;
    }

    function current(Counter storage counter) internal view returns (uint256) {
        return counter._value;
    }

    function increment(Counter storage counter) internal {
        counter._value += 1;
    }

    function decrement(Counter storage counter) internal {
        counter._value = counter._value - 1;
    }
}

contract BondNoTreasuryV3 is OwnableUpgradeable, PausableUpgradeable {
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /* ======== EVENTS ======== */

    event BondCreated(
        uint256 depositId,
        address principal,
        uint256 deposit,
        uint256 indexed payout,
        uint256 indexed expires,
        uint256 indexed priceInUSD
    );
    event BondRedeemed(
        uint256 depositId,
        address indexed recipient,
        uint256 payout,
        uint256 remaining
    );

    /* ======== STATE VARIABLES ======== */

    address public rewardToken; // token given as payment for bond
    address public DAO; // receives profit share from bond
    IPriceOracleAggregator public priceOracleAggregator; // bond price oracle aggregator

    uint256 rewardUnit; // HEC: 1e9, WETH: 1e18

    address[] public principals; // tokens used to create bond
    mapping(address => bool) public isPrincipal; // is token used to create bond

    CountersUpgradeable.Counter public depositIdGenerator; // id for each deposit
    mapping(address => mapping(uint256 => uint256)) public ownedDeposits; // each wallet owned index=>depositId
    mapping(uint256 => uint256) public depositIndexes; // each depositId and its index in ownedDeposits
    mapping(address => uint256) public depositCounts; // each wallet total deposit count

    mapping(uint256 => Bond) public bondInfo; // stores bond information for depositId

    uint256[] public lockingPeriods; // stores locking periods of discounts
    mapping(uint256 => uint256) public lockingDiscounts; // stores discount in hundreths for locking periods ( 500 = 5% = 0.05 )

    uint256 public totalRemainingPayout; // total remaining rewardToken payout for bonding
    uint256 public totalBondedValue; // total amount of payout assets sold to the bonders
    mapping(address => uint256) public totalPrincipals; // total principal bonded through this depository

    uint256 public minimumPrice; //min price

    string public name; // name of this bond

    string public constant VERSION = '2.0'; // version number

    enum CONFIG {
        DEPOSIT_TOKEN,
        FEE_RECIPIENT,
        FUND_RECIPIENT
    }
    mapping(CONFIG => bool) public initialized;
    uint256 constant ONEinBPS = 10000;
    uint256 public feeBps; // 10000=100%, 100=1%
    address public fundRecipient;
    mapping(address => mapping(address => uint256)) public tokenBalances; // balances for each deposit token
    // address[] public depositTokens;
    address[] public feeRecipients;
    uint256[] public feeWeightBps;
    mapping(address => uint256) feeWeightFor; // feeRecipient=>feeWeight

    /* ======== STRUCTS ======== */

    // Info for bond holder
    struct Bond {
        uint256 depositId; // deposit Id
        address principal; // token used to create bond
        uint256 amount; // princial deposited amount
        uint256 payout; // rewardToken remaining to be paid
        uint256 vesting; // Blocks left to vest
        uint256 lastBlockAt; // Last interaction
        uint256 pricePaid; // In DAI, for front end viewing
        address depositor; //deposit address
    }

    /* ======== INITIALIZATION ======== */

    function initialize(
        string memory _name,
        address _rewardToken,
        address _DAO,
        address _priceOracleAggregator
    ) external initializer {
        require(_rewardToken != address(0));
        rewardToken = _rewardToken;
        require(_DAO != address(0));
        DAO = _DAO;
        require(_priceOracleAggregator != address(0));
        priceOracleAggregator = IPriceOracleAggregator(_priceOracleAggregator);

        name = _name;
        rewardUnit = 10**(IERC20MetadataUpgradeable(_rewardToken).decimals());
        depositIdGenerator.init(1); //id starts with 1 for better handling in mapping of case NOT FOUND

        __Ownable_init();
        __Pausable_init();
    }

    /* ======== MODIFIER ======== */
    modifier onlyPrincipal(address _principal) {
        require(isPrincipal[_principal], 'Invalid principal');
        _;
    }

    /* ======== INIT FUNCTIONS ======== */

    /**
     *  @notice initialize fee recipients and split percentage for each of them, in basis points
     */
    function initializeFeeRecipient(
        address[] memory recipients,
        uint256[] memory weightBps
    ) external onlyPolicy {
        require(!initialized[CONFIG.FEE_RECIPIENT], 'initialzed already');
        initialized[CONFIG.FEE_RECIPIENT] = true;

        require(
            initialized[CONFIG.FUND_RECIPIENT],
            'need to run initializeFundReceipient first'
        );
        require(
            recipients.length > 0,
            'there shall be at least one fee recipient'
        );
        require(
            recipients.length == weightBps.length,
            'number of recipients and number of weightBps should match'
        );

        uint256 total = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            require(
                weightBps[i] > 0,
                'all weight in weightBps should be greater than 0'
            );
            total += weightBps[i];

            require(
                recipients[i] != fundRecipient,
                'address in recipients can be the same as fundRecipient'
            );
            require(
                feeWeightFor[recipients[i]] == 0,
                'duplicated address detected in recipients'
            );
            feeWeightFor[recipients[i]] = weightBps[i];
        }
        require(total == ONEinBPS, 'the sum of weightBps should be 10000');
        feeRecipients = recipients;
        feeWeightBps = weightBps;
    }

    /**
     *  @notice initialize deposit token types, should be stable coins
     */
    function initializeDepositTokens(address[] memory _principals)
        external
        onlyPolicy
    {
        require(!initialized[CONFIG.DEPOSIT_TOKEN], 'initialzed already');
        initialized[CONFIG.DEPOSIT_TOKEN] = true;

        require(
            _principals.length > 0,
            'principals need to contain at least one token'
        );

        principals = _principals;

        for (uint256 i = 0; i < _principals.length; i++) {
            isPrincipal[_principals[i]] = true;
        }
    }

    /**
     *  @notice initialize the fund recipient and the fee percentage in basis points
     */
    function initializeFundRecipient(address _fundRecipient, uint256 _feeBps)
        external
        onlyPolicy
    {
        require(!initialized[CONFIG.FUND_RECIPIENT], 'initialzed already');
        initialized[CONFIG.FUND_RECIPIENT] = true;

        require(_fundRecipient != address(0), '_fundRecipient address invalid');
        fundRecipient = _fundRecipient;

        feeBps = _feeBps;
    }

    /* ======== POLICY FUNCTIONS ======== */

    /**
     *  @notice set discount for locking period
     *  @param _lockingPeriod uint
     *  @param _discount uint
     */
    function setLockingDiscount(uint256 _lockingPeriod, uint256 _discount)
        external
        onlyPolicy
    {
        require(_lockingPeriod > 0, 'Invalid locking period');
        require(_discount < ONEinBPS, 'Invalid discount');

        // remove locking period
        if (_discount == 0) {
            uint256 length = lockingPeriods.length;
            for (uint256 i = 0; i < length; i++) {
                if (lockingPeriods[i] == _lockingPeriod) {
                    lockingPeriods[i] = lockingPeriods[length - 1];
                    delete lockingPeriods[length - 1];
                    lockingPeriods.pop();
                }
            }
        }
        // push if new locking period
        else if (lockingDiscounts[_lockingPeriod] == 0) {
            lockingPeriods.push(_lockingPeriod);
        }

        lockingDiscounts[_lockingPeriod] = _discount;
    }

    function setMinPrice(uint256 _minimumPrice) external onlyPolicy {
        minimumPrice = _minimumPrice;
    }

    function updateName(string memory _name) external onlyPolicy {
        name = _name;
    }

    function updateFundWeights(address _fundRecipient, uint256 _feeBps)
        external
        onlyPolicy
    {
        require(initialized[CONFIG.FUND_RECIPIENT], 'not yet initialzed');

        require(_fundRecipient != address(0), '_fundRecipient address invalid');
        fundRecipient = _fundRecipient;

        feeBps = _feeBps;
    }

    function updateFeeWeights(
        address[] memory recipients,
        uint256[] memory weightBps
    ) external onlyPolicy {
        require(initialized[CONFIG.FEE_RECIPIENT], 'not yet initialzed');

        require(
            recipients.length > 0,
            'there shall be at least one fee recipient'
        );
        require(
            recipients.length == weightBps.length,
            'number of recipients and number of weightBps should match'
        );

        for (uint256 i = 0; i < feeRecipients.length; i++) {
            feeWeightFor[feeRecipients[i]] = 0;
        }

        uint256 total = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            require(
                weightBps[i] > 0,
                'all weight in weightBps should be greater than 0'
            );
            total += weightBps[i];

            require(
                recipients[i] != fundRecipient,
                'address in recipients can be the same as fundRecipient'
            );
            require(
                feeWeightFor[recipients[i]] == 0,
                'duplicated address detected in recipients'
            );
            feeWeightFor[recipients[i]] = weightBps[i];
        }

        require(total == ONEinBPS, 'the sum of weightBps should be 10000');
        feeRecipients = recipients;
        feeWeightBps = weightBps;
    }

    function updatePriceOracleAggregator(address _priceOracleAggregator)
        external
        onlyPolicy
    {
        require(_priceOracleAggregator != address(0), 'Invalid address');

        priceOracleAggregator = IPriceOracleAggregator(_priceOracleAggregator);
    }

    function pause() external onlyPolicy whenNotPaused {
        return _pause();
    }

    function unpause() external onlyPolicy whenPaused {
        return _unpause();
    }

    /* ======== USER FUNCTIONS ======== */

    /**
     *  @notice deposit bond
     *  @param _principal address
     *  @param _amount uint
     *  @param _maxPrice uint
     *  @param _lockingPeriod uint
     *  @return uint
     */
    function deposit(
        address _principal,
        uint256 _amount,
        uint256 _maxPrice,
        uint256 _lockingPeriod
    ) external onlyPrincipal(_principal) whenNotPaused returns (uint256) {
        require(_amount > 0, 'Amount zero');

        uint256 discount = lockingDiscounts[_lockingPeriod];
        require(discount > 0, 'Invalid locking period');

        uint256 priceInUSD = (bondPriceInUSD() * (ONEinBPS - discount)) /
            ONEinBPS; // Stored in bond info

        {
            uint256 nativePrice = (_bondPrice() * (ONEinBPS - discount)) /
                ONEinBPS;
            require(
                _maxPrice >= nativePrice,
                'Slippage limit: more than max price'
            ); // slippage protection
        }

        uint256 payout = payoutFor(_principal, _amount, discount); // payout to bonder is computed
        require(payout >= (rewardUnit / 100), 'Bond too small'); // must be > 0.01 rewardToken ( underflow protection )

        // total remaining payout is increased
        totalRemainingPayout = totalRemainingPayout + payout;
        require(
            totalRemainingPayout <=
                IERC20Upgradeable(rewardToken).balanceOf(address(this)),
            'Insufficient rewardToken'
        ); // has enough rewardToken balance for payout

        // total bonded value is increased
        totalBondedValue = totalBondedValue + payout;

        /**
            principal is transferred
         */
        IERC20Upgradeable(_principal).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );

        totalPrincipals[_principal] = totalPrincipals[_principal] + _amount;

        uint256 depositId = depositIdGenerator.current();
        depositIdGenerator.increment();
        // depositor info is stored
        bondInfo[depositId] = Bond({
            depositId: depositId,
            principal: _principal,
            amount: _amount,
            payout: payout,
            vesting: _lockingPeriod,
            lastBlockAt: block.timestamp,
            pricePaid: priceInUSD,
            depositor: msg.sender
        });

        ownedDeposits[msg.sender][depositCounts[msg.sender]] = depositId;
        depositIndexes[depositId] = depositCounts[msg.sender];
        depositCounts[msg.sender] = depositCounts[msg.sender] + 1;

        // indexed events are emitted
        emit BondCreated(
            depositId,
            _principal,
            _amount,
            payout,
            block.timestamp + _lockingPeriod,
            priceInUSD
        );

        processFee(_principal, _amount); // distribute fee

        return payout;
    }

    /**
     *  @notice redeem bond for user
     *  @param _depositId uint
     *  @return uint
     */
    function redeem(uint256 _depositId)
        external
        whenNotPaused
        returns (uint256)
    {
        Bond memory info = bondInfo[_depositId];
        address _recipient = info.depositor;
        require(msg.sender == _recipient, 'Cant redeem others bond');

        uint256 percentVested = percentVestedFor(_depositId); // (blocks since last interaction / vesting term remaining)

        require(percentVested >= ONEinBPS, 'Not fully vested');

        delete bondInfo[_depositId]; // delete user info

        totalRemainingPayout -= info.payout; // total remaining payout is decreased

        IERC20Upgradeable(rewardToken).transfer(_recipient, info.payout); // send payout

        emit BondRedeemed(_depositId, _recipient, info.payout, 0); // emit bond data

        removeDepositId(_recipient, _depositId);

        return info.payout;
    }

    function claimFee(address _principal, address feeRecipient) external {
        require(
            feeRecipient != fundRecipient,
            'can only claim fee for recipient'
        );
        IERC20Upgradeable(_principal).safeTransfer(
            feeRecipient,
            tokenBalances[_principal][feeRecipient]
        );
        tokenBalances[_principal][feeRecipient] = 0;
    }

    function claimFund(address _principal) external {
        IERC20Upgradeable(_principal).safeTransfer(
            fundRecipient,
            tokenBalances[_principal][fundRecipient]
        );
        tokenBalances[_principal][fundRecipient] = 0;
    }

    /* ======== INTERNAL HELPER FUNCTIONS ======== */

    /**
     *  @notice remove depositId after redeem
     */
    function removeDepositId(address _recipient, uint256 _depositId) internal {
        uint256 lastTokenIndex = depositCounts[_recipient] - 1; //underflow is intended
        uint256 tokenIndex = depositIndexes[_depositId];

        // When the token to delete is the last token, the swap operation is unnecessary
        if (tokenIndex != lastTokenIndex) {
            uint256 lastTokenId = ownedDeposits[_recipient][lastTokenIndex];

            ownedDeposits[_recipient][tokenIndex] = lastTokenId; // Move the last token to the slot of the to-delete token
            depositIndexes[lastTokenId] = tokenIndex; // Update the moved token's index
        }

        // This also deletes the contents at the last position of the array
        delete depositIndexes[_depositId];
        delete ownedDeposits[_recipient][lastTokenIndex];
        depositCounts[_recipient] = depositCounts[_recipient] - 1;
    }

    /**
     *  @notice process fee on deposit
     */
    function processFee(address _principal, uint256 _amount) internal {
        require(
            initialized[CONFIG.DEPOSIT_TOKEN] &&
                initialized[CONFIG.FEE_RECIPIENT] &&
                initialized[CONFIG.FUND_RECIPIENT],
            'please complete initialize for FeeRecipient/Principals/FundRecipient'
        );

        uint256 fee = (_amount * feeBps) / ONEinBPS;
        tokenBalances[_principal][fundRecipient] += _amount - fee;

        if (fee > 0) {
            uint256 theLast = fee;
            for (uint256 i = 0; i < feeRecipients.length - 1; i++) {
                tokenBalances[_principal][feeRecipients[i]] +=
                    (fee * feeWeightBps[i]) /
                    ONEinBPS;
                theLast -= (fee * feeWeightBps[i]) / ONEinBPS;
            }
            require(
                theLast >=
                    (fee * feeWeightBps[feeWeightBps.length - 1]) / ONEinBPS,
                'fee calculation error'
            );
            tokenBalances[_principal][
                feeRecipients[feeRecipients.length - 1]
            ] += theLast;
        }
    }

    /* ======== VIEW FUNCTIONS ======== */

    /**
     *  @notice calculate interest due for new bond
     *  @param _principal address
     *  @param _amount uint
     *  @param _discount uint
     *  @return uint
     */
    function payoutFor(
        address _principal,
        uint256 _amount,
        uint256 _discount
    ) public view returns (uint256) {
        uint256 nativePrice = (bondPrice() * (ONEinBPS - _discount)) / ONEinBPS;

        return
            (_amount *
                priceOracleAggregator.viewPriceInUSD(_principal) *
                rewardUnit) /
            (nativePrice *
                10**IERC20MetadataUpgradeable(_principal).decimals());
    }

    /**
     *  @notice calculate current bond price
     *  @return price_ uint
     */
    function bondPrice() public view returns (uint256 price_) {
        price_ = priceOracleAggregator.viewPriceInUSD(rewardToken);

        if (price_ < minimumPrice) {
            price_ = minimumPrice;
        }
    }

    /**
     *  @notice calculate current bond price and remove floor if above
     *  @return price_ uint
     */
    function _bondPrice() internal returns (uint256 price_) {
        price_ = priceOracleAggregator.viewPriceInUSD(rewardToken);

        if (price_ < minimumPrice) {
            price_ = minimumPrice;
        } else {
            minimumPrice = 0;
        }
    }

    /**
     *  @return price_ uint
     */
    function bondPriceInUSD() public view returns (uint256 price_) {
        price_ = priceOracleAggregator.viewPriceInUSD(rewardToken);
    }

    /**
     *  @notice calculate how far into vesting a depositor is
     *  @param _depositId uint
     *  @return percentVested_ uint
     */
    function percentVestedFor(uint256 _depositId)
        public
        view
        returns (uint256 percentVested_)
    {
        Bond memory bond = bondInfo[_depositId];
        uint256 timestampSinceLast = block.timestamp - bond.lastBlockAt;
        uint256 vesting = bond.vesting;

        if (vesting > 0) {
            percentVested_ = (timestampSinceLast * ONEinBPS) / vesting;
        } else {
            percentVested_ = 0;
        }
    }

    /**
     *  @notice calculate amount of rewardToken available for claim by depositor
     *  @param _depositId uint
     *  @return pendingPayout_ uint
     */
    function pendingPayoutFor(uint256 _depositId)
        public
        view
        returns (uint256 pendingPayout_)
    {
        uint256 percentVested = percentVestedFor(_depositId);
        uint256 payout = bondInfo[_depositId].payout;

        if (percentVested >= ONEinBPS) {
            pendingPayout_ = payout;
        } else {
            pendingPayout_ = (payout * percentVested) / ONEinBPS;
        }
    }

    /**
     *  @notice return minimum principal amount to deposit
     *  @param _principal address
     *  @param _discount uint
     *  @param amount_ principal amount
     */
    function minimumPrincipalAmount(address _principal, uint256 _discount)
        external
        view
        onlyPrincipal(_principal)
        returns (uint256 amount_)
    {
        uint256 nativePrice = (bondPrice() * (ONEinBPS - _discount)) / ONEinBPS;

        amount_ =
            ((rewardUnit / 100) *
                nativePrice *
                10**IERC20MetadataUpgradeable(_principal).decimals()) /
            (priceOracleAggregator.viewPriceInUSD(_principal) * rewardUnit);
    }

    /**
     *  @notice show all tokens used to create bond
     *  @return principals_ principals
     *  @return totalPrincipals_ total principals
     */
    function allPrincipals()
        external
        view
        returns (
            address[] memory principals_,
            uint256[] memory totalPrincipals_
        )
    {
        principals_ = principals;

        uint256 length = principals.length;
        totalPrincipals_ = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            totalPrincipals_[i] = totalPrincipals[principals[i]];
        }
    }

    /**
     *  @notice show all locking periods of discounts
     *  @return lockingPeriods_ locking periods
     *  @return lockingDiscounts_ locking discounts
     */
    function allLockingPeriodsDiscounts()
        external
        view
        returns (
            uint256[] memory lockingPeriods_,
            uint256[] memory lockingDiscounts_
        )
    {
        lockingPeriods_ = lockingPeriods;

        uint256 length = lockingPeriods.length;
        lockingDiscounts_ = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            lockingDiscounts_[i] = lockingDiscounts[lockingPeriods[i]];
        }
    }

    /**
     *  @notice show all bond infos for a particular owner
     *  @param _owner owner
     *  @return bondInfos_ bond infos
     *  @return pendingPayouts_ pending payouts
     */
    function allBondInfos(address _owner)
        external
        view
        returns (Bond[] memory bondInfos_, uint256[] memory pendingPayouts_)
    {
        uint256 length = depositCounts[_owner];
        bondInfos_ = new Bond[](length);
        pendingPayouts_ = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            uint256 depositId = ownedDeposits[_owner][i];
            bondInfos_[i] = bondInfo[depositId];
            pendingPayouts_[i] = pendingPayoutFor(depositId);
        }
    }

    /**
     *  @notice show all fee recipients and weight bps
     *  @return feeRecipients_ fee recipients address
     *  @return feeWeightBps_ fee weight bps
     */
    function allFeeInfos()
        external
        view
        returns (
            address[] memory feeRecipients_,
            uint256[] memory feeWeightBps_
        )
    {
        feeRecipients_ = feeRecipients;
        feeWeightBps_ = feeWeightBps;
    }

    /* ======= AUXILLIARY ======= */

    /**
     *  @notice allow anyone to send lost tokens (excluding principal or rewardToken) to the DAO
     *  @return bool
     */
    function withdrawToken(address _token) external onlyPolicy returns (bool) {
        uint256 amount = IERC20Upgradeable(_token).balanceOf(address(this));
        if (_token == rewardToken) {
            amount = amount - totalRemainingPayout;
        }
        IERC20Upgradeable(_token).safeTransfer(DAO, amount);
        return true;
    }
}
