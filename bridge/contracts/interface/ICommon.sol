// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

interface ICommon {
	struct CommonBridgeData {
		address sendingAssetId;
		uint256 minAmount;
	}

	struct CommonSwapData {
		address sendingAssetId;
		uint256 fromAmount;
	}

	struct CustomStargateData {
		uint256 lzFee;
	}
}
