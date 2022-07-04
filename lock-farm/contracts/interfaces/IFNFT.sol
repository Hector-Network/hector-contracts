// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

import '@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol';

interface IFNFT is IERC721Enumerable {
    function mint(address to) external returns (uint256 fnftId);

    function burn(uint256 fnftId) external;
}
