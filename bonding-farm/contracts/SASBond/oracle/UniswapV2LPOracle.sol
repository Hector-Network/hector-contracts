// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';

import '../libraries/math/PRBMath.sol';
import '../interfaces/IPriceOracleAggregator.sol';
import '../external/uniswapV2/IUniswapV2Pair.sol';

/**
 * @title Uni-v2 LP oracle.
 * @notice You can use this contract for lp token pricing oracle.
 * @dev This should have `viewPriceInUSD` which returns price in USD
 */
contract UniswapV2LPOracle is IOracle {
    /// @notice oracle that returns price in USD
    IPriceOracleAggregator public immutable aggregator;

    address public immutable pair;
    address public immutable token0;
    address public immutable token1;

    constructor(address _pair, address _priceOracleAggregator) {
        pair = _pair;
        token0 = IUniswapV2Pair(pair).token0();
        token1 = IUniswapV2Pair(pair).token1();

        aggregator = IPriceOracleAggregator(_priceOracleAggregator);
    }

    /// @dev returns the latest price of asset
    /// @notice we can reference LP pricing from
    /// https://github.com/sushiswap/kashi-lending/blob/master/contracts/oracles/LPChainlinkOracle.sol
    /// https://github.com/AlphaFinanceLab/homora-v2/blob/master/contracts/oracle/UniswapV2Oracle.sol
    function viewPriceInUSD() external view override returns (uint256 price) {
        uint256 price0 = aggregator.viewPriceInUSD(token0); // decimals 8
        uint256 price1 = aggregator.viewPriceInUSD(token1); // decimals 8

        uint256 totalSupply = IUniswapV2Pair(pair).totalSupply();
        (uint256 r0, uint256 r1, ) = IUniswapV2Pair(pair).getReserves();
        uint256 decimal0 = IERC20Metadata(token0).decimals();
        uint256 decimal1 = IERC20Metadata(token1).decimals();

        r0 = (r0 * (10**18)) / (10**decimal0); // decimal = 18
        r1 = (r1 * (10**18)) / (10**decimal1); // decimal = 18

        uint256 r = PRBMath.sqrt(r0 * r1); // decimal = 18

        uint256 p = PRBMath.sqrt(price0 * price1); // decimal = 8

        price = (2 * r * p) / totalSupply; // decimal = 8
    }
}
