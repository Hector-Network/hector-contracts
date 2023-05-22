// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import '@openzeppelin/contracts/utils/math/SafeMath.sol';

import '../libraries/FixedPoint.sol';
import '../interfaces/IPriceOracleAggregator.sol';
import '../external/uniswapV2/IUniswapV2Pair.sol';
import '../external/uniswapV2/IUniswapV2Factory.sol';

interface IERC20Metadata {
    function decimals() external view returns (uint8);
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
        _newOwner = address(0);
    }
}

library UniswapV2Library {
    using SafeMath for uint256;

    // returns sorted token addresses, used to handle return values from pairs sorted in this order
    function sortTokens(address tokenA, address tokenB)
        internal
        pure
        returns (address token0, address token1)
    {
        require(tokenA != tokenB, 'UniswapV2Library: IDENTICAL_ADDRESSES');
        (token0, token1) = tokenA < tokenB
            ? (tokenA, tokenB)
            : (tokenB, tokenA);
        require(token0 != address(0), 'UniswapV2Library: ZERO_ADDRESS');
    }

    // Less efficient than the CREATE2 method below
    function pairFor(
        address factory,
        address tokenA,
        address tokenB
    ) internal view returns (address pair) {
        (address token0, address token1) = sortTokens(tokenA, tokenB);
        pair = IUniswapV2Factory(factory).getPair(token0, token1);
    }

    // calculates the CREATE2 address for a pair without making any external calls
    function pairForCreate2(
        address factory,
        address tokenA,
        address tokenB
    ) internal pure returns (address pair) {
        (address token0, address token1) = sortTokens(tokenA, tokenB);
        pair = address(
            uint160(
                bytes20(
                    keccak256(
                        abi.encodePacked(
                            hex'ff',
                            factory,
                            keccak256(abi.encodePacked(token0, token1)),
                            hex'96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f' // init code hash
                        )
                    )
                )
            )
        ); // this matches the CREATE2 in UniswapV2Factory.createPair
    }

    // fetches and sorts the reserves for a pair
    function getReserves(
        address factory,
        address tokenA,
        address tokenB
    ) internal view returns (uint256 reserveA, uint256 reserveB) {
        (address token0, ) = sortTokens(tokenA, tokenB);
        (uint256 reserve0, uint256 reserve1, ) = IUniswapV2Pair(
            pairFor(factory, tokenA, tokenB)
        ).getReserves();
        (reserveA, reserveB) = tokenA == token0
            ? (reserve0, reserve1)
            : (reserve1, reserve0);
    }

    // given some amount of an asset and pair reserves, returns an equivalent amount of the other asset
    function quote(
        uint256 amountA,
        uint256 reserveA,
        uint256 reserveB
    ) internal pure returns (uint256 amountB) {
        require(amountA > 0, 'UniswapV2Library: INSUFFICIENT_AMOUNT');
        require(
            reserveA > 0 && reserveB > 0,
            'UniswapV2Library: INSUFFICIENT_LIQUIDITY'
        );
        amountB = amountA.mul(reserveB) / reserveA;
    }

    // given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal pure returns (uint256 amountOut) {
        require(amountIn > 0, 'UniswapV2Library: INSUFFICIENT_INPUT_AMOUNT');
        require(
            reserveIn > 0 && reserveOut > 0,
            'UniswapV2Library: INSUFFICIENT_LIQUIDITY'
        );
        uint256 amountInWithFee = amountIn.mul(997);
        uint256 numerator = amountInWithFee.mul(reserveOut);
        uint256 denominator = reserveIn.mul(1000).add(amountInWithFee);
        amountOut = numerator / denominator;
    }

    // given an output amount of an asset and pair reserves, returns a required input amount of the other asset
    function getAmountIn(
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal pure returns (uint256 amountIn) {
        require(amountOut > 0, 'UniswapV2Library: INSUFFICIENT_OUTPUT_AMOUNT');
        require(
            reserveIn > 0 && reserveOut > 0,
            'UniswapV2Library: INSUFFICIENT_LIQUIDITY'
        );
        uint256 numerator = reserveIn.mul(amountOut).mul(1000);
        uint256 denominator = reserveOut.sub(amountOut).mul(997);
        amountIn = (numerator / denominator).add(1);
    }

    // performs chained getAmountOut calculations on any number of pairs
    function getAmountsOut(
        address factory,
        uint256 amountIn,
        address[] memory path
    ) internal view returns (uint256[] memory amounts) {
        require(path.length >= 2, 'UniswapV2Library: INVALID_PATH');
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        for (uint256 i = 0; i < path.length - 1; i++) {
            (uint256 reserveIn, uint256 reserveOut) = getReserves(
                factory,
                path[i],
                path[i + 1]
            );
            amounts[i + 1] = getAmountOut(amounts[i], reserveIn, reserveOut);
        }
    }

    // performs chained getAmountIn calculations on any number of pairs
    function getAmountsIn(
        address factory,
        uint256 amountOut,
        address[] memory path
    ) internal view returns (uint256[] memory amounts) {
        require(path.length >= 2, 'UniswapV2Library: INVALID_PATH');
        amounts = new uint256[](path.length);
        amounts[amounts.length - 1] = amountOut;
        for (uint256 i = path.length - 1; i > 0; i--) {
            (uint256 reserveIn, uint256 reserveOut) = getReserves(
                factory,
                path[i - 1],
                path[i]
            );
            amounts[i - 1] = getAmountIn(amounts[i], reserveIn, reserveOut);
        }
    }
}

