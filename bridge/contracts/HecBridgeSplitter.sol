// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

import '@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol';
import {OwnableUpgradeable} from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

error INVALID_PARAM();
error INVALID_ADDRESS();
error INVALID_AMOUNT();
error INVALID_ALLOWANCE();
error INVALID_PERCENTAGE();
error INVALID_FEES();
error DAO_FEE_FAILED();

/**
 * @title HecBridgeSplitter
 */
contract HecBridgeSplitter is OwnableUpgradeable, PausableUpgradeable {
	using SafeMathUpgradeable for uint256;
	using SafeERC20Upgradeable for IERC20Upgradeable;
	using EnumerableSet for EnumerableSet.AddressSet;

	mapping(address => bool) private isCallAddress;
	EnumerableSet.AddressSet private _callAddresses;

	function addToWhiteList(address _callAddress) external onlyOwner {
		require(!isCallAddress[_callAddress], 'Address already exists');

		isCallAddress[_callAddress] = true;
		_callAddresses.add(_callAddress);
	}

	function removeFromWhiteList(address _callAddress) external onlyOwner {
		require(isCallAddress[_callAddress], 'Address does not exist');

		delete isCallAddress[_callAddress];
		_callAddresses.remove(_callAddress);
	}

	function getWhiteListSize() public view returns (uint256) {
		return _callAddresses.length();
	}

	function isInWhiteList(address _callAddress) public view returns (bool) {
		return isCallAddress[_callAddress];
	}

	function getWhiteListAtIndex(uint256 index) public view returns (address) {
		require(index < _callAddresses.length(), 'Invalid index');
		return _callAddresses.at(index);
	}

	function getAllWhiteList() public view returns (address[] memory) {
		uint256 length = _callAddresses.length();
		address[] memory addresses = new address[](length);

		for (uint256 i = 0; i < length; i++) {
			addresses[i] = _callAddresses.at(i);
		}

		return addresses;
	}

	uint256 public CountDest; // Count of the destination wallets
	uint public minFeePercentage;
	address public DAO; // DAO wallet for taking fee
	string public version;

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
	function bridge(
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
			isInWhiteList(callTargetAddress)
		) revert INVALID_PARAM();

		if (msg.value < sum(fees)) revert INVALID_FEES();

		// Receive asset
		_receiveAssets(sendingAssetInfos, callTargetAddress);

		uint length = sendingAssetInfos.length;
		for (uint i = 0; i < length; i++) {
			SendingAssetInfo memory sendingAssetInfo = sendingAssetInfos[i];

			bytes memory callData = callDatas[i];
			if (msg.value > 0 && fees.length > 0 && fees[i] > 0) {
				(bool success, bytes memory result) = payable(callTargetAddress).call{value: fees[i]}(
					callData
				);
				if (!success) revert(_getRevertMsg(result));
				emit MakeCallData(success, callData, msg.sender);
			} else {
				(bool success, bytes memory result) = payable(callTargetAddress).call(callData);
				if (!success) revert(_getRevertMsg(result));
				emit MakeCallData(success, callData, msg.sender);
			}
			_takeFee(sendingAssetInfo);
		}

		emit HectorBridge(msg.sender, sendingAssetInfos);
	}

	// Receive asset
	function _receiveAssets(
		SendingAssetInfo[] memory sendingAssetInfos,
		address callTargetAddress
	) internal {
		uint256 totalAmounts = 0;
		uint256 sendAmounts = 0;
		for (uint i = 0; i < sendingAssetInfos.length; i++) {
			SendingAssetInfo memory sendingAssetInfo = sendingAssetInfos[i];
			if (sendingAssetInfo.feePercentage < minFeePercentage) revert INVALID_PERCENTAGE();
			require(sendingAssetInfo.totalAmount > sendingAssetInfo.sendingAmount, 'Invalid asset info');
			if (sendingAssetInfo.sendingAssetId != address(0)) {
				totalAmounts += sendingAssetInfo.totalAmount;
				sendAmounts += sendingAssetInfo.sendingAmount;
			}
		}

		require(totalAmounts > sendAmounts, "Invalid asset info");

		IERC20Upgradeable srcToken = IERC20Upgradeable(sendingAssetInfos[0].sendingAssetId);
		uint256 beforeBalance = srcToken.balanceOf(address(this));
		srcToken.safeTransferFrom(msg.sender, address(this), totalAmounts);
		uint256 afterBalance = srcToken.balanceOf(address(this));
		if (afterBalance - beforeBalance != totalAmounts) revert INVALID_AMOUNT();

		srcToken.approve(callTargetAddress, sendAmounts);
	}

	// Sum
	function sum(uint256[] memory numbers) internal pure returns (uint256) {
		uint256 total = 0;
		for (uint i = 0; i < numbers.length; i++) {
			total += numbers[i];
		}
		return total;
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

	// Set Bridge
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

	// Set DAO wallet
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
