// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.7.5;

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {
    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `recipient`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address recipient, uint256 amount)
        external
        returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender)
        external
        view
        returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Moves `amount` tokens from `sender` to `recipient` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );
}

interface ITreasury {
    function deposit(
        uint256 _amount,
        address _token,
        uint256 _profit
    ) external returns (uint256 send_);

    function manage(address _token, uint256 _amount) external;

    function valueOf(address _token, uint256 _amount)
        external
        view
        returns (uint256 value_);
}

interface IAnyswapERC20 {
    function underlying() external view returns (address);

    function withdraw(uint256 amount) external returns (uint256);
}

interface IAnyswapRouter {
    function anySwapOutUnderlying(
        address token,
        address to,
        uint256 amount,
        uint256 toChainID
    ) external;
}

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
        require(_owner == msg.sender, "Ownable: caller is not the owner");
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
            "Ownable: new owner is the zero address"
        );
        emit OwnershipPushed(_owner, newOwner_);
        _newOwner = newOwner_;
    }

    function pullManagement() public virtual override {
        require(msg.sender == _newOwner, "Ownable: must be new owner to pull");
        emit OwnershipPulled(_owner, _newOwner);
        _owner = _newOwner;
    }
}

contract CRXDeposit is Ownable {
    address public onwer;
    ITreasury public treasury; // Treasury
    IAnyswapRouter public immutable anyswapRouter; // Treasury

    //4002: fantom testnet
    //Kovan: 42
    uint256 public ETHEREUM_CHAINID = 42;
    address public ethereumAddress;
    address public ethereumAddressCandidate;
    uint256 public immutable ethAddressChangeTimelock;
    uint256 public ethereumAddressActiveblock;

    //Dai address: 0x04df6e4121c27713ed22341e7c7df330f56f289b

    constructor(
        address _treasury,
        address _anyswapRouter,
        address _ethereumAddress,
        uint256 _ethAddressChangeTimelock
    ) //uint _timelockInBlocks
    {
        require(_treasury != address(0));
        treasury = ITreasury(0x08d2C94F47b5Ca3C3193e599276AAbF24aADc9a1);
        //treasury = ITreasury( _treasury );

        require(_anyswapRouter != address(0));
        anyswapRouter = IAnyswapRouter(_anyswapRouter);

        //require( _rewardPool != address(0) );
        //rewardPool = _rewardPool;

        //timelockInBlocks = _timelockInBlocks;

        require(_ethereumAddress != address(0));
        ethereumAddress = _ethereumAddress;

        ethAddressChangeTimelock = _ethAddressChangeTimelock;
    }

    /**
     *  @notice withdraws asset from treasury, transfer out to other chain through
     *  @param token address
     *  @param amount uint
     */
    function bridgeOut(address token, uint256 amount) public onlyPolicy {
        //require( !exceedsLimit( token, amount ),"deposit amount exceed limit" ); // ensure deposit is within bounds
        treasury.manage(token, amount); // retrieve amount of asset from treasury

        IERC20(token).approve(address(anyswapRouter), amount); // approve anyswap router to spend tokens
        anyswapRouter.anySwapOutUnderlying(
            tokenInfo[token].anyswapERC20,
            ethereumAddress,
            amount,
            ETHEREUM_CHAINID
        );

        // account for deposit
        // uint value = treasury.valueOf( token, amount );
        // accountingFor( token, amount, value, true );
    }

    /**
     *  @notice adds asset and corresponding anyswapERC20Token to mapping
     *  @param principleToken address
     *  @param anyswapERC20Token address
     *  @param max uint
     */
    // function addToken( address principleToken, address anyswapERC20Token, uint max ) external onlyPolicy() {

    //     require(anyswapERC20Token!=address(0),"invalid anyswap erc20 token");
    //     address token=IAnyswapERC20(anyswapERC20Token).underlying();
    //     require( token != address(0) && principleToken==token,"principle token not matched with anyswap ERC20 underlying token");
    //     require( tokenInfo[ token ].sent <= tokenInfo[token].received );

    //     tokenInfo[ token ] = tokenData({
    //         underlying: token,
    //         anyswapERC20: anyswapERC20Token,
    //         sent: 0,
    //         received: 0,
    //         limit: max,
    //         newLimit: 0,
    //         limitChangeTimelockEnd: 0
    //     });
    // }
}
