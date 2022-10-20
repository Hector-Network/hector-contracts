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

    struct Oracle {
        address oracleAddress; // address of oracle contract
        string chain; // 
        address token0; // oracle's first token
        address token1; // oracle's second token
    }

     /* ======== POLICY FUNCTIONS ======== */

    /**
     *  @notice create new Oracle
     *  @param _oracle address
     *  @param _chain string
     *  @param _token0 address
     *  @param _token1 address
     */
    function addOracle ( address _oracle, string memory _chain, address _token0, address _token1 ) external onlyPolicy() {
        require( _oracle != address(0) );
        require( _token0 != address(0) );
        require( _token1 != address(0) );

        IUniswapPairOracle oracle = IUniswapPairOracle( _oracle );
        require( oracle.token0() == _token0, "Invalid token0");
        require( oracle.token1() == _token1, "Invalid token1");

        Oracle memory o = Oracle ({
            oracleAddress: _oracle,
            chain: _chain,
            token0: _token0,
            token1: _token1
        });

        oracles.push(o);  
    }

    /* ======== USER FUNCTIONS ======== */

     /**
     *  @notice Find existing oracle
     *  @param _token0 address
     *  @param _token1 address
     *  @return address
     */
    function findOracle(address _token0, address _token1) external view returns ( address ) {
        address _oracle = address(0);

        for (uint i = 0; i < oracles.length; i++) {
            Oracle memory o = oracles[i];
            IUniswapPairOracle oracle = IUniswapPairOracle( o.oracleAddress );

            if (oracle.token0() == _token0 && oracle.token1() == _token1) {
                _oracle = o.oracleAddress;
                break;
            }
        }
        return _oracle;
    }
}
