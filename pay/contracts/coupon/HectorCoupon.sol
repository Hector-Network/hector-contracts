// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.17;

import {OwnableUpgradeable} from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import {EIP712Upgradeable} from '@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol';
import {ECDSA} from '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';

import {IHectorCoupon} from '../interfaces/IHectorCoupon.sol';

error INVALID_ADDRESS();

contract HectorCoupon is IHectorCoupon, OwnableUpgradeable, EIP712Upgradeable {
    /* ======== STORAGE ======== */

    /// @notice moderators data
    mapping(address => bool) public moderators;

    /// @notice nonce
    mapping(address => uint256) public nonces;

    /// @notice eip712 name
    string public constant NAME = 'Hector Coupon';

    /// @notice eip712 version
    string public constant VERSION = '1.0';

    /// @notice coupon hash
    bytes32 private constant COUPON_HASH =
        keccak256(
            'Coupon(uint256 nonce,address payer,uint256 id,bytes32 product,address token,uint256 discount,bool isFixed)'
        );

    /// @notice multiplier
    uint256 public constant MULTIPLIER = 10000;

    /* ======== EVENTS ======== */

    event CouponApplied(
        address indexed from,
        uint256 indexed id,
        string product
    );

    /* ======== INITIALIZATION ======== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() external initializer {
        moderators[msg.sender] = true;

        __Ownable_init();
        __EIP712_init(NAME, VERSION);
    }

    /* ======== POLICY FUNCTIONS ======== */

    function setModerator(address moderator, bool approved) external onlyOwner {
        if (moderator == address(0)) revert INVALID_ADDRESS();
        moderators[moderator] = approved;
    }

    /* ======== INTERNAL FUNCTIONS ======== */

    function _verifySignature(
        bytes32 structHash,
        bytes calldata signature
    ) internal view returns (bool) {
        bytes32 hash = _hashTypedDataV4(structHash);
        (uint8 v, bytes32 r, bytes32 s) = abi.decode(
            signature,
            (uint8, bytes32, bytes32)
        );
        address signer = ECDSA.recover(hash, v, r, s);

        return moderators[signer];
    }

    /* ======== PUBLIC FUNCTIONS ======== */

    function applyCoupon(
        Pay calldata pay,
        bytes calldata couponInfo,
        bytes calldata signature
    ) external returns (bool isValid, uint256 id, uint256 newAmount) {
        string memory product = pay.product;
        address payer = pay.payer;
        uint256 discount;
        bool isFixed;

        (id, discount, isFixed) = abi.decode(
            couponInfo,
            (uint256, uint256, bool)
        );
        newAmount = pay.amount;

        // Verify signature
        {
            address token = pay.token;
            uint256 nonce = nonces[payer]++;
            bytes32 structHash = keccak256(
                abi.encode(
                    COUPON_HASH,
                    nonce,
                    payer,
                    id,
                    bytes32(bytes(product)),
                    token,
                    discount,
                    isFixed
                )
            );
            if (!_verifySignature(structHash, signature)) {
                return (false, 0, newAmount);
            }
        }

        // if fixed amount discount
        if (isFixed) {
            if (discount >= pay.amount) {
                newAmount = 0;
            } else {
                unchecked {
                    newAmount = pay.amount - discount;
                }
            }
        }
        // if % discount
        else {
            if (discount >= MULTIPLIER) {
                newAmount = 0;
            } else {
                newAmount = pay.amount - (pay.amount * discount) / MULTIPLIER;
            }
        }

        emit CouponApplied(payer, id, product);

        return (true, id, newAmount);
    }
}
