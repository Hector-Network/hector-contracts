// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

import '@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol';
import {ICommon} from './interface/ICommon.sol';

interface IOwnableUpgradeable {
	function owner() external view returns (address);

	function renounceManagement() external;

	function pushManagement(address newOwner_) external;

	function pullManagement() external;
}

abstract contract OwnableUpgradeable is IOwnableUpgradeable, Initializable, ContextUpgradeable {
	address internal _owner;
	address internal _newOwner;

	event OwnershipPushed(address indexed previousOwner, address indexed newOwner);
	event OwnershipPulled(address indexed previousOwner, address indexed newOwner);

	/**
	 * @dev Initializes the contract setting the deployer as the initial owner.
	 */
	function __Ownable_init() internal onlyInitializing {
		__Ownable_init_unchained();
	}

	function __Ownable_init_unchained() internal onlyInitializing {
		_owner = msg.sender;
		emit OwnershipPushed(address(0), _owner);
	}

	function owner() public view override returns (address) {
		return _owner;
	}

	modifier onlyOwner() {
		require(_owner == msg.sender, 'Ownable: caller is not the owner');
		_;
	}

	function renounceManagement() public virtual override onlyOwner {
		emit OwnershipPushed(_owner, address(0));
		_owner = address(0);
	}

	function pushManagement(address newOwner_) public virtual override {
		require(newOwner_ != address(0), 'Ownable: new owner is the zero address');
		emit OwnershipPushed(_owner, newOwner_);
		_newOwner = newOwner_;
	}

	function pullManagement() public virtual override {
		require(msg.sender == _newOwner, 'Ownable: must be new owner to pull');
		emit OwnershipPulled(_owner, _newOwner);
		_owner = _newOwner;
	}

	/**
	 * @dev This empty reserved space is put in place to allow future versions to add new
	 * variables without shifting down storage in the inheritance chain.
	 * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
	 */
	uint256[49] private __gap;
}

/**
 * @title HecBridgeSplitter
 */
