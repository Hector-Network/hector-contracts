// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.7.5;
interface ITORMintRedeemStrategy{
    function canMint(address recipient,uint torAmount,address stableToken) external returns(bool);
    function canRedeem(address recipient,uint torAmount,address stableToken) external returns(bool);
}
contract PauseStrategy is ITORMintRedeemStrategy{
    function canMint(address recipient,uint torAmount,address stableToken) override external returns(bool){
        return false;
    }
    function canRedeem(address recipient,uint torAmount,address stableToken) override external returns(bool){
        return false;
    }
}
