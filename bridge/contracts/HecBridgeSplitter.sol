// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.17;

import '@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol';
import {OwnableUpgradeable} from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';

error INVALID_PARAM();
error INVALID_ADDRESS();
error BRIDGE_FAILURE();
error INVALID_ALLOWANCE();

/**
 * @title HecBridgeSplitter
 */
contract HecBridgeSplitter is OwnableUpgradeable, PausableUpgradeable {
	using SafeMathUpgradeable for uint256;
	using SafeERC20Upgradeable for IERC20Upgradeable;

	address public LiFiBridge;
	uint256 public CountDest; // Count of the destination wallets

	// Struct Asset Info
	struct SendingAssetInfo {
		address sendingAssetId;
		uint256 sendingAmount;
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
		LiFiBridge = _bridge;
		CountDest = _CountDest;
		__Ownable_init();
		__Pausable_init();
	}

	///////////////////////////////////////////////////////
	//               USER CALLED FUNCTIONS               //
	///////////////////////////////////////////////////////

	/// @notice Performs a swap before bridging via HECTOR Bridge Splitter
	/// @param sendingAssetInfos Array Data used purely for sending assets
	/// @param fees Amounts of native coin amounts for bridge
	/// @param callDatas CallDatas from lifi sdk
	/// @param useSquid use Squid or Lifi
	/// @param squidTargetAddress use in executing squid bridge contract
	function Bridge(
		SendingAssetInfo[] memory sendingAssetInfos,
		uint256[] memory fees,
		bytes[] memory callDatas,
		bool useSquid,
		address squidTargetAddress
	) external payable {
		uint256 assetLength = sendingAssetInfos.length;

		if  (assetLength != callDatas.length || assetLength > CountDest) 
			revert INVALID_PARAM();

		if (useSquid && squidTargetAddress == address(0))
			revert INVALID_ADDRESS();

		address callTargetAddress = useSquid ? squidTargetAddress : LiFiBridge;
		for (uint256 i = 0; i < sendingAssetInfos.length; i++) {
			if (sendingAssetInfos[i].sendingAssetId != address(0)) {
				IERC20Upgradeable srcToken = IERC20Upgradeable(sendingAssetInfos[i].sendingAssetId);

				if (srcToken.allowance(msg.sender, address(this)) <= 0) revert INVALID_ALLOWANCE();				

				srcToken.safeTransferFrom(msg.sender, address(this), sendingAssetInfos[i].sendingAmount);
				srcToken.approve(callTargetAddress, sendingAssetInfos[i].sendingAmount);
			}

			if (msg.value > 0 && fees.length > 0 && fees[i] > 0) {
				(bool success, ) = payable(callTargetAddress).call{value: fees[i]}(callDatas[i]);
				if (!success) revert BRIDGE_FAILURE();
				emit CallData(success, callDatas[i]);
			} else {
				(bool success, ) = payable(callTargetAddress).call(callDatas[i]);
				if (!success) revert BRIDGE_FAILURE();
				emit CallData(success, callDatas[i]);
			}
		}

		emit HectorBridge(msg.sender, sendingAssetInfos);
	}

	// Custom counts of detinations
	function setCountDest(uint256 _countDest) external onlyOwner {
		CountDest = _countDest;
		emit SetCountDest(_countDest);
	}

	// Set LiFiDiamond Address
	function setBridge(address _bridge) external onlyOwner {
		LiFiBridge = _bridge;
		emit SetBridge(_bridge);
	}

	// All events
	event SetCountDest(uint256 countDest);
	event SetBridge(address bridge);
	event CallData(bool success, bytes callData);
	event HectorBridge(address user, SendingAssetInfo[] sendingAssetInfos);
}
