// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.17;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {EnumerableSet} from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import {OwnableUpgradeable} from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import {PausableUpgradeable} from '@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol';

error INVALID_MODERATOR();
error INVALID_ADDRESS();
error INVALID_AMOUNT();
error INVALID_PARAM();

contract HectorSubscriptionV2Treasury is
    OwnableUpgradeable,
    PausableUpgradeable
{
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    /* ======== STORAGE ======== */

    /// @notice DAO wallet
    address public dao;

    /// @notice Deposited tokens set
    EnumerableSet.AddressSet private tokensSet;

    /// @notice moderators data
    mapping(address => bool) public moderators;

    /* ======== EVENTS ======== */

    event Deposited(address indexed who, address indexed token, uint256 amount);

    /* ======== INITIALIZATION ======== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _dao) external initializer {
        if (_dao == address(0)) revert INVALID_ADDRESS();

        dao = _dao;

        moderators[msg.sender] = true;

        __Ownable_init();
        __Pausable_init();
    }

    /* ======== MODIFIER ======== */

    modifier onlyMod() {
        if (!moderators[msg.sender]) revert INVALID_MODERATOR();
        _;
    }

    /* ======== POLICY FUNCTIONS ======== */

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setDAO(address _dao) external onlyOwner {
        if (_dao == address(0)) revert INVALID_ADDRESS();

        dao = _dao;
    }

    function setModerator(
        address _moderator,
        bool _approved
    ) external onlyOwner {
        if (_moderator == address(0)) revert INVALID_ADDRESS();
        moderators[_moderator] = _approved;
    }

    /* ======== MODERATOR FUNCTIONS ======== */

    function withdrawTokens(address[] calldata _tokens) external onlyMod {
        uint256 length = _tokens.length;

        for (uint256 i = 0; i < length; i++) {
            address token = _tokens[i];
            if (token == address(0)) revert INVALID_ADDRESS();

            uint256 balance = IERC20(token).balanceOf(address(this));
            if (balance > 0) {
                IERC20(token).safeTransfer(dao, balance);
            }
        }
    }

    function withdrawAll() external onlyMod {
        uint256 length = tokensSet.length();

        for (uint256 i = 0; i < length; i++) {
            address token = tokensSet.at(0);
            uint256 balance = IERC20(token).balanceOf(address(this));

            if (balance > 0) {
                IERC20(token).safeTransfer(dao, balance);
            }

            tokensSet.remove(token);
        }
    }

    function withdrawTokensWithAmounts(
        address[] calldata _tokens,
        uint256[] calldata _amounts
    ) external onlyMod {
        uint256 length = _tokens.length;
        if (length != _amounts.length) revert INVALID_PARAM();

        for (uint256 i = 0; i < length; i++) {
            address token = _tokens[i];
            if (token == address(0)) revert INVALID_ADDRESS();

            uint256 balance = IERC20(token).balanceOf(address(this));
            uint256 amount = _amounts[i];
            if (balance >= amount) {
                IERC20(token).safeTransfer(dao, amount);
            }
        }
    }

    function withdrawTokensToUsers(
        address[] calldata _tos,
        address[] calldata _tokens,
        uint256[] calldata _amounts
    ) external onlyMod {
        uint256 length = _tos.length;
        if (length != _tokens.length) revert INVALID_PARAM();
        if (length != _amounts.length) revert INVALID_PARAM();

        for (uint256 i = 0; i < length; i++) {
            address to = _tos[i];
            address token = _tokens[i];
            if (to == address(0) || token == address(0))
                revert INVALID_ADDRESS();

            uint256 balance = IERC20(token).balanceOf(address(this));
            uint256 amount = _amounts[i];
            if (balance < amount) revert INVALID_AMOUNT();

            IERC20(token).safeTransfer(to, amount);
        }
    }

    /* ======== USER FUNCTIONS ======== */

    function deposit(address _token, uint256 _amount) external whenNotPaused {
        if (_token == address(0)) revert INVALID_ADDRESS();
        if (_amount == 0) revert INVALID_AMOUNT();

        tokensSet.add(_token);

        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        emit Deposited(msg.sender, _token, _amount);
    }
}
