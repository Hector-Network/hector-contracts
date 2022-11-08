// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import './interfaces/IUniswapV2Pair.sol';
import './interfaces/IUniswapV2Router02.sol';
import './interfaces/IWETH.sol';

contract HectorZap is Ownable {
    using SafeERC20 for IERC20;

    /* ========== CONSTANT VARIABLES ========== */

    address public immutable HEC;
    address public immutable USDC;
    address public immutable TOR;
    address public immutable WFTM;

    IUniswapV2Router02 public immutable ROUTER;

    /* ========== STATE VARIABLES ========== */

    mapping(address => bool) private notLP;
    mapping(address => address) private routePairAddresses;
    address[] public tokens;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _hec,
        address _usdc,
        address _tor,
        address _wftm,
        address _router
    ) {
        HEC = _hec;
        USDC = _usdc;
        TOR = _tor;
        WFTM = _wftm;
        ROUTER = IUniswapV2Router02(_router);

        _setNotLP(WFTM);
        _setNotLP(USDC);
        _setNotLP(HEC);
        _setNotLP(TOR);
    }

    receive() external payable {}

    /* ========== View Functions ========== */

    function isLP(address _address) public view returns (bool) {
        return !notLP[_address];
    }

    function routePair(address _address) external view returns (address) {
        return routePairAddresses[_address];
    }

    /* ========== External Functions ========== */

    function zapInToken(
        address _from,
        uint256 amount,
        address _to
    ) external {
        IERC20(_from).safeTransferFrom(msg.sender, address(this), amount);
        _approveTokenIfNeeded(_from);

        if (isLP(_to)) {
            IUniswapV2Pair pair = IUniswapV2Pair(_to);
            address token0 = pair.token0();
            address token1 = pair.token1();
            if (_from == token0 || _from == token1) {
                // swap half amount for other
                address other = _from == token0 ? token1 : token0;
                _approveTokenIfNeeded(other);
                uint256 sellAmount = amount / 2;
                uint256 otherAmount = _swap(
                    _from,
                    sellAmount,
                    other,
                    address(this)
                );
                ROUTER.addLiquidity(
                    _from,
                    other,
                    amount - sellAmount,
                    otherAmount,
                    0,
                    0,
                    msg.sender,
                    block.timestamp
                );
            } else {
                uint256 ftmAmount = _swapTokenForFTM(
                    _from,
                    amount,
                    address(this)
                );
                _swapFTMToLP(_to, ftmAmount, msg.sender);
            }
        } else {
            _swap(_from, amount, _to, msg.sender);
        }
    }

    function zapIn(address _to) external payable {
        _swapFTMToLP(_to, msg.value, msg.sender);
    }

    function zapOut(address _from, uint256 amount) external {
        IERC20(_from).safeTransferFrom(msg.sender, address(this), amount);
        _approveTokenIfNeeded(_from);

        if (!isLP(_from)) {
            _swapTokenForFTM(_from, amount, msg.sender);
        } else {
            IUniswapV2Pair pair = IUniswapV2Pair(_from);
            address token0 = pair.token0();
            address token1 = pair.token1();
            if (token0 == WFTM || token1 == WFTM) {
                ROUTER.removeLiquidityETH(
                    token0 != WFTM ? token0 : token1,
                    amount,
                    0,
                    0,
                    msg.sender,
                    block.timestamp
                );
            } else {
                ROUTER.removeLiquidity(
                    token0,
                    token1,
                    amount,
                    0,
                    0,
                    msg.sender,
                    block.timestamp
                );
            }
        }
    }

    /* ========== Private Functions ========== */

    function _approveTokenIfNeeded(address token) private {
        if (IERC20(token).allowance(address(this), address(ROUTER)) == 0) {
            IERC20(token).safeApprove(address(ROUTER), 2**256 - 1);
        }
    }

    function _swapFTMToLP(
        address lp,
        uint256 amount,
        address receiver
    ) private {
        if (!isLP(lp)) {
            _swapFTMForToken(lp, amount, receiver);
        } else {
            // lp
            IUniswapV2Pair pair = IUniswapV2Pair(lp);
            address token0 = pair.token0();
            address token1 = pair.token1();
            if (token0 == WFTM || token1 == WFTM) {
                address token = token0 == WFTM ? token1 : token0;
                uint256 swapValue = amount / 2;
                uint256 tokenAmount = _swapFTMForToken(
                    token,
                    swapValue,
                    address(this)
                );

                _approveTokenIfNeeded(token);
                ROUTER.addLiquidityETH{value: amount - swapValue}(
                    token,
                    tokenAmount,
                    0,
                    0,
                    receiver,
                    block.timestamp
                );
            } else {
                uint256 swapValue = amount / 2;
                uint256 token0Amount = _swapFTMForToken(
                    token0,
                    swapValue,
                    address(this)
                );
                uint256 token1Amount = _swapFTMForToken(
                    token1,
                    amount - swapValue,
                    address(this)
                );

                _approveTokenIfNeeded(token0);
                _approveTokenIfNeeded(token1);
                ROUTER.addLiquidity(
                    token0,
                    token1,
                    token0Amount,
                    token1Amount,
                    0,
                    0,
                    receiver,
                    block.timestamp
                );
            }
        }
    }

    function _swapFTMForToken(
        address token,
        uint256 value,
        address receiver
    ) private returns (uint256) {
        address[] memory path;

        if (routePairAddresses[token] != address(0)) {
            path = new address[](3);
            path[0] = WFTM;
            path[1] = routePairAddresses[token];
            path[2] = token;
        } else {
            path = new address[](2);
            path[0] = WFTM;
            path[1] = token;
        }

        uint256[] memory amounts = ROUTER.swapExactETHForTokens{value: value}(
            0,
            path,
            receiver,
            block.timestamp
        );
        return amounts[amounts.length - 1];
    }

    function _swapTokenForFTM(
        address token,
        uint256 amount,
        address receiver
    ) private returns (uint256) {
        address[] memory path;
        if (routePairAddresses[token] != address(0)) {
            path = new address[](3);
            path[0] = token;
            path[1] = routePairAddresses[token];
            path[2] = WFTM;
        } else {
            path = new address[](2);
            path[0] = token;
            path[1] = WFTM;
        }

        uint256[] memory amounts = ROUTER.swapExactTokensForETH(
            amount,
            0,
            path,
            receiver,
            block.timestamp
        );
        return amounts[amounts.length - 1];
    }

    function _swap(
        address _from,
        uint256 amount,
        address _to,
        address receiver
    ) private returns (uint256) {
        address intermediate = routePairAddresses[_from];
        if (intermediate == address(0)) {
            intermediate = routePairAddresses[_to];
        }

        address[] memory path;
        if (intermediate != address(0) && (_from == WFTM || _to == WFTM)) {
            // [WFTM, BUSD, VAI] or [VAI, BUSD, WFTM]
            path = new address[](3);
            path[0] = _from;
            path[1] = intermediate;
            path[2] = _to;
        } else if (
            intermediate != address(0) &&
            (_from == intermediate || _to == intermediate)
        ) {
            // [VAI, BUSD] or [BUSD, VAI]
            path = new address[](2);
            path[0] = _from;
            path[1] = _to;
        } else if (
            intermediate != address(0) &&
            routePairAddresses[_from] == routePairAddresses[_to]
        ) {
            // [VAI, TOR] or [VAI, USDC]
            path = new address[](3);
            path[0] = _from;
            path[1] = intermediate;
            path[2] = _to;
        } else if (
            routePairAddresses[_from] != address(0) &&
            routePairAddresses[_to] != address(0) &&
            routePairAddresses[_from] != routePairAddresses[_to]
        ) {
            // routePairAddresses[xToken] = xRoute
            // [VAI, BUSD, WFTM, xRoute, xToken]
            path = new address[](5);
            path[0] = _from;
            path[1] = routePairAddresses[_from];
            path[2] = WFTM;
            path[3] = routePairAddresses[_to];
            path[4] = _to;
        } else if (
            intermediate != address(0) &&
            routePairAddresses[_from] != address(0)
        ) {
            // [VAI, BUSD, WFTM, BUNNY]
            path = new address[](4);
            path[0] = _from;
            path[1] = intermediate;
            path[2] = WFTM;
            path[3] = _to;
        } else if (
            intermediate != address(0) && routePairAddresses[_to] != address(0)
        ) {
            // [BUNNY, WFTM, BUSD, VAI]
            path = new address[](4);
            path[0] = _from;
            path[1] = WFTM;
            path[2] = intermediate;
            path[3] = _to;
        } else if (_from == WFTM || _to == WFTM) {
            // [WFTM, BUNNY] or [BUNNY, WFTM]
            path = new address[](2);
            path[0] = _from;
            path[1] = _to;
        } else {
            // [USDC, BUNNY] or [BUNNY, USDC]
            path = new address[](3);
            path[0] = _from;
            path[1] = WFTM;
            path[2] = _to;
        }

        uint256[] memory amounts = ROUTER.swapExactTokensForTokens(
            amount,
            0,
            path,
            receiver,
            block.timestamp
        );
        return amounts[amounts.length - 1];
    }

    function _setNotLP(address token) internal {
        bool needPush = notLP[token] == false;
        notLP[token] = true;
        if (needPush) {
            tokens.push(token);
        }
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function setRoutePairAddress(address asset, address route)
        external
        onlyOwner
    {
        routePairAddresses[asset] = route;
    }

    function setNotLP(address token) public onlyOwner {
        _setNotLP(token);
    }

    function removeToken(uint256 i) external onlyOwner {
        address token = tokens[i];
        notLP[token] = false;
        tokens[i] = tokens[tokens.length - 1];
        tokens.pop();
    }

    function sweep() external onlyOwner {
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            if (token == address(0)) continue;
            uint256 amount = IERC20(token).balanceOf(address(this));
            if (amount > 0) {
                if (token == WFTM) {
                    IWETH(token).withdraw(amount);
                } else {
                    _swapTokenForFTM(token, amount, owner());
                }
            }
        }

        uint256 balance = address(this).balance;
        if (balance > 0) {
            payable(owner()).transfer(balance);
        }
    }

    function withdraw(address token) external onlyOwner {
        if (token == address(0)) {
            payable(owner()).transfer(address(this).balance);
            return;
        }

        IERC20(token).transfer(owner(), IERC20(token).balanceOf(address(this)));
    }
}
