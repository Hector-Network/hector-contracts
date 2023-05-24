// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.17;

import {OwnableUpgradeable} from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';

import {IHectorDiscount} from '../interfaces/IHectorDiscount.sol';

error INVALID_MODERATOR();
error INVALID_ADDRESS();
error INVALID_DISCOUNT();
error INVALID_PARAM();

contract HectorDiscount is IHectorDiscount, OwnableUpgradeable {
    /* ======== STORAGE ======== */

    /// @notice moderators data
    mapping(address => bool) public moderators;

    /// @notice discount amount for plan token
    mapping(address => uint256) public discounts;

    /// @notice multiplier
    uint256 public constant MULTIPLIER = 10000;

    /* ======== INITIALIZATION ======== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() external initializer {
        moderators[msg.sender] = true;

        __Ownable_init();
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

    /* ======== MODERATOR FUNCTIONS ======== */

    function appendDiscount(
        address[] calldata _tokens,
        uint256[] calldata _discounts
    ) external onlyMod {
        uint256 length = _tokens.length;
        if (length != _discounts.length) revert INVALID_PARAM();

        for (uint256 i = 0; i < length; i++) {
            address token = _tokens[i];
            if (token == address(0)) revert INVALID_ADDRESS();
            uint256 discount = _discounts[i];
            if (discount > MULTIPLIER) revert INVALID_DISCOUNT();

            discounts[token] = discount;
        }
    }

    function updateDiscount(
        address _token,
        uint256 _discount
    ) external onlyMod {
        if (_token == address(0)) revert INVALID_ADDRESS();
        if (_discount > MULTIPLIER) revert INVALID_DISCOUNT();

        discounts[_token] = _discount;
    }

    /* ======== VIEW FUNCTIONS ======== */

    function getDiscountedPrice(
        bytes calldata plan
    ) external view returns (uint256 discountedPrice) {
        (, , address token, uint256 price) = abi.decode(
            plan,
            (bytes32, uint256, address, uint256)
        );

        uint256 discount = (price * discounts[token]) / MULTIPLIER;

        return price - discount;
    }
}
