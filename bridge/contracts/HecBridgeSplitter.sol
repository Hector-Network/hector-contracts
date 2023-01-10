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

    /// @notice Bridges tokens via Stargate Bridge
    /// @param _bridgeDatas Array Data used purely for tracking and analytics
    /// @param _stargateDatas Array Data specific to Stargate Bridge
    /// @param callDatas callDatas from lifi sdk
    function startBridgeTokensViaStargate(
        ILiFi.CommonBridgeData[] memory _bridgeDatas,
        IHecBridgeSplitterInterface.CustomStargateData[] memory _stargateDatas,
        bytes[] memory callDatas
    ) public payable {
        require(
            _bridgeDatas.length > 0 &&
                _bridgeDatas.length <= CountDest &&
                _bridgeDatas.length == _stargateDatas.length &&
                _bridgeDatas.length == callDatas.length,
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

            (bool success, ) = payable(address(Bridge)).call{
                value: _stargateDatas[i].lzFee
            }(callDatas[i]);
            require(success, "Splitter: bridge swap transaction was failed");

            emit CallData(success, callDatas[i]);
        }

        emit HectorBridge(msg.sender, _bridgeDatas);
    }

    /// @notice Performs a swap before bridging via Stargate Bridge
    /// @param _bridgeDatas Array Data used purely for tracking and analytics
    /// @param _swapDatas An array of array swap related data for performing swaps before bridging
    /// @param _stargateDatas Array Data specific to Stargate Bridge
    /// @param callDatas callData from lifi sdk
    function swapAndStartBridgeTokensViaStargate(
        ILiFi.CommonBridgeData[] memory _bridgeDatas,
        LibSwap.CommonSwapData[][] calldata _swapDatas,
        IHecBridgeSplitterInterface.CustomStargateData[]
            calldata _stargateDatas,
        uint256[] memory fees,
        bytes[] memory callDatas
    ) external payable {
        require(
            _bridgeDatas.length > 0 &&
                _bridgeDatas.length <= CountDest &&
                _bridgeDatas.length == _stargateDatas.length &&
                _bridgeDatas.length == _swapDatas.length &&
                _bridgeDatas.length == callDatas.length &&
                _bridgeDatas.length == fees.length,
            "Splitter: bridge or swap call data is invalid"
        );
        for (uint256 i = 0; i < _bridgeDatas.length; i++) {
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

            (bool success, ) = payable(address(Bridge)).call{value: fees[i]}(
                callDatas[i]
            );
            require(success, "Splitter: bridge swap transaction was failed");

            emit CallData(success, callDatas[i]);
        }

        emit HectorBridge(msg.sender, _bridgeDatas);
    }

    /// @notice This function starts a cross-chain transaction using the NXTP protocol
    /// @param _bridgeDatas the core information needed for bridging
    /// @param callDatas callDatas from lifi sdk
    function startBridgeTokensViaNXTP(
        ILiFi.CommonBridgeData[] memory _bridgeDatas,
        uint256[] memory fees,
        bytes[] memory callDatas
    ) external payable {
        require(
            _bridgeDatas.length > 0 &&
                _bridgeDatas.length <= CountDest &&
                _bridgeDatas.length == callDatas.length,
            "Splitter: bridge or connext data is invalid"
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

            if (msg.value > 0 && fees[i] > 0) {
                (bool success, ) = payable(address(Bridge)).call{
                    value: fees[i]
                }(callDatas[i]);
                require(
                    success,
                    "Splitter: bridge swap transaction was failed"
                );
                emit CallData(success, callDatas[i]);
            } else {
                (bool success, ) = payable(address(Bridge)).call(callDatas[i]);
                require(
                    success,
                    "Splitter: bridge swap transaction was failed"
                );
                emit CallData(success, callDatas[i]);
            }
        }

        emit HectorBridge(msg.sender, _bridgeDatas);
    }

    /// @notice This function performs a swap or multiple swaps and then starts a cross-chain transaction
    ///         using the NXTP protocol.
    /// @param _bridgeDatas the core information needed for bridging
    /// @param _swapDatas array of data needed for swaps
    /// @param callDatas callDatas from lifi sdk
    function swapAndStartBridgeTokensViaNXTP(
        ILiFi.CommonBridgeData[] memory _bridgeDatas,
        LibSwap.CommonSwapData[][] calldata _swapDatas,
        uint256[] memory fees,
        bytes[] memory callDatas
    ) external payable {
        require(
            _bridgeDatas.length > 0 &&
                _bridgeDatas.length <= CountDest &&
                _bridgeDatas.length == callDatas.length &&
                _bridgeDatas.length == _swapDatas.length,
            "Splitter: bridge or swap call data is invalid"
        );
        for (uint256 i = 0; i < _bridgeDatas.length; i++) {
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

            (bool success, ) = payable(address(Bridge)).call{value: fees[i]}(
                callDatas[i]
            );
            require(success, "Splitter: bridge swap transaction was failed");

            emit CallData(success, callDatas[i]);
        }

        emit HectorBridge(msg.sender, _bridgeDatas);
    }

    /// @notice Performs multiple swaps in one transaction
    /// @param _swapDatas an object containing swap related data to perform swaps before bridging
    /// @param callDatas callDatas from lifi sdk
    function swapTokensGeneric(
        LibSwap.CommonSwapData[][] calldata _swapDatas,
        bytes[] memory callDatas
    ) external payable {
        require(
            _swapDatas.length > 0 &&
                _swapDatas.length <= CountDest &&
                _swapDatas.length == callDatas.length,
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

            (bool success, ) = _swapDatas[i][0].sendingAssetId == address(0)
                ? payable(address(Bridge)).call{
                    value: _swapDatas[i][0].fromAmount
                }(callDatas[i])
                : address(Bridge).call(callDatas[i]);

            require(success, "Splitter: bridge swap transaction was failed");
            emit CallData(success, callDatas[i]);
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

    // Custom counts of detinations
    function setCountDest(uint256 _countDest) external onlyOwner {
        CountDest = _countDest;
        emit SetCountDest(_countDest);
    }

    // All events
    event SetCountDest(uint256 countDest);
    event Split(address user, ILiFi.BridgeData[] bridgeData);
    event CallData(bool success, bytes callData);
    event HectorBridge(address user, ILiFi.CommonBridgeData[] bridgeData);
}
