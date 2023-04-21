// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

interface IHectorValidator {
    function isValid(bytes calldata input) external returns (bool);
}
