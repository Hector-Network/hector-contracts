// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;
pragma experimental ABIEncoderV2;

interface IWooPP {
    function quoteToken() external view returns (address);

    function sellBase(
        address baseToken,
        uint256 baseAmount,
        uint256 minQuoteAmount,
        address to,
        address rebateTo
    ) external returns (uint256 quoteAmount);

    function sellQuote(
        address baseToken,
        uint256 quoteAmount,
        uint256 minBaseAmount,
        address to,
        address rebateTo
    ) external returns (uint256 baseAmount);
}