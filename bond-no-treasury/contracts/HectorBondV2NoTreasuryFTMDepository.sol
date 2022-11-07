// SPDX-License-Identifier: AGPL-3.0-or-later
pragma abicoder v2;
pragma solidity 0.7.5;

interface IOwnable {
    function policy() external view returns (address);

    function renounceManagement() external;

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
}

library SafeMath {
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, 'SafeMath: addition overflow');

        return c;
    }

    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return sub(a, b, 'SafeMath: subtraction overflow');
    }

    function sub(
        uint256 a,
        uint256 b,
        string memory errorMessage
    ) internal pure returns (uint256) {
        require(b <= a, errorMessage);
        uint256 c = a - b;

        return c;
    }

    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b, 'SafeMath: multiplication overflow');

        return c;
    }

    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return div(a, b, 'SafeMath: division by zero');
    }

    function div(
        uint256 a,
        uint256 b,
        string memory errorMessage
    ) internal pure returns (uint256) {
        require(b > 0, errorMessage);
        uint256 c = a / b;
        return c;
    }

    function mod(uint256 a, uint256 b) internal pure returns (uint256) {
        return mod(a, b, 'SafeMath: modulo by zero');
    }

    function mod(
        uint256 a,
        uint256 b,
        string memory errorMessage
    ) internal pure returns (uint256) {
        require(b != 0, errorMessage);
        return a % b;
    }

    function sqrrt(uint256 a) internal pure returns (uint256 c) {
        if (a > 3) {
            c = a;
            uint256 b = add(div(a, 2), 1);
            while (b < c) {
                c = b;
                b = div(add(div(a, b), b), 2);
            }
        } else if (a != 0) {
            c = 1;
        }
    }
}

library Address {
    function isContract(address account) internal view returns (bool) {
        uint256 size;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }

    function sendValue(address payable recipient, uint256 amount) internal {
        require(
            address(this).balance >= amount,
            'Address: insufficient balance'
        );

        // solhint-disable-next-line avoid-low-level-calls, avoid-call-value
        (bool success, ) = recipient.call{value: amount}('');
        require(
            success,
            'Address: unable to send value, recipient may have reverted'
        );
    }

    function functionCall(address target, bytes memory data)
        internal
        returns (bytes memory)
    {
        return functionCall(target, data, 'Address: low-level call failed');
    }

    function functionCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal returns (bytes memory) {
        return _functionCallWithValue(target, data, 0, errorMessage);
    }

    function functionCallWithValue(
        address target,
        bytes memory data,
        uint256 value
    ) internal returns (bytes memory) {
        return
            functionCallWithValue(
                target,
                data,
                value,
                'Address: low-level call with value failed'
            );
    }

    function functionCallWithValue(
        address target,
        bytes memory data,
        uint256 value,
        string memory errorMessage
    ) internal returns (bytes memory) {
        require(
            address(this).balance >= value,
            'Address: insufficient balance for call'
        );
        require(isContract(target), 'Address: call to non-contract');

        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory returndata) = target.call{value: value}(
            data
        );
        return _verifyCallResult(success, returndata, errorMessage);
    }

    function _functionCallWithValue(
        address target,
        bytes memory data,
        uint256 weiValue,
        string memory errorMessage
    ) private returns (bytes memory) {
        require(isContract(target), 'Address: call to non-contract');

        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory returndata) = target.call{value: weiValue}(
            data
        );
        if (success) {
            return returndata;
        } else {
            // Look for revert reason and bubble it up if present
            if (returndata.length > 0) {
                // The easiest way to bubble the revert reason is using memory via assembly

                // solhint-disable-next-line no-inline-assembly
                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert(errorMessage);
            }
        }
    }

    function functionStaticCall(address target, bytes memory data)
        internal
        view
        returns (bytes memory)
    {
        return
            functionStaticCall(
                target,
                data,
                'Address: low-level static call failed'
            );
    }

    function functionStaticCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal view returns (bytes memory) {
        require(isContract(target), 'Address: static call to non-contract');

        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory returndata) = target.staticcall(data);
        return _verifyCallResult(success, returndata, errorMessage);
    }

    function functionDelegateCall(address target, bytes memory data)
        internal
        returns (bytes memory)
    {
        return
            functionDelegateCall(
                target,
                data,
                'Address: low-level delegate call failed'
            );
    }

    function functionDelegateCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal returns (bytes memory) {
        require(isContract(target), 'Address: delegate call to non-contract');

        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory returndata) = target.delegatecall(data);
        return _verifyCallResult(success, returndata, errorMessage);
    }

    function _verifyCallResult(
        bool success,
        bytes memory returndata,
        string memory errorMessage
    ) private pure returns (bytes memory) {
        if (success) {
            return returndata;
        } else {
            if (returndata.length > 0) {
                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert(errorMessage);
            }
        }
    }

    function addressToString(address _address)
        internal
        pure
        returns (string memory)
    {
        bytes32 _bytes = bytes32(uint256(_address));
        bytes memory HEX = '0123456789abcdef';
        bytes memory _addr = new bytes(42);

        _addr[0] = '0';
        _addr[1] = 'x';

        for (uint256 i = 0; i < 20; i++) {
            _addr[2 + i * 2] = HEX[uint8(_bytes[i + 12] >> 4)];
            _addr[3 + i * 2] = HEX[uint8(_bytes[i + 12] & 0x0f)];
        }

        return string(_addr);
    }
}

