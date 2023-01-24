// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.17;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IERC20Metadata} from '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import {ContextUpgradeable} from '@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {Strings} from '@openzeppelin/contracts/utils/Strings.sol';

import {BoringBatchable} from './libraries/BoringBatchable.sol';

interface Factory {
    function parameter() external view returns (address);
}

error INVALID_ADDRESS();
error INVALID_TIME();
error PAYER_IN_DEBT();
error INACTIVE_STREAM();
error ACTIVE_STREAM();
error STREAM_ENDED();
error INVALID_AMOUNT();
error INVALID_PARAM();

contract HectorPay is ContextUpgradeable, BoringBatchable {
    using SafeERC20 for IERC20;

    struct Payer {
        uint256 balance;
        uint256 totalPaidPerSec;
        uint48 lastUpdate;
    }

    struct Stream {
        address from;
        address to;
        uint256 amountPerSec;
        uint48 starts;
        uint48 ends;
        uint48 lastPaid;
    }

    mapping(address => Payer) public payers;
    mapping(bytes32 => Stream) public streams;
    mapping(bytes32 => uint256) public debts; /// Tracks debt for streams
    mapping(bytes32 => uint256) public redeemables; /// Tracks redeemable amount for streams

    IERC20 public token;
    uint256 public DECIMALS_DIVISOR;

    event StreamCreated(
        address indexed from,
        address indexed to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends,
        bytes32 streamId
    );
    event StreamCreatedWithReason(
        address indexed from,
        address indexed to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends,
        bytes32 streamId,
        string reason
    );
    event StreamCancelled(
        address indexed from,
        address indexed to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends,
        bytes32 streamId
    );
    event StreamPaused(
        address indexed from,
        address indexed to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends,
        bytes32 streamId
    );
    event StreamResumed(
        address indexed from,
        address indexed to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends,
        bytes32 streamId
    );
    event StreamModified(
        address indexed from,
        address indexed oldTo,
        uint256 oldAmountPerSec,
        uint48 oldEnds,
        bytes32 oldStreamId,
        address indexed to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends,
        bytes32 newStreamId
    );
    event Withdraw(
        address indexed from,
        address indexed to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends,
        bytes32 streamId,
        uint256 amount
    );
    event PayerDeposit(address indexed from, uint256 amount);
    event PayerWithdraw(address indexed from, uint256 amount);
    event UpdatePayer(address indexed payer);
    event UpdateStream(bytes32 streamId);

    constructor() {
        _disableInitializers();
    }

    function initialize() external initializer {
        token = IERC20(Factory(msg.sender).parameter());
        uint8 tokenDecimals = IERC20Metadata(address(token)).decimals();
        DECIMALS_DIVISOR = 10**(20 - tokenDecimals);
    }

    function getStreamId(
        address from,
        address to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends
    ) public pure returns (bytes32) {
        return
            keccak256(abi.encodePacked(from, to, amountPerSec, starts, ends));
    }

    function _updatePayer(address _payer)
        private
        returns (Payer storage payer)
    {
        payer = payers[_payer];
        unchecked {
            uint256 streamed = (block.timestamp - uint256(payer.lastUpdate)) *
                payer.totalPaidPerSec;
            if (payer.balance >= streamed) {
                /// If enough to pay owed then deduct from balance and update to current timestamp
                payer.balance -= streamed;
                payer.lastUpdate = uint48(block.timestamp);
            } else {
                /// If not enough then get remainder paying as much as possible then calculating and adding time paid
                payer.lastUpdate += uint48(
                    payer.balance / payer.totalPaidPerSec
                );
                payer.balance = payer.balance % payer.totalPaidPerSec;
            }
        }
        emit UpdatePayer(_payer);
    }

    function _updateStream(bytes32 streamId)
        private
        returns (Stream storage stream)
    {
        stream = streams[streamId];
        Payer storage payer = _updatePayer(stream.from);

        unchecked {
            uint256 lastUpdate = uint256(payer.lastUpdate);
            uint256 amountPerSec = uint256(stream.amountPerSec);
            uint256 lastPaid = uint256(stream.lastPaid);
            uint256 starts = uint256(stream.starts);
            uint256 ends = uint256(stream.ends);
            /// If stream is inactive/cancelled
            if (lastPaid == 0) {
                /// Can only withdraw redeemable so do nothing
            }
            /// Stream not updated after start and has ended
            else if (
                /// Stream not updated after start
                starts > lastPaid &&
                /// Stream ended
                lastUpdate >= ends
            ) {
                /// Refund payer for:
                /// Stream last updated to stream start
                /// Stream ended to token last updated
                payer.balance +=
                    ((starts - lastPaid) + (lastUpdate - ends)) *
                    amountPerSec;
                /// Payee can redeem:
                /// Stream start to end
                redeemables[streamId] = (ends - starts) * amountPerSec;
                /// Stream is now inactive
                stream.lastPaid = 0;
                payer.totalPaidPerSec -= amountPerSec;
            }
            /// Stream started but has not been updated from after start
            else if (
                /// Stream started
                lastUpdate >= starts &&
                /// Stream not updated after start
                starts > lastPaid
            ) {
                /// Refund payer for:
                /// Stream last updated to stream start
                payer.balance += (starts - lastPaid) * amountPerSec;
                /// Payer can redeem:
                /// Stream start to last token update
                redeemables[streamId] = (lastUpdate - starts) * amountPerSec;
                stream.lastPaid = uint48(lastUpdate);
            }
            /// Stream has ended
            else if (
                /// Stream ended
                lastUpdate >= ends
            ) {
                /// Refund payer for:
                /// Stream end to last token update
                payer.balance += (lastUpdate - ends) * amountPerSec;
                /// Add redeemable for:
                /// Stream last updated to stream end
                redeemables[streamId] += (ends - lastPaid) * amountPerSec;
                /// Stream is now inactive
                stream.lastPaid = 0;
                payer.totalPaidPerSec -= amountPerSec;
            }
            /// Stream is updated before stream starts
            else if (
                /// Stream not started
                starts > lastUpdate
            ) {
                /// Refund payer:
                /// Last stream update to last token update
                payer.balance += (lastUpdate - lastPaid) * amountPerSec;
                /// update lastpaid to last token update
                stream.lastPaid = uint48(lastUpdate);
            }
            /// Updated after start, and has not ended
            else if (
                /// Stream started
                lastPaid >= starts &&
                /// Stream has not ended
                ends > lastUpdate
            ) {
                /// Add redeemable for:
                /// stream last update to last token update
                redeemables[streamId] += (lastUpdate - lastPaid) * amountPerSec;
                stream.lastPaid = uint48(lastUpdate);
            }
        }

        emit UpdateStream(streamId);
    }

    function _createStream(
        address to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends
    ) internal returns (bytes32 streamId) {
        if (starts >= ends) revert INVALID_TIME();
        if (to == address(0)) revert INVALID_ADDRESS();
        if (amountPerSec == 0) revert INVALID_AMOUNT();

        Payer storage payer = _updatePayer(msg.sender);
        if (block.timestamp > payer.lastUpdate) revert PAYER_IN_DEBT();

        streamId = getStreamId(msg.sender, to, amountPerSec, starts, ends);
        if (streams[streamId].lastPaid > 0) revert ACTIVE_STREAM();

        /// calculate owed if stream already ended on creation
        uint256 owed;
        uint256 lastPaid;
        if (block.timestamp > ends) {
            owed = (ends - starts) * amountPerSec;
        }
        /// calculated owed if start is before block.timestamp
        else if (block.timestamp > starts) {
            owed = (block.timestamp - starts) * amountPerSec;
            payer.totalPaidPerSec += amountPerSec;
            lastPaid = block.timestamp;
            /// If started at timestamp or starts in the future
        } else if (starts >= block.timestamp) {
            payer.totalPaidPerSec += amountPerSec;
            lastPaid = block.timestamp;
        }

        unchecked {
            /// If can pay owed then directly send it to payee
            if (payer.balance >= owed) {
                payer.balance -= owed;
                redeemables[streamId] = owed;
            } else {
                /// If cannot pay debt, then add to debt and send entire balance to payee
                uint256 balance = payer.balance;
                payer.balance = 0;
                debts[streamId] = owed - balance;
                redeemables[streamId] = balance;
            }
        }

        streams[streamId] = Stream({
            from: msg.sender,
            to: to,
            amountPerSec: amountPerSec,
            starts: starts,
            ends: ends,
            lastPaid: uint48(lastPaid)
        });
    }

    function createStream(
        address to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends
    ) public {
        bytes32 streamId = _createStream(to, amountPerSec, starts, ends);
        emit StreamCreated(
            msg.sender,
            to,
            amountPerSec,
            starts,
            ends,
            streamId
        );
    }

    function createStreamWithReason(
        address to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends,
        string calldata reason
    ) public {
        bytes32 streamId = _createStream(to, amountPerSec, starts, ends);
        emit StreamCreatedWithReason(
            msg.sender,
            to,
            amountPerSec,
            starts,
            ends,
            streamId,
            reason
        );
    }

    function _withdraw(
        address from,
        address to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends
    )
        private
        returns (
            bytes32 streamId,
            Stream storage stream,
            uint256 amountToTransfer
        )
    {
        streamId = getStreamId(from, to, amountPerSec, starts, ends);
        stream = _updateStream(streamId);

        amountToTransfer = redeemables[streamId] / DECIMALS_DIVISOR;
        redeemables[streamId] = 0;

        emit Withdraw(
            from,
            to,
            amountPerSec,
            starts,
            ends,
            streamId,
            amountToTransfer
        );
    }

    // Copy of _withdraw that is view-only and returns how much can be withdrawn from a stream, purely for convenience on frontend
    // No need to review since this does nothing
    function withdrawable(
        address from,
        address to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends
    )
        external
        view
        returns (
            bytes32 streamId,
            uint256 lastUpdate,
            uint256 debt,
            uint256 withdrawableAmount
        )
    {
        streamId = getStreamId(from, to, amountPerSec, starts, ends);
        Stream storage stream = streams[streamId];
        Payer storage payer = payers[stream.from];

        uint256 streamed;
        unchecked {
            streamed = (block.timestamp - lastUpdate) * payer.totalPaidPerSec;
        }

        if (payer.balance >= streamed) {
            lastUpdate = block.timestamp;
        } else {
            lastUpdate =
                uint256(payer.lastUpdate) +
                (payer.balance / payer.totalPaidPerSec);
        }

        /// Inactive or cancelled stream
        if (stream.lastPaid == 0 || starts > block.timestamp) {
            return (streamId, 0, 0, 0);
        }

        uint256 start = max(uint256(stream.lastPaid), starts);
        uint256 stop = min(ends, lastUpdate);
        // If lastUpdate isn't block.timestamp and greater than ends, there is debt.
        if (lastUpdate != block.timestamp && ends > lastUpdate) {
            debt =
                (min(block.timestamp, ends) - max(lastUpdate, starts)) *
                amountPerSec;
        }
        withdrawableAmount = (stop - start) * amountPerSec;

        withdrawableAmount =
            (withdrawableAmount + redeemables[streamId]) /
            DECIMALS_DIVISOR;
        debt = (debt + debts[streamId]) / DECIMALS_DIVISOR;
    }

    function withdraw(
        address from,
        address to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends
    ) external {
        (, , uint256 amountToTransfer) = _withdraw(
            from,
            to,
            amountPerSec,
            starts,
            ends
        );
        token.safeTransfer(to, amountToTransfer);
    }

    function _cancelStream(
        address to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends
    ) internal returns (bytes32 streamId) {
        Stream storage stream;
        uint256 amountToTransfer;
        (streamId, stream, amountToTransfer) = _withdraw(
            msg.sender,
            to,
            amountPerSec,
            starts,
            ends
        );

        if (stream.lastPaid == 0) revert INACTIVE_STREAM();

        stream.lastPaid = 0;
        unchecked {
            // totalPaidPerSec is a sum of items which include amountPerSec, so totalPaidPerSec >= amountPerSec
            payers[msg.sender].totalPaidPerSec -= amountPerSec;
        }

        token.safeTransfer(to, amountToTransfer);
    }

    function cancelStream(
        address to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends
    ) external {
        bytes32 streamId = _cancelStream(to, amountPerSec, starts, ends);
        emit StreamCancelled(
            msg.sender,
            to,
            amountPerSec,
            starts,
            ends,
            streamId
        );
    }

    function pauseStream(
        address to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends
    ) external {
        bytes32 streamId = _cancelStream(to, amountPerSec, starts, ends);
        emit StreamPaused(msg.sender, to, amountPerSec, starts, ends, streamId);
    }

    function resumeStream(
        address to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends
    ) external {
        bytes32 streamId = getStreamId(
            msg.sender,
            to,
            amountPerSec,
            starts,
            ends
        );
        Stream storage stream = _updateStream(streamId);
        Payer storage payer = payers[msg.sender];

        if (stream.from == address(0)) revert INVALID_PARAM();
        if (stream.lastPaid > 0) revert ACTIVE_STREAM();
        if (block.timestamp >= stream.ends) revert STREAM_ENDED();
        if (block.timestamp > payer.lastUpdate) revert PAYER_IN_DEBT();

        payer.totalPaidPerSec += stream.amountPerSec;
        stream.lastPaid = uint48(block.timestamp);

        emit StreamResumed(
            msg.sender,
            to,
            amountPerSec,
            starts,
            ends,
            streamId
        );
    }

    function modifyStream(
        address oldTo,
        uint256 oldAmountPerSec,
        uint48 starts,
        uint48 oldEnds,
        address to,
        uint256 amountPerSec,
        uint48 ends
    ) external {
        // Can be optimized but I don't think extra complexity is worth it
        bytes32 oldStreamId = _cancelStream(
            oldTo,
            oldAmountPerSec,
            starts,
            oldEnds
        );
        bytes32 newStreamId = _createStream(to, amountPerSec, starts, ends);
        emit StreamModified(
            msg.sender,
            oldTo,
            oldAmountPerSec,
            oldEnds,
            oldStreamId,
            to,
            amountPerSec,
            starts,
            ends,
            newStreamId
        );
    }

    function deposit(uint256 amount) public {
        payers[msg.sender].balance += amount * DECIMALS_DIVISOR;
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit PayerDeposit(msg.sender, amount);
    }

    function depositAndCreate(
        uint256 amountToDeposit,
        address to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends
    ) external {
        deposit(amountToDeposit);
        createStream(to, amountPerSec, starts, ends);
    }

    function depositAndCreateWithReason(
        uint256 amountToDeposit,
        address to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends,
        string calldata reason
    ) external {
        deposit(amountToDeposit);
        createStreamWithReason(to, amountPerSec, starts, ends, reason);
    }

    function withdrawPayer(uint256 amount) public {
        Payer storage payer = _updatePayer(msg.sender);
        uint256 toDeduct = amount * DECIMALS_DIVISOR;
        /// Will revert if not enough after updating Token
        payer.balance -= toDeduct;
        token.safeTransfer(msg.sender, amount);
        emit PayerWithdraw(msg.sender, amount);
    }

    function withdrawPayerAll() external {
        Payer storage payer = _updatePayer(msg.sender);
        uint256 toSend = payer.balance / DECIMALS_DIVISOR;
        payer.balance = 0;
        token.safeTransfer(msg.sender, toSend);
        emit PayerWithdraw(msg.sender, toSend);
    }

    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function isSufficientFund(
        address from,
        address[] memory to,
        uint256[] memory amountPerSec,
        uint48[] memory starts,
        uint48[] memory ends,
        uint256 timestamp
    ) external view returns (bool isSufficient, uint256 chargeAmount) {
        uint256 length = to.length;
        if (from == address(0)) revert INVALID_ADDRESS();
        if (length == 0) revert INVALID_PARAM();
        if (length != amountPerSec.length) revert INVALID_PARAM();
        if (length != starts.length) revert INVALID_PARAM();
        if (length != ends.length) revert INVALID_PARAM();
        if (timestamp < block.timestamp) revert INVALID_TIME();

        // Update Payer
        Payer memory payer = payers[from];
        unchecked {
            uint256 streamed = (timestamp - uint256(payer.lastUpdate)) *
                payer.totalPaidPerSec;
            if (payer.balance >= streamed) {
                /// If enough to pay owed then deduct from balance and update to specified timestamp
                return (true, 0);
            } else {
                /// If not enough then get remainder paying as much as possible then calculating and adding time paid
                payer.lastUpdate += uint48(
                    payer.balance / payer.totalPaidPerSec
                );
                payer.balance = payer.balance % payer.totalPaidPerSec;
            }
        }

        // Update Stream
        for (uint256 i = 0; i < length; i++) {
            bytes32 streamId = getStreamId(
                from,
                to[i],
                amountPerSec[i],
                starts[i],
                ends[i]
            );
            Stream memory stream = streams[streamId];

            unchecked {
                uint256 lastUpdate = uint256(payer.lastUpdate);
                uint256 lastPaid = uint256(stream.lastPaid);

                /// If stream is inactive/cancelled
                if (lastPaid == 0) {
                    /// Can only withdraw redeemable so do nothing
                }
                /// Stream not updated after start and has ended
                else if (
                    /// Stream not updated after start
                    starts[i] > lastPaid &&
                    /// Stream ended
                    lastUpdate >= ends[i]
                ) {
                    /// Refund payer for:
                    /// Stream last updated to stream start
                    /// Stream ended to token last updated
                    payer.balance +=
                        ((starts[i] - lastPaid) + (lastUpdate - ends[i])) *
                        amountPerSec[i];
                    /// Stream is now inactive
                    payer.totalPaidPerSec -= amountPerSec[i];
                }
                /// Stream started but has not been updated from after start
                else if (
                    /// Stream started
                    lastUpdate >= starts[i] &&
                    /// Stream not updated after start
                    starts[i] > lastPaid
                ) {
                    /// Refund payer for:
                    /// Stream last updated to stream start
                    payer.balance += (starts[i] - lastPaid) * amountPerSec[i];
                }
                /// Stream has ended
                else if (
                    /// Stream ended
                    lastUpdate >= ends[i]
                ) {
                    /// Refund payer for:
                    /// Stream end to last token update
                    payer.balance += (lastUpdate - ends[i]) * amountPerSec[i];
                    /// Stream is now inactive
                    payer.totalPaidPerSec -= amountPerSec[i];
                }
                /// Stream is updated before stream starts
                else if (
                    /// Stream not started
                    starts[i] > lastUpdate
                ) {
                    /// Refund payer:
                    /// Last stream update to last token update
                    payer.balance += (lastUpdate - lastPaid) * amountPerSec[i];
                }
            }
        }

        // Check if it's sufficient
        unchecked {
            uint256 streamed = (timestamp - uint256(payer.lastUpdate)) *
                payer.totalPaidPerSec;
            if (payer.balance >= streamed) {
                /// If enough to pay owed then deduct from balance and update to specified timestamp
                return (true, 0);
            } else {
                /// If not enough then get remainder paying as much as possible then calculating and adding time paid
                isSufficient = false;
                chargeAmount = streamed - payer.balance;
            }
        }
    }
}
