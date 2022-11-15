// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "../lib/Utils.sol";
import "../lib/weth/IWETH.sol";
import "../ITokenTransferProxy.sol";

contract SimpleSwapHelper {

    function approve(
        address token,
        address to,
        uint256 amount
    )
        external
    {
        require(
            msg.sender == address(this),
            "SimpleSwap: Invalid access"
        );
        Utils.approve(to, token, amount);
    }

    function withdrawAllWETH(IWETH token) external {
      require(
          msg.sender == address(this),
          "SimpleSwap: Invalid access"
      );
      uint256 amount = token.balanceOf(address(this));
      token.withdraw(amount);
    }

}