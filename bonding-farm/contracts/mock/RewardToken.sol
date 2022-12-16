// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract RewardToken is ERC20 {
    string constant NAME = 'Reward Hector';
    string constant SYMBOL = 'RHEC';

    uint256 public _totalSupply = 63531806809604284;

    constructor() ERC20(NAME, SYMBOL) {}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function setTotalSupply(uint256 __totalSupply) external {
        _totalSupply = __totalSupply;
    }

    function totalSupply() public view virtual override returns (uint256) {
        return _totalSupply;
    }
}
