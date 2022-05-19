// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import '@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol';
import '@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol';
import '@openzeppelin/contracts/token/ERC721/extensions/ERC721Pausable.sol';
import '@openzeppelin/contracts/access/AccessControlEnumerable.sol';
import '@openzeppelin/contracts/utils/Counters.sol';

import './LockAccessControl.sol';

// Credits to Revest Team
// Github:https://github.com/Revest-Finance/RevestContracts/blob/master/hardhat/contracts/FNFTHandler.sol
contract FNFT is
    AccessControlEnumerable,
    LockAccessControl,
    ERC721Enumerable,
    ERC721Burnable,
    ERC721Pausable
{
    using Counters for Counters.Counter;

    string private constant NAME = 'Hector FNFT';
    string private constant SYMBOL = 'HFNFT';

    bytes32 public constant PAUSER_ROLE = keccak256('PAUSER_ROLE');

    Counters.Counter private _fnftIdTracker;

    /* ======= CONSTRUCTOR ======= */

    constructor(address provider)
        ERC721(NAME, SYMBOL)
        LockAccessControl(provider)
    {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(PAUSER_ROLE, _msgSender());
    }

    ///////////////////////////////////////////////////////
    //              TOKENVAULT CALLED FUNCTIONS          //
    ///////////////////////////////////////////////////////

    function mint(address to)
        public
        virtual
        onlyTokenVault
        returns (uint256 fnftId)
    {
        // We cannot just use balanceOf to create the new tokenId because tokens
        // can be burned (destroyed), so we need a separate counter.
        fnftId = _fnftIdTracker.current();
        _fnftIdTracker.increment();
        _mint(to, fnftId);
    }

    ///////////////////////////////////////////////////////
    //                PAUSER CALLED FUNCTIONS            //
    ///////////////////////////////////////////////////////

    function pause() public virtual {
        require(
            hasRole(PAUSER_ROLE, _msgSender()),
            'ERC721PresetMinterPauserAutoId: must have pauser role to pause'
        );
        _pause();
    }

    function unpause() public virtual {
        require(
            hasRole(PAUSER_ROLE, _msgSender()),
            'ERC721PresetMinterPauserAutoId: must have pauser role to unpause'
        );
        _unpause();
    }

    ///////////////////////////////////////////////////////
    //                  INTERNAL FUNCTIONS               //
    ///////////////////////////////////////////////////////

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override(ERC721, ERC721Enumerable, ERC721Pausable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(AccessControlEnumerable, ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
