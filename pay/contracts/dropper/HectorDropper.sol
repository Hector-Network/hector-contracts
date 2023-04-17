// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.17;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {OwnableUpgradeable} from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import {ReentrancyGuardUpgradeable} from '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';

import {IHectorDropper} from '../interfaces/IHectorDropper.sol';
import {IHectorDropperFactory} from '../interfaces/IHectorDropperFactory.sol';
import {IHectorValidator} from '../interfaces/IHectorValidator.sol';

error INVALID_INDEX();
error INVALID_ADDRESS();
error INVALID_TIME();
error INVALID_AMOUNT();
error INVALID_LENGTH();
error LIMITED_SUBSCRIPTION();
error INSUFFICIENT_FEE();
error INACTIVE_AIRDROP();
error ACTIVE_AIRDROP();
error NOT_RELEASABLE();
error FEE_TRANSFER_FAILED();

contract HectorDropper is
    IHectorDropper,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    /* ======== STORAGE ======== */

    enum AirdropStatus {
        InProgress,
        Completed,
        Cancelled
    }

    struct Airdrop {
        address from;
        address[] tos;
        uint256 amountPerRecipient;
        uint48 releaseTime;
        AirdropStatus status;
        uint256 fee;
    }

    /// @notice dropper factory
    IHectorDropperFactory public factory;

    /// @notice airdrop count
    mapping(address => uint256) public numberOfAirdrops;

    /// @notice airdrop info
    mapping(address => mapping(uint256 => Airdrop)) public airdrops;

    /// @notice airdrop token
    IERC20 public token;

    /// @notice treasury wallet
    address public treasury;

    /// @notice airdrop fee
    uint256 public fee;

    /// @notice version
    string public constant VERSION = 'v1.0';

    /* ======== EVENTS ======== */

    event AirdropCreated(
        address indexed from,
        address[] tos,
        uint256 amountPerRecipient,
        uint48 releaseTime,
        uint256 index
    );
    event AirdropCreatedWithReason(
        address indexed from,
        address[] tos,
        uint256 amountPerRecipient,
        uint48 releaseTime,
        uint256 index,
        string reason
    );
    event AirdropCancelled(address indexed from, uint256 index);
    event AirdropReleased(address indexed from, uint256 index);

    /* ======== INITIALIZATION ======== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() external initializer {
        factory = IHectorDropperFactory(msg.sender);

        address _token;
        (_token, treasury, fee) = abi.decode(
            factory.parameter(),
            (address, address, uint256)
        );
        token = IERC20(_token);

        _transferOwnership(factory.factoryOwner());
        __ReentrancyGuard_init();
    }

    /* ======== MODIFIER ======== */

    modifier isValid(address from, uint256 numberOfRecipients) {
        address validator = factory.validator();

        if (validator != address(0)) {
            if (
                !IHectorValidator(validator).isValid(
                    abi.encode(from, numberOfRecipients)
                )
            ) revert LIMITED_SUBSCRIPTION();
        }

        _;
    }

    /* ======== POLICY FUNCTIONS ======== */

    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert INVALID_ADDRESS();
        treasury = _treasury;
    }

    function setFee(uint256 _fee) external onlyOwner {
        if (_fee == 0) revert INVALID_AMOUNT();
        fee = _fee;
    }

    function takeFee() external onlyOwner {
        uint256 balance = address(this).balance;

        if (balance > 0) {
            (bool success, ) = treasury.call{value: balance}('');
            if (!success) revert FEE_TRANSFER_FAILED();
        }
    }

    /* ======== VIEW FUNCTIONS ======== */

    function airdropsByOwner(
        address from
    ) external view returns (Airdrop[] memory) {
        uint256 length = numberOfAirdrops[from];
        Airdrop[] memory drops = new Airdrop[](length);

        for (uint256 i = 0; i < length; i++) {
            drops[i] = airdrops[from][i];
        }

        return drops;
    }

    function canPerformAirdrop(
        address from,
        uint256 index
    ) external view returns (bool) {
        if (index >= numberOfAirdrops[from]) return false;

        return airdrops[from][index].releaseTime <= block.timestamp;
    }

    /* ======== INTERNAL FUNCTIONS ======== */

    function _createAirdrop(
        address[] calldata tos,
        uint256 amountPerRecipient,
        uint48 releaseTime
    ) internal returns (uint256 index) {
        uint256 length = tos.length;
        if (length == 0) revert INVALID_LENGTH();
        if (amountPerRecipient == 0) revert INVALID_AMOUNT();
        if (releaseTime <= block.timestamp) revert INVALID_TIME();
        if (msg.value < fee) revert INSUFFICIENT_FEE();

        for (uint256 i = 0; i < length; i++) {
            if (tos[i] == address(0)) revert INVALID_ADDRESS();
        }

        // get the airdrop index
        index = numberOfAirdrops[msg.sender];
        numberOfAirdrops[msg.sender] += 1;

        // create a new airdrop
        Airdrop storage airdrop = airdrops[msg.sender][index];
        airdrop.from = msg.sender;
        airdrop.tos = tos;
        airdrop.amountPerRecipient = amountPerRecipient;
        airdrop.releaseTime = releaseTime;
        airdrop.status = AirdropStatus.InProgress;
        airdrop.fee = fee;

        // fund assets
        IERC20(token).safeTransferFrom(
            msg.sender,
            address(this),
            amountPerRecipient * length
        );

        // take fee
        (bool success, ) = treasury.call{value: fee}('');
        if (!success) revert FEE_TRANSFER_FAILED();
    }

    function _cancelAirdrop(uint256 index) internal {
        if (index >= numberOfAirdrops[msg.sender]) revert INVALID_INDEX();

        Airdrop storage airdrop = airdrops[msg.sender][index];
        if (airdrop.status != AirdropStatus.InProgress)
            revert INACTIVE_AIRDROP();

        // update status
        airdrop.status = AirdropStatus.Cancelled;

        // refund assets
        IERC20(token).safeTransfer(
            msg.sender,
            airdrop.amountPerRecipient * airdrop.tos.length
        );

        // refund fee
        (bool success, ) = (msg.sender).call{value: airdrop.fee}('');
        if (!success) revert FEE_TRANSFER_FAILED();
    }

    function _releaseAirdrop(address from, uint256 index) internal {
        if (index >= numberOfAirdrops[from]) revert INVALID_INDEX();

        Airdrop storage airdrop = airdrops[from][index];
        if (airdrop.status != AirdropStatus.InProgress)
            revert INACTIVE_AIRDROP();
        if (airdrop.releaseTime > block.timestamp) revert NOT_RELEASABLE();

        // update status
        airdrop.status = AirdropStatus.Completed;

        // airdrop assets
        for (uint256 i = 0; i < airdrop.tos.length; i++) {
            IERC20(token).safeTransfer(
                airdrop.tos[i],
                airdrop.amountPerRecipient
            );
        }
    }

    /* ======== USER FUNCTIONS ======== */

    function createAirdrop(
        address[] calldata tos,
        uint256 amountPerRecipient,
        uint48 releaseTime
    ) external payable isValid(msg.sender, tos.length) {
        uint256 index = _createAirdrop(tos, amountPerRecipient, releaseTime);

        emit AirdropCreated(
            msg.sender,
            tos,
            amountPerRecipient,
            releaseTime,
            index
        );
    }

    function createAirdropWithReason(
        address[] calldata tos,
        uint256 amountPerRecipient,
        uint48 releaseTime,
        string calldata reason
    ) external payable isValid(msg.sender, tos.length) {
        uint256 index = _createAirdrop(tos, amountPerRecipient, releaseTime);

        emit AirdropCreatedWithReason(
            msg.sender,
            tos,
            amountPerRecipient,
            releaseTime,
            index,
            reason
        );
    }

    function cancelAirdrop(uint256 index) external {
        _cancelAirdrop(index);

        emit AirdropCancelled(msg.sender, index);
    }

    function releaseAirdrop(address from, uint256 index) external {
        _releaseAirdrop(from, index);

        emit AirdropReleased(from, index);
    }

    function releaseAirdrops(
        address[] calldata froms,
        uint256[] calldata indexes
    ) external {
        uint256 length = froms.length;
        if (length == 0 || length != indexes.length) revert INVALID_LENGTH();

        for (uint256 i = 0; i < length; i++) {
            address from = froms[i];
            uint256 index = indexes[i];

            _releaseAirdrop(from, index);

            emit AirdropReleased(from, index);
        }
    }
}
