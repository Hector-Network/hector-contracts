// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.7;
interface ITORMintRedeemStrategy{
    function canMint(address recipient,uint torAmount,address stableToken) external returns(bool);
    function canRedeem(address recipient,uint torAmount,address stableToken) external returns(bool);
}
contract NoBlockStrategy is ITORMintRedeemStrategy{
    function canMint(address recipient,uint torAmount,address stableToken) override external returns(bool){
        return true;
    }
    function canRedeem(address recipient,uint torAmount,address stableToken) override external returns(bool){
        return true;
    }
}