contract HecBridgeSplitter is OwnableUpgradeable, PausableUpgradeable {
	using SafeMathUpgradeable for uint256;
	using SafeERC20Upgradeable for IERC20Upgradeable;

	address public Bridge;
	uint256 public CountDest; // Count of the destination wallets

	/* ======== INITIALIZATION ======== */

	/// @custom:oz-upgrades-unsafe-allow constructor
	constructor() {
		_disableInitializers();
	}

	/**
	 * @dev sets initials
	 */
	function initialize(uint256 _CountDest, address _bridge) external initializer {
		Bridge = _bridge;
		CountDest = _CountDest;
		 __Ownable_init();
        __Pausable_init();
	}

	///////////////////////////////////////////////////////
	//               USER CALLED FUNCTIONS               //
	///////////////////////////////////////////////////////

	/// @notice Performs multiple swaps in one transaction
	/// @param _swapDatas an object containing swap related data to perform swaps before bridging
	/// @param callDatas callDatas from lifi sdk
	function swapTokensGeneric(
		ICommon.CommonSwapData[][] calldata _swapDatas,
		bytes[] memory callDatas
	) external payable {
		require(
			_swapDatas.length > 0 &&
				_swapDatas.length <= CountDest &&
				_swapDatas.length == callDatas.length,
			'Splitter: passed parameter data is invalid'
		);

		for (uint256 i = 0; i < _swapDatas.length; i++) {
			if (_swapDatas[i][0].sendingAssetId != address(0)) {
				IERC20Upgradeable srcToken = IERC20Upgradeable(_swapDatas[i][0].sendingAssetId);

				require(
					srcToken.allowance(msg.sender, address(this)) > 0,
					'ERC20: transfer amount exceeds allowance'
				);

				srcToken.safeTransferFrom(msg.sender, address(this), _swapDatas[i][0].fromAmount);
				srcToken.approve(Bridge, _swapDatas[i][0].fromAmount);
			}

			(bool success, ) = _swapDatas[i][0].sendingAssetId == address(0)
				? payable(Bridge).call{value: _swapDatas[i][0].fromAmount}(callDatas[i])
				: Bridge.call(callDatas[i]);

			require(success, 'Splitter: bridge swap transaction was failed');
			emit CallData(success, callDatas[i]);
		}
	}

	/// @notice Bridges tokens via HECTOR Bridge Splitter
	/// @param _bridgeDatas Array Data used purely for tracking and analytics
	/// @param fees Amounts of native coin amounts for bridge
	/// @param callDatas CallDatas from lifi sdk
	function startBridgeTokens(
		ICommon.CommonBridgeData[] memory _bridgeDatas,
		uint256[] memory fees,
		bytes[] memory callDatas
	) external payable {
		require(
			_bridgeDatas.length > 0 &&
				_bridgeDatas.length <= CountDest &&
				_bridgeDatas.length == callDatas.length,
			'Splitter: bridge or callDatas is invalid'
		);
		for (uint256 i = 0; i < _bridgeDatas.length; i++) {
			if (_bridgeDatas[i].sendingAssetId != address(0)) {
				IERC20Upgradeable srcToken = IERC20Upgradeable(_bridgeDatas[i].sendingAssetId);

				require(
					srcToken.allowance(msg.sender, address(this)) > 0,
					'ERC20: transfer amount exceeds allowance'
				);

				srcToken.safeTransferFrom(msg.sender, address(this), _bridgeDatas[i].minAmount);
				srcToken.approve(Bridge, _bridgeDatas[i].minAmount);
			}

			if (msg.value > 0 && fees.length > 0 && fees[i] > 0) {
				(bool success, ) = payable(Bridge).call{value: fees[i]}(callDatas[i]);
				require(success, 'Splitter: bridge swap transaction was failed');
				emit CallData(success, callDatas[i]);
			} else {
				(bool success, ) = payable(Bridge).call(callDatas[i]);
				require(success, 'Splitter: bridge swap transaction was failed');
				emit CallData(success, callDatas[i]);
			}
		}

		emit HectorBridge(msg.sender, _bridgeDatas);
	}

	/// @notice Performs a swap before bridging via HECTOR Bridge Splitter
	/// @param _bridgeDatas Array Data used purely for tracking and analytics
	/// @param _swapDatas An array of swap related data for performing swaps before bridging
	/// @param fees Amounts of native coin amounts for bridge
	/// @param callDatas CallDatas from lifi sdk
	function swapAndStartBridgeTokens(
		ICommon.CommonBridgeData[] memory _bridgeDatas,
		ICommon.CommonSwapData[][] calldata _swapDatas,
		uint256[] memory fees,
		bytes[] memory callDatas
	) external payable {
		require(
			_bridgeDatas.length > 0 &&
				_bridgeDatas.length <= CountDest &&
				_bridgeDatas.length == callDatas.length &&
				_bridgeDatas.length == _swapDatas.length,
			'Splitter: bridge or swap call data is invalid'
		);
		for (uint256 i = 0; i < _bridgeDatas.length; i++) {
			if (_swapDatas[i][0].sendingAssetId != address(0)) {
				IERC20Upgradeable srcToken = IERC20Upgradeable(_swapDatas[i][0].sendingAssetId);

				require(
					srcToken.allowance(msg.sender, address(this)) > 0,
					'ERC20: transfer amount exceeds allowance'
				);

				srcToken.safeTransferFrom(msg.sender, address(this), _swapDatas[i][0].fromAmount);
				srcToken.approve(Bridge, _swapDatas[i][0].fromAmount);
			}

			if (msg.value > 0 && fees.length > 0 && fees[i] > 0) {
				(bool success, ) = payable(Bridge).call{value: fees[i]}(callDatas[i]);
				require(success, 'Splitter: bridge swap transaction was failed');
				emit CallData(success, callDatas[i]);
			} else {
				(bool success, ) = payable(Bridge).call(callDatas[i]);
				require(success, 'Splitter: bridge swap transaction was failed');
				emit CallData(success, callDatas[i]);
			}
		}

		emit HectorBridge(msg.sender, _bridgeDatas);
	}

	// Custom counts of detinations
	function setCountDest(uint256 _countDest) external onlyOwner {
		CountDest = _countDest;
		emit SetCountDest(_countDest);
	}

	// Set LiFiDiamond Address
	function setBridge(address _bridge) external onlyOwner {
		Bridge = _bridge;
		emit SetBridge(_bridge);
	}

	// All events
	event SetCountDest(uint256 countDest);
	event SetBridge(address bridge);
	event CallData(bool success, bytes callData);
	event HectorBridge(address user, ICommon.CommonBridgeData[] bridgeData);
}
