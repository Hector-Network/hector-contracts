// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./HectorStorage.sol";
import "./fee/FeeModelV2.sol";
import "./ITokenTransferProxy.sol";
import "./lib/Utils.sol";
import "./lib/weth/IWETH.sol";
import "./routers/IRouterV2.sol";

abstract contract ProtectedSimpleSwap is FeeModel, IRouter {
    using SafeMath for uint256;

    constructor(uint256 _partnerSharePercent, uint256 _maxFeePercent)
        FeeModel(_partnerSharePercent, _maxFeePercent)
    {}

    function initialize() external pure {
        revert("METHOD NOT IMPLEMENTED");
    }

    function getKey() external pure override returns (bytes32) {
        return
            keccak256(
                abi.encodePacked("PROTECTED_SIMPLE_SWAP_ROUTER", "1.0.0")
            );
    }

    function protectedSimpleSwap(Utils.SimpleData memory data)
        public
        payable
        returns (uint256 receivedAmount)
    {
        require(data.deadline >= block.timestamp, "Deadline breached");
        address payable beneficiary = data.beneficiary == address(0)
            ? payable(msg.sender)
            : data.beneficiary;
        receivedAmount = performSimpleSwap(
            data.fromToken,
            data.toToken,
            data.fromAmount,
            data.toAmount,
            data.expectedAmount,
            data.callees,
            data.exchangeData,
            data.startIndexes,
            data.values,
            beneficiary,
            data.partner,
            data.feePercent,
            data.permit
        );

        retrieveTokens(data.fromToken);

        emit Swapped(
            data.uuid,
            msg.sender,
            beneficiary,
            data.fromToken,
            data.toToken,
            data.fromAmount,
            receivedAmount,
            data.expectedAmount
        );

        return receivedAmount;
    }

    function protectedSimpleBuy(Utils.SimpleData calldata data)
        external
        payable
    {
        require(data.deadline >= block.timestamp, "Deadline breached");
        address payable beneficiary = data.beneficiary == address(0)
            ? payable(msg.sender)
            : data.beneficiary;
        uint256 receivedAmount = performSimpleSwap(
            data.fromToken,
            data.toToken,
            data.fromAmount,
            data.toAmount,
            data.toAmount, //expected amount and to amount are same in case of buy
            data.callees,
            data.exchangeData,
            data.startIndexes,
            data.values,
            beneficiary,
            data.partner,
            data.feePercent,
            data.permit
        );

        retrieveTokens(data.fromToken);

        emit Bought(
            data.uuid,
            msg.sender,
            beneficiary,
            data.fromToken,
            data.toToken,
            data.fromAmount,
            receivedAmount
        );
    }

    function performSimpleSwap(
        address fromToken,
        address toToken,
        uint256 fromAmount,
        uint256 toAmount,
        uint256 expectedAmount,
        address[] memory callees,
        bytes memory exchangeData,
        uint256[] memory startIndexes,
        uint256[] memory values,
        address payable beneficiary,
        address payable partner,
        uint256 feePercent,
        bytes memory permit
    ) private returns (uint256 receivedAmount) {
        require(toAmount > 0, "toAmount is too low");
        require(
            callees.length + 1 == startIndexes.length,
            "Start indexes must be 1 greater then number of callees"
        );

        //If source token is not ETH than transfer required amount of tokens
        //from sender to this contract
        transferTokensFromProxy(fromToken, fromAmount, permit);

        for (uint256 i = 0; i < callees.length; i++) {
            require(
                callees[i] != address(tokenTransferProxy),
                "Can not call TokenTransferProxy Contract"
            );

            {
                uint256 dataOffset = startIndexes[i];
                bytes32 selector;
                assembly {
                    selector := mload(add(exchangeData, add(dataOffset, 32)))
                }
                require(
                    bytes4(selector) != IERC20.transferFrom.selector,
                    "transferFrom not allowed for externalCall"
                );
            }

            bool result = externalCall(
                callees[i], //destination
                values[i], //value to send
                startIndexes[i], // start index of call data
                startIndexes[i + 1].sub(startIndexes[i]), // length of calldata
                exchangeData // total calldata
            );
            require(result, "External call failed");
        }

        receivedAmount = Utils.tokenBalance(toToken, address(this));

        require(
            receivedAmount >= toAmount,
            "Received amount of tokens are less then expected"
        );

        takeFeeAndTransferTokens(
            toToken,
            expectedAmount,
            receivedAmount,
            beneficiary,
            partner,
            feePercent
        );

        return receivedAmount;
    }

    function transferTokensFromProxy(
        address token,
        uint256 amount,
        bytes memory permit
    ) private {
        if (token != Utils.ethAddress()) {
            Utils.permit(token, permit);

            tokenTransferProxy.transferFrom(
                token,
                msg.sender,
                address(this),
                amount
            );
        }
    }

    /**
     * @dev Source take from GNOSIS MultiSigWallet
     * @dev https://github.com/gnosis/MultiSigWallet/blob/master/contracts/MultiSigWallet.sol
     */
    function externalCall(
        address destination,
        uint256 value,
        uint256 dataOffset,
        uint256 dataLength,
        bytes memory data
    ) private returns (bool) {
        bool result = false;

        assembly {
            let x := mload(0x40) // "Allocate" memory for output (0x40 is where "free memory" pointer is stored by convention)

            let d := add(data, 32) // First 32 bytes are the padded length of data, so exclude that
            result := call(
                gas(),
                destination,
                value,
                add(d, dataOffset),
                dataLength, // Size of the input (in bytes) - this is what fixes the padding problem
                x,
                0 // Output is ignored, therefore the output size is zero
            )
        }
        return result;
    }

    function retrieveTokens(address token) private {
        uint256 balance = Utils.tokenBalance(token, address(this));
        Utils.transferTokens(token, payable(msg.sender), balance);
    }
}
