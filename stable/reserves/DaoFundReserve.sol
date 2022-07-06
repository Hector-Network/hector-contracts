// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.7;
interface IERC20 {
    function decimals() external view returns(uint8);
    function balanceOf(address owner) external view returns(uint);
    function totalSupply() external view returns(uint);
}
interface CurveLp{
    function balances(uint idx) external view returns (uint);
}
contract DaoFundReserve is IERC20{
    function balanceOf(address owner) override external view returns(uint){
        return owner==0xCB54EA94191B280C296E6ff0E37c7e76Ad42dC6A?totalSupply():0;
    }
    function decimals() override external pure returns(uint8){
        return 18;
    }
    function totalSupply() override public view returns(uint){
        address daoWallet=0x677d6EC74fA352D4Ef9B1886F6155384aCD70D90;
        uint torLp = IERC20(0x8B92DE822b121761a3caF894627a09a9f87864C0).balanceOf(daoWallet);
        uint totalStable = CurveLp(0x24699312CB27C26Cfc669459D670559E5E44EE60).balances(1);
        uint stableInLp = totalStable*torLp/(IERC20(0x24699312CB27C26Cfc669459D670559E5E44EE60).totalSupply());
        return stableInLp
        +IERC20(0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E).balanceOf(daoWallet)
        +IERC20(0x04068DA6C83AFCFA0e13ba15A6696662335D5B75).balanceOf(daoWallet)*1e12;
    }
}
