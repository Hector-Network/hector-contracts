// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';

import '../libraries/math/PRBMath.sol';
import '../interfaces/IPriceOracleAggregator.sol';
import '../external/uniswapV2/IUniswapV2Pair.sol';

/**
 * @title Curve LP oracle.
 * @notice You can use this contract for lp token pricing oracle.
 * @dev This should have `viewPriceInUSD` which returns price in USD
 */
contract CurveLPOracle is IOracle {
    /// @notice oracle that returns price in USD
    IPriceOracleAggregator public immutable aggregator;

    address public immutable token;
    address public immutable minter;
    address[] public coins;

    constructor(
        address _priceOracleAggregator,
        address _token,
        address _minter,
        address[] memory _coins
    ) {
        aggregator = IPriceOracleAggregator(_priceOracleAggregator);
        token = _token;
        minter = _minter;
        coins = _coins;
    }

    /// @dev returns the latest price of asset
    function viewPriceInUSD() external view override returns (uint256 price) {
        uint256 valueInUSD;
        for (uint256 i = 0; i < coins.length; i++) {
            uint256 reserve = IERC20(coins[i]).balanceOf(minter);
            uint256 decimals = IERC20Metadata(coins[i]).decimals();
            uint256 coinPrice = aggregator.viewPriceInUSD(coins[i]); // decimals 8

            valueInUSD += (reserve * coinPrice) / (10**decimals); // decimals 8
        }

        uint256 totalSupply = IERC20Metadata(token).totalSupply();

        price = (valueInUSD * (10**18)) / totalSupply; // decimals 8
    }
}
