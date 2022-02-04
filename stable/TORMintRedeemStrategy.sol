// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.7.5;
library SafeMath {

    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");

        return c;
    }

    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return sub(a, b, "SafeMath: subtraction overflow");
    }

    function sub(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b <= a, errorMessage);
        uint256 c = a - b;

        return c;
    }

    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");

        return c;
    }

    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return div(a, b, "SafeMath: division by zero");
    }

    function div(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b > 0, errorMessage);
        uint256 c = a / b;
        return c;
    }

    function mod(uint256 a, uint256 b) internal pure returns (uint256) {
        return mod(a, b, "SafeMath: modulo by zero");
    }

    function mod(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b != 0, errorMessage);
        return a % b;
    }

    function sqrrt(uint256 a) internal pure returns (uint c) {
        if (a > 3) {
            c = a;
            uint b = add( div( a, 2), 1 );
            while (b < c) {
                c = b;
                b = div( add( div( a, b ), b), 2 );
            }
        } else if (a != 0) {
            c = 1;
        }
    }
}
interface IOwnable {
    function owner() external view returns (address);

    function renounceManagement(string memory confirm) external;

    function pushManagement( address newOwner_ ) external;

    function pullManagement() external;
}

contract Ownable is IOwnable {

    address internal _owner;
    address internal _newOwner;

    event OwnershipPushed(address indexed previousOwner, address indexed newOwner);
    event OwnershipPulled(address indexed previousOwner, address indexed newOwner);

    constructor () {
        _owner = msg.sender;
        emit OwnershipPulled( address(0), _owner );
    }

    function owner() public view override returns (address) {
        return _owner;
    }

    modifier onlyOwner() {
        require( _owner == msg.sender, "Ownable: caller is not the owner" );
        _;
    }

    function renounceManagement(string memory confirm) public virtual override onlyOwner() {
        require(
            keccak256(abi.encodePacked(confirm)) == keccak256(abi.encodePacked("confirm renounce")),
            "Ownable: renouce needs 'confirm renounce' as input"
        );
        emit OwnershipPushed( _owner, address(0) );
        _owner = address(0);
    }

    function pushManagement( address newOwner_ ) public virtual override onlyOwner() {
        require( newOwner_ != address(0), "Ownable: new owner is the zero address");
        emit OwnershipPushed( _owner, newOwner_ );
        _newOwner = newOwner_;
    }

    function pullManagement() public virtual override {
        require( msg.sender == _newOwner, "Ownable: must be new owner to pull");
        emit OwnershipPulled( _owner, _newOwner );
        _owner = _newOwner;
    }
}
interface ITORMintStrategy{
    function tryMint(address recipient,uint torAmount,address stableToken) external returns(bool);
    function tryRedeem(address recipient,uint torAmount,address stableToken) external returns(bool);
}
interface ITORReserveHelper{
    function getTorReserveAndSupply() view external returns(uint reserve,uint totalSupply);//reserve 1e18,totalSupply 1e18
}
interface ITORPriceHelper{
    function getBuyPrice(uint stableAmount,address stableToken) view external returns(uint price);//price 1e18, 1$=1e18
    function getSellPrice(uint torAmount,address stableToken) view external returns(uint price);//price 1e18, 1$=1e18
}
interface ITORMinter{
    function lastMintTimestamp() view external returns(uint);
    function lastRedeemTimestamp() view external returns(uint);
}
contract TORMintStrategy is ITORMintStrategy,Ownable{
    using SafeMath for uint;

    uint public reserveCeilingPercentage=10000;//40%=4000
    uint public reserveFloorPercentage=0;//20%=2000

    uint public mintPriceFloor=1001*1e15;//$1.001 , $1=1e18
    uint public redeemPriceCeiling=998*1e15;//$0.998 , $1=1e18

    uint public mintBuffer=0;
    uint public redeemBuffer=0;
    uint public mintRate=10*1e18;//per second mintable rate, 1 tor = 1e18
    uint public redeemRate=5*1e18;//per second redeemable rate, 1 tor = 1e18

    ITORReserveHelper public torReserveHelper;
    ITORPriceHelper public torPriceHelper;

    address public TORMinter;
    function setTORMinter(address _TORMinter) external onlyOwner(){
        require(_TORMinter!=address(0),"invalid TORMinter address");
        TORMinter=_TORMinter;
    }
    function setReserveCeilingPercentage(uint _reserveCeilingPercentage) external onlyOwner(){
        require(_reserveCeilingPercentage!=0);
        reserveCeilingPercentage=_reserveCeilingPercentage;
    }
    function setReserveFloorPercentage(uint _reserveFloorPercentage) external onlyOwner(){
        require(_reserveFloorPercentage!=0);
        reserveFloorPercentage=_reserveFloorPercentage;
    }
    function setMintPriceFloor(uint _mintPriceFloor) external onlyOwner(){
        require(_mintPriceFloor!=0);
        mintPriceFloor=_mintPriceFloor;
    }
    function setRedeemPriceCeiling(uint _redeemPriceCeiling) external onlyOwner(){
        require(_redeemPriceCeiling!=0);
        redeemPriceCeiling=_redeemPriceCeiling;
    }
    function setMintRate(uint _mintRate) external onlyOwner(){
        require(_mintRate!=0);
        mintRate=_mintRate;
    }
    function setRedeemRate(uint _redeemRate) external onlyOwner(){
        require(_redeemRate!=0);
        redeemRate=_redeemRate;
    }
    function tryMint(address wallet,uint torAmount,address stableToken) override external returns(bool){
        require(torAmount>0,"amount must be positive");
        require(wallet!=address(0),"invalid address");
        require(msg.sender==TORMinter&&TORMinter!=address(0),"only TORMinter can tryMint");
        require(lowerThanReserveCeilingAfterMint(torAmount),"reserve ceiling reached for minting");
        require(priceAboveFloor(torAmount,stableToken),"price is too low for minting");
        require(enoughMintBuffer(torAmount),"not enough buffer for minting");
        return true;
    }
    function tryRedeem(address wallet,uint torAmount,address stableToken) override external returns(bool){
        require(torAmount>0,"amount must be positive");
        require(wallet!=address(0),"invalid address");
        require(msg.sender==TORMinter&&TORMinter!=address(0),"only TORMinter can tryRedeem");
        require(higherThanReserveFloorAfterRedeem(torAmount),"reserve floor reached for redeeming");
        require(priceBelowCeiling(torAmount,stableToken),"price is too high for redeeming");
        require(enoughRedeemBuffer(torAmount),"not enough buffer for redeeming");
        return true;
    }
    function lowerThanReserveCeilingAfterMint(uint torAmount) public view returns (bool){
        (uint reserve,uint totalSupply)=torReserveHelper.getTorReserveAndSupply();
        return torAmount.add(totalSupply)<reserve.mul(reserveCeilingPercentage).div(10000);
    }
    function priceAboveFloor(uint torAmount,address stableToken) public view returns(bool){
        return torPriceHelper.getBuyPrice(torAmount,stableToken)>mintPriceFloor;
    }
    function enoughMintBuffer(uint torAmount) internal returns(bool){
        mintBuffer=getCurrentMintBuffer();
        if(mintBuffer>=torAmount){
            mintBuffer=mintBuffer.sub(torAmount);
            return true;
        }else{
            return false;
        }
    }
    function getCurrentMintBuffer() public view returns(uint){
        return mintBuffer.add(block.timestamp.sub(ITORMinter(TORMinter).lastMintTimestamp()).mul(mintRate));
    }
    function higherThanReserveFloorAfterRedeem(uint torAmount) public view returns (bool){
        (uint reserve,uint totalSupply)=torReserveHelper.getTorReserveAndSupply();
        return totalSupply.sub(torAmount)>reserve.mul(reserveFloorPercentage).div(10000);
    }
    function priceBelowCeiling(uint torAmount,address stableToken) public view returns(bool){
        return torPriceHelper.getSellPrice(torAmount,stableToken)<redeemPriceCeiling;
    }
    function enoughRedeemBuffer(uint torAmount) internal returns(bool){
        redeemBuffer=getCurrentRedeemBuffer();
        if(redeemBuffer>=torAmount){
            redeemBuffer=redeemBuffer.sub(torAmount);
            return true;
        }else{
            return false;
        }
    }
    function getCurrentRedeemBuffer() public view returns(uint){
        return redeemBuffer.add(block.timestamp.sub(ITORMinter(TORMinter).lastRedeemTimestamp()).mul(redeemRate));
    }
}
