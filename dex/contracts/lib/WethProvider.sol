// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

contract WethProvider {
    address public immutable WETH;

    constructor(address weth) {
        WETH = weth;
    }
}
