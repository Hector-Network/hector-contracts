// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "../../HectorStorage.sol";
import "../IRouter.sol";

abstract contract OnERC721Received is HectorStorage, IRouter {
    constructor() {}

    function initialize() external pure {
        revert("METHOD NOT IMPLEMENTED");
    }

    function getKey() external pure override returns (bytes32) {
        return keccak256(abi.encodePacked("onERC721Received", "1.0.0"));
    }

    bytes4 constant ERC721_RECEIVED = bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"));

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) public pure returns (bytes4) {
        return ERC721_RECEIVED;
    }
}