// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import '../libraries/math/PRBMathSD59x18.sol';
import '../interfaces/IPriceOracleAggregator.sol';
import '../external/uniswapV2/IUniswapV2Pair.sol';

library UniswapV2Library {
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

    // calculates the CREATE2 address for a pair without making any external calls
    function pairFor(
        address factory,
        address tokenA,
        address tokenB
    ) internal pure returns (address pair) {
        (address token0, address token1) = sortTokens(tokenA, tokenB);
        pair = address(
            uint160(
                uint256(
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
        );
    }
}

library UniswapV2OracleLibrary {
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
            uint256 timeElapsed = blockTimestamp > blockTimestampLast
                ? blockTimestamp - blockTimestampLast
                : uint256(blockTimestamp) + 2**32 - uint256(blockTimestampLast);
            // addition overflow is desired

            // counterfactual
            // price0Cumulative += uint(FixedPoint.fraction(reserve1, reserve0)._x) * timeElapsed;
            int256 ratio0 = PRBMathSD59x18.div(
                int256(uint256(reserve1)),
                int256(uint256(reserve0))
            );
            price0Cumulative += uint256(ratio0) * timeElapsed;

            // counterfactual
            // price1Cumulative += uint(FixedPoint.fraction(reserve0, reserve1)._x) * timeElapsed;
            int256 ratio1 = PRBMathSD59x18.div(
                int256(uint256(reserve0)),
                int256(uint256(reserve1))
            );
            price1Cumulative += uint256(ratio1) * timeElapsed;
        }
    }
}

contract UniswapV2Oracle is IOracle {
    /// @notice oracle that returns price in USD
    IPriceOracleAggregator public immutable aggregator;

    uint256 public constant PERIOD = 24 hours;

    IUniswapV2Pair public immutable pair;
    bool public isFirstToken;
    address public immutable token0;
    address public immutable token1;

    uint256 public price0CumulativeLast;
    uint256 public price1CumulativeLast;
    uint32 public blockTimestampLast;

    uint256 public price0Average;
    uint256 public price1Average;

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

    function update() public {
        (
            uint256 price0Cumulative,
            uint256 price1Cumulative,
            uint32 blockTimestamp
        ) = UniswapV2OracleLibrary.currentCumulativePrices(address(pair));

        // overflow is desired
        uint256 timeElapsed = blockTimestamp > blockTimestampLast
            ? blockTimestamp - blockTimestampLast
            : uint256(blockTimestamp) + 2**32 - uint256(blockTimestampLast);

        // ensure that at least one full period has passed since the last update
        if (timeElapsed >= PERIOD) {
            // overflow is desired, casting never truncates
            price0Average = uint256(
                PRBMathSD59x18.div(
                    int256(price0Cumulative - price0CumulativeLast),
                    int256(timeElapsed)
                )
            );
            price1Average = uint256(
                PRBMathSD59x18.div(
                    int256(price1Cumulative - price1CumulativeLast),
                    int256(timeElapsed)
                )
            );

            price0CumulativeLast = price0Cumulative;
            price1CumulativeLast = price1Cumulative;
            blockTimestampLast = blockTimestamp;
        }
    }

    /// @dev returns the latest price of asset
    function viewPriceInUSD() external view override returns (uint256 price) {
        if (isFirstToken) {
            price =
                (price0Average * aggregator.viewPriceInUSD(token1)) /
                (10**(pair.decimals() + 18));
        } else {
            price =
                (price1Average * aggregator.viewPriceInUSD(token0)) /
                (10**(pair.decimals() + 18));
        }
    }
}
