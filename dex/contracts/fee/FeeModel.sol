// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../HectorStorage.sol";
import "../lib/Utils.sol";
import "./IFeeClaimer.sol";
// helpers
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract FeeModel is HectorStorage {
    using SafeMath for uint256;

    uint256 public immutable partnerSharePercent;
    uint256 public immutable maxFeePercent;
    IFeeClaimer public immutable feeClaimer;

    constructor(
        uint256 _partnerSharePercent,
        uint256 _maxFeePercent,
        IFeeClaimer _feeClaimer
    ) {
        partnerSharePercent = _partnerSharePercent;
        maxFeePercent = _maxFeePercent;
        feeClaimer = _feeClaimer;
    }

    // feePercent is a packed structure.
    // Bits 255-248 = 8-bit version field
    //
    // Version 0
    // =========
    // Entire structure is interpreted as the fee percent in basis points.
    // If set to 0 then partner will not receive any fees.
    //
    // Version 1
    // =========
    // Bits 13-0 = Fee percent in basis points
    // Bit 14 = positiveSlippageToUser (positive slippage to partner if not set)
    // Bit 15 = if set, take fee from fromToken, toToken otherwise
    // Bit 16 = if set, do fee distribution as per referral program

    // Used only for SELL (where needs to be done before swap or at the end if not transferring)
    function takeFromTokenFee(
        address fromToken,
        uint256 fromAmount,
        address payable partner,
        uint256 feePercent
    ) internal returns (uint256 newFromAmount) {
        uint256 fixedFeeBps = _getFixedFeeBps(partner, feePercent);
        if (fixedFeeBps == 0) return fromAmount;
        (uint256 partnerShare, uint256 paraswapShare) = _calcFixedFees(fromAmount, fixedFeeBps);
        return _distributeFees(fromAmount, fromToken, partner, partnerShare, paraswapShare);
    }

    // Used only for SELL (where can be done after swap and need to transfer)
    function takeFromTokenFeeAndTransfer(
        address fromToken,
        uint256 fromAmount,
        uint256 remainingAmount,
        address payable partner,
        uint256 feePercent
    ) internal {
        uint256 fixedFeeBps = _getFixedFeeBps(partner, feePercent);
        if (fixedFeeBps != 0) {
            (uint256 partnerShare, uint256 paraswapShare) = _calcFixedFees(fromAmount, fixedFeeBps);
            remainingAmount = _distributeFees(remainingAmount, fromToken, partner, partnerShare, paraswapShare);
        }
        Utils.transferTokens(fromToken, payable(msg.sender), remainingAmount);
    }

    // Used only for BUY
    function takeFromTokenFeeSlippageAndTransfer(
        address fromToken,
        uint256 fromAmount,
        uint256 expectedAmount,
        uint256 remainingAmount,
        address payable partner,
        uint256 feePercent
    ) internal {
        uint256 fixedFeeBps = _getFixedFeeBps(partner, feePercent);
        uint256 slippage = _calcSlippage(fixedFeeBps, expectedAmount, fromAmount.sub(remainingAmount));
        uint256 partnerShare;
        uint256 paraswapShare;
        if (fixedFeeBps != 0) {
            (partnerShare, paraswapShare) = _calcFixedFees(expectedAmount, fixedFeeBps);
        }
        if (slippage != 0) {
            (uint256 partnerShare2, uint256 paraswapShare2) = _calcSlippageFees(slippage, partner, feePercent);
            partnerShare = partnerShare.add(partnerShare2);
            paraswapShare = paraswapShare.add(paraswapShare2);
        }
        Utils.transferTokens(
            fromToken,
            payable(msg.sender),
            _distributeFees(remainingAmount, fromToken, partner, partnerShare, paraswapShare)
        );
    }

    // Used only for SELL
    function takeToTokenFeeSlippageAndTransfer(
        address toToken,
        uint256 expectedAmount,
        uint256 receivedAmount,
        address payable beneficiary,
        address payable partner,
        uint256 feePercent
    ) internal {
        uint256 fixedFeeBps = _getFixedFeeBps(partner, feePercent);
        uint256 slippage = _calcSlippage(fixedFeeBps, receivedAmount, expectedAmount);
        uint256 partnerShare;
        uint256 paraswapShare;
        if (fixedFeeBps != 0) {
            (partnerShare, paraswapShare) = _calcFixedFees(
                slippage != 0 ? expectedAmount : receivedAmount,
                fixedFeeBps
            );
        }
        if (slippage != 0) {
            (uint256 partnerShare2, uint256 paraswapShare2) = _calcSlippageFees(slippage, partner, feePercent);
            partnerShare = partnerShare.add(partnerShare2);
            paraswapShare = paraswapShare.add(paraswapShare2);
        }
        Utils.transferTokens(
            toToken,
            beneficiary,
            _distributeFees(receivedAmount, toToken, partner, partnerShare, paraswapShare)
        );
    }

    // Used only for BUY
    function takeToTokenFeeAndTransfer(
        address toToken,
        uint256 receivedAmount,
        address payable beneficiary,
        address payable partner,
        uint256 feePercent
    ) internal {
        uint256 fixedFeeBps = _getFixedFeeBps(partner, feePercent);
        if (fixedFeeBps != 0) {
            (uint256 partnerShare, uint256 paraswapShare) = _calcFixedFees(receivedAmount, fixedFeeBps);
            receivedAmount = _distributeFees(receivedAmount, toToken, partner, partnerShare, paraswapShare);
        }
        Utils.transferTokens(toToken, beneficiary, receivedAmount);
    }

    function _getFixedFeeBps(address partner, uint256 feePercent) private view returns (uint256 fixedFeeBps) {
        if (partner == address(0)) return 0;
        uint256 version = feePercent >> 248;
        if (version == 0) {
            fixedFeeBps = feePercent;
        } else if ((feePercent & (1 << 16)) != 0) {
            // Referrer program only has slippage fees
            return 0;
        } else {
            fixedFeeBps = feePercent & 0x3FFF;
        }
        return fixedFeeBps > maxFeePercent ? maxFeePercent : fixedFeeBps;
    }

    function _calcSlippage(
        uint256 fixedFeeBps,
        uint256 positiveAmount,
        uint256 negativeAmount
    ) private pure returns (uint256 slippage) {
        return (fixedFeeBps <= 50 && positiveAmount > negativeAmount) ? positiveAmount.sub(negativeAmount) : 0;
    }

    function _calcFixedFees(uint256 amount, uint256 fixedFeeBps)
        private
        view
        returns (uint256 partnerShare, uint256 paraswapShare)
    {
        uint256 fee = amount.mul(fixedFeeBps).div(10000);
        partnerShare = fee.mul(partnerSharePercent).div(10000);
        paraswapShare = fee.sub(partnerShare);
    }

    function _calcSlippageFees(
        uint256 slippage,
        address partner,
        uint256 feePercent
    ) private pure returns (uint256 partnerShare, uint256 paraswapShare) {
        paraswapShare = slippage.div(2);
        if (partner != address(0)) {
            uint256 version = feePercent >> 248;
            if (version != 0) {
                if ((feePercent & (1 << 16)) != 0) {
                    uint256 feeBps = feePercent & 0x3FFF;
                    partnerShare = paraswapShare.mul(feeBps > 10000 ? 10000 : feeBps).div(10000);
                } else if ((feePercent & (1 << 14)) == 0) {
                    partnerShare = paraswapShare;
                }
            }
        }
    }

    function _distributeFees(
        uint256 currentBalance,
        address token,
        address payable partner,
        uint256 partnerShare,
        uint256 paraswapShare
    ) private returns (uint256 newBalance) {
        uint256 totalFees = partnerShare.add(paraswapShare);
        if (totalFees == 0) return currentBalance;

        require(totalFees <= currentBalance, "Insufficient balance to pay for fees");

        Utils.transferTokens(token, payable(address(feeClaimer)), totalFees);
        if (partnerShare != 0) {
            feeClaimer.registerFee(partner, IERC20(token), partnerShare);
        }
        if (paraswapShare != 0) {
            feeClaimer.registerFee(feeWallet, IERC20(token), paraswapShare);
        }

        return currentBalance.sub(totalFees);
    }

    function _isTakeFeeFromSrcToken(uint256 feePercent) internal pure returns (bool) {
        return feePercent >> 248 != 0 && (feePercent & (1 << 15)) != 0;
    }
}