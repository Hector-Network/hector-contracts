// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';

import '../interfaces/IOracle.sol';
import '../interfaces/IPriceOracleAggregator.sol';

interface IUniswapPairOracle {
    function token0() external view returns (address);

    function token1() external view returns (address);

    function consult(
        address token,
        uint amountIn
    ) external view returns (uint amountOut);
}

contract UniswapV2WrapperOracle is IOracle {
    /// @notice the asset with the price oracle
    address public immutable asset;

    /// @notice uniswap pair oracle with price in base asset
    IUniswapPairOracle public immutable uniswapPairOracle;

    /// @notice the base asset of chainlink aggregator
    address public immutable baseAsset;

    /// @notice oracle that returns price in USD
    IPriceOracleAggregator public immutable aggregator;

    constructor(
        address _asset,
        address _uniswapPairOracle,
        address _baseAsset,
        address _aggregator
    ) {
        require(_uniswapPairOracle != address(0), 'invalid pair oracle');
        require(_aggregator != address(0), 'invalid aggregator');

        asset = _asset;
        uniswapPairOracle = IUniswapPairOracle(_uniswapPairOracle);
        baseAsset = _baseAsset;
        aggregator = IPriceOracleAggregator(_aggregator);

        require(
            (uniswapPairOracle.token0() == asset &&
                uniswapPairOracle.token1() == baseAsset) ||
                (uniswapPairOracle.token1() == asset &&
                    uniswapPairOracle.token0() == baseAsset),
            'invalid assets'
        );
    }

    function adjustDecimal(
        uint256 balance,
        uint8 org,
        uint8 target
    ) internal pure returns (uint256 adjustedBalance) {
        adjustedBalance = balance;
        if (target < org) {
            adjustedBalance = adjustedBalance / (10 ** (org - target));
        } else if (target > org) {
            adjustedBalance = adjustedBalance * (10 ** (target - org));
        }
    }

    /// @dev returns the latest price of asset
    function viewPriceInUSD() external view override returns (uint256) {
        uint256 price = uniswapPairOracle.consult(
            asset,
            10 ** IERC20Metadata(asset).decimals()
        );
        uint256 priceInBaseAsset = adjustDecimal(
            price,
            IERC20Metadata(baseAsset).decimals(),
            8
        ); // 8 decimals

        if (baseAsset != address(0)) {
            return
                (priceInBaseAsset * aggregator.viewPriceInUSD(baseAsset)) /
                10 ** 8;
        }

        return priceInBaseAsset;
    }
}
