// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.17;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {MerkleProof} from '@openzeppelin/contracts/utils/cryptography/MerkleProof.sol';
import {OwnableUpgradeable} from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import {ReentrancyGuardUpgradeable} from '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';

import {IHectorDropperV2Factory} from '../interfaces/IHectorDropperV2Factory.sol';

error INVALID_INDEX();
error INVALID_ADDRESS();
error INVALID_TIME();
error INVALID_AMOUNT();
error INVALID_MODERATOR();
error INACTIVE_AIRDROP();
error INSUFFICIENT_FUND();
error AIRDROP_RELEASED();
error FAILED_PROOF();
error NOT_RELEASABLE();

contract HectorDropperV2 is OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    /* ======== STORAGE ======== */

    enum AirdropStatus {
        InProgress,
        Cancelled
    }

    struct Airdrop {
        address from;
        bytes32 root;
        uint48 releaseTime;
        uint256 balance;
        AirdropStatus status;
    }

    /// @notice dropper factory
    IHectorDropperV2Factory public factory;

    /// @notice airdrop count
    mapping(address => uint256) public numberOfAirdrops;

    /// @notice airdrop info
    mapping(address => mapping(uint256 => Airdrop)) public airdrops;

    /// @notice airdrop released
    mapping(address => mapping(uint256 => mapping(address => bool)))
        public airdropReleased;

    /// @notice moderators data
    mapping(address => bool) public moderators;

    /// @notice airdrop token
    IERC20 public token;

    /// @notice version
    string public constant VERSION = 'v2.0';

    /* ======== EVENTS ======== */

    event AirdropCreated(
        address indexed from,
        bytes32 root,
        uint48 releaseTime,
        uint256 index
    );
    event AirdropCreatedWithReason(
        address indexed from,
        bytes32 root,
        uint48 releaseTime,
        uint256 index,
        string reason
    );
    event AirdropCancelled(address indexed from, uint256 index);
    event AirdropFunded(address indexed from, uint256 index, uint256 amount);
    event AirdropRefunded(address indexed from, uint256 index, uint256 amount);
    event AirdropReleased(
        address indexed from,
        uint256 index,
        address indexed to,
        uint256 amount
    );

    /* ======== INITIALIZATION ======== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() external initializer {
        factory = IHectorDropperV2Factory(msg.sender);

        token = IERC20(factory.parameter());

        moderators[factory.factoryOwner()] = true;

        _transferOwnership(factory.factoryOwner());
        __ReentrancyGuard_init();
    }

    /* ======== MODIFIER ======== */

    modifier onlyMod() {
        if (!moderators[msg.sender]) revert INVALID_MODERATOR();
        _;
    }

    /* ======== POLICY FUNCTIONS ======== */

    function setModerator(address moderator, bool approved) external onlyOwner {
        if (moderator == address(0)) revert INVALID_ADDRESS();
        moderators[moderator] = approved;
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

    /* ======== INTERNAL FUNCTIONS ======== */

    function _createAirdrop(
        address from,
        bytes32 root,
        uint48 releaseTime
    ) internal returns (uint256 index) {
        if (from == address(0)) revert INVALID_ADDRESS();
        if (releaseTime <= block.timestamp) revert INVALID_TIME();

        // get the airdrop index
        index = numberOfAirdrops[from];
        numberOfAirdrops[from] += 1;

        // create a new airdrop
        Airdrop storage airdrop = airdrops[from][index];
        airdrop.from = from;
        airdrop.root = root;
        airdrop.releaseTime = releaseTime;
        airdrop.status = AirdropStatus.InProgress;
    }

    function _fundAirdrop(
        address from,
        uint256 index,
        uint256 amount
    ) internal {
        if (index >= numberOfAirdrops[from]) revert INVALID_INDEX();
        if (amount == 0) revert INVALID_AMOUNT();

        Airdrop storage airdrop = airdrops[from][index];

        // increase airdrop balance (balance <= totalSupply)
        unchecked {
            airdrop.balance += amount;
        }

        // token deposit
        token.safeTransferFrom(from, address(this), amount);

        // event
        emit AirdropFunded(from, index, amount);
    }

    function _refundAirdrop(
        address from,
        uint256 index,
        uint256 amount
    ) internal {
        if (index >= numberOfAirdrops[from]) revert INVALID_INDEX();

        Airdrop storage airdrop = airdrops[from][index];
        if (airdrop.balance < amount) revert INSUFFICIENT_FUND();
        if (amount == 0) revert INVALID_AMOUNT();

        // decrease airdrop balance
        unchecked {
            airdrop.balance -= amount;
        }

        // token withdraw
        IERC20(token).safeTransfer(from, amount);

        // event
        emit AirdropRefunded(from, index, amount);
    }

    /* ======== MODERATOR FUNCTIONS ======== */

    function createAirdrop(
        address from,
        bytes32 root,
        uint48 releaseTime,
        uint256 amount
    ) external onlyMod {
        uint256 index = _createAirdrop(from, root, releaseTime);

        emit AirdropCreated(from, root, releaseTime, index);

        // fund assets
        if (amount > 0) {
            _fundAirdrop(from, index, amount);
        }
    }

    function createAirdropWithReason(
        address from,
        bytes32 root,
        uint48 releaseTime,
        string calldata reason,
        uint256 amount
    ) external onlyMod {
        uint256 index = _createAirdrop(from, root, releaseTime);

        emit AirdropCreatedWithReason(from, root, releaseTime, index, reason);

        // fund assets
        if (amount > 0) {
            _fundAirdrop(from, index, amount);
        }
    }

    /* ======== USER FUNCTIONS ======== */

    function fundAirdrop(uint256 index, uint256 amount) external nonReentrant {
        _fundAirdrop(msg.sender, index, amount);
    }

    function refundAirdrop(
        uint256 index,
        uint256 amount
    ) external nonReentrant {
        _refundAirdrop(msg.sender, index, amount);
    }

    function refundAirdropAll(uint256 index) external nonReentrant {
        _refundAirdrop(msg.sender, index, airdrops[msg.sender][index].balance);
    }

    function cancelAirdrop(uint256 index) external nonReentrant {
        if (index >= numberOfAirdrops[msg.sender]) revert INVALID_INDEX();

        Airdrop storage airdrop = airdrops[msg.sender][index];
        if (airdrop.status != AirdropStatus.InProgress)
            revert INACTIVE_AIRDROP();

        // update status
        airdrop.status = AirdropStatus.Cancelled;

        // refund assets
        if (airdrop.balance > 0) {
            _refundAirdrop(msg.sender, index, airdrop.balance);
        }

        emit AirdropCancelled(msg.sender, index);
    }

    function releaseAirdrop(
        address from,
        uint256 index,
        address to,
        uint256 amount,
        bytes32[] calldata proof
    ) external nonReentrant {
        if (index >= numberOfAirdrops[from]) revert INVALID_INDEX();
        if (to == address(0)) revert INVALID_ADDRESS();
        if (amount == 0) revert INVALID_AMOUNT();
        if (airdropReleased[from][index][to]) revert AIRDROP_RELEASED();

        Airdrop storage airdrop = airdrops[from][index];
        if (airdrop.status != AirdropStatus.InProgress)
            revert INACTIVE_AIRDROP();
        if (airdrop.releaseTime > block.timestamp) revert NOT_RELEASABLE();
        if (airdrop.balance < amount) revert INSUFFICIENT_FUND();

        // merkle verify
        bytes32 leaf = keccak256(
            bytes.concat(keccak256(abi.encode(to, amount)))
        );
        if (!MerkleProof.verify(proof, airdrop.root, leaf))
            revert FAILED_PROOF();

        // airdrop released
        airdropReleased[from][index][to] = true;

        // decrease airdrop balance
        unchecked {
            airdrop.balance -= amount;
        }

        // token release
        token.safeTransfer(to, amount);

        // event
        emit AirdropReleased(from, index, to, amount);
    }
}