library UniswapV2OracleLibrary {
    using FixedPoint for *;

    // helper function that returns the current block timestamp within the range of uint32, i.e. [0, 2**32 - 1]
    function currentBlockTimestamp() internal view returns (uint32) {
        return uint32(block.timestamp % 2**32);
    }

    // produces the cumulative price using counterfactuals to save gas and avoid a call to sync.
    function currentCumulativePrices(address pair)
        internal
        view
        returns (
            uint256 price0Cumulative,
            uint256 price1Cumulative,
            uint32 blockTimestamp
        )
    {
        blockTimestamp = currentBlockTimestamp();
        price0Cumulative = IUniswapV2Pair(pair).price0CumulativeLast();
        price1Cumulative = IUniswapV2Pair(pair).price1CumulativeLast();

        // if time has elapsed since the last update on the pair, mock the accumulated price values
        (
            uint112 reserve0,
            uint112 reserve1,
            uint32 blockTimestampLast
        ) = IUniswapV2Pair(pair).getReserves();
        if (blockTimestampLast != blockTimestamp) {
            // subtraction overflow is desired
            uint32 timeElapsed = blockTimestamp - blockTimestampLast;
            // addition overflow is desired
            // counterfactual
            price0Cumulative +=
                uint256(FixedPoint.fraction(reserve1, reserve0)._x) *
                timeElapsed;
            // counterfactual
            price1Cumulative +=
                uint256(FixedPoint.fraction(reserve0, reserve1)._x) *
                timeElapsed;
        }
    }
}

