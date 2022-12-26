// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @dev Required interface for an Athanasia OTC underlying token sale.
 *
 * This contract is initialized with the IAthanasia contract which is specific for this underlying token.
 * Athanasia enables NFT collection owners to lock in a portion of the mint sale price in form of a secondary underlying token.
 *
 * Typically during an NFT mint, configured value is deposited into this smart contract and an OTC purchase of the
 * underlying token. This is done to avoid price spikes during minting.
 * Alternatively, one may also choose to directly deposit the underlying tokens.
 *
 * This contract enables the OTC purchase of the underlying token. Only the IAthanasia contract may do the purchase, and only on
 * behalf of the collection which has been registered with IAthanasiaOtc.
 */
interface IAthanasiaOtc {
    struct TokenInfo {
        address otcToken;
        uint256 otcPrice;
        uint256 totalAmount;
        uint256 purchasedAmount;
    }

    /**
     * @dev Registers or updates a collection with the OTC contract.
     *
     * Parameters:
     *  - `collection` - NFT Collection address on behalf of which the OTC purchase is done.
     *  - `otcToken` - the token which is used to purchase the underlying token.
     *  - `otcPrice` - the OTC price for 1 underlying token (i.e. 10eX, where X is number of decimals of underlying token)
     *  - `totalAmount` - total amount of tokens that can be purchased on behalf of the collection.
     */
    function registerCollection(
        address collection,
        address otcToken,
        uint256 otcPrice,
        uint256 totalAmount
    ) external;

    /**
     * @dev Returns true if the collection was registered with OTC contract for the specified OTC token and price.
     *
     * Parameters:
     *  - `collection` - NFT Collection address on behalf of which the OTC purchase is done.
     *  - `otcToken` - the token which is used to purchase the underlying token.
     *  - `otcPrice` - the OTC price for 1 underlying token (i.e. 10eX, where X is number of decimals of underlying token)
     *
     * @return true of the registration data matches the parameters.
     */
    function validateCollection(
        address collection,
        address otcToken,
        uint256 otcPrice
    ) external returns (bool);

    /**
     * @dev Perform OTC purchase of `amount` amount of the underlying token, using the price and token type as registered for the collection.
     *
     * Parameters:
     *  - `collection` - NFT Collection address on behalf of which the OTC purchase is done.
     *  - `amountToPurchase` - amount of underlying tokens to purchase.
     *  - `expectedCost` - total number of `otcToken` tokens that the caller expects to pay for the `amountToPurchase` underlying tokens.
     */
    function otc(
        address collection,
        uint256 amountToPurchase,
        uint256 expectedCost
    ) external payable;
}
