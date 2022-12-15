// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
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

    // Split by multichain
    function startBridgeTokensViaMultichain(
        ILiFi.BridgeData memory _bridgeData,
        IHecBridgeSplitterInterface.MultichainData calldata _multichainData
    ) public payable {
        Bridge.startBridgeTokensViaMultichain(_bridgeData, _multichainData);
    }

    function swapAndStartBridgeTokensViaMultichain(
        ILiFi.BridgeData memory _bridgeData,
        LibSwap.SwapData[] calldata _swapData,
        IHecBridgeSplitterInterface.MultichainData calldata _multichainData
    ) public payable {
        Bridge.swapAndStartBridgeTokensViaMultichain(
            _bridgeData,
            _swapData,
            _multichainData
        );
    }

    // Split by stargate
    function startStargateBridgeSplit(
        ILiFi.BridgeData[] memory _bridgeDatas,
        IHecBridgeSplitterInterface.StargateData[] memory _stargateDatas
    ) public payable {
        require(
            _bridgeDatas.length > 0 &&
                _bridgeDatas.length < CountDest &&
                _bridgeDatas.length == _stargateDatas.length,
            "Error: Destinations is not allowed"
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
                0x3b00e807,
                _bridgeDatas[i],
                _stargateDatas[i]
            );

            (bool success, ) = payable(address(Bridge)).call{
                value: msg.value
            }(callData);

            // Bridge.startBridgeTokensViaStargate(
            //     _bridgeDatas[i],
            //     _stargateDatas[i]
            // );
            emit CallData(success, callData);
        }

        emit Split(msg.sender, _bridgeDatas);
    }

    function swapAndStartBridgeTokensViaStargate(
        ILiFi.BridgeData[] memory _bridgeDatas,
        LibSwap.SwapData[][] calldata _swapDatas,
        IHecBridgeSplitterInterface.StargateData[] calldata _stargateDatas
    ) external payable {
        require(
            _bridgeDatas.length > 0 &&
                _bridgeDatas.length < CountDest &&
                _bridgeDatas.length == _stargateDatas.length,
            "Error: Destinations is not allowed"
        );
        for (uint256 i = 0; i < _bridgeDatas.length; i++) {
            IERC20Upgradeable srcToken = IERC20Upgradeable(
                _bridgeDatas[i].sendingAssetId
            );
            srcToken.approve(address(Bridge), _bridgeDatas[i].minAmount);
            require(
                srcToken.allowance(msg.sender, address(this)) > 0,
                "ERC20: transfer amount exceeds allowance"
            );
            Bridge.swapAndStartBridgeTokensViaStargate(
                _bridgeDatas[i],
                _swapDatas[i],
                _stargateDatas[i]
            );
        }
        emit Split(msg.sender, _bridgeDatas);
    }

    // // Splitter by Arbitrum
    // function startBridgeTokensViaArbitrumBridge(
    //     // BridgeData
    //     bytes32 _transactionId,
    //     string memory _bridge,
    //     string memory _integrator,
    //     address _referrer,
    //     address _sendingAssetId,
    //     address[] memory _receivers,
    //     uint256 _minAmount,
    //     uint256[] memory _amounts,
    //     uint256 _destinationChainId,
    //     bool _hasSourceSwaps,
    //     bool _hasDestinationCall,
    //     // ArbitrumData
    //     uint256 _maxSubmissionCost,
    //     uint256 _maxGas,
    //     uint256 _maxGasPrice
    // ) external payable {
    //     require(
    //         _receivers.length > 0 &&
    //             _receivers.length < CountDest &&
    //             _receivers.length == _amounts.length,
    //         "Error: Destinations is not allowed"
    //     );
    //     uint256 totalAmount = 0;
    //     for (uint256 j = 0; j < _amounts.length; j++) {
    //         totalAmount = totalAmount.add(_amounts[j]);
    //     }
    //     require(_minAmount == totalAmount, "Destination amount is wrong");

    //     for (uint256 i = 0; i < _receivers.length; i++) {
    //         ILiFi.BridgeData memory _bridgeData = ILiFi.BridgeData({
    //             transactionId: _transactionId,
    //             bridge: _bridge,
    //             integrator: _integrator,
    //             referrer: _referrer,
    //             sendingAssetId: _sendingAssetId,
    //             receiver: _receivers[i],
    //             minAmount: _amounts[i],
    //             destinationChainId: _destinationChainId,
    //             hasSourceSwaps: _hasSourceSwaps,
    //             hasDestinationCall: _hasDestinationCall
    //         });

    //         IHecBridgeSplitterInterface.ArbitrumData
    //             memory _arbitrumData = IHecBridgeSplitterInterface
    //                 .ArbitrumData({
    //                     maxSubmissionCost: _maxSubmissionCost,
    //                     maxGas: _maxGas,
    //                     maxGasPrice: _maxGasPrice
    //                 });

    //         Bridge.startBridgeTokensViaArbitrumBridge(
    //             _bridgeData,
    //             _arbitrumData
    //         );

    //         emit Split(msg.sender, _bridgeData, _receivers, _amounts);
    //     }
    // }

    // function swapAndStartBridgeTokensViaArbitrumBridge(
    //     // BridgeData
    //     bytes32 transactionId,
    //     string memory bridge,
    //     string memory integrator,
    //     address referrer,
    //     address sendingAssetId,
    //     address[] memory receivers,
    //     uint256[] memory minAmounts,
    //     uint256 destinationChainId,
    //     bool hasSourceSwaps,
    //     bool hasDestinationCall,
    //     // SwapData
    //     address callTo,
    //     address approveTo,
    //     address sendingAssetIdForSwap,
    //     address receivingAssetId,
    //     uint256 fromAmount,
    //     bytes calldata callData,
    //     bool requiresDeposit,
    //     // ArbitrumData
    //     uint256 maxSubmissionCost,
    //     uint256 maxGas,
    //     uint256 maxGasPrice
    // ) external payable {
    //     // require(
    //     //     receivers.length < CountDest,
    //     //     "Error: Destinations is not allowed"
    //     // );
    //     // for (uint256 i = 0; i < receivers.length; i++) {
    //     //     ILiFi.BridgeData memory _bridgeData = ILiFi.BridgeData({
    //     //         transactionId: transactionId,
    //     //         bridge: bridge,
    //     //         integrator: integrator,
    //     //         referrer: referrer,
    //     //         sendingAssetId: sendingAssetId,
    //     //         receiver: receivers[i],
    //     //         minAmount: minAmounts[i],
    //     //         destinationChainId: destinationChainId,
    //     //         hasSourceSwaps: hasSourceSwaps,
    //     //         hasDestinationCall: hasDestinationCall
    //     //     });
    //     //     LibSwap.SwapData memory _swapData = LibSwap.SwapData({
    //     //         callTo: callTo,
    //     //         approveTo: approveTo,
    //     //         sendingAssetId: sendingAssetIdForSwap,
    //     //         receivingAssetId: receivingAssetId,
    //     //         fromAmount: fromAmount,
    //     //         callData: callData,
    //     //         requiresDeposit: requiresDeposit
    //     //     });
    //     //     IHecBridgeSplitterInterface.ArbitrumData
    //     //         memory _arbitrumData = IHecBridgeSplitterInterface
    //     //             .ArbitrumData({
    //     //                 maxSubmissionCost: maxSubmissionCost,
    //     //                 maxGas: maxGas,
    //     //                 maxGasPrice: maxGasPrice
    //     //             });
    //     //     Bridge.swapAndStartBridgeTokensViaArbitrumBridge(
    //     //         _bridgeData,
    //     //         _swapData,
    //     //         _arbitrumData
    //     //     );
    //     // }
    // }

    function swapTokensGeneric(
        bytes32 _transactionId,
        string calldata _integrator,
        string calldata _referrer,
        address payable _receiver,
        uint256 _minAmount,
        LibSwap.SwapData[] calldata _swapData
    ) external payable {
        Bridge.swapTokensGeneric(
            _transactionId,
            _integrator,
            _referrer,
            _receiver,
            _minAmount,
            _swapData
        );
    }

    function withdraw(IERC20Upgradeable erc20) external {
        erc20.safeTransfer(msg.sender, erc20.balanceOf(address(this)));
        if (address(this).balance > 0) {
            payable(msg.sender).transfer(address(this).balance);
        }
    }

    receive() external payable {}

    // All events
    event Split(address user, ILiFi.BridgeData[] bridgeData);
    event CallData(bool success, bytes callData);
}
