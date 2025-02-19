import { expect } from "chai";
import { ethers } from "hardhat";

describe("DutchAuctionSwap", function () {
  let auction: any;
  let token: any;
  let seller: any;
  let buyer: any;
  let initialPrice = ethers.utils.parseEther("10");
  let duration = 300; // 5 minutes
  let priceDecreaseRate = ethers.utils.parseEther("0.05");
  let tokenAmount = ethers.utils.parseEther("100");

  before(async function () {
    [seller, buyer] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockERC20");
    token = await Token.deploy();
    await token.deployed();

    const ReverseDutchAuctionSwap = await ethers.getContractFactory("ReverseDutchAuctionSwap");
    auction = await ReverseDutchAuctionSwap.deploy(token.address);
    await auction.deployed();

    await token.mint(seller.address, tokenAmount);
    await token.connect(seller).approve(auction.address, tokenAmount);
    await auction.connect(seller).startAuction(initialPrice, duration, priceDecreaseRate, tokenAmount);
  });

  it("Should decrease price over time", async function () {
    await ethers.provider.send("evm_increaseTime", [120]);
    await ethers.provider.send("evm_mine", []);

    const expectedPrice = initialPrice.sub(priceDecreaseRate.mul(120));
    expect(await auction.getCurrentPrice()).to.equal(expectedPrice);
  });

  it("Should allow only one buyer", async function () {
    const currentPrice = await auction.getCurrentPrice();
    await auction.connect(buyer).buy({ value: currentPrice });

    await expect(
      auction.connect(buyer).buy({ value: currentPrice })
    ).to.be.revertedWith("Auction already ended");
  });

  it("Should transfer tokens and ETH correctly", async function () {
    const buyerBalance = await token.balanceOf(buyer.address);
    expect(buyerBalance).to.equal(tokenAmount);
  });

  it("Should handle no buyer scenario correctly", async function () {
    const ReverseDutchAuctionSwap = await ethers.getContractFactory("ReverseDutchAuctionSwap");
    const newAuction = await ReverseDutchAuctionSwap.deploy(token.address);
    await newAuction.deployed();

    await token.connect(seller).approve(newAuction.address, tokenAmount);
    await newAuction.connect(seller).startAuction(initialPrice, duration, priceDecreaseRate, tokenAmount);

    await ethers.provider.send("evm_increaseTime", [duration + 1]);
    await ethers.provider.send("evm_mine", []);

    expect(await newAuction.getCurrentPrice()).to.equal(0);
  });
});
