const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DutchAuctionSwap", function () {
  let deployer, buyer, mockToken, auction;

  beforeEach(async function () {
    // Get signers
    [deployer, buyer] = await ethers.getSigners();

    // Deploy MockERC20 Token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Mock Token", "MCK", ethers.parseEther("100"));
    await mockToken.waitForDeployment();

    // Deploy DutchAuctionSwap
    const DutchAuctionSwap = await ethers.getContractFactory("DutchAuctionSwap");
    auction = await DutchAuctionSwap.deploy(await mockToken.getAddress());
    await auction.waitForDeployment();
  });

  it("Should deploy contracts successfully", async function () {
    expect(await mockToken.getAddress()).to.be.properAddress;
    expect(await auction.getAddress()).to.be.properAddress;
  });

  it("Should start the auction correctly", async function () {
    const tokensForSale = ethers.parseEther("10");
    const initialPrice = ethers.parseEther("0.01");
    const duration = 3600;
    const priceDecreaseRate = ethers.parseEther("0.000001");

    // Approve auction contract to spend deployer's tokens
    await mockToken.approve(await auction.getAddress(), tokensForSale);

    // Start auction
    await expect(
      auction.startAuction(initialPrice, duration, priceDecreaseRate, tokensForSale)
    ).to.emit(auction, "AuctionStarted");

    expect(await auction.seller()).to.equal(deployer.address);
    expect(await mockToken.balanceOf(await auction.getAddress())).to.equal(tokensForSale);
  });

  it("Should allow buyer to purchase tokens", async function () {
    const tokensForSale = ethers.parseEther("10");
    const initialPrice = ethers.parseEther("0.01");
    const duration = 3600;
    const priceDecreaseRate = ethers.parseEther("0.000001");

    // Approve and start auction
    await mockToken.approve(await auction.getAddress(), tokensForSale);
    await auction.startAuction(initialPrice, duration, priceDecreaseRate, tokensForSale);

    // Simulate time passing for price drop
    await ethers.provider.send("evm_increaseTime", [600]); // Fast-forward 10 minutes
    await ethers.provider.send("evm_mine");

    // Get updated price
    const newPrice = await auction.getCurrentPrice();

    // Buyer purchases tokens
    await expect(auction.connect(buyer).buy({ value: newPrice })).to.emit(auction, "SwapExecuted");

    // Check balances
    expect(await mockToken.balanceOf(buyer.address)).to.equal(tokensForSale);
    expect(await auction.auctionEnded()).to.equal(true);
  });
});
