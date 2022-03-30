// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

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
interface IERC20{
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}
interface IRewardReceiver{
    function receiveReward(uint amount) external;
}
abstract contract RewardReceiver is IRewardReceiver,Ownable{
    event Log(uint value);
    address public rewardToken;
    function receiveReward(uint amount) external override{
        IERC20(rewardToken).transferFrom(msg.sender,address(this),amount);
        onRewardReceived(amount);
    }
    function onRewardReceived(uint amount) internal virtual;
    function setRewardToken(address _rewardToken) external onlyOwner{
        require(rewardToken==address(0)&&_rewardToken!=address(0));
        rewardToken=_rewardToken;
    }
}

interface ISHEC{
    function circulatingSupply() external view returns ( uint );
}

contract StakedHecDistributor is RewardReceiver {

    /* ====== VARIABLES ====== */

    IERC20 public HEC = IERC20(0x5C4FDfc5233f935f20D2aDbA572F770c2E377Ab0);
    address public immutable treasury;
    
    uint public immutable epochLength;
    uint public nextEpochBlock;
    
    address public immutable oldStaking;
    address public immutable sHecOld;
    
    address public newStaking;
    address public sHecNew;
    
    uint public rate;//5900=0.59%
    uint public favouriteForNew;//1000=0.1%
    
    struct Adjust {
        bool add;
        uint rate;
        uint target;
    }
    
    Adjust public adjustment;
    
    event RewardsDistributed( address indexed caller, address indexed recipient, uint amount );



    constructor( address _treasury, uint _epochLength, uint _nextEpochBlock, address _oldStaking, address _sHecOld, address _newStaking, address _sHecNew ) {
        require( _treasury != address(0) );
        treasury = _treasury;
        require( _oldStaking != address(0) );
        oldStaking = _oldStaking;
        require( _sHecOld != address(0) );
        sHecOld = _sHecOld;
        require( _newStaking != address(0) );
        newStaking = _newStaking;
        require( _sHecNew != address(0) );
        sHecNew = _sHecNew;
        epochLength = _epochLength;
        nextEpochBlock = _nextEpochBlock;
        favouriteForNew = 0;
    }

     /* ====== PUBLIC FUNCTIONS ====== */
    
    /**
        @notice send epoch reward to staking contract
     */
    function distribute() external returns ( bool ) {
        if ( nextEpochBlock <= block.number ) {
            nextEpochBlock = nextEpochBlock.add( epochLength ); // set next epoch block
            
            if(rate==0)return false;
            uint reward = nextRewardAt(rate);
            uint oldReward = split(reward,ISHEC(sHecOld).circulatingSupply(),ISHEC(sHecNew).circulatingSupply(),favouriteForNew);
            uint newReward = reward.sub(oldReward);
            if(oldReward>0){
                distributeRewards(oldStaking, oldReward);
            }
            if(newReward>0){
                distributeRewards(newStaking, newReward);
            }
            adjust();
            return true;
        } else { 
            return false; 
        }
    }

    /* ====== INTERNAL FUNCTIONS ====== */

    /**
        @notice increment reward rate for collector
     */
    function adjust( ) internal {
        if ( adjustment.rate != 0 ) {
            if ( adjustment.add ) { // if rate should increase
                rate = rate.add( adjustment.rate ); // raise rate
                if ( rate >= adjustment.target ) { // if target met
                    adjustment.rate = 0; // turn off adjustment
                }
            } else { // if rate should decrease
                rate = rate.sub( adjustment.rate ); // lower rate
                if ( rate <= adjustment.target ) { // if target met
                    adjustment.rate = 0; // turn off adjustment
                }
            }
        }
    }

    /**
        @notice send epoch reward to staking contract
     */
    function distributeRewards( address _recipient, uint _amount ) internal {
        require( _amount <= excessReserves(), "Insufficient reserves" );

        IERC20( HEC ).safeTransfer( _recipient, _amount );

        emit RewardsDistributed( msg.sender, _recipient, _amount );
    } 

   /* ====== VIEW FUNCTIONS ====== */
    
    function split( uint reward, uint supply1, uint supply2, uint favouriteFor2 ) public pure returns ( uint _reward1 ) {
        if(reward==0){
            return 0;
        }else{
            uint total=supply1.add(supply2);
            uint percent1=supply1.mul(1000000).div(total);
            if(favouriteFor2<percent1)percent1=percent1.sub(favouriteFor2);
            else percent1=0;
            uint reward1=reward.mul(percent1).div(1000000);
            //if(supply1>0&&reward1<1)reward1=1;
            //uint reward1=reward.mul(supply1).div(total);
            return reward1;
        }
    }

    /**
        @notice view function for next reward at given rate
        @param _rate uint
        @return uint
     */
    function nextRewardAt( uint _rate ) public view returns ( uint ) {
        return IERC20( HEC ).totalSupply().mul( _rate ).div( 1000000 );
    }

    /**
        @notice view function for next reward for specified address
        @param _recipient address
        @return uint
     */
    function nextRewardFor( address _recipient ) public view returns ( uint ) {
        uint reward;
        if(_recipient!=newStaking&&_recipient!=oldStaking){
            return 0;
        }else{
            reward = nextRewardAt(rate);
            uint oldReward = split(reward,ISHEC(sHecOld).circulatingSupply(),ISHEC(sHecNew).circulatingSupply(),favouriteForNew);
            uint newReward = reward.sub(oldReward);
            if(_recipient==newStaking){
                return newReward;
            }else{
                return oldReward;
            }
        }
    }

    
    /* ====== POLICY FUNCTIONS ====== */

    function setHec(address _hec) external onlyOwner(){
        require(_hec!=address(0));
        HEC = IERC20(_hec);
    }

    function setRate( uint _rewardRate ) external onlyOwner() {
        rate=_rewardRate;
    }
    
    function setFavouriteForNew( uint _favouriteForNew ) external onlyOwner() {
        require(_favouriteForNew<=50000,"the addtional absolute percentage of reward for new staking can't >5%");
        favouriteForNew=_favouriteForNew;
    }
    
    function setNewStaking(address _newStaking, address _sHecNew) external onlyOwner() {
        require( _newStaking != address(0) );
        newStaking = _newStaking;
        require( _sHecNew != address(0) );
        sHecNew = _sHecNew;
    }

    /**
        @notice set adjustment info for a collector's reward rate
        @param _add bool
        @param _rate uint
        @param _target uint
     */

    function setAdjustment( bool _add, uint _rate, uint _target ) external onlyOwner() {
        adjustment = Adjust({
            add: _add,
            rate: _rate,
            target: _target
        });
    }

}
