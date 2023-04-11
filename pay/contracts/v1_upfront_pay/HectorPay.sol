// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.17;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IERC20Metadata} from '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {ContextUpgradeable} from '@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol';
import {ReentrancyGuardUpgradeable} from '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';
import {EnumerableSet} from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

import {BoringBatchable} from '../libraries/BoringBatchable.sol';

import {IHectorPay} from '../interfaces/IHectorPay.sol';
import {IHectorPayFactory} from '../interfaces/IHectorPayFactory.sol';
import {IHectorValidator} from '../interfaces/IHectorValidator.sol';

error INVALID_ADDRESS();
error INVALID_TIME();
error INVALID_AMOUNT();
error LIMITED_SUBSCRIPTION();
error INSUFFICIENT_FUND();
error INACTIVE_STREAM();
error ACTIVE_STREAM();
error STREAM_PAUSED();
error STREAM_ENDED();

contract HectorPay is
    IHectorPay,
    ContextUpgradeable,
    ReentrancyGuardUpgradeable,
    BoringBatchable
{
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.Bytes32Set;

    /* ======== STORAGE ======== */

    struct Payer {
        uint256 totalDeposited;
        uint256 totalCommitted;
        uint256 totalWithdrawn;
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

    /// @notice pay factory
    IHectorPayFactory public factory;

    /// @notice payer info
    mapping(address => Payer) public payers;

    /// @notice stream info
    mapping(bytes32 => Stream) public streams;

    /// @notice stream token
    IERC20 public token;

    /// @notice decimals divisor for 20
    uint256 public DECIMALS_DIVISOR;

    /// @notice version
    string public constant VERSION = 'v1.0';

    /// @notice payer's active streams
    mapping(address => EnumerableSet.Bytes32Set) private activeStreams;

    /* ======== EVENTS ======== */

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

    /* ======== INITIALIZATION ======== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() external initializer {
        factory = IHectorPayFactory(msg.sender);

        token = IERC20(factory.parameter());

        uint8 tokenDecimals = IERC20Metadata(address(token)).decimals();
        DECIMALS_DIVISOR = 10 ** (20 - tokenDecimals);

        __Context_init();
        __ReentrancyGuard_init();
    }

    /* ======== MODIFIER ======== */

    modifier isValid(address from) {
        address validator = factory.validator();

        if (validator != address(0)) {
            if (!IHectorValidator(validator).isValid(abi.encode(from)))
                revert LIMITED_SUBSCRIPTION();
        }

        _;
    }

    /* ======== VIEW FUNCTIONS ======== */

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

    function withdrawable(
        address from,
        address to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends
    )
        external
        view
        returns (bytes32 streamId, uint48 lastPaid, uint256 withdrawableAmount)
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

    /* ======== INTERNAL FUNCTIONS ======== */

    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function _createStream(
        address to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends,
        uint48 lastPaid
    ) internal returns (bytes32 streamId) {
        if (starts >= ends) revert INVALID_TIME();
        if (ends <= block.timestamp) revert INVALID_TIME();
        if (to == address(0)) revert INVALID_ADDRESS();
        if (amountPerSec == 0) revert INVALID_AMOUNT();

        // stream active
        streamId = getStreamId(msg.sender, to, amountPerSec, starts, ends);
        if (streams[streamId].lastPaid > 0) revert ACTIVE_STREAM();
        if (streams[streamId].lastPaused > 0) revert STREAM_PAUSED();

        /// calculate total committed amount of a stream
        Payer storage payer = payers[msg.sender];
        payer.totalCommitted += (ends - lastPaid) * amountPerSec;
        if (payer.totalDeposited < payer.totalCommitted)
            revert INSUFFICIENT_FUND();

        streams[streamId] = Stream({
            from: msg.sender,
            to: to,
            amountPerSec: amountPerSec,
            starts: starts,
            ends: ends,
            lastPaid: lastPaid,
            lastPaused: 0
        });

        /// active stream
        activeStreams[msg.sender].add(streamId);
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
            uint256 decimalAmount = (stop - stream.lastPaid) *
                stream.amountPerSec;
            amountToTransfer = decimalAmount / DECIMALS_DIVISOR;

            Payer storage payer = payers[from];
            payer.totalWithdrawn += decimalAmount;

            stream.lastPaid = uint48(stop);

            emit Withdraw(
                from,
                to,
                amountPerSec,
                starts,
                ends,
                stream.lastPaid,
                streamId,
                decimalAmount
            );
        }
    }

    function _cancelStream(
        address from,
        address to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends
    ) internal returns (bytes32 streamId) {
        Stream storage stream;
        uint256 amountToTransfer;
        (streamId, stream, amountToTransfer) = _withdraw(
            from,
            to,
            amountPerSec,
            starts,
            ends
        );

        stream.lastPaid = 0;

        /// deactive stream
        activeStreams[msg.sender].remove(streamId);

        token.safeTransfer(to, amountToTransfer);
    }

    function _resumeStream(
        address from,
        address to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends
    ) internal returns (bytes32 streamId) {
        streamId = getStreamId(from, to, amountPerSec, starts, ends);
        Stream storage stream = streams[streamId];
        Payer storage payer = payers[from];

        if (stream.lastPaid > 0) revert ACTIVE_STREAM();
        if (stream.lastPaused == 0) revert STREAM_ENDED();

        /// calculate total committed amount of a stream
        uint256 start = max(starts, stream.lastPaused);
        uint256 stop = min(ends, block.timestamp);
        if (stop > start) {
            payer.totalCommitted -= amountPerSec * (stop - start);
        }

        stream.lastPaid = uint48(stop);
        stream.lastPaused = 0;

        /// active stream
        activeStreams[msg.sender].add(streamId);
    }

    /* ======== VALIDATOR POLICY FUNCTIONS ======== */

    function activeStreamsByRemoveEnded(
        address from
    ) external returns (uint256 count) {
        uint256 length = activeStreams[from].length();

        for (uint256 i = 0; i < length; i++) {
            bytes32 streamId = activeStreams[from].at(count);
            Stream memory stream = streams[streamId];

            if (stream.ends < block.timestamp || stream.lastPaid == 0) {
                activeStreams[from].remove(streamId);
                delete streams[streamId];
            } else {
                unchecked {
                    ++count;
                }
            }
        }
    }

    /* ======== USER FUNCTIONS ======== */

    function createStream(
        address to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends
    ) public isValid(msg.sender) {
        bytes32 streamId = _createStream(
            to,
            amountPerSec,
            starts,
            ends,
            starts
        );
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
    ) public isValid(msg.sender) {
        bytes32 streamId = _createStream(
            to,
            amountPerSec,
            starts,
            ends,
            starts
        );
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

    function deposit(uint256 amount) public nonReentrant {
        uint256 decimalAmount = amount * DECIMALS_DIVISOR;

        payers[msg.sender].totalDeposited += decimalAmount;

        token.safeTransferFrom(msg.sender, address(this), amount);

        emit PayerDeposit(msg.sender, decimalAmount);
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

    function cancelStream(
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

        /// resume stream if it's paused in order to cancel it
        if (
            streams[streamId].lastPaid == 0 && streams[streamId].lastPaused > 0
        ) {
            _resumeStream(msg.sender, to, amountPerSec, starts, ends);
        }

        /// calculate total committed amount of a stream
        uint256 start = max(starts, block.timestamp);
        if (ends > start) {
            payers[msg.sender].totalCommitted -= amountPerSec * (ends - start);
        }

        /// cancel stream
        _cancelStream(msg.sender, to, amountPerSec, starts, ends);

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
        bytes32 streamId = _cancelStream(
            msg.sender,
            to,
            amountPerSec,
            starts,
            ends
        );
        streams[streamId].lastPaused = uint48(block.timestamp);

        emit StreamPaused(msg.sender, to, amountPerSec, starts, ends, streamId);
    }

    function resumeStream(
        address to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends
    ) public isValid(msg.sender) {
        bytes32 streamId = _resumeStream(
            msg.sender,
            to,
            amountPerSec,
            starts,
            ends
        );

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
        /// cancel old stream
        bytes32 oldStreamId = _cancelStream(
            msg.sender,
            oldTo,
            oldAmountPerSec,
            starts,
            oldEnds
        );
        bytes32 newStreamId;

        {
            uint256 lastPaid = min(oldEnds, max(starts, block.timestamp));

            /// calculate total committed amount of an old stream
            payers[msg.sender].totalCommitted -=
                oldAmountPerSec *
                (oldEnds - lastPaid);

            /// create new stream
            newStreamId = _createStream(
                to,
                amountPerSec,
                starts,
                ends,
                uint48(lastPaid)
            );
        }

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

    function withdrawablePayer(
        address from
    ) external view returns (uint256 amount) {
        Payer memory payer = payers[from];
        amount =
            (payer.totalDeposited - payer.totalCommitted) /
            DECIMALS_DIVISOR;
    }

    function withdrawPayerAll() external {
        Payer storage payer = payers[msg.sender];

        uint256 decimalAmount = payer.totalDeposited - payer.totalCommitted;
        uint256 toSend = decimalAmount / DECIMALS_DIVISOR;

        payer.totalDeposited = payer.totalCommitted;

        if (toSend > 0) token.safeTransfer(msg.sender, toSend);

        emit PayerWithdraw(msg.sender, decimalAmount);
    }

    function withdrawPayer(uint256 amount) external {
        if (amount == 0) revert INVALID_AMOUNT();

        Payer storage payer = payers[msg.sender];

        uint256 decimalAmount = amount * DECIMALS_DIVISOR;
        payer.totalDeposited -= decimalAmount;

        if (payer.totalDeposited < payer.totalCommitted)
            revert INVALID_AMOUNT();

        token.safeTransfer(msg.sender, amount);

        emit PayerWithdraw(msg.sender, decimalAmount);
    }
}
