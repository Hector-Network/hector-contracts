// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "../../HectorStorage.sol";
import "../IRouter.sol";

abstract contract ERC165 is HectorStorage, IRouter {
    constructor() {}

    function initialize(bytes calldata) external pure override {
        revert("METHOD NOT IMPLEMENTED");
    }

    function getKey() external pure override returns (bytes32) {
        return keccak256(abi.encodePacked("ERC165", "1.0.0"));
    }

    bytes4 constant ERC165_INTERFACE = bytes4(keccak256("supportsInterface(bytes4)"));
    bytes4 constant ON_ERC1155_RECEIVED_INTERFACE =
        bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)")) ^
            bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"));
    bytes4 constant ON_ERC721_RECEIVED_INTERFACE = bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"));

    function supportsInterface(bytes4 interfaceID) external pure returns (bool) {
        return
            interfaceID == ERC165_INTERFACE ||
            interfaceID == ON_ERC1155_RECEIVED_INTERFACE ||
            interfaceID == ON_ERC721_RECEIVED_INTERFACE;
    }
}