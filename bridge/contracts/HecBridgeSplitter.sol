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

/**
 * @title HecBridgeSplitter
 */
contract HecBridgeSplitter is OwnableUpgradeable, PausableUpgradeable {
	using SafeMathUpgradeable for uint256;
	using SafeERC20Upgradeable for IERC20Upgradeable;

	address public BridgeContract;
	uint256 public CountDest; // Count of the destination wallets
	address public DAO;

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
	function initialize(uint256 _CountDest, address _bridge) external initializer {
		if (_bridge == address(0)) revert INVALID_ADDRESS();
		if (_CountDest == 0) revert INVALID_PARAM();
		BridgeContract = _bridge;
		CountDest = _CountDest;
		__Pausable_init();
	}

	///////////////////////////////////////////////////////
	//               USER CALLED FUNCTIONS               //
	///////////////////////////////////////////////////////

	/// @notice Performs a swap before bridging via HECTOR Bridge Splitter
	/// @param sendingAssetInfos Array Data used purely for sending assets
	/// @param bridgeFees Amounts of native coin amounts for bridge
	/// @param DAOFee Amounts of fee for DAO
	/// @param callDatas CallDatas from bridge sdk
	function Bridge(
		SendingAssetInfo[] memory sendingAssetInfos,
		uint256[] memory bridgeFees,
		uint256 DAOFee,
		bytes[] memory callDatas
	) external payable {
		if (
				sendingAssetInfos.length > 0 &&
				sendingAssetInfos.length <= CountDest &&
				sendingAssetInfos.length == callDatas.length &&
				sendingAssetInfos.length == bridgeFees.length
			)
			revert INVALID_PARAM();		

		bool isFeeEnabled = msg.value > 0 && bridgeFees.length > 0;

		IERC20Upgradeable srcToken = IERC20Upgradeable(sendingAssetInfos[0].sendingAssetId);
		if (srcToken.allowance(msg.sender, address(this)) == 0) revert INVALID_ALLOWANCE();
		uint256 totalAmount = _getTotalAmount(sendingAssetInfos) + DAOFee;

		if (srcToken.balanceOf(msg.sender) < totalAmount) revert INVALID_AMOUNT();

		srcToken.safeTransferFrom(msg.sender, address(this), totalAmount);
		srcToken.approve(BridgeContract, totalAmount);

		// Send fee to DAO
		if (DAOFee > 0) {
			srcToken.safeTransfer(DAO, DAOFee);
		}

		uint256 length = sendingAssetInfos.length;
		for (uint256 i = 0; i < length; i++) {
			address sendingAssetId = sendingAssetInfos[i].sendingAssetId;

			if (sendingAssetId == address(0)) revert INVALID_ADDRESS();
			bytes memory callData = callDatas[i];

			uint256 bridgeFee = bridgeFees[i];
			
			//Bridge the rest of the asset to the destination
			if (isFeeEnabled && bridgeFee > 0) {
				(bool success, ) = payable(BridgeContract).call{value: bridgeFee}(callData);
				if (!success) revert BRIDGE_FAILED();
				emit MakeCallData(success, callData, msg.sender);
			} else {
				(bool success, ) = payable(BridgeContract).call(callData);
				if (!success) revert BRIDGE_FAILED();
				emit MakeCallData(success, callData, msg.sender);
			}

		}

		emit HectorBridge(msg.sender, sendingAssetInfos);
	}

	// Custom counts of detinations
	function setCountDest(uint256 _countDest) external onlyOwner {
		if (_countDest == 0) revert INVALID_PARAM();
		uint256 oldCountDest = CountDest;
		CountDest = _countDest;
		emit SetCountDest(oldCountDest, _countDest, msg.sender);
	}

	function setBridge(address _bridge) external onlyOwner {
		if (_bridge == address(0)) revert INVALID_ADDRESS();
		//check if _bridge is a contract not wallet
		uint256 size;
		assembly {
			size := extcodesize(_bridge)
		}
		if (size == 0) revert INVALID_ADDRESS();

		address oldBridge = BridgeContract;

		BridgeContract = _bridge;
		emit SetBridge(oldBridge, _bridge, msg.sender);
	}

	function setDAO(address newDAO) external onlyOwner {
		if (newDAO == address(0)) revert INVALID_ADDRESS();
		address oldDAO = DAO;

		DAO = newDAO;
		emit SetDAO(oldDAO, newDAO, msg.sender);
	}

	///////////////////////////////////////////////////////
	//               INTERNAL FUNCTIONS                  //
	///////////////////////////////////////////////////////

	function _getTotalAmount(SendingAssetInfo[] memory sendingAssetInfos) internal pure returns (uint256) {
		uint256 totalAmount = 0;
		for (uint256 i = 0; i < sendingAssetInfos.length; i++) {
			totalAmount = totalAmount.add(sendingAssetInfos[i].sendingAmount);
		}
		return totalAmount;
	}

	// All events
	event SetCountDest(uint256 oldCountDest, uint256 newCountDest, address indexed user);
	event SetBridge(address oldBridge, address newBridge, address indexed user);
	event SetDAO(address oldDAO, address newDAO, address indexed user);
	event MakeCallData(bool success, bytes callData, address indexed user);
	event HectorBridge(address indexed user, SendingAssetInfo[] sendingAssetInfos);
	event SendFeeToDAO(uint256 feeAmount , SendingAssetInfo[] sendingAssetInfos);
}
