// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.7;

interface IOwnable {
  function policy() external view returns (address);

  function renounceManagement() external;
  
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
        emit OwnershipPushed( address(0), _owner );
    }

    function policy() public view override returns (address) {
        return _owner;
    }

    modifier onlyPolicy() {
        require( _owner == msg.sender, "Ownable: caller is not the owner" );
        _;
    }

    function renounceManagement() public virtual override onlyPolicy() {
        emit OwnershipPushed( _owner, address(0) );
        _owner = address(0);
    }

    function pushManagement( address newOwner_ ) public virtual override onlyPolicy() {
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

interface IUniswapPairOracle {
    function consult(address token, uint256 amountIn) external view returns (uint256 amountOut);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

contract BondPricing is Ownable {

    /* ======== STATE VARIABLES ======== */

    Oracle[] public oracles; // uniswap twap oracle
    uint constant NOT_FOUND = 99999;

    event AddOracleEvent(address _oracle, address _token0, address _token1 );
    event UpdateOracleEvent(address oldOracle, address newOracle );
    event DeleteOracleEvent(address currentToken0, address currentToken1 );

    struct Oracle {
        address oracleAddress; // address of oracle contract
        address token0; // oracle's first token
        address token1; // oracle's second token
    }

     /* ======== POLICY FUNCTIONS ======== */

    /**
     *  @notice create new Oracle
     *  @param _oracle address
     *  @param _token0 address
     *  @param _token1 address
     */
    function addOracle ( address _oracle, address _token0, address _token1 ) external onlyPolicy() {
        require( _oracle != address(0) );
        require( _token0 != address(0) );
        require( _token1 != address(0) );

        require(_oracleExists(_token0, _token1) == NOT_FOUND, "Oracle with this pair already exists.");

        Oracle memory o = Oracle ({
            oracleAddress: _oracle,
            token0: _token0,
            token1: _token1
        });

        oracles.push(o);  
        emit AddOracleEvent(_oracle, _token0, _token1);
    }

    /**
     *  @notice Update oracle address
     *  @param newOracleAddress address
     *  @param currentToken0 address
     *  @param currentToken1 address
     */
    function updateOracle ( address newOracleAddress, address currentToken0, address currentToken1 ) external onlyPolicy() {
        require( newOracleAddress != address(0) );
        require( currentToken0 != address(0) );
        require( currentToken1 != address(0) );

        uint index = _oracleExists(currentToken0, currentToken1);
        require(index != NOT_FOUND, "Oracle does not exist");

        address oldOracle = oracles[index].oracleAddress;
        //updating 
        oracles[index].oracleAddress = newOracleAddress;

        emit UpdateOracleEvent(oldOracle, newOracleAddress);
    }

    /**
     *  @notice Delete existing Oracle
     *  @param _token0 address
     *  @param _token1 address
     */
    function deleteOracle ( address _token0, address _token1 ) external onlyPolicy() {
        require( _token0 != address(0) );
        require( _token1 != address(0) );

        uint index = _oracleExists(_token0, _token1);
        require(index != NOT_FOUND, "Oracle does not exist");

        _deleteOracle(index);

        emit DeleteOracleEvent(_token0, _token1);
    }

    /* ======== USER FUNCTIONS ======== */

     /**
     *  @notice Find existing oracle from token pair
     *  @param _token0 address
     *  @param _token1 address
     *  @return address
     */
    function findOracle(address _token0, address _token1) external view returns ( address ) {
        address _oracle = address(0);

        uint index = _oracleExists(_token0, _token1);
        
        if (index != NOT_FOUND) {
            _oracle = oracles[index].oracleAddress;
        }

        return _oracle;
    }

    function oracleExists(address _token0, address _token1) view external returns (uint index) {
        index = _oracleExists(_token0, _token1);
    }

    function _oracleExists(address _token0, address _token1) view internal returns (uint index) {
        index = NOT_FOUND ;

        for (uint i = 0; i < oracles.length; i++) {
            Oracle memory oracle = oracles[i];
            if (oracle.token0 == _token0 && oracle.token1 == _token1) {
                index = i;
                break;
            }
            
        }
    }

    function _deleteOracle(uint index) internal {
        require(index < oracles.length);
        oracles[index] = oracles[oracles.length-1];
        oracles.pop();
    }
}
