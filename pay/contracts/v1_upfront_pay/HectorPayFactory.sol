// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.17;

import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {TransparentUpgradeableProxy} from '@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol';

import {IHectorPay} from '../interfaces/IHectorPay.sol';
import {IHectorPayFactory} from '../interfaces/IHectorPayFactory.sol';

import {HectorPay} from './HectorPay.sol';

error INVALID_ADDRESS();
error INVALID_PARAM();

contract HectorPayFactory is IHectorPayFactory, Ownable {
    /* ======== STORAGE ======== */

    address public hectorPayLogic;
    address public upgradeableAdmin;
    address public validator;

    address public parameter;
    uint256 public getHectorPayContractCount;
    address[1000000000] public getHectorPayContractByIndex;
    mapping(address => address) public getHectorPayContractByToken;

    /* ======== EVENTS ======== */

    event HectorPayCreated(address token, address hectorPay);

    /* ======== INITIALIZATION ======== */

    constructor(address _hectorPayLogic, address _upgradeableAdmin) {
        if (_hectorPayLogic == address(0) || _upgradeableAdmin == address(0))
            revert INVALID_ADDRESS();

        hectorPayLogic = _hectorPayLogic;
        upgradeableAdmin = _upgradeableAdmin;
    }

    /* ======== POLICY FUNCTIONS ======== */

    function setHectorPayLogic(address _hectorPayLogic) external onlyOwner {
        if (_hectorPayLogic == address(0)) revert INVALID_ADDRESS();
        hectorPayLogic = _hectorPayLogic;
    }

    function setUpgradeableAdmin(address _upgradeableAdmin) external onlyOwner {
        if (_upgradeableAdmin == address(0)) revert INVALID_ADDRESS();
        upgradeableAdmin = _upgradeableAdmin;
    }

    function setValidator(address _validator) external onlyOwner {
        validator = _validator;
    }

    /* ======== VALIDATOR FUNCTIONS ======== */

    function activeStreamsByRemoveEnded(
        address from
    ) external returns (uint256 count) {
        for (uint256 i = 0; i < getHectorPayContractCount; i++) {
            count += IHectorPay(getHectorPayContractByIndex[i])
                .activeStreamsByRemoveEnded(from);
        }
    }

    /* ======== PUBLIC FUNCTIONS ======== */

    function createHectorPayContract(
        address _token
    ) external returns (address hectorPayContract) {
        // set the parameter storage slot so the contract can query it
        parameter = _token;
        // use CREATE2 so we can get a deterministic address based on the token
        hectorPayContract = address(
            new TransparentUpgradeableProxy{
                salt: bytes32(uint256(uint160(_token)))
            }(
                hectorPayLogic,
                upgradeableAdmin,
                abi.encodeWithSignature('initialize()')
            )
        );
        // CREATE2 can return address(0), add a check to verify this isn't the case
        // See: https://eips.ethereum.org/EIPS/eip-1014
        require(hectorPayContract != address(0));

        // Append the new contract address to the array of deployed contracts
        uint256 index = getHectorPayContractCount;
        getHectorPayContractByIndex[index] = hectorPayContract;
        unchecked {
            getHectorPayContractCount = index + 1;
        }

        // Append the new contract address to the mapping of deployed contracts
        getHectorPayContractByToken[_token] = hectorPayContract;

        emit HectorPayCreated(_token, hectorPayContract);
    }

    /* ======== VIEW FUNCTIONS ======== */

    function isDeployedHectorPayContractByToken(
        address _token
    ) external view returns (bool isDeployed) {
        isDeployed = getHectorPayContractByToken[_token] != address(0);
    }
}
