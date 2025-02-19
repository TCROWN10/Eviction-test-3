// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DutchAuctionSwap {
    IERC20 public token;
    address public seller;
    uint256 public initialPrice;
    uint256 public startTime;
    uint256 public duration;
    uint256 public priceDecreaseRate;
    bool public auctionEnded;
    address public buyer;

    event AuctionStarted(address indexed seller, uint256 initialPrice, uint256 duration, uint256 priceDecreaseRate);
    event SwapExecuted(address indexed buyer, uint256 finalPrice);

    constructor(address _token) {
        token = IERC20(_token);
    }

    function startAuction(
        uint256 _initialPrice,
        uint256 _duration,
        uint256 _priceDecreaseRate,
        uint256 _tokenAmount
    ) external {
        require(seller == address(0), "Auction already started");
        require(_duration > 0, "Duration must be greater than zero");
        require(_tokenAmount > 0, "Token amount must be greater than zero");

        seller = msg.sender;
        initialPrice = _initialPrice;
        duration = _duration;
        priceDecreaseRate = _priceDecreaseRate;
        startTime = block.timestamp;

        require(token.transferFrom(msg.sender, address(this), _tokenAmount), "Token transfer failed");

        emit AuctionStarted(msg.sender, _initialPrice, _duration, _priceDecreaseRate);
    }

    function getCurrentPrice() public view returns (uint256) {
        if (block.timestamp >= startTime + duration) {
            return 0; // Auction ends at 0 price if no one buys.
        }
        uint256 timeElapsed = block.timestamp - startTime;
        return initialPrice > (timeElapsed * priceDecreaseRate) ? (initialPrice - (timeElapsed * priceDecreaseRate)) : 0;
    }

    function buy() external payable {
        require(!auctionEnded, "Auction already ended");
        require(seller != address(0), "Auction not started");

        uint256 currentPrice = getCurrentPrice();
        require(msg.value >= currentPrice, "Insufficient ETH sent");

        auctionEnded = true;
        buyer = msg.sender;

        payable(seller).transfer(msg.value);
        require(token.transfer(msg.sender, token.balanceOf(address(this))), "Token transfer failed");

        emit SwapExecuted(msg.sender, currentPrice);
    }
}
