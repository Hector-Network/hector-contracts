// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

// Structure of FNFT
struct FNFTInfo {
    uint256 id;
    uint256 amount;
    uint256 startTime;
    uint256 secs;
    uint256 multiplier;
    uint256 rewardDebt;
    uint256 pendingReward;
}

// Structure of FNFT voted info
struct FNFTInfoByUser {
    uint256 fnftId; // FNFT id
    address stakingToken; // The token being stored
    uint256 depositAmount; // How many tokens
}

// Structure of locked FNFT info
struct LockedFNFTInfo {
    uint256 fnftId; // FNFT id
    uint256 time; // The token being stored
}

// Interface of the LockFarm
interface LockFarm {
    function fnfts(uint256)
        external
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256
        );

    function pendingReward(uint256 fnftId)
        external
        view
        returns (uint256 reward);

    function getFnfts(address owner)
        external
        view
        returns (FNFTInfo[] memory infos);

    function totalTokenSupply()
        external
        view
        returns (uint256 _totalTokenSupply);
}

// Interface of the FNFT
interface FNFT {
    function balanceOf(address) external view returns (uint256);

    function tokenOfOwnerByIndex(address, uint256)
        external
        view
        returns (uint256);

    function ownerOf(uint256 tokenId) external view returns (address);

    function symbol() external view returns (string memory);
}

// Interface of the LockAddressRegistry
interface LockAddressRegistry {
    function getTokenVault() external view returns (address);

    function getEmissionor() external view returns (address);

    function getFNFT() external view returns (address);
}

// Interface of the SpookySwap Liqudity ERC20
interface SpookySwapPair {
    function MINIMUM_LIQUIDITY() external pure returns (uint256);

    function factory() external view returns (address);

    function token0() external view returns (address);

    function token1() external view returns (address);

    function getReserves()
        external
        view
        returns (
            uint112 reserve0,
            uint112 reserve1,
            uint32 blockTimestampLast
        );

    function price0CumulativeLast() external view returns (uint256);

    function price1CumulativeLast() external view returns (uint256);

    function totalSupply() external view returns (uint256);

    function symbol() external view returns (string memory);
}

// Interface of the SpookySwap Factory
interface SpookySwapFactory {
    function getPair(address tokenA, address tokenB)
        external
        view
        returns (address pair);

    function createPair(address tokenA, address tokenB)
        external
        returns (address pair);
}

// Interface of the SpookySwap Router
interface SpookySwapRouter {
    function WETH() external view returns (address weth);

    function quote(
        uint256 amountA,
        uint256 reserveA,
        uint256 reserveB
    ) external pure returns (uint256 amountB);

    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) external pure returns (uint256 amountOut);

    function getAmountIn(
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut
    ) external pure returns (uint256 amountIn);

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts);

    function getAmountsIn(uint256 amountOut, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts);
}

// Interface of the wsHEC
interface wsHEC {
    function wsHECTosHEC(uint256 _amount) external view returns (uint256);
}

// Interface of the TokenVault
interface TokenVault {
    struct FNFTConfig {
        address asset; // The token being stored
        uint256 depositAmount; // How many tokens
        uint256 endTime; // Time lock expiry
    }

    function getFNFT(uint256 fnftId) external view returns (FNFTConfig memory);
}
