// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "../../HectorStorage.sol";
import "../IRouter.sol";

abstract contract OnERC1155Received is HectorStorage, IRouter {
    constructor() {}

    address internal __operator;
    address internal __from;
    uint256 internal __id;
    uint256 internal __value;
    bytes internal __data;

    uint256[] internal __ids;
    uint256[] internal __values;

    function initialize(bytes calldata) external pure override {
        revert("METHOD NOT IMPLEMENTED");
    }

    function getKey() external pure override returns (bytes32) {
        return keccak256(abi.encodePacked("onERC1155Received", "1.0.0"));
    }

    bytes4 constant ERC1155_RECEIVED = bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)"));
    bytes4 constant ERC1155_BATCH_RECEIVED =
        bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"));

    function onERC1155Received(
        address _operator,
        address _from,
        uint256 _id,
        uint256 _value,
        bytes calldata _data
    ) external returns (bytes4) {
        __operator = _operator;
        __from = _from;
        __id = _id;
        __value = _value;
        __data = _data;
        return ERC1155_RECEIVED;
    }

    function onERC1155BatchReceived(
        address _operator,
        address _from,
        uint256[] calldata _ids,
        uint256[] calldata _values,
        bytes calldata _data
    ) external returns (bytes4) {
        __operator = _operator;
        __from = _from;
        __ids = _ids;
        __values = _values;
        __data = _data;
        return ERC1155_BATCH_RECEIVED;
    }
}