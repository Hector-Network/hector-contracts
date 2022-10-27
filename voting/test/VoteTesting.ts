import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { expect } from "chai";
import { FNFT, LockFarm, VotingFarm, IERC20, IERC20__factory, LockFarm__factory, FNFT__factory } from "../types";
import { deployVotingFarm } from "../helper";

describe("VotingFarm Test", async () => {
  let deployer: SignerWithAddress; // owner
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let fnft1: FNFT;
  let fnft2: FNFT;
  let farm1: LockFarm;
  let farm2: LockFarm;

  let hec: IERC20;
  let votingFarm: VotingFarm;

  let _hec = "0x55639b1833Ddc160c18cA60f5d0eC9286201f525";

  let _farm1 = "0x6Bd2b014547d7e1b05fDe0CB62c8717216c6E9ec";
  let _fnft1 = "0x669CD4d138669740D8c5a4417B6a7599bfe5434A";

  let _farm2 = "0x6Bd2b014547d7e1b05fDe0CB62c8717216c6E9ec";
  let _fnft2 = "0x669CD4d138669740D8c5a4417B6a7599bfe5434A";

  let _fakeFarm = "0x55639b1833Ddc160c18cA60f5d0eC9286201f525";

  let votingFarmsData = [_farm1];
  let votingWeightsData = ["100"];

  let votingFakeFarmsData = [_fakeFarm];
  let votingFakeFarmsData1 = [_farm1, _farm2, _fakeFarm];
  let votingFakeWeightsData = ["101"];
  let votingFakeWeightsData1 = ["30", "70", "10"];

  before(async () => {
    const signers: SignerWithAddress[] = await ethers.getSigners();

    deployer = signers[0];
    alice = signers[1];
    bob = signers[2];

    // FNFT1
    fnft1 = FNFT__factory.connect(_fnft1, deployer);
    console.log("FNFT: ", fnft1.address);

    // HEC
    hec = IERC20__factory.connect(_hec, deployer);
    console.log("HEC: ", hec.address);

    // Farm1
    farm1 = LockFarm__factory.connect(_farm1, deployer);
    console.log("Farm1: ", farm1.address);

    // Farm2
    farm2 = LockFarm__factory.connect(_farm2, deployer);
    console.log("Farm2: ", farm2.address);

    // VotingFarm
    votingFarm = await deployVotingFarm(_hec);
    console.log("VotingFarm: ", votingFarm.address);

    console.log("Deployer: ", deployer.address);
    console.log("Alice: ", alice.address);

    await votingFarm.connect(deployer).addLockFarmForOwner(farm1.address, _fnft1);
    await votingFarm.connect(deployer).setMaxPercentageFarm(200);
  });

  describe("#1: AddLockFarmForOwner", async () => {
    it("Should set the right owner", async function () {
      await expect(votingFarm.connect(alice).addLockFarmForOwner(farm1.address, _fnft1)).to.be.revertedWith("!admin");
    });

    it("Should set the non-existed farm", async function () {
      await expect(votingFarm.connect(deployer).addLockFarmForOwner(farm1.address, _fnft1)).to.be.revertedWith("Already existed farm");
    });
  });

  describe("#2: Vote", async () => {
    it("Failed - inputted weights total percentage is not 100%", async function () {
      await expect(votingFarm.connect(deployer).vote(votingFarmsData, votingFakeWeightsData)).to.be.revertedWith("Weights total percentage is not 100%");
    });

    it("Failed - inputted one of weights exceeded max limit", async function () {
      await votingFarm.connect(deployer).setMaxPercentageFarm(30);
      await expect(votingFarm.connect(deployer).vote(votingFarmsData, votingWeightsData)).to.be.revertedWith("One of Weights exceeded max limit");
      await votingFarm.connect(deployer).setMaxPercentageFarm(200);
    });

    it("Failed - inputted farms and weights length size are difference", async function () {
      await expect(votingFarm.connect(deployer).vote(votingFakeFarmsData1, votingWeightsData)).to.be.revertedWith("Farms and Weights length size are difference");
    });

    it("Failed - inputted invalid farms", async function () {
      await expect(votingFarm.connect(deployer).vote(votingFakeFarmsData, votingWeightsData)).to.be.revertedWith("Invalid Farms");
    });

    it("Failed - can't vote in voting delay duration", async function () {
      await votingFarm.connect(deployer).vote(votingFarmsData, votingWeightsData);
      await expect(votingFarm.connect(deployer).vote(votingFarmsData, votingWeightsData)).to.be.revertedWith("You voted in the last 7 days");
    });
  });

  describe("#3: setConfiguration", async () => {
    it("Failed - only admin can set configuration", async function () {
      await expect(votingFarm.connect(alice).setConfiguration(hec.address)).to.be.revertedWith("!admin");
    });

    it("Compare - configurations after set", async function () {
      const thec = hec.address;
      await votingFarm.connect(deployer).setConfiguration(hec.address);

      expect(thec).to.equal(await votingFarm.connect(deployer).HEC());
    });
  });

  describe("#4: setMaxPercentageFarm", async () => {
    it("Failed - only admin can set max percentage of the farms", async function () {
      await expect(votingFarm.connect(alice).setMaxPercentageFarm("60")).to.be.revertedWith("!admin");
    });

    it("Compare - max percentage after set", async function () {
      const maxPercentage = 60;
      await votingFarm.connect(deployer).setMaxPercentageFarm(maxPercentage);
      const maxPercentage1 = await votingFarm.connect(deployer).maxPercentage();
      expect(maxPercentage).to.equal(maxPercentage1);
    });
  });

  describe("#5: setVoteDelay", async () => {
    it("Failed - only admin can set vote delay time", async function () {
      const voteDelay = 60;
      await expect(votingFarm.connect(alice).setVoteDelay(voteDelay)).to.be.revertedWith("!admin");
    });

    it("Compare - vote delay time after set", async function () {
      const voteDelay = 60;
      await votingFarm.connect(deployer).setVoteDelay(voteDelay);
      const voteDelay1 = await votingFarm.connect(deployer).voteDelay();
      expect(voteDelay).to.equal(voteDelay1);
    });
  });

  describe("#6: setAdmin", async () => {
    it("Failed - only admin can change admin", async function () {
      await expect(votingFarm.connect(alice).setAdmin(alice.address)).to.be.revertedWith("!admin");
    });

    it("Compare - admin after set", async function () {
      await votingFarm.connect(deployer).setAdmin(alice.address);
      expect(alice.address).to.equal(await votingFarm.connect(alice).admin());
    });
  });
});
