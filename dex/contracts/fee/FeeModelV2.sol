// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../HectorStorage.sol";
import "../lib/Utils.sol";
import "./IFeeClaimer.sol";

contract FeeModel is HectorStorage {
    using SafeMath for uint256;

    uint256 public immutable partnerSharePercent;
    uint256 public immutable maxFeePercent;

    constructor(uint256 _partnerSharePercent, uint256 _maxFeePercent) {
        partnerSharePercent = _partnerSharePercent;
        maxFeePercent = _maxFeePercent;
    }

    function takeFeeAndTransferTokens(
        address toToken,
        uint256 expectedAmount,
        uint256 receivedAmount,
        address payable beneficiary,
        address payable partner,
        uint256 feePercent
    ) internal {
        uint256 remainingAmount = 0;
        uint256 fee = 0;

        if (feePercent > 0) {
            FeeStructure memory feeStructure = registeredPartners[partner];

            if (feeStructure.partnerShare > 0) {
                fee = _takeFee(
                    feePercent > maxFeePercent ? maxFeePercent : feePercent,
                    toToken,
                    receivedAmount,
                    expectedAmount,
                    feeStructure.partnerShare,
                    feeStructure.noPositiveSlippage,
                    feeStructure.positiveSlippageToUser,
                    partner
                );
            } else if (partner != address(0)) {
                fee = _takeFee(
                    feePercent > maxFeePercent ? maxFeePercent : feePercent,
                    toToken,
                    receivedAmount,
                    expectedAmount,
                    partnerSharePercent,
                    false,
                    true,
                    partner
                );
            }
        }

        remainingAmount = receivedAmount.sub(fee);

        //If there is a positive slippage and no partner fee then 50% goes to paraswap and 50% to the user
        if ((remainingAmount > expectedAmount) && fee == 0) {
            uint256 positiveSlippageShare = remainingAmount
                .sub(expectedAmount)
                .div(2);
            remainingAmount = remainingAmount.sub(positiveSlippageShare);
            Utils.transferTokens(toToken, feeWallet, positiveSlippageShare);
        }

        Utils.transferTokens(toToken, beneficiary, remainingAmount);
    }

    function _takeFee(
        uint256 feePercent,
        address toToken,
        uint256 receivedAmount,
        uint256 expectedAmount,
        uint256 _partnerSharePercent,
        bool noPositiveSlippage,
        bool positiveSlippageToUser,
        address payable partner
    ) private returns (uint256 fee) {
        uint256 partnerShare = 0;
        uint256 paraswapShare = 0;

        if (
            !noPositiveSlippage &&
            feePercent <= 50 &&
            receivedAmount > expectedAmount
        ) {
            uint256 halfPositiveSlippage = receivedAmount
                .sub(expectedAmount)
                .div(2);
            //Calculate total fee to be taken
            fee = expectedAmount.mul(feePercent).div(10000);
            //Calculate partner's share
            partnerShare = fee.mul(_partnerSharePercent).div(10000);
            //All remaining fee is paraswap's share
            paraswapShare = fee.sub(partnerShare);
            paraswapShare = paraswapShare.add(halfPositiveSlippage);

            fee = fee.add(halfPositiveSlippage);

            if (!positiveSlippageToUser) {
                partnerShare = partnerShare.add(halfPositiveSlippage);
                fee = fee.add(halfPositiveSlippage);
            }
        } else {
            //Calculate total fee to be taken
            fee = receivedAmount.mul(feePercent).div(10000);
            //Calculate partner's share
            partnerShare = fee.mul(_partnerSharePercent).div(10000);
            //All remaining fee is paraswap's share
            paraswapShare = fee.sub(partnerShare);
        }
        Utils.transferTokens(toToken, partner, partnerShare);
        Utils.transferTokens(toToken, feeWallet, paraswapShare);

        return (fee);
    }
}
