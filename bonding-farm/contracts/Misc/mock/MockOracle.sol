// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import '../interfaces/IOracle.sol';

contract MockOracle is IOracle {
    address public immutable asset;
    uint256 public price;

    constructor(address _asset, uint256 _price) {
        asset = _asset;
        price = _price;
    }

    /// @dev returns the latest price of asset
    function viewPriceInUSD() external view override returns (uint256) {
        return price;
    }
}
