// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

import '@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol';
import {OwnableUpgradeable} from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';

error INVALID_PARAM();
error INVALID_ADDRESS();
error INVALID_AMOUNT();
error INVALID_ALLOWANCE();
error BRIDGE_FAILED();
error INVALID_PERCENTAGE();
error DAO_FEE_FAILED();

/**
 * @title HecBridgeSplitter
 */
contract HecBridgeSplitter is OwnableUpgradeable, PausableUpgradeable {
	using SafeMathUpgradeable for uint256;
	using SafeERC20Upgradeable for IERC20Upgradeable;

	uint256 public CountDest; // Count of the destination wallets
	uint public minFeePercentage;
	address public DAO; // DAO wallet for taking fee
	string public version;
	mapping(address => bool) public isCallAddress; // Return status of callTargetAddress is registered

	// Struct Asset Info
	struct SendingAssetInfo {
		address sendingAssetId;
		uint256 sendingAmount;
		uint256 totalAmount;
		uint feePercentage;
	}

	/* ======== INITIALIZATION ======== */

	/// @custom:oz-upgrades-unsafe-allow constructor
	constructor() {
		_disableInitializers();
	}

	/**
	 * @dev sets initials
	 */
	function initialize(uint256 _CountDest) external initializer {
		if (_CountDest == 0) revert INVALID_PARAM();
		CountDest = _CountDest;
		__Pausable_init();
		__Ownable_init();
	}

	///////////////////////////////////////////////////////
	//               USER CALLED FUNCTIONS               //
	///////////////////////////////////////////////////////

	/// @notice Performs a swap before bridging via HECTOR Bridge Splitter
	/// @param sendingAssetInfos Array Data used purely for sending assets
	/// @param fees Amounts of native coin amounts for bridge
	/// @param callDatas CallDatas from lifi sdk
	/// @param callTargetAddress use in executing squid bridge contract
	function Bridge(
		SendingAssetInfo[] memory sendingAssetInfos,
		uint256[] memory fees,
		bytes[] memory callDatas,
		address callTargetAddress
	) external payable {
		if (
			sendingAssetInfos.length > 0 &&
			sendingAssetInfos.length <= CountDest &&
			sendingAssetInfos.length == callDatas.length &&
			sendingAssetInfos.length == fees.length &&
			isCallAddress[callTargetAddress]
		) revert INVALID_PARAM();

		uint256 length = sendingAssetInfos.length;
		for (uint256 i = 0; i < length; i++) {
			if (sendingAssetInfos[i].feePercentage < minFeePercentage) revert INVALID_PERCENTAGE();
			if (sendingAssetInfos[i].sendingAssetId != address(0)) {
				IERC20Upgradeable srcToken = IERC20Upgradeable(sendingAssetInfos[i].sendingAssetId);

				if (srcToken.allowance(msg.sender, address(this)) == 0) revert INVALID_ALLOWANCE();
				if (srcToken.balanceOf(msg.sender) < sendingAssetInfos[i].totalAmount)
					revert INVALID_AMOUNT();

				uint256 calcBridgeAmount = sendingAssetInfos[i].sendingAmount;

				srcToken.safeTransferFrom(msg.sender, address(this), sendingAssetInfos[i].totalAmount);
				srcToken.approve(callTargetAddress, calcBridgeAmount);
			}
			bytes memory callData = callDatas[i];

			if (msg.value > 0 && fees.length > 0 && fees[i] > 0) {
				(bool success, ) = payable(callTargetAddress).call{value: fees[i]}(callData);
				if (!success) revert BRIDGE_FAILED();
				emit MakeCallData(success, callData, msg.sender);
			} else {
				(bool success, ) = payable(callTargetAddress).call(callDatas[i]);
				if (!success) revert BRIDGE_FAILED();
				emit MakeCallData(success, callData, msg.sender);
			}
			_takeFee(sendingAssetInfos[i]);
		}

		emit HectorBridge(msg.sender, sendingAssetInfos);
	}

	// Send Fee to DAO wallet
	function _takeFee(SendingAssetInfo memory sendingAssetInfo) internal returns (address, uint256) {
		uint256 feeAmount = (sendingAssetInfo.totalAmount * sendingAssetInfo.feePercentage) / 1000;
		if (sendingAssetInfo.sendingAssetId != address(0)) {
			IERC20Upgradeable token = IERC20Upgradeable(sendingAssetInfo.sendingAssetId);
			feeAmount = token.balanceOf(address(this)) < feeAmount
				? token.balanceOf(address(this))
				: feeAmount;
			token.safeTransfer(DAO, feeAmount);
			return (sendingAssetInfo.sendingAssetId, feeAmount);
		} else {
			feeAmount = address(this).balance < feeAmount ? address(this).balance : feeAmount;
			(bool success, ) = payable(DAO).call{value: feeAmount}('');
			if (!success) revert DAO_FEE_FAILED();
			return (address(0), feeAmount);
		}
	}

	// Custom counts of detinations
	function setCountDest(uint256 _countDest) external onlyOwner {
		if (_countDest == 0) revert INVALID_PARAM();
		uint256 oldCountDest = CountDest;
		CountDest = _countDest;
		emit SetCountDest(oldCountDest, _countDest, msg.sender);
	}

	function setBridge(address _bridge, bool status) external onlyOwner {
		if (_bridge == address(0)) revert INVALID_ADDRESS();
		//check if _bridge is a contract not wallet
		uint256 size;
		assembly {
			size := extcodesize(_bridge)
		}
		if (size == 0) revert INVALID_ADDRESS();
		isCallAddress[_bridge] = status;

		emit SetBridge(_bridge, status, msg.sender);
	}

	function setDAO(address newDAO) external onlyOwner {
		if (newDAO == address(0)) revert INVALID_ADDRESS();
		address oldDAO = DAO;

		DAO = newDAO;
		emit SetDAO(oldDAO, newDAO, msg.sender);
	}

	// Set Version
	function setVersion(string memory _version) external onlyOwner {
		version = _version;
		emit SetVersion(_version);
	}

	// Set Minimum Fee Percentage
	function setMinFeePercentage(uint _feePercentage) external onlyOwner {
		minFeePercentage = _feePercentage;
		emit SetMinFeePercentage(_feePercentage);
	}

	// All events
	event SetCountDest(uint256 oldCountDest, uint256 newCountDest, address indexed user);
	event SetBridge(address newBridge, bool status, address indexed user);
	event SetDAO(address oldDAO, address newDAO, address indexed user);
	event MakeCallData(bool success, bytes callData, address indexed user);
	event HectorBridge(address indexed user, SendingAssetInfo[] sendingAssetInfos);
	event SendFeeToDAO(uint256 feeAmount, SendingAssetInfo[] sendingAssetInfos);
	event SetVersion(string _version);
	event SetMinFeePercentage(uint256 feePercentage);
}
