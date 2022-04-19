// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

interface IEmissionor {
    function getBeginTime() external view returns (uint256);

    function getEndTime() external view returns (uint256);

    function distributionRemainingTime() external view returns (uint256);

    function isEmissionActive() external view returns (bool);
}