contract UniswapV2Oracle is IOracle, Ownable {
    using FixedPoint for *;

    /// @notice oracle that returns price in USD
    IPriceOracleAggregator public immutable aggregator;

    uint256 public PERIOD = 1; // 1 hour TWAP (time-weighted average price)
    uint256 public CONSULT_LENIENCY = 120; // Used for being able to consult past the period end
    bool public ALLOW_STALE_CONSULTS = false; // If false, consult() will fail if the TWAP is stale

    IUniswapV2Pair public immutable pair;
    bool public isFirstToken;
    address public immutable token0;
    address public immutable token1;

    uint256 public price0CumulativeLast;
    uint256 public price1CumulativeLast;
    uint32 public blockTimestampLast;

    FixedPoint.uq112x112 public price0Average;
    FixedPoint.uq112x112 public price1Average;

    constructor(
        address _factory,
        address _tokenA,
        address _tokenB,
        address _priceOracleAggregator
    ) {
        require(
            _priceOracleAggregator != address(0),
            'UNIV2: Invalid Aggregator'
        );
        require(_factory != address(0), 'UNIV2: Invalid factory');
        require(_tokenA != address(0), 'UNIV2: Invalid tokenA');
        require(_tokenB != address(0), 'UNIV2: Invalid tokenB');

        aggregator = IPriceOracleAggregator(_priceOracleAggregator);

        IUniswapV2Pair _pair = IUniswapV2Pair(
            UniswapV2Library.pairFor(_factory, _tokenA, _tokenB)
        );
        require(address(_pair) != address(0), 'UNIV2: Invalid Pair');

        pair = _pair;
        token0 = _pair.token0();
        token1 = _pair.token1();

        price0CumulativeLast = _pair.price0CumulativeLast(); // fetch the current accumulated price value (1 / 0)
        price1CumulativeLast = _pair.price1CumulativeLast(); // fetch the current accumulated price value (0 / 1)
        uint112 reserve0;
        uint112 reserve1;
        (reserve0, reserve1, blockTimestampLast) = _pair.getReserves();
        require(reserve0 != 0 && reserve1 != 0, 'UNIV2: NO_RESERVES'); // ensure that there's liquidity in the pair

        if (_tokenA == _pair.token0()) {
            isFirstToken = true;
        } else {
            isFirstToken = false;
        }
    }

    function setPeriod(uint256 _period) external onlyPolicy {
        PERIOD = _period;
    }

    function setConsultLeniency(uint256 _consult_leniency) external onlyPolicy {
        CONSULT_LENIENCY = _consult_leniency;
    }

    function setAllowStaleConsults(bool _allow_stale_consults)
        external
        onlyPolicy
    {
        ALLOW_STALE_CONSULTS = _allow_stale_consults;
    }

    // Check if update() can be called instead of wasting gas calling it
    function canUpdate() public view returns (bool) {
        uint32 blockTimestamp = UniswapV2OracleLibrary.currentBlockTimestamp();
        uint32 timeElapsed = blockTimestamp - blockTimestampLast; // Overflow is desired
        return (timeElapsed >= PERIOD);
    }

    function update() external {
        (
            uint256 price0Cumulative,
            uint256 price1Cumulative,
            uint32 blockTimestamp
        ) = UniswapV2OracleLibrary.currentCumulativePrices(address(pair));

        // overflow is desired
        uint256 timeElapsed = blockTimestamp > blockTimestampLast
            ? blockTimestamp - blockTimestampLast
            : uint256(blockTimestamp) + 2**32 - uint256(blockTimestampLast);

        // Ensure that at least one full period has passed since the last update
        require(timeElapsed >= PERIOD, 'UniswapPairOracle: PERIOD_NOT_ELAPSED');

        // Overflow is desired, casting never truncates
        // Cumulative price is in (uq112x112 price * seconds) units so we simply wrap it after division by time elapsed
        price0Average = FixedPoint.uq112x112(
            uint224((price0Cumulative - price0CumulativeLast) / timeElapsed)
        );
        price1Average = FixedPoint.uq112x112(
            uint224((price1Cumulative - price1CumulativeLast) / timeElapsed)
        );

        price0CumulativeLast = price0Cumulative;
        price1CumulativeLast = price1Cumulative;
        blockTimestampLast = blockTimestamp;
    }

    /// @dev returns the latest price of asset
    function viewPriceInUSD() external view override returns (uint256 price) {
        uint32 blockTimestamp = UniswapV2OracleLibrary.currentBlockTimestamp();
        uint32 timeElapsed = blockTimestamp - blockTimestampLast; // Overflow is desired

        // Ensure that the price is not stale
        require(
            (timeElapsed < (PERIOD + CONSULT_LENIENCY)) || ALLOW_STALE_CONSULTS,
            'UniswapPairOracle: PRICE_IS_STALE_NEED_TO_CALL_UPDATE'
        );

        if (isFirstToken) {
            price =
                (aggregator.viewPriceInUSD(token1) *
                    (10**IERC20Metadata(token0).decimals())) /
                (
                    price1Average
                        .mul(10**IERC20Metadata(token1).decimals())
                        .decode144()
                );
        } else {
            price =
                (aggregator.viewPriceInUSD(token0) *
                    (10**IERC20Metadata(token1).decimals())) /
                (
                    price0Average
                        .mul(10**IERC20Metadata(token0).decimals())
                        .decode144()
                );
        }
    }
}
