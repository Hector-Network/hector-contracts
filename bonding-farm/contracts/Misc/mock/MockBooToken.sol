// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.7;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract MockBooToken is ERC20 {
    constructor() ERC20('Boo', 'BOO') {}

    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }
}
