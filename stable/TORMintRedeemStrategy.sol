// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.7;
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
        _newOwner = address(0);
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
interface ITORMintRedeemStrategy{
    function canMint(address recipient,uint torAmount,address stableToken) external returns(bool);
    function canRedeem(address recipient,uint torAmount,address stableToken) external returns(bool);
}
interface ITORReserveHelper{
    function getTorReserveAndSupply() view external returns(uint reserve,uint totalSupply);//reserve 1e18,totalSupply 1e18
}
interface ITORCurveHelper{
    function getPoolPercentageWithMint(uint torAmount) view external returns(uint percentage);//tor percentage 10000 = 100%
    function getPoolPercentageWithRedeem(uint torAmount) view external returns(uint percentage);//tor percentage 5000 = 50%
}
interface ITORMinter{
    function lastMintTimestamp() view external returns(uint);
    function lastRedeemTimestamp() view external returns(uint);
}
contract TORMintRedeemStrategy is ITORMintRedeemStrategy,Ownable{
    using SafeMath for uint;

    uint public reserveCeilingPercentage=5000;//40%=4000
    uint public reserveFloorPercentage=0;//20%=2000

    uint public mintPercentageCeiling=500;//percentage of TOR in curve pool, 100%=10000
    uint public redeemPercentageFloor=6500;//percentage of TOR in curve pool, 100%=10000

    uint public mintBuffer=0;
    uint public redeemBuffer=0;
    uint public mintRate=25*1e18;//per second mintable rate, 1 tor = 1e18
    uint public redeemRate=5*1e18;//per second redeemable rate, 1 tor = 1e18
    uint public mintBufferMax=30000*1e18;//100K TOR as max mint buffer
    uint public redeemBufferMax=30000*1e18;//10K TOR as max redeem buffer

    mapping(address=>uint) public allowedStableToken;

    ITORReserveHelper public TORReserveHelper=ITORReserveHelper(0x504dDf1ff26047D850EFa88e64e65EBA9b1E5cbF);
    ITORCurveHelper public TORCurveHelper=ITORCurveHelper(0x2cFC70B2c114De258F05069c8f8416f6215C4A68);

    address public TORMinter=0x9b0c6FfA7d0Ec29EAb516d3F2dC809eE43DD60ca;

    address public timelock;
    function setTimelock(address _timelock) external{
        require(_timelock!=address(0),"invalid timelock address");
        require(
            (timelock!=address(0)&&msg.sender==timelock) || //
            (timelock==address(0)&&msg.sender==owner()),
            "once timelock is set, new timelock can only be set ty existing timelock address"
        );
        timelock=_timelock;
    }
    function setTORMinter(address _TORMinter) external onlyOwner(){
        require(_TORMinter!=address(0),"invalid TORMinter address");
        TORMinter=_TORMinter;
    }
    function setTORReserveHelper(address _TORReserveHelper) external{
        require(msg.sender==timelock,"only timelock address can setTORReserveHelper");
        require(_TORReserveHelper!=address(0),"invalid TORReserveHelper address");
        TORReserveHelper=ITORReserveHelper(_TORReserveHelper);
    }
    function setTORCurveHelper(address _TORCurveHelper) external onlyOwner(){
        require(_TORCurveHelper!=address(0),"invalid TORCurveHelper address");
        TORCurveHelper=ITORCurveHelper(_TORCurveHelper);
    }
    function setReserveCeilingPercentage(uint _reserveCeilingPercentage) external onlyOwner(){
        require(_reserveCeilingPercentage!=0,"reserveCeilingPercentage must be greater than 0%");
        require(_reserveCeilingPercentage<=10000,"reserveCeilingPercentage can't be more than 100%");
        reserveCeilingPercentage=_reserveCeilingPercentage;
    }
    function setReserveFloorPercentage(uint _reserveFloorPercentage) external onlyOwner(){
        require(_reserveFloorPercentage!=0);
        reserveFloorPercentage=_reserveFloorPercentage;
    }
    function setMintPercentageCeiling(uint _mintPercentageCeiling) external onlyOwner(){
        require(_mintPercentageCeiling!=0);
        mintPercentageCeiling=_mintPercentageCeiling;
    }
    function setRedeemPercentageFloor(uint _redeemPercentageFloor) external onlyOwner(){
        require(_redeemPercentageFloor!=0);
        redeemPercentageFloor=_redeemPercentageFloor;
    }
    function setMintRate(uint _mintRate) external onlyOwner(){
        require(_mintRate!=0);
        mintRate=_mintRate;
    }
    function setRedeemRate(uint _redeemRate) external onlyOwner(){
        require(_redeemRate!=0);
        redeemRate=_redeemRate;
    }
    function setMintBufferMax(uint _mintBufferMax) external onlyOwner(){
        require(_mintBufferMax!=0);
        mintBufferMax=_mintBufferMax;
    }
    function setRedeemBufferMax(uint _redeemBufferMax) external onlyOwner(){
        require(_redeemBufferMax!=0);
        redeemBufferMax=_redeemBufferMax;
    }
    function addAllowedStable(address stableToken) external onlyOwner(){
        if(allowedStableToken[stableToken]==0) allowedStableToken[stableToken]=1;
    }
    function removeAllowedStable(address stableToken) external onlyOwner(){
        if(allowedStableToken[stableToken]==1) delete allowedStableToken[stableToken];
    }
    function canMint(address wallet,uint torAmount,address stableToken) override external returns(bool){
        require(allowedStableToken[stableToken]!=0,"mint not allowed for stableToken");
        require(torAmount>0,"amount must be positive");
        require(wallet!=address(0),"invalid address");
        require(msg.sender==TORMinter&&TORMinter!=address(0),"only TORMinter can tryMint");
        require(lowerThanReserveCeilingAfterMint(torAmount),"reserve ceiling reached for minting");
        require(curvePercentageBelowCeiling(torAmount),"curve percentage is too high to mint tor");
        require(enoughMintBuffer(torAmount),"not enough buffer for minting");
        return true;
    }
    function canRedeem(address wallet,uint torAmount,address stableToken) override external returns(bool){
        require(allowedStableToken[stableToken]!=0,"redeem not allowed for stableToken");
        require(torAmount>0,"amount must be positive");
        require(wallet!=address(0),"invalid address");
        require(msg.sender==TORMinter&&TORMinter!=address(0),"only TORMinter can tryRedeem");
        require(higherThanReserveFloorAfterRedeem(torAmount),"reserve floor reached for redeeming");
        require(curvePercentageAboveFloor(torAmount),"curve percentage is too low to redeem tor");
        require(enoughRedeemBuffer(torAmount),"not enough buffer for redeeming");
        return true;
    }
    function lowerThanReserveCeilingAfterMint(uint torAmount) public view returns (bool){
        (uint reserve,uint totalSupply)=TORReserveHelper.getTorReserveAndSupply();
        return totalSupply.add(torAmount)<reserve.mul(reserveCeilingPercentage).div(10000);
    }
    function curvePercentageBelowCeiling(uint torAmount) public view returns(bool){
        return TORCurveHelper.getPoolPercentageWithMint(torAmount)<=mintPercentageCeiling;
    }
    function enoughMintBuffer(uint torAmount) internal returns(bool){
        if(getCurrentMintBuffer()>=torAmount){
            mintBuffer=getCurrentMintBuffer().sub(torAmount);
            return true;
        }else{
            return false;
        }
    }
    function getCurrentMintBuffer() public view returns(uint _mintBuffer){
        _mintBuffer=mintBuffer.add(block.timestamp.sub(ITORMinter(TORMinter).lastMintTimestamp()).mul(mintRate));
        if(_mintBuffer>mintBufferMax)_mintBuffer=mintBufferMax;
    }
    function higherThanReserveFloorAfterRedeem(uint torAmount) public view returns (bool){
        (uint reserve,uint totalSupply)=TORReserveHelper.getTorReserveAndSupply();
        return totalSupply.sub(torAmount)>reserve.mul(reserveFloorPercentage).div(10000);
    }
    function curvePercentageAboveFloor(uint torAmount) public view returns(bool){
        return TORCurveHelper.getPoolPercentageWithRedeem(torAmount)>=redeemPercentageFloor;
    }
    function enoughRedeemBuffer(uint torAmount) internal returns(bool){
        if(getCurrentRedeemBuffer()>=torAmount){
            redeemBuffer=getCurrentRedeemBuffer().sub(torAmount);
            return true;
        }else{
            return false;
        }
    }
    function getCurrentRedeemBuffer() public view returns(uint _redeemBuffer){
        _redeemBuffer=redeemBuffer.add(block.timestamp.sub(ITORMinter(TORMinter).lastRedeemTimestamp()).mul(redeemRate));
        if(_redeemBuffer>redeemBufferMax)_redeemBuffer=redeemBufferMax;
    }
}
