// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../interfaces/IOracle.sol";
import "../interfaces/IPriceOracleAggregator.sol";
import "../external/chainlink/IChainlinkV3Aggregator.sol";

contract ChainlinkUSDAdapter is IOracle {
    /// @notice the asset with the price oracle
    address public immutable asset;

    /// @notice chainlink aggregator with price in base asset
    IChainlinkV3Aggregator public immutable chainlinkAggregator;

    /// @notice the base asset of chainlink aggregator
    address public immutable baseAsset;

    /// @notice oracle that returns price in USD
    IPriceOracleAggregator public immutable aggregator;

    constructor(
        address _asset,
        address _aggregator,
        address _baseAsset,
        address _priceOracleAggregator
    ) {
        require(address(_aggregator) != address(0), "invalid aggregator");

        asset = _asset;
        chainlinkAggregator = IChainlinkV3Aggregator(_aggregator);
        baseAsset = _baseAsset;
        aggregator = IPriceOracleAggregator(_priceOracleAggregator);
    }

    function adjustDecimal(
        uint256 balance,
        uint8 org,
        uint8 target
    ) internal pure returns (uint256 adjustedBalance) {
        adjustedBalance = balance;
        if (target < org) {
            adjustedBalance = adjustedBalance / (10**(org - target));
        } else if (target > org) {
            adjustedBalance = adjustedBalance * (10**(target - org));
        }
    }

    /// @dev returns the latest price of asset
    function viewPriceInUSD() external view override returns (uint256) {
        (, int256 priceC, , , ) = chainlinkAggregator.latestRoundData();

        uint256 priceInBaseAsset = adjustDecimal(
            uint256(priceC),
            chainlinkAggregator.decimals(),
            8
        ); // 8 decimals

        if (baseAsset != address(0)) {
            return
                (priceInBaseAsset * aggregator.viewPriceInUSD(baseAsset)) /
                10**8;
        }

        return priceInBaseAsset;
    }
}
