// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.17;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IERC20Metadata} from '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import {ERC721EnumerableUpgradeable} from '@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {Strings} from '@openzeppelin/contracts/utils/Strings.sol';

import {BoringBatchable} from './libraries/BoringBatchable.sol';

interface Factory {
    function parameter() external view returns (address);
}

error NOT_PAYER();
error NOT_OWNER();
error NOT_PAYER_OR_OWNER();
error INVALID_ADDRESS();
error INVALID_TIME();
error PAYER_IN_DEBT();
error INACTIVE_STREAM();
error ACTIVE_STREAM();
error STREAM_ACTIVE_OR_REDEEMABLE();
error STREAM_ENDED();
error STREAM_DOES_NOT_EXIST();
error INVALID_AMOUNT();

contract HectorPay is ERC721EnumerableUpgradeable, BoringBatchable {
    using SafeERC20 for IERC20;

    struct Payer {
        uint256 balance;
        uint256 totalPaidPerSec;
        uint48 lastUpdate;
    }

    struct Stream {
        address payer;
        uint208 amountPerSec;
        uint48 lastPaid;
        uint48 starts;
        uint48 ends;
    }

    IERC20 public token;
    uint256 public nextTokenId;
    uint256 public DECIMALS_DIVISOR;

    mapping(address => Payer) public payers;
    mapping(uint256 => Stream) public streams;
    mapping(address => uint256) public payerWhitelists; /// Allows other addresses to interact on owner behalf
    mapping(address => mapping(uint256 => address)) public redirects; /// Allows stream funds to be sent to another address
    mapping(address => mapping(uint256 => mapping(address => uint256)))
        public streamWhitelists; /// Whitelist for addresses authorized to withdraw from stream
    mapping(uint256 => uint256) public debts; /// Tracks debt for streams
    mapping(uint256 => uint256) public redeemables; /// Tracks redeemable amount for streams

    event PayerDeposit(address indexed from, uint256 amount);
    event PayerWithdraw(address indexed from, uint256 amount);
    event Withdraw(
        address indexed from,
        address indexed to,
        uint216 amountPerSec,
        uint256 id,
        uint256 amount
    );
    event StreamCreated(
        uint256 id,
        address indexed payer,
        address indexed to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends
    );
    event StreamCreatedWithReason(
        uint256 id,
        address indexed payer,
        address indexed to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends,
        string reason
    );
    event StreamModified(uint256 id, uint208 newAmountPerSec, uint48 newEnd);
    event StreamStopped(uint256 id);
    event StreamResumed(uint256 id);
    event StreamBurnt(uint256 id);
    event UpdatePayer(address indexed payer);
    event UpdateStream(uint256 id);
    event RepayDebt(uint256 id, uint256 amount);
    event RepayAllDebt(uint256 id, uint256 amount);

    /* ======== INITIALIZATION ======== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() external initializer {
        token = IERC20(Factory(msg.sender).parameter());
        uint8 tokenDecimals = IERC20Metadata(address(token)).decimals();
        DECIMALS_DIVISOR = 10**(20 - tokenDecimals);

        __ERC721_init('HectorPay Stream', 'HECTORPAY-STREAM');
    }

    modifier onlyPayer(uint256 _id) {
        if (msg.sender != streams[_id].payer) revert NOT_PAYER();
        _;
    }

    modifier onlyOwner(uint256 _id) {
        if (msg.sender != ownerOf(_id)) revert NOT_OWNER();
        _;
    }

    modifier onlyPayerOrOwner(uint256 _id) {
        if (msg.sender != streams[_id].payer && msg.sender != ownerOf(_id))
            revert NOT_PAYER_OR_OWNER();
        _;
    }

    /// @notice deposit into vault (anybody can deposit)
    /// @param _amount amount (native token decimal)
    function deposit(uint256 _amount) external {
        payers[msg.sender].balance += _amount * DECIMALS_DIVISOR;
        token.safeTransferFrom(msg.sender, address(this), _amount);
        emit PayerDeposit(msg.sender, _amount);
    }

    /// @notice withdraw tokens that have not been streamed yet
    /// @param _amount amount (native token decimals)
    function withdrawPayer(uint256 _amount) external {
        Payer storage payer = _updatePayer(msg.sender);
        uint256 toDeduct = _amount * DECIMALS_DIVISOR;
        /// Will revert if not enough after updating Token
        payer.balance -= toDeduct;
        token.safeTransfer(msg.sender, _amount);
        emit PayerWithdraw(msg.sender, _amount);
    }

    /// @notice same as above but all available tokens
    /// @param _token token
    function withdrawPayerAll(address _token) external {
        Payer storage payer = _updatePayer(msg.sender);
        uint256 toSend = payer.balance / DECIMALS_DIVISOR;
        payer.balance = 0;
        token.safeTransfer(msg.sender, toSend);
        emit PayerWithdraw(msg.sender, toSend);
    }

    /// @notice withdraw from stream
    /// @param _id token id
    /// @param _amount amount (native decimals)
    function withdraw(uint256 _id, uint256 _amount) external onlyOwner(_id) {
        /// Update stream to update available balances
        Stream storage stream = _updateStream(_id);

        /// Reverts if payee is going to rug
        redeemables[_id] -= _amount * DECIMALS_DIVISOR;

        token.safeTransfer(msg.sender, _amount);

        emit Withdraw(
            stream.payer,
            msg.sender,
            stream.amountPerSec,
            _id,
            _amount
        );
    }

    /// @notice withdraw all from stream
    /// @param _id token id
    function withdrawAll(uint256 _id) external onlyOwner(_id) {
        /// Update stream to update available balances
        Stream storage stream = _updateStream(_id);

        uint256 toRedeem = redeemables[_id] / DECIMALS_DIVISOR;

        redeemables[_id] = 0;

        token.safeTransfer(msg.sender, toRedeem);

        emit Withdraw(
            stream.payer,
            msg.sender,
            stream.amountPerSec,
            _id,
            toRedeem
        );
    }

    /// @notice creates stream
    /// @param _to recipient
    /// @param _amountPerSec amount per sec (20 decimals)
    /// @param _starts stream to start
    /// @param _ends stream to end
    function createStream(
        address _to,
        uint208 _amountPerSec,
        uint48 _starts,
        uint48 _ends
    ) external {
        uint256 id = _createStream(_to, _amountPerSec, _starts, _ends);
        emit StreamCreated(id, msg.sender, _to, _amountPerSec, _starts, _ends);
    }

    /// @notice creates stream with reason
    /// @param _to recipient
    /// @param _amountPerSec amount per sec (20 decimals)
    /// @param _starts stream to start
    /// @param _ends stream to end
    /// @param _reason stream reason
    function createStreamWithReason(
        address _to,
        uint208 _amountPerSec,
        uint48 _starts,
        uint48 _ends,
        string calldata _reason
    ) external {
        uint256 id = _createStream(_to, _amountPerSec, _starts, _ends);
        emit StreamCreatedWithReason(
            id,
            msg.sender,
            _to,
            _amountPerSec,
            _starts,
            _ends,
            _reason
        );
    }

    /// @notice modifies current stream
    /// @param _id token id
    /// @param _newAmountPerSec modified amount per sec (20 decimals)
    /// @param _newEnd new end time
    function modifyStream(
        uint256 _id,
        uint208 _newAmountPerSec,
        uint48 _newEnd
    ) external onlyPayer(_id) {
        Stream storage stream = _updateStream(_id);
        if (_newAmountPerSec == 0) revert INVALID_AMOUNT();
        /// Prevents people from setting end to time already "paid out"
        Payer storage payer = payers[msg.sender];
        if (payer.lastUpdate >= _newEnd) revert INVALID_TIME();

        /// Check if stream is active
        /// Prevents miscalculation in totalPaidPerSec
        if (stream.lastPaid > 0) {
            payer.totalPaidPerSec += uint256(_newAmountPerSec);
            unchecked {
                payer.totalPaidPerSec -= uint256(stream.amountPerSec);
            }
        }
        stream.amountPerSec = _newAmountPerSec;
        stream.ends = _newEnd;
        emit StreamModified(_id, _newAmountPerSec, _newEnd);
    }

    /// @notice Stop current stream
    /// @param _id token id
    function stopStream(uint256 _id) external onlyPayer(_id) {
        Stream storage stream = _updateStream(_id);
        if (stream.lastPaid == 0) revert INACTIVE_STREAM();
        uint256 amountPerSec = uint256(stream.amountPerSec);
        Payer storage payer = payers[msg.sender];
        unchecked {
            /// Track owed until stopStream call
            debts[_id] +=
                (block.timestamp - uint256(payer.lastUpdate)) *
                amountPerSec;
            stream.lastPaid = 0;
            payer.totalPaidPerSec -= amountPerSec;
        }
        emit StreamStopped(_id);
    }

    /// @notice resumes a stopped stream
    /// @param _id token id
    function resumeStream(uint256 _id) external onlyPayer(_id) {
        Stream storage stream = _updateStream(_id);
        if (stream.lastPaid > 0) revert ACTIVE_STREAM();
        if (block.timestamp >= stream.ends) revert STREAM_ENDED();
        Payer storage payer = payers[msg.sender];
        if (block.timestamp > payer.lastUpdate) revert PAYER_IN_DEBT();

        payer.totalPaidPerSec += uint256(stream.amountPerSec);
        stream.lastPaid = uint48(block.timestamp);
        emit StreamResumed(_id);
    }

    /// @notice burns an inactive and withdrawn stream
    /// @param _id token id
    function burnStream(uint256 _id) external onlyOwner(_id) {
        /// Prevents somebody from burning an active stream or a stream with balance in it
        if (redeemables[_id] > 0 || streams[_id].lastPaid > 0 || debts[_id] > 0)
            revert STREAM_ACTIVE_OR_REDEEMABLE();

        /// Free up storage
        delete streams[_id];
        delete debts[_id];
        delete redeemables[_id];
        _burn(_id);
        emit StreamBurnt(_id);
    }

    /// @notice manually update stream
    /// @param _id token id
    function updateStream(uint256 _id) external onlyPayer(_id) {
        _updateStream(_id);
    }

    /// @notice repay debt
    /// @param _id token id
    /// @param _amount amount to repay (native decimals)
    function repayDebt(uint256 _id, uint256 _amount)
        external
        onlyPayerOrOwner(_id)
    {
        /// Update stream to update balances
        Stream storage stream = _updateStream(_id);
        Payer storage payer = payers[msg.sender];
        uint256 toRepay;
        unchecked {
            toRepay = _amount * DECIMALS_DIVISOR;
            /// Add to redeemable to payee
            redeemables[_id] += toRepay;
        }
        /// Reverts if debt cannot be paid
        payer.balance -= toRepay;
        /// Reverts if paying too much debt
        debts[_id] -= toRepay;
        emit RepayDebt(_id, _amount);
    }

    /// @notice attempt to repay all debt
    /// @param _id token id
    function repayAllDebt(uint256 _id) external onlyPayerOrOwner(_id) {
        /// Update stream to update balances
        Stream storage stream = _updateStream(_id);
        Payer storage payer = payers[msg.sender];
        uint256 totalDebt = debts[_id];
        uint256 balance = payer.balance;
        uint256 toPay;
        unchecked {
            if (balance >= totalDebt) {
                payer.balance -= totalDebt;
                debts[_id] = 0;
                toPay = totalDebt;
            } else {
                debts[_id] = totalDebt - balance;
                payer.balance = 0;
                toPay = balance;
            }
        }
        redeemables[_id] += toPay;
        emit RepayAllDebt(_id, toPay / DECIMALS_DIVISOR);
    }

    /// @notice view only function to see withdrawable
    /// @param _id token id
    /// @return lastUpdate last time Payer has been updated
    /// @return debt debt owed to stream (native decimals)
    /// @return withdrawableAmount amount withdrawable by payee (native decimals)
    function withdrawable(uint256 _id)
        external
        view
        returns (
            uint256 lastUpdate,
            uint256 debt,
            uint256 withdrawableAmount
        )
    {
        Stream storage stream = streams[_id];
        Payer storage payer = payers[stream.payer];
        uint256 starts = uint256(stream.starts);
        uint256 ends = uint256(stream.ends);
        uint256 amountPerSec = uint256(stream.amountPerSec);
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
            return (0, 0, 0);
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
            (withdrawableAmount + redeemables[_id]) /
            DECIMALS_DIVISOR;
        debt = (debt + debts[_id]) / DECIMALS_DIVISOR;
    }

    /// @notice create stream
    /// @param _to recipient
    /// @param _amountPerSec amount per sec (20 decimals)
    /// @param _starts stream to start
    /// @param _ends stream to end
    function _createStream(
        address _to,
        uint208 _amountPerSec,
        uint48 _starts,
        uint48 _ends
    ) private returns (uint256 id) {
        if (_starts >= _ends) revert INVALID_TIME();
        if (_to == address(0)) revert INVALID_ADDRESS();
        if (_amountPerSec == 0) revert INVALID_AMOUNT();

        Payer storage payer = _updatePayer(msg.sender);
        if (block.timestamp > payer.lastUpdate) revert PAYER_IN_DEBT();

        id = nextTokenId;

        /// calculate owed if stream already ended on creation
        uint256 owed;
        uint256 lastPaid;
        uint256 starts = uint256(_starts);
        uint256 amountPerSec = uint256(_amountPerSec);
        if (block.timestamp > _ends) {
            owed = (uint256(_ends) - starts) * amountPerSec;
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
                redeemables[id] = owed;
            } else {
                /// If cannot pay debt, then add to debt and send entire balance to payee
                uint256 balance = payer.balance;
                payer.balance = 0;
                debts[id] = owed - balance;
                redeemables[id] = balance;
            }
            nextTokenId++;
        }

        streams[id] = Stream({
            payer: msg.sender,
            amountPerSec: _amountPerSec,
            lastPaid: uint48(lastPaid),
            starts: _starts,
            ends: _ends
        });

        _safeMint(_to, id);
    }

    /// @notice updates payer balances
    /// @param _payer payer to update
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

    /// @notice update stream
    /// @param _id token id
    function _updateStream(uint256 _id)
        private
        returns (Stream storage stream)
    {
        if (ownerOf(_id) == address(0)) revert STREAM_DOES_NOT_EXIST();
        stream = streams[_id];
        Payer storage payer = _updatePayer(stream.payer);
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
                redeemables[_id] = (ends - starts) * amountPerSec;
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
                redeemables[_id] = (lastUpdate - starts) * amountPerSec;
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
                redeemables[_id] += (ends - lastPaid) * amountPerSec;
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
                redeemables[_id] += (lastUpdate - lastPaid) * amountPerSec;
                stream.lastPaid = uint48(lastUpdate);
            }
        }
        emit UpdateStream(_id);
    }

    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