interface IERC20 {
    function decimals() external view returns (uint8);

    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function transfer(address recipient, uint256 amount)
        external
        returns (bool);

    function allowance(address owner, address spender)
        external
        view
        returns (uint256);

    function approve(address spender, uint256 amount) external returns (bool);

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 value);

    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );
}

abstract contract ERC20 is IERC20 {
    using SafeMath for uint256;

    // TODO comment actual hash value.
    bytes32 private constant ERC20TOKEN_ERC1820_INTERFACE_ID =
        keccak256('ERC20Token');

    mapping(address => uint256) internal _balances;

    mapping(address => mapping(address => uint256)) internal _allowances;

    uint256 internal _totalSupply;

    string internal _name;

    string internal _symbol;

    uint8 internal _decimals;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) {
        _name = name_;
        _symbol = symbol_;
        _decimals = decimals_;
    }

    function name() public view returns (string memory) {
        return _name;
    }

    function symbol() public view returns (string memory) {
        return _symbol;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account)
        public
        view
        virtual
        override
        returns (uint256)
    {
        return _balances[account];
    }

    function transfer(address recipient, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function allowance(address owner, address spender)
        public
        view
        virtual
        override
        returns (uint256)
    {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public virtual override returns (bool) {
        _transfer(sender, recipient, amount);
        _approve(
            sender,
            msg.sender,
            _allowances[sender][msg.sender].sub(
                amount,
                'ERC20: transfer amount exceeds allowance'
            )
        );
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue)
        public
        virtual
        returns (bool)
    {
        _approve(
            msg.sender,
            spender,
            _allowances[msg.sender][spender].add(addedValue)
        );
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue)
        public
        virtual
        returns (bool)
    {
        _approve(
            msg.sender,
            spender,
            _allowances[msg.sender][spender].sub(
                subtractedValue,
                'ERC20: decreased allowance below zero'
            )
        );
        return true;
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal virtual {
        require(sender != address(0), 'ERC20: transfer from the zero address');
        require(recipient != address(0), 'ERC20: transfer to the zero address');

        _beforeTokenTransfer(sender, recipient, amount);

        _balances[sender] = _balances[sender].sub(
            amount,
            'ERC20: transfer amount exceeds balance'
        );
        _balances[recipient] = _balances[recipient].add(amount);
        emit Transfer(sender, recipient, amount);
    }

    function _mint(address account_, uint256 ammount_) internal virtual {
        require(account_ != address(0), 'ERC20: mint to the zero address');
        _beforeTokenTransfer(address(this), account_, ammount_);
        _totalSupply = _totalSupply.add(ammount_);
        _balances[account_] = _balances[account_].add(ammount_);
        emit Transfer(address(this), account_, ammount_);
    }

    function _burn(address account, uint256 amount) internal virtual {
        require(account != address(0), 'ERC20: burn from the zero address');

        _beforeTokenTransfer(account, address(0), amount);

        _balances[account] = _balances[account].sub(
            amount,
            'ERC20: burn amount exceeds balance'
        );
        _totalSupply = _totalSupply.sub(amount);
        emit Transfer(account, address(0), amount);
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        require(owner != address(0), 'ERC20: approve from the zero address');
        require(spender != address(0), 'ERC20: approve to the zero address');

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _beforeTokenTransfer(
        address from_,
        address to_,
        uint256 amount_
    ) internal virtual {}
}

interface IERC2612Permit {
    function permit(
        address owner,
        address spender,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function nonces(address owner) external view returns (uint256);
}

library Counters {
    using SafeMath for uint256;

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
        counter._value = counter._value.sub(1);
    }
}

library SafeERC20 {
    using SafeMath for uint256;
    using Address for address;

    function safeTransfer(
        IERC20 token,
        address to,
        uint256 value
    ) internal {
        _callOptionalReturn(
            token,
            abi.encodeWithSelector(token.transfer.selector, to, value)
        );
    }

    function safeTransferFrom(
        IERC20 token,
        address from,
        address to,
        uint256 value
    ) internal {
        _callOptionalReturn(
            token,
            abi.encodeWithSelector(token.transferFrom.selector, from, to, value)
        );
    }

    function safeApprove(
        IERC20 token,
        address spender,
        uint256 value
    ) internal {
        require(
            (value == 0) || (token.allowance(address(this), spender) == 0),
            'SafeERC20: approve from non-zero to non-zero allowance'
        );
        _callOptionalReturn(
            token,
            abi.encodeWithSelector(token.approve.selector, spender, value)
        );
    }

    function safeIncreaseAllowance(
        IERC20 token,
        address spender,
        uint256 value
    ) internal {
        uint256 newAllowance = token.allowance(address(this), spender).add(
            value
        );
        _callOptionalReturn(
            token,
            abi.encodeWithSelector(
                token.approve.selector,
                spender,
                newAllowance
            )
        );
    }

    function safeDecreaseAllowance(
        IERC20 token,
        address spender,
        uint256 value
    ) internal {
        uint256 newAllowance = token.allowance(address(this), spender).sub(
            value,
            'SafeERC20: decreased allowance below zero'
        );
        _callOptionalReturn(
            token,
            abi.encodeWithSelector(
                token.approve.selector,
                spender,
                newAllowance
            )
        );
    }

    function _callOptionalReturn(IERC20 token, bytes memory data) private {
        bytes memory returndata = address(token).functionCall(
            data,
            'SafeERC20: low-level call failed'
        );
        if (returndata.length > 0) {
            // Return data is optional
            // solhint-disable-next-line max-line-length
            require(
                abi.decode(returndata, (bool)),
                'SafeERC20: ERC20 operation did not succeed'
            );
        }
    }
}

library FullMath {
    function fullMul(uint256 x, uint256 y)
        private
        pure
        returns (uint256 l, uint256 h)
    {
        uint256 mm = mulmod(x, y, uint256(-1));
        l = x * y;
        h = mm - l;
        if (mm < l) h -= 1;
    }

    function fullDiv(
        uint256 l,
        uint256 h,
        uint256 d
    ) private pure returns (uint256) {
        uint256 pow2 = d & -d;
        d /= pow2;
        l /= pow2;
        l += h * ((-pow2) / pow2 + 1);
        uint256 r = 1;
        r *= 2 - d * r;
        r *= 2 - d * r;
        r *= 2 - d * r;
        r *= 2 - d * r;
        r *= 2 - d * r;
        r *= 2 - d * r;
        r *= 2 - d * r;
        r *= 2 - d * r;
        return l * r;
    }

    function mulDiv(
        uint256 x,
        uint256 y,
        uint256 d
    ) internal pure returns (uint256) {
        (uint256 l, uint256 h) = fullMul(x, y);
        uint256 mm = mulmod(x, y, d);
        if (mm > l) h -= 1;
        l -= mm;
        require(h < d, 'FullMath::mulDiv: overflow');
        return fullDiv(l, h, d);
    }
}

library FixedPoint {
    struct uq112x112 {
        uint224 _x;
    }

    struct uq144x112 {
        uint256 _x;
    }

    uint8 private constant RESOLUTION = 112;
    uint256 private constant Q112 = 0x10000000000000000000000000000;
    uint256 private constant Q224 =
        0x100000000000000000000000000000000000000000000000000000000;
    uint256 private constant LOWER_MASK = 0xffffffffffffffffffffffffffff; // decimal of UQ*x112 (lower 112 bits)

    function decode(uq112x112 memory self) internal pure returns (uint112) {
        return uint112(self._x >> RESOLUTION);
    }

    function decode112with18(uq112x112 memory self)
        internal
        pure
        returns (uint256)
    {
        return uint256(self._x) / 5192296858534827;
    }

    function fraction(uint256 numerator, uint256 denominator)
        internal
        pure
        returns (uq112x112 memory)
    {
        require(denominator > 0, 'FixedPoint::fraction: division by zero');
        if (numerator == 0) return FixedPoint.uq112x112(0);

        if (numerator <= uint144(-1)) {
            uint256 result = (numerator << RESOLUTION) / denominator;
            require(result <= uint224(-1), 'FixedPoint::fraction: overflow');
            return uq112x112(uint224(result));
        } else {
            uint256 result = FullMath.mulDiv(numerator, Q112, denominator);
            require(result <= uint224(-1), 'FixedPoint::fraction: overflow');
            return uq112x112(uint224(result));
        }
    }
}

interface IUniswapPairOracle {
    function consult(address token, uint256 amountIn)
        external
        view
        returns (uint256 amountOut);

    function token0() external view returns (address);

    function token1() external view returns (address);
}

interface IBondPricing {
    function findOracle(address _token0, address _token1)
        external
        view
        returns (address);
}

contract HectorBondV2NoTreasuryFTMDepository is Ownable {
    using Counters for Counters.Counter;
    using FixedPoint for *;
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

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

    address public immutable rewardToken; // token given as payment for bond
    address public immutable DAO; // receives profit share from bond
    address public bondPricing; // bond price oracles

    uint256 immutable rewardUnit; // HEC: 1e9, WETH: 1e18

    address[] public principals; // tokens used to create bond
    mapping(address => bool) public isPrincipal; // is token used to create bond

    Counters.Counter public depositIdGenerator; // id for each deposit
    mapping(address => mapping(uint256 => uint256)) public ownedDeposits; // each wallet owned index=>depositId
    mapping(uint256 => uint256) public depositIndexes; // each depositId and its index in ownedDeposits
    mapping(address => uint256) public depositCounts; // each wallet total deposit count

    mapping(uint256 => Bond) public bondInfo; // stores bond information for depositId

    uint256[] public lockingPeriods; // stores locking periods of discounts
    mapping(uint256 => uint256) public lockingDiscounts; // stores discount in hundreths for locking periods ( 500 = 5% = 0.05 )

    uint256 public totalDebt; // total value of outstanding bonds; used for pricing
    uint256 public lastDecay; // reference block for debt decay

    uint256 public totalRemainingPayout; // total remaining rewardToken payout for bonding
    mapping(address => uint256) public totalPrincipals; // total principal bonded through this depository

    uint256 public minimumPrice; //min price

    string public name; // name of this bond

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
        uint256 payout; // rewardToken remaining to be paid
        uint256 vesting; // Blocks left to vest
        uint256 lastBlockAt; // Last interaction
        uint256 pricePaid; // In DAI, for front end viewing
        address depositor; //deposit address
    }

    /* ======== INITIALIZATION ======== */

    constructor(
        string memory _name,
        address _rewardToken,
        address _DAO,
        address _bondPricing
    ) {
        require(_rewardToken != address(0));
        rewardToken = _rewardToken;
        require(_DAO != address(0));
        DAO = _DAO;
        require(_bondPricing != address(0));
        bondPricing = _bondPricing;

        name = _name;
        rewardUnit = 10**(IERC20(_rewardToken).decimals());
        depositIdGenerator.init(1); //id starts with 1 for better handling in mapping of case NOT FOUND
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

        require(_feeBps > 0, '_feeBps should be greater than 0'); //? or maybe this rule is not neccessary
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
        require(_discount < 10000, 'Invalid discount');

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

        require(_feeBps > 0, '_feeBps should be greater than 0'); //? or maybe this rule is not neccessary
        feeBps = _feeBps;
    }

    function updateFeeWeights(
        address[] memory recipients,
        uint256[] memory weightBps
    ) external onlyPolicy {
        require(feeRecipients.length > 0, 'fee recipients not yet initialized');
        require(
            recipients.length == weightBps.length,
            'number of recipients and number of weightBps should match'
        );
        require(
            recipients.length == feeRecipients.length,
            'must update all receipients together'
        );

        uint256 total = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            require(
                weightBps[i] > 0,
                'all weight in weightBps should be greater than 0'
            );
            total += weightBps[i];

            require(
                feeWeightFor[recipients[i]] > 0,
                'all recipients must be in the fee weight initilization list'
            );
            feeWeightFor[recipients[i]] = weightBps[i];
        }

        require(total == ONEinBPS, 'the sum of weightBps should be 10000');
        feeRecipients = recipients;
        feeWeightBps = weightBps;
    }

    function updateBondPricing(address _bondPricing) external onlyPolicy {
        require(_bondPricing != address(0), 'Invalid address');

        bondPricing = _bondPricing;
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
    ) external onlyPrincipal(_principal) returns (uint256) {
        require(_amount > 0, 'Amount zero');

        uint256 discount = lockingDiscounts[_lockingPeriod];
        require(discount > 0, 'Invalid locking period');

        uint256 priceInUSD = bondPriceInUSD(_principal)
            .mul(10000 - discount)
            .div(10000); // Stored in bond info

        {
            uint256 nativePrice = _bondPrice(_principal)
                .mul(10000 - discount)
                .div(10000);
            require(
                _maxPrice >= nativePrice,
                'Slippage limit: more than max price'
            ); // slippage protection
        }

        uint256 value = _amount.mul(rewardUnit).div(
            10**IERC20(_principal).decimals()
        );
        uint256 payout = payoutFor(_principal, value, discount); // payout to bonder is computed

        require(payout >= (rewardUnit / 100), 'Bond too small'); // must be > 0.01 rewardToken ( underflow protection )

        // total remaining payout is increased
        totalRemainingPayout = totalRemainingPayout.add(payout);
        require(
            totalRemainingPayout <=
                IERC20(rewardToken).balanceOf(address(this)),
            'Insufficient rewardToken'
        ); // has enough rewardToken balance for payout

        /**
            principal is transferred
         */
        IERC20(_principal).safeTransferFrom(msg.sender, address(this), _amount);

        totalPrincipals[_principal] = totalPrincipals[_principal].add(_amount);

        // total debt is increased
        totalDebt = totalDebt.add(value);

        uint256 depositId = depositIdGenerator.current();
        depositIdGenerator.increment();
        // depositor info is stored
        bondInfo[depositId] = Bond({
            depositId: depositId,
            principal: _principal,
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
            block.timestamp.add(_lockingPeriod),
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
    function redeem(uint256 _depositId) external returns (uint256) {
        Bond memory info = bondInfo[_depositId];
        address _recipient = info.depositor;
        require(msg.sender == _recipient, 'Cant redeem others bond');

        uint256 percentVested = percentVestedFor(_depositId); // (blocks since last interaction / vesting term remaining)

        require(percentVested >= 10000, 'Not fully vested');

        delete bondInfo[_depositId]; // delete user info

        totalRemainingPayout = totalRemainingPayout.sub(info.payout); // total remaining payout is decreased

        IERC20(rewardToken).transfer(_recipient, info.payout); // send payout

        emit BondRedeemed(_depositId, _recipient, info.payout, 0); // emit bond data

        removeDepositId(_recipient, _depositId);

        return info.payout;
    }

    function claimFee(address _principal, address feeRecipient) external {
        require(
            feeRecipient != fundRecipient,
            'can only claim fee for recipient'
        );

        uint256 fee = tokenBalances[_principal][feeRecipient];
        require(fee > 0, 'no fee for principal and feeRecipient');

        IERC20(_principal).safeTransfer(feeRecipient, fee);
        tokenBalances[_principal][feeRecipient] = 0;
    }

    function claimFund(address _principal) external {
        uint256 fund = tokenBalances[_principal][fundRecipient];
        require(fund > 0, 'no fund is available for fundRecipient');

        IERC20(_principal).safeTransfer(fundRecipient, fund);
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

        uint256 fee = _amount.mul(feeBps).div(ONEinBPS);
        tokenBalances[_principal][fundRecipient] += _amount.sub(fee);
        uint256 theLast = fee;
        for (uint256 i = 0; i < feeRecipients.length - 1; i++) {
            tokenBalances[_principal][feeRecipients[i]] += fee
                .mul(feeWeightBps[i])
                .div(ONEinBPS);
            theLast = theLast.sub(fee.mul(feeWeightBps[i]).div(ONEinBPS));
        }
        require(
            theLast >=
                fee.mul(feeWeightBps[feeWeightBps.length - 1]).div(ONEinBPS),
            'fee calculation error'
        );
        tokenBalances[_principal][
            feeRecipients[feeRecipients.length - 1]
        ] += theLast;
    }

    /* ======== VIEW FUNCTIONS ======== */

    /**
     *  @notice calculate interest due for new bond
     *  @param _principal address
     *  @param _value uint
     *  @param _discount uint
     *  @return uint
     */
    function payoutFor(
        address _principal,
        uint256 _value,
        uint256 _discount
    ) public view returns (uint256) {
        uint256 nativePrice = bondPrice(_principal).mul(10000 - _discount).div(
            10000
        );

        return
            FixedPoint.fraction(_value, nativePrice).decode112with18().div(
                1e14
            );
    }

    /**
     *  @notice calculate current bond price
     *  @param _principal address
     *  @return price_ uint
     */
    function bondPrice(address _principal)
        public
        view
        returns (uint256 price_)
    {
        address oracle = IBondPricing(bondPricing).findOracle(
            rewardToken,
            _principal
        );
        price_ = IUniswapPairOracle(oracle)
            .consult(rewardToken, rewardUnit)
            .div(10**(IERC20(_principal).decimals() - 4));
        if (price_ < minimumPrice) {
            price_ = minimumPrice;
        }
    }

    /**
     *  @notice calculate current bond price and remove floor if above
     *  @param _principal address
     *  @return price_ uint
     */
    function _bondPrice(address _principal) internal returns (uint256 price_) {
        address oracle = IBondPricing(bondPricing).findOracle(
            rewardToken,
            _principal
        );
        price_ = IUniswapPairOracle(oracle)
            .consult(rewardToken, rewardUnit)
            .div(10**(IERC20(_principal).decimals() - 4));
        if (price_ < minimumPrice) {
            price_ = minimumPrice;
        } else if (minimumPrice != 0) {
            minimumPrice = 0;
        }
    }

    /**


     *  @return price_ uint
     */
    function bondPriceInUSD(address _principal)
        public
        view
        returns (uint256 price_)
    {
        price_ = bondPrice(_principal)
            .mul(10**IERC20(_principal).decimals())
            .div(1e4);
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
        uint256 timestampSinceLast = block.timestamp.sub(bond.lastBlockAt);
        uint256 vesting = bond.vesting;

        if (vesting > 0) {
            percentVested_ = timestampSinceLast.mul(10000).div(vesting);
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

        if (percentVested >= 10000) {
            pendingPayout_ = payout;
        } else {
            pendingPayout_ = payout.mul(percentVested).div(10000);
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
        uint256 nativePrice = bondPrice(_principal).mul(10000 - _discount).div(
            10000
        );

        amount_ = (rewardUnit / 100)
            .mul(nativePrice)
            .mul(10**IERC20(_principal).decimals())
            .div(10**(4 + IERC20(rewardToken).decimals()));
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
        uint256 amount = IERC20(_token).balanceOf(address(this));
        if (_token == rewardToken) {
            amount = amount.sub(totalRemainingPayout);
        }
        IERC20(_token).safeTransfer(DAO, amount);
        return true;
    }
}
