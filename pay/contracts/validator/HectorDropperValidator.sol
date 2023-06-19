// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.17;

import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {TransparentUpgradeableProxy} from '@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol';

import {IHectorValidator} from '../interfaces/IHectorValidator.sol';
import {IHectorSubscriptionBase} from '../interfaces/IHectorSubscriptionBase.sol';

error INVALID_ADDRESS();
error INVALID_PARAM();

contract HectorDropperValidator is IHectorValidator, Ownable {
    /* ======== STORAGE ======== */

    IHectorSubscriptionBase public paySubscription;

    /* ======== INITIALIZATION ======== */

    constructor(address _paySubscription) {
        if (_paySubscription == address(0)) revert INVALID_ADDRESS();

        paySubscription = IHectorSubscriptionBase(_paySubscription);
    }

    /* ======== POLICY FUNCTIONS ======== */

    function setPaySubscription(address _paySubscription) external onlyOwner {
        if (_paySubscription == address(0)) revert INVALID_ADDRESS();
        paySubscription = IHectorSubscriptionBase(_paySubscription);
    }

    /* ======== PUBLIC FUNCTIONS ======== */

    function isValid(bytes calldata input) external returns (bool) {
        (address from, uint256 numberOfRecipients) = abi.decode(
            input,
            (address, uint256)
        );

        (uint256 planId, , , , ) = paySubscription.getSubscription(from);
        bytes memory planData = paySubscription.getPlanData(planId);
        (, uint256 limitationOfRecipients) = abi.decode(
            planData,
            (uint256, uint256)
        );

        return limitationOfRecipients >= numberOfRecipients;
    }
}
