// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

interface ITokenVault {
    event FNFTMinted(
        address indexed asset,
        address indexed from,
        uint256 indexed fnftId,
        uint256 depositAmount,
        uint256 endTime
    );

    event FNFTWithdrawn(
        address indexed from,
        uint256 indexed fnftId,
        uint256 indexed quantity
    );

    struct FNFTConfig {
        address asset; // The token being stored
        uint256 depositAmount; // How many tokens
        uint256 endTime; // Time lock expiry
    }

    function getFNFT(uint256 fnftId) external view returns (FNFTConfig memory);

    function mint(address recipient, FNFTConfig memory fnftConfig)
        external
        returns (uint256);

    function withdraw(address recipient, uint256 fnftId) external;
}
