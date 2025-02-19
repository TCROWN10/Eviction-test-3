// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DutchAuctionSwap {
    IERC20 public immutable token;
    address public seller;
    uint256 public initialPrice;
    uint256 public startTime;
    uint256 public duration;
    uint256 public priceDecreaseRate;
    bool public auctionEnded;
    address public buyer;
    uint256 public tokenAmount;

    event AuctionStarted(address indexed seller, uint256 initialPrice, uint256 duration, uint256 priceDecreaseRate);
    event SwapExecuted(address indexed buyer, uint256 finalPrice);

    constructor(address _token) {
        require(_token != address(0), "Invalid token address");
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
        require(_initialPrice > 0, "Initial price must be greater than zero");
        require(_priceDecreaseRate > 0, "Price decrease rate must be greater than zero");

        seller = msg.sender;
        initialPrice = _initialPrice;
        duration = _duration;
        priceDecreaseRate = _priceDecreaseRate;
        startTime = block.timestamp;
        tokenAmount = _tokenAmount;

        require(token.transferFrom(msg.sender, address(this), _tokenAmount), "Token transfer failed");

        emit AuctionStarted(msg.sender, _initialPrice, _duration, _priceDecreaseRate);
    }

    function getCurrentPrice() public view returns (uint256) {
        if (auctionEnded || block.timestamp >= startTime + duration) {
            return 0; // Auction ends at 0 price if no one buys.
        }

        uint256 timeElapsed = block.timestamp - startTime;
        uint256 priceDrop = timeElapsed * priceDecreaseRate;

        return initialPrice > priceDrop ? initialPrice - priceDrop : 0;
    }

    function buy() external payable {
        require(!auctionEnded, "Auction already ended");
        require(seller != address(0), "Auction not started");

        uint256 currentPrice = getCurrentPrice();
        require(currentPrice > 0, "Auction price reached zero");
        require(msg.value >= currentPrice, "Insufficient ETH sent");

        auctionEnded = true;
        buyer = msg.sender;

        // Send ETH to seller
        (bool success, ) = payable(seller).call{value: msg.value}("");
        require(success, "ETH transfer to seller failed");

        // Transfer auctioned tokens to buyer
        require(token.transfer(msg.sender, tokenAmount), "Token transfer failed");

        emit SwapExecuted(msg.sender, currentPrice);
    }
}