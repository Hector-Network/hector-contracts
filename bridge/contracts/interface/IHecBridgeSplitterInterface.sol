// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;
import {ILiFi} from "./Libraries/ILiFi.sol";
import {LibSwap} from "./Libraries/LibSwap.sol";

interface IHecBridgeSplitterInterface {
    struct MultichainData {
        address router;
    }

    /// @param dstPoolId Dest pool id.
    /// @param minAmountLD The min qty you would accept on the destination.
    /// @param dstGasForCall Additional gas fee for extral call on the destination.
    /// @param refundAddress Refund adddress. Extra gas (if any) is returned to this address
    /// @param lzFee Estimated message fee.
    /// @param callTo The address to send the tokens to on the destination.
    /// @param callData Additional payload.
    struct StargateData {
        uint256 dstPoolId;
        uint256 minAmountLD;
        uint256 dstGasForCall;
        uint256 lzFee;
        address payable refundAddress;
        bytes callTo;
        bytes callData;
    }

    /// @param maxSlippage The max slippage accepted, given as percentage in point (pip).
    /// @param nonce A number input to guarantee uniqueness of transferId. Can be timestamp in practice.
    struct CBridgeData {
        uint32 maxSlippage;
        uint64 nonce;
    }

    /// @param maxSubmissionCost Max gas deducted from user's L2 balance to cover base submission fee.
    /// @param maxGas Max gas deducted from user's L2 balance to cover L2 execution.
    /// @param maxGasPrice price bid for L2 execution.
    struct ArbitrumData {
        uint256 maxSubmissionCost;
        uint256 maxGas;
        uint256 maxGasPrice;
    }

    /// @notice Register router
    /// @param router Address of the router
    /// @param allowed Whether the address is allowed or not
    function registerBridge(address router, bool allowed) external;

    /// @notice Batch register routers
    /// @param routers Router addresses
    /// @param allowed Array of whether the addresses are allowed or not
    function registerBridge(address[] calldata routers, bool[] calldata allowed)
        external;

    /// @notice (Batch) register routers
    /// @param routers Router addresses
    /// @param allowed Array of whether the addresses are allowed or not
    function registerRouters(
        address[] calldata routers,
        bool[] calldata allowed
    ) external;

    /// @notice Bridges tokens via Multichain
    /// @param _bridgeData the core information needed for bridging
    /// @param _multichainData data specific to Multichain
    function startBridgeTokensViaMultichain(
        ILiFi.BridgeData memory _bridgeData,
        MultichainData calldata _multichainData
    ) external payable;

    /// @notice Performs a swap before bridging via Multichain
    /// @param _bridgeData the core information needed for bridging
    /// @param _swapData an array of swap related data for performing swaps before bridging
    /// @param _multichainData data specific to Multichain
    function swapAndStartBridgeTokensViaMultichain(
        ILiFi.BridgeData memory _bridgeData,
        LibSwap.SwapData[] calldata _swapData,
        MultichainData memory _multichainData
    ) external payable;

    /// @notice Sets the Stargate pool ID for a given token
    /// @param _token address of the token
    /// @param _poolId uint16 of the Stargate pool ID
    function setStargatePoolId(address _token, uint16 _poolId) external;

    /// @notice Sets the Layer 0 chain ID for a given chain ID
    /// @param _chainId uint16 of the chain ID
    /// @param _layerZeroChainId uint16 of the Layer 0 chain ID
    /// @dev This is used to map a chain ID to its Layer 0 chain ID
    function setLayerZeroChainId(uint256 _chainId, uint16 _layerZeroChainId)
        external;

    /// @notice Bridges tokens via Stargate Bridge
    /// @param _bridgeData Data used purely for tracking and analytics
    /// @param _stargateData Data specific to Stargate Bridge
    function startBridgeTokensViaStargate(
        ILiFi.BridgeData memory _bridgeData,
        StargateData calldata _stargateData
    ) external payable;

    /// @notice Performs a swap before bridging via Stargate Bridge
    /// @param _bridgeData Data used purely for tracking and analytics
    /// @param _swapData An array of swap related data for performing swaps before bridging
    /// @param _stargateData Data specific to Stargate Bridge
    function swapAndStartBridgeTokensViaStargate(
        ILiFi.BridgeData memory _bridgeData,
        LibSwap.SwapData[] calldata _swapData,
        StargateData calldata _stargateData
    ) external payable;

    /// @notice Bridges tokens via CBridge
    /// @param _bridgeData the core information needed for bridging
    /// @param _cBridgeData data specific to CBridge
    function startBridgeTokensViaCBridge(
        ILiFi.BridgeData memory _bridgeData,
        CBridgeData calldata _cBridgeData
    ) external payable;

    /// @notice Performs a swap before bridging via CBridge
    /// @param _bridgeData the core information needed for bridging
    /// @param _swapData an array of swap related data for performing swaps before bridging
    /// @param _cBridgeData data specific to CBridge
    function swapAndStartBridgeTokensViaCBridge(
        ILiFi.BridgeData memory _bridgeData,
        LibSwap.SwapData[] calldata _swapData,
        CBridgeData memory _cBridgeData
    ) external payable;

    /// @notice Bridges tokens via Arbitrum Bridge
    /// @param _bridgeData Data containing core information for bridging
    /// @param _arbitrumData Data for gateway router address, asset id and amount
    function startBridgeTokensViaArbitrumBridge(
        ILiFi.BridgeData memory _bridgeData,
        ArbitrumData calldata _arbitrumData
    ) external payable;

    /// @notice Performs a swap before bridging via Arbitrum Bridge
    /// @param _bridgeData Data containing core information for bridging
    /// @param _swapData An array of swap related data for performing swaps before bridging
    /// @param _arbitrumData Data for gateway router address, asset id and amount
    function swapAndStartBridgeTokensViaArbitrumBridge(
        ILiFi.BridgeData memory _bridgeData,
        LibSwap.SwapData[] calldata _swapData,
        ArbitrumData calldata _arbitrumData
    ) external payable;

    

    /// @notice Performs multiple swaps in one transaction
    /// @param _transactionId the transaction id associated with the operation
    /// @param _integrator the name of the integrator
    /// @param _referrer the address of the referrer
    /// @param _receiver the address to receive the swapped tokens into (also excess tokens)
    /// @param _minAmount the minimum amount of the final asset to receive
    /// @param _swapData an object containing swap related data to perform swaps before bridging
    function swapTokensGeneric(
        bytes32 _transactionId,
        string calldata _integrator,
        string calldata _referrer,
        address payable _receiver,
        uint256 _minAmount,
        LibSwap.SwapData[] calldata _swapData
    ) external payable;
}
