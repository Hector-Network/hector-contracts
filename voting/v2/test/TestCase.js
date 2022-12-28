const { expect } = require("chai");
const { ethers } = require("hardhat");

const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("Test case of the HecBridgeSplitter contract \n", function () {
  async function deployOneYearLockFixture() {
    const [owner] = await ethers.getSigners();

    console.log("Deploying contracts with the accounts:", owner.address);
    console.log("Account balance:", (await owner.getBalance()).toString());

    const gas = await ethers.provider.getGasPrice();
    console.log("Gas Price:", ethers.utils.formatEther(gas));

    const hecBridgeSplitterContract = await ethers.getContractFactory("HecBridgeSplitter");

    const HecBridgeSplitter = await hecBridgeSplitterContract.deploy();

    console.log("HecBridgeSplitter contract deployed to:", HecBridgeSplitter.address);

    const _countDest = 2; // Count of the destination wallets, default: 2
    const _bridge = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE";

    // console.log("Initializing HecBridgeSplitter");
    // await hecBridgeSplitterContract.initialize(_countDest, _bridge);

    return { HecBridgeSplitter, owner };
  }

  describe("Goerli network", function () {
    it("Use eth to splitter in multichain on the goerli network", async function () {
      const { HecBridgeSplitter, owner } = await loadFixture(deployOneYearLockFixture);
     
    });
  });
});
