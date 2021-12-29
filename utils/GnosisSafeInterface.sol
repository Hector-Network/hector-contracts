// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.7.5;
interface Safe{
    enum Operation {
        Call,
        DelegateCall
    }
    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes calldata signatures
    )
        external
        payable
        returns (bool success);
}
