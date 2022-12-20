// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import {IHecBridgeSplitterInterface} from "./interface/IHecBridgeSplitterInterface.sol";
import {ILiFi} from "./interface/Libraries/ILiFi.sol";
import {LibSwap} from "./interface/Libraries/LibSwap.sol";

/**
 * @title HecBridgeSplitter
 */
contract HecBridgeSplitter is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeMathUpgradeable for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IHecBridgeSplitterInterface public Bridge;
    uint256 public CountDest; // Count of the destination wallets
    mapping(string => bytes4) public selectors; // Selector for each bridge

    // Interface

    /**
     * @dev sets initials
     */
    function initialize(uint256 _CountDest, IHecBridgeSplitterInterface _bridge)
        public
        initializer
    {
        Bridge = _bridge;
        CountDest = _CountDest;
        __Context_init_unchained();
        __Ownable_init_unchained();
        __ReentrancyGuard_init_unchained();
    }

    ///////////////////////////////////////////////////////
    //               USER CALLED FUNCTIONS               //
    ///////////////////////////////////////////////////////

    /// @notice Bridges tokens via Multichain
    /// @param _bridgeDatas the core information needed for bridging
    /// @param _multichainDatas data specific to Multichain
    function startBridgeTokensViaMultichain(
        ILiFi.BridgeData[] memory _bridgeDatas,
        IHecBridgeSplitterInterface.MultichainData[] calldata _multichainDatas
    ) public payable {
        require(
            _bridgeDatas.length > 0 &&
                _bridgeDatas.length <= CountDest &&
                _bridgeDatas.length == _multichainDatas.length,
            "Splitter: bridge or multichain call data is invalid"
        );
        for (uint256 i = 0; i < _bridgeDatas.length; i++) {
            IERC20Upgradeable srcToken = IERC20Upgradeable(
                _bridgeDatas[i].sendingAssetId
            );

            require(
                srcToken.allowance(msg.sender, address(this)) > 0,
                "ERC20: transfer amount exceeds allowance"
            );

            srcToken.safeTransferFrom(
                msg.sender,
                address(this),
                _bridgeDatas[i].minAmount
            );

            srcToken.approve(address(Bridge), _bridgeDatas[i].minAmount);

            bytes memory callData = abi.encodeWithSelector(
                selectors["startBridgeTokensViaMultichain"],
                _bridgeDatas[i],
                _multichainDatas[i]
            );

            (bool success, ) = payable(address(Bridge)).call(callData);
            require(success, "Splitter: bridge swap transaction was failed");

            emit CallData(success, callData);
        }

        emit Split(msg.sender, _bridgeDatas);
    }

    /// @notice Performs a swap before bridging via Multichain
    /// @param _bridgeDatas the core information needed for bridging
    /// @param _swapDatas an array of swap related data for performing swaps before bridging
    /// @param _multichainDatas data specific to Multichain
    function swapAndStartBridgeTokensViaMultichain(
        ILiFi.BridgeData[] memory _bridgeDatas,
        LibSwap.SwapData[] calldata _swapDatas,
        IHecBridgeSplitterInterface.MultichainData[] calldata _multichainDatas
    ) public payable {
        require(
            _bridgeDatas.length > 0 &&
                _bridgeDatas.length <= CountDest &&
                _bridgeDatas.length == _multichainDatas.length &&
                _bridgeDatas.length == _swapDatas.length,
            "Splitter: bridge or swap call data is invalid"
        );
        for (uint256 i = 0; i < _bridgeDatas.length; i++) {
            IERC20Upgradeable srcToken = IERC20Upgradeable(
                _bridgeDatas[i].sendingAssetId
            );

            require(
                srcToken.allowance(msg.sender, address(this)) > 0,
                "ERC20: transfer amount exceeds allowance"
            );

            srcToken.safeTransferFrom(
                msg.sender,
                address(this),
                _bridgeDatas[i].minAmount
            );

            srcToken.approve(address(Bridge), _bridgeDatas[i].minAmount);

            bytes memory callData = abi.encodeWithSelector(
                selectors["swapAndStartBridgeTokensViaMultichain"],
                _bridgeDatas[i],
                _swapDatas[i],
                _multichainDatas[i]
            );

            (bool success, ) = payable(address(Bridge)).call(callData);
            require(success, "Splitter: bridge swap transaction was failed");

            emit CallData(success, callData);
        }

        emit Split(msg.sender, _bridgeDatas);
    }

    /// @notice Bridges tokens via Stargate Bridge
    /// @param _bridgeDatas Array Data used purely for tracking and analytics
    /// @param _stargateDatas Array Data specific to Stargate Bridge
    function startBridgeTokensViaStargate(
        ILiFi.BridgeData[] memory _bridgeDatas,
        IHecBridgeSplitterInterface.StargateData[] memory _stargateDatas
    ) public payable {
        require(
            _bridgeDatas.length > 0 &&
                _bridgeDatas.length <= CountDest &&
                _bridgeDatas.length == _stargateDatas.length,
            "Splitter: bridge or stargate data is invalid"
        );
        for (uint256 i = 0; i < _bridgeDatas.length; i++) {
            if (_bridgeDatas[i].sendingAssetId != address(0)) {
                IERC20Upgradeable srcToken = IERC20Upgradeable(
                    _bridgeDatas[i].sendingAssetId
                );

                require(
                    srcToken.allowance(msg.sender, address(this)) > 0,
                    "ERC20: transfer amount exceeds allowance"
                );

                srcToken.safeTransferFrom(
                    msg.sender,
                    address(this),
                    _bridgeDatas[i].minAmount
                );

                srcToken.approve(address(Bridge), _bridgeDatas[i].minAmount);
            }

            bytes memory callData = abi.encodeWithSelector(
                selectors["startBridgeTokensViaStargate"],
                _bridgeDatas[i],
                _stargateDatas[i]
            );

            (bool success, ) = payable(address(Bridge)).call{
                value: _stargateDatas[i].lzFee
            }(callData);
            require(success, "Splitter: bridge swap transaction was failed");

            emit CallData(success, callData);
        }

        emit Split(msg.sender, _bridgeDatas);
    }

    /// @notice Performs a swap before bridging via Stargate Bridge
    /// @param _bridgeDatas Array Data used purely for tracking and analytics
    /// @param _swapDatas An array of array swap related data for performing swaps before bridging
    /// @param _stargateDatas Array Data specific to Stargate Bridge
    function swapAndStartBridgeTokensViaStargate(
        ILiFi.BridgeData[] memory _bridgeDatas,
        LibSwap.SwapData[][] calldata _swapDatas,
        IHecBridgeSplitterInterface.StargateData[] calldata _stargateDatas,
        uint256[] memory fees
    ) external payable {
        require(
            _bridgeDatas.length > 0 &&
                _bridgeDatas.length <= CountDest &&
                _bridgeDatas.length == _stargateDatas.length &&
                _bridgeDatas.length == _swapDatas.length,
            "Splitter: bridge or swap call data is invalid"
        );
        for (uint256 i = 0; i < _bridgeDatas.length; i++) {
            if (_swapDatas[i][0].sendingAssetId != address(0)) {
                IERC20Upgradeable srcToken = IERC20Upgradeable(
                    _bridgeDatas[i].sendingAssetId
                );

                require(
                    srcToken.allowance(msg.sender, address(this)) > 0,
                    "ERC20: transfer amount exceeds allowance"
                );

                srcToken.safeTransferFrom(
                    msg.sender,
                    address(this),
                    _bridgeDatas[i].minAmount
                );

                srcToken.approve(address(Bridge), _bridgeDatas[i].minAmount);
            }

            bytes memory callData = abi.encodeWithSelector(
                selectors["swapAndStartBridgeTokensViaStargate"],
                _bridgeDatas[i],
                _swapDatas[i],
                _stargateDatas[i]
            );

            (bool success, ) = payable(address(Bridge)).call{value: fees[i]}(
                callData
            );
            require(success, "Splitter: bridge swap transaction was failed");

            emit CallData(success, callData);
        }

        emit Split(msg.sender, _bridgeDatas);
    }

    /// @notice Performs multiple swaps in one transaction
    /// @param _transactionIds the transaction id associated with the operation
    /// @param _integrators the name of the integrator
    /// @param _referrers the address of the referrer
    /// @param _receivers the address to receive the swapped tokens into (also excess tokens)
    /// @param _minAmounts the minimum amount of the final asset to receive
    /// @param _swapDatas an object containing swap related data to perform swaps before bridging
    function swapTokensGeneric(
        bytes32[] memory _transactionIds,
        string[] calldata _integrators,
        string[] calldata _referrers,
        address[] memory _receivers,
        uint256[] memory _minAmounts,
        LibSwap.SwapData[][] calldata _swapDatas
    ) external payable {
        require(
            _swapDatas.length > 0 &&
                _swapDatas.length <= CountDest &&
                _swapDatas.length == _transactionIds.length &&
                _swapDatas.length == _integrators.length &&
                _swapDatas.length == _referrers.length &&
                _swapDatas.length == _receivers.length &&
                _swapDatas.length == _minAmounts.length,
            "Splitter: passed parameter data is invalid"
        );

        for (uint256 i = 0; i < _swapDatas.length; i++) {
            if (_swapDatas[i][0].sendingAssetId != address(0)) {
                IERC20Upgradeable srcToken = IERC20Upgradeable(
                    _swapDatas[i][0].sendingAssetId
                );

                require(
                    srcToken.allowance(msg.sender, address(this)) > 0,
                    "ERC20: transfer amount exceeds allowance"
                );

                srcToken.safeTransferFrom(
                    msg.sender,
                    address(this),
                    _swapDatas[i][0].fromAmount
                );

                srcToken.approve(address(Bridge), _swapDatas[i][0].fromAmount);
            }
            bytes memory callData = abi.encodeWithSelector(
                selectors["swapTokensGeneric"],
                _transactionIds[i],
                _integrators[i],
                _referrers[i],
                _receivers[i],
                _minAmounts[i],
                _swapDatas[i]
            );

            (bool success, ) = _swapDatas[i][0].sendingAssetId == address(0)
                ? payable(address(Bridge)).call{
                    value: _swapDatas[i][0].fromAmount
                }(callData)
                : address(Bridge).call(callData);

            require(success, "Splitter: bridge swap transaction was failed");

            emit CallData(success, callData);
        }
    }

    // Set selector
    function setSelectors(string[] memory _names, bytes4[] memory _selectors)
        external
        onlyOwner
    {
        require(
            _names.length == _selectors.length,
            "Splitter: not matched names and selectors length"
        );
        for (uint256 i = 0; i < _names.length; i++) {
            selectors[_names[i]] = _selectors[i];
        }
    }

    // Withdraw dummy erc20 tokens
    function withdraw(IERC20Upgradeable erc20) external onlyOwner {
        if (erc20.balanceOf(address(this)) > 0) {
            erc20.safeTransfer(msg.sender, erc20.balanceOf(address(this)));
        }
        if (address(this).balance > 0) {
            payable(msg.sender).transfer(address(this).balance);
        }
    }

    receive() external payable {}

    // All events
    event Split(address user, ILiFi.BridgeData[] bridgeData);
    event CallData(bool success, bytes callData);
}
