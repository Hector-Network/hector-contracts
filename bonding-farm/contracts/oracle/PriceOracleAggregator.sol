// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/IOracle.sol";
import "../interfaces/IPriceOracleAggregator.sol";

contract PriceOracleAggregator is IPriceOracleAggregator, Ownable {
    address public immutable airUSD;
    /// @notice token to the oracle address
    mapping(address => IOracle) public assetToOracle;

    constructor(address _airUSD) Ownable() {
        airUSD = _airUSD;
    }

    /// @notice adds oracle for an asset e.g. ETH
    /// @param _asset the oracle for the asset
    /// @param _oracle the oracle address
    function updateOracleForAsset(address _asset, IOracle _oracle)
        external
        override
        onlyOwner
    {
        require(address(_oracle) != address(0), "INVALID_ORACLE");
        assetToOracle[_asset] = _oracle;
        emit UpdateOracle(_asset, _oracle);
    }

    /// @notice returns price of token in USD
    /// @param _token view price of token
    function viewPriceInUSD(address _token)
        external
        view
        override
        returns (uint256)
    {
        if (_token == airUSD) {
            return 10**8;
        }

        require(address(assetToOracle[_token]) != address(0), "INVALID_ORACLE");
        return assetToOracle[_token].viewPriceInUSD();
    }
}
