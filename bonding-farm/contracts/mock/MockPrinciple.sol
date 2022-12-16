// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.7;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract MockPrinciple is ERC20 {
    constructor() ERC20('Mock Principle', 'Mock Principle') {}

    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }
}
