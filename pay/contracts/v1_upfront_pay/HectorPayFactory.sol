// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.17;

import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {TransparentUpgradeableProxy} from '@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol';

import {HectorPay} from './HectorPay.sol';

interface IPay {
    function pauseStreamBySubscription(
        address from,
        address to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends
    ) external;

    function resumeStreamBySubscription(
        address from,
        address to,
        uint256 amountPerSec,
        uint48 starts,
        uint48 ends
    ) external;
}

error INVALID_ADDRESS();

contract HectorPayFactory is Ownable {
    /* ======== STORAGE ======== */

    struct Stream {
        address payContract;
        address from;
        address to;
        uint256 amountPerSec;
        uint48 starts;
        uint48 ends;
    }

    address public hectorPayLogic;
    address public upgradeableAdmin;
    address public subscription;

    address public parameter;
    uint256 public getHectorPayContractCount;
    address[1000000000] public getHectorPayContractByIndex;
    mapping(address => address) public getHectorPayContractByToken;

    /* ======== EVENTS ======== */

    event HectorPayCreated(address token, address hectorPay);

    /* ======== INITIALIZATION ======== */

    constructor(
        address _hectorPayLogic,
        address _upgradeableAdmin,
        address _subscription
    ) {
        if (
            _hectorPayLogic == address(0) ||
            _upgradeableAdmin == address(0) ||
            _subscription == address(0)
        ) revert INVALID_ADDRESS();

        hectorPayLogic = _hectorPayLogic;
        upgradeableAdmin = _upgradeableAdmin;
        subscription = _subscription;
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

    function setSubscription(address _subscription) external onlyOwner {
        if (_subscription == address(0)) revert INVALID_ADDRESS();
        subscription = _subscription;
    }

    /* ======== USER FUNCTIONS ======== */

    /**
        @notice Create a new Hector Pay Streaming instance for `_token`
        @dev Instances are created deterministically via CREATE2 and duplicate
            instances will cause a revert
        @param _token The ERC20 token address for which a Hector Pay contract should be deployed
        @return hectorPayContract The address of the newly created Hector Pay contract
      */
    function createHectorPayContract(address _token)
        external
        returns (address hectorPayContract)
    {
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

    /**
      @notice Query the address of the Hector Pay contract for `_token` and whether it is deployed
      @param _token An ERC20 token address
      @return isDeployed Boolean denoting whether the contract is currently deployed
      */
    function isDeployedHectorPayContractByToken(address _token)
        external
        view
        returns (bool isDeployed)
    {
        isDeployed = getHectorPayContractByToken[_token] != address(0);
    }

    /* ======== SUBSCRIPTION POLICY FUNCTIONS ======== */

    function pauseStreams(Stream[] calldata streams) external {
        uint256 length = streams.length;
        for (uint256 i = 0; i < length; i++) {
            Stream memory stream = streams[i];
            IPay(stream.payContract).pauseStreamBySubscription(
                stream.from,
                stream.to,
                stream.amountPerSec,
                stream.starts,
                stream.ends
            );
        }
    }

    function resumeStreams(Stream[] calldata streams) external {
        uint256 length = streams.length;
        for (uint256 i = 0; i < length; i++) {
            Stream memory stream = streams[i];
            IPay(stream.payContract).resumeStreamBySubscription(
                stream.from,
                stream.to,
                stream.amountPerSec,
                stream.starts,
                stream.ends
            );
        }
    }
}
