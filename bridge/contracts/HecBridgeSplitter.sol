// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

import '@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol';
import {OwnableUpgradeable} from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

error INVALID_PARAM();
error INVALID_ADDRESS();
error INVALID_AMOUNT();
error INVALID_ALLOWANCE();
error INVALID_DAO_FEE();
error INVALID_FEES();
error DAO_FEE_FAILED();

/**
 * @title HecBridgeSplitter
 */
contract HecBridgeSplitter is OwnableUpgradeable, PausableUpgradeable {
	using SafeERC20Upgradeable for IERC20Upgradeable;
	using EnumerableSet for EnumerableSet.AddressSet;

	// Struct Asset Info
	struct SendingAssetInfo {
		bytes callData;
		uint256 sendingAmount;
		uint256 totalAmount;
		uint256 feeAmount;
		uint256 bridgeFee;
	}

	// State variables
	uint256 public CountDest; // Count of the destination wallets
	uint public minFeePercentage;
	address public DAO; // DAO wallet for taking fee
	string public version;
	EnumerableSet.AddressSet private _callAddresses;

	// Events
	event SetCountDest(uint256 oldCountDest, uint256 newCountDest, address indexed user);
	event SetBridge(address newBridge, bool status, address indexed user);
	event SetDAO(address oldDAO, address newDAO, address indexed user);
	event MakeCallData(bool success, bytes callData, address indexed user);
	event HectorBridge(address indexed user, SendingAssetInfo[] sendingAssetInfos);
	event SendFeeToDAO(uint256 feeAmount, SendingAssetInfo[] sendingAssetInfos);
	event SetVersion(string _version);
	event SetMinFeePercentage(uint256 feePercentage);

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

	/* ======== POLICY FUNCTIONS ======== */

	function pause() external onlyOwner {
		_pause();
	}

	function unpause() external onlyOwner {
		_unpause();
	}

	// Functions
	function addToWhiteList(address _callAddress) external onlyOwner {
		require(!_callAddresses.contains(_callAddress), 'Address already exists');
		_callAddresses.add(_callAddress);
	}

	function removeFromWhiteList(address _callAddress) external onlyOwner {
		require(_callAddresses.contains(_callAddress), 'Address does not exist');
		_callAddresses.remove(_callAddress);
	}

	function getWhiteListSize() external view returns (uint256) {
		return _callAddresses.length();
	}

	function isInWhiteList(address _callAddress) public view returns (bool) {
		return _callAddresses.contains(_callAddress);
	}

	function getWhiteListAtIndex(uint256 index) external view returns (address) {
		require(index < _callAddresses.length(), 'Invalid index');
		return _callAddresses.at(index);
	}

	function getAllWhiteList() external view returns (address[] memory) {
		return _callAddresses.values();
	}

	///////////////////////////////////////////////////////
	//               USER CALLED FUNCTIONS               //
	///////////////////////////////////////////////////////

	/// @notice Performs a swap before bridging via HECTOR Bridge Splitter
	/// @param sendingAsset Asset that is used for bridge
	/// @param sendingAssetInfos Array Data used purely for sending assets
	/// @param callTargetAddress use in executing squid bridge contract
	function bridge(
		address sendingAsset,
		SendingAssetInfo[] calldata sendingAssetInfos,
		address callTargetAddress
	) external payable whenNotPaused {
		require(
			sendingAssetInfos.length > 0 &&
				sendingAssetInfos.length <= CountDest &&
				isInWhiteList(callTargetAddress),
			'Bridge: Invalid parameters'
		);

		// Receive asset
		_receiveAssets(sendingAsset, sendingAssetInfos, callTargetAddress);

		uint length = sendingAssetInfos.length;
		for (uint i = 0; i < length; i++) {
			bytes memory callData = sendingAssetInfos[i].callData;
			uint256 fee = sendingAssetInfos[i].bridgeFee;
			if (fee > 0) {
				(bool success, bytes memory result) = payable(callTargetAddress).call{value: fee}(callData);
				if (!success) revert(_getRevertMsg(result));
				emit MakeCallData(success, callData, msg.sender);
			} else {
				(bool success, bytes memory result) = payable(callTargetAddress).call(callData);
				if (!success) revert(_getRevertMsg(result));
				emit MakeCallData(success, callData, msg.sender);
			}
		}
		emit HectorBridge(msg.sender, sendingAssetInfos);
	}

	// Receive asset
	function _receiveAssets(
		address sendingAsset,
		SendingAssetInfo[] calldata sendingAssetInfos,
		address callTargetAddress
	) internal {
		uint256 totalAmounts = 0;
		uint256 sendAmounts = 0;
		uint256 feeAmounts = 0;
		uint256 bridgeFees = 0;
		for (uint i = 0; i < sendingAssetInfos.length; i++) {
			SendingAssetInfo memory sendingAssetInfo = sendingAssetInfos[i];
			uint256 totalAmount = sendingAssetInfo.totalAmount;
			uint256 sendingAmount = sendingAssetInfo.sendingAmount;
			uint256 feeAmount = sendingAssetInfo.feeAmount;
			uint256 bridgeFee = sendingAssetInfo.bridgeFee;

			require(totalAmount == sendingAmount + feeAmount, 'Bridge: Invalid asset info');

			if (feeAmount < (totalAmount * minFeePercentage) / 1000) revert INVALID_DAO_FEE();

			totalAmounts += totalAmount;
			sendAmounts += sendingAmount;
			feeAmounts += feeAmount;
			bridgeFees += bridgeFee;
		}

		if (sendingAsset != address(0)) {
			if (msg.value < bridgeFees) revert INVALID_FEES();
			IERC20Upgradeable srcToken = IERC20Upgradeable(sendingAsset);
			uint256 beforeBalance = srcToken.balanceOf(address(this));
			srcToken.safeTransferFrom(msg.sender, address(this), totalAmounts);
			uint256 afterBalance = srcToken.balanceOf(address(this));
			if (afterBalance - beforeBalance != totalAmounts) revert INVALID_AMOUNT();
			// Approve targetAddress
			srcToken.approve(callTargetAddress, sendAmounts);
			// Take Fee
			srcToken.safeTransfer(DAO, feeAmounts);
		} else {
			if (msg.value < bridgeFees + feeAmounts) revert INVALID_FEES();
			(bool success, ) = payable(DAO).call{value: feeAmounts}('');
			if (!success) revert DAO_FEE_FAILED();
		}
	}

	// Return revert msg of failed Bridge transaction
	function _getRevertMsg(bytes memory _returnData) internal pure returns (string memory) {
		// If the _res length is less than 68, then the transaction failed silently (without a revert message)
		if (_returnData.length < 68) return 'Transaction reverted silently';

		assembly {
			// Slice the sighash.
			_returnData := add(_returnData, 0x04)
		}
		return abi.decode(_returnData, (string)); // All that remains is the revert string
	}

	// Custom counts of detinations
	function setCountDest(uint256 _countDest) external onlyOwner {
		if (_countDest == 0) revert INVALID_PARAM();
		uint256 oldCountDest = CountDest;
		CountDest = _countDest;
		emit SetCountDest(oldCountDest, _countDest, msg.sender);
	}

	// Set DAO wallet
	function setDAO(address newDAO) external onlyOwner {
		if (newDAO == address(0)) revert INVALID_ADDRESS();
		address oldDAO = DAO;

		DAO = newDAO;
		emit SetDAO(oldDAO, newDAO, msg.sender);
	}

	// Set Version
	function setVersion(string calldata _version) external onlyOwner {
		version = _version;
		emit SetVersion(_version);
	}

	// Set Minimum Fee Percentage
	function setMinFeePercentage(uint _feePercentage) external onlyOwner {
		require(_feePercentage > 0 && _feePercentage < 1000, 'Invalid percentage');
		minFeePercentage = _feePercentage;
		emit SetMinFeePercentage(_feePercentage);
	}

	// Withdraw dummy token
	function withdrawTokens(address[] memory _tokens) external onlyOwner {
		uint256 length = _tokens.length;

		for (uint256 i = 0; i < length; i++) {
			address token = _tokens[i];
			if (token == address(0)) revert INVALID_ADDRESS();

			uint256 balance = IERC20Upgradeable(token).balanceOf(address(this));
			if (balance > 0) {
				IERC20Upgradeable(token).safeTransfer(DAO, balance);
			}
		}
	}
}
