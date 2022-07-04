// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract StakingToken is ERC20 {
    string constant NAME = 'Staking Hector';
    string constant SYMBOL = 'SHEC';

    constructor() ERC20(NAME, SYMBOL) {}

    function mint() external {
        _mint(msg.sender, 1000e18);
    }
}
