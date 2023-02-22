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

contract HectorPay is ContextUpgradeable, BoringBatchable {
    using SafeERC20 for IERC20;

    struct Payer {
        uint256 totalDeposited;
        uint256 totalCommitted;
    }

    struct Stream {
        address from;
        address to;
        uint256 amountPerSec;
        uint48 starts;
        uint48 ends;
        uint48 lastPaid;
        uint48 lastPaused;
    }

    mapping(address => Payer) public payers;
    mapping(bytes32 => Stream) public streams;

    IERC20 public token;
    uint256 public DECIMALS_DIVISOR;

    string public constant VERSION = 'v1.0';

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
        uint48 lastPaid,
        bytes32 streamId,
        uint256 amount
    );
    event PayerDeposit(address indexed from, uint256 amount);
    event PayerWithdraw(address indexed from, uint256 amount);

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

    function _createStream(
        address to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends
    ) internal returns (bytes32 streamId) {
        if (starts >= ends) revert INVALID_TIME();
        if (ends <= block.timestamp) revert INVALID_TIME();
        if (to == address(0)) revert INVALID_ADDRESS();
        if (amountPerSec == 0) revert INVALID_AMOUNT();

        streamId = getStreamId(msg.sender, to, amountPerSec, starts, ends);
        if (streams[streamId].lastPaid > 0) revert ACTIVE_STREAM();

        /// calculate total committed amount of a stream
        Payer storage payer = payers[msg.sender];
        payer.totalCommitted += (ends - starts) * amountPerSec;
        if (payer.totalDeposited < payer.totalCommitted) revert PAYER_IN_DEBT();

        streams[streamId] = Stream({
            from: msg.sender,
            to: to,
            amountPerSec: amountPerSec,
            starts: starts,
            ends: ends,
            lastPaid: starts,
            lastPaused: 0
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

    function deposit(uint256 amount) public {
        payers[msg.sender].totalDeposited += amount * DECIMALS_DIVISOR;

        token.safeTransferFrom(msg.sender, address(this), amount);

        emit PayerDeposit(msg.sender, amount * DECIMALS_DIVISOR);
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
        stream = streams[streamId];

        if (stream.lastPaid == 0) revert INACTIVE_STREAM();

        uint256 stop = min(ends, block.timestamp);
        if (stop > stream.lastPaid) {
            amountToTransfer =
                ((stop - stream.lastPaid) * stream.amountPerSec) /
                DECIMALS_DIVISOR;
            stream.lastPaid = uint48(stop);

            emit Withdraw(
                from,
                to,
                amountPerSec,
                starts,
                ends,
                stream.lastPaid,
                streamId,
                amountToTransfer
            );
        }
    }

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
            uint48 lastPaid,
            uint256 withdrawableAmount
        )
    {
        streamId = getStreamId(from, to, amountPerSec, starts, ends);
        Stream storage stream = streams[streamId];

        if (stream.lastPaid == 0) revert INACTIVE_STREAM();

        lastPaid = stream.lastPaid;

        uint256 stop = min(ends, block.timestamp);
        if (stop > lastPaid) {
            withdrawableAmount =
                ((stop - lastPaid) * amountPerSec) /
                DECIMALS_DIVISOR;
        }
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

        stream.lastPaid = 0;

        token.safeTransfer(to, amountToTransfer);
    }

    function cancelStream(
        address to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends
    ) external {
        bytes32 streamId = _cancelStream(to, amountPerSec, starts, ends);

        /// calculate total committed amount of a stream
        uint256 start = max(starts, block.timestamp);
        if (ends > start) {
            payers[msg.sender].totalCommitted -= amountPerSec * (ends - start);
        }

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
        streams[streamId].lastPaused = uint48(block.timestamp);
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
        Stream storage stream = streams[streamId];
        Payer storage payer = payers[msg.sender];

        if (stream.lastPaid > 0) revert ACTIVE_STREAM();
        if (stream.lastPaused == 0) revert STREAM_ENDED();

        /// calculate total committed amount of a stream
        uint256 start = max(starts, stream.lastPaused);
        uint256 stop = min(ends, block.timestamp);
        if (stop > start) {
            payer.totalCommitted -= amountPerSec * (stop - start);
        }

        stream.lastPaused = 0;

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

    function withdrawablePayer(address from)
        external
        view
        returns (bool isSufficient, uint256 amount)
    {
        Payer memory payer = payers[from];

        if (payer.totalDeposited < payer.totalCommitted) {
            return (false, 0);
        } else {
            isSufficient = true;
            amount =
                (payer.totalDeposited - payer.totalCommitted) /
                DECIMALS_DIVISOR;
        }
    }

    function withdrawPayer() external {
        Payer storage payer = payers[msg.sender];
        uint256 toSend;

        if (payer.totalDeposited > payer.totalCommitted) {
            toSend =
                (payer.totalDeposited - payer.totalCommitted) /
                DECIMALS_DIVISOR;
            payer.totalDeposited = payer.totalCommitted;
        }

        if (toSend > 0) token.safeTransfer(msg.sender, toSend);

        emit PayerWithdraw(msg.sender, toSend);
    }

    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
