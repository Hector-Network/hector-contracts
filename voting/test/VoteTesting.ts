import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { expect } from "chai";
import { FNFT, LockFarm, Voting, IERC20, IERC20__factory, LockFarm__factory, FNFT__factory } from "../types";
import { deployVoting } from "../helper";

describe("Voting Test", async () => {
  let deployer: SignerWithAddress; // owner
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let fnft: FNFT;
  let fnft2: FNFT;
  let farm1: LockFarm;
  let farm2: LockFarm;

  let hec: IERC20;
  let Voting: Voting;

  let _hec = '0x55639b1833Ddc160c18cA60f5d0eC9286201f525';
	let _sHec = '0x71264c23604fa78D1eFcc32af1c73714F33dCdb4';
	let _wsHec = '0x6225eeA79a0baF0c7e368Db4de1e8066589815B1';
	let _usdc = '0x6f3da9C6700cAfBAb0323cF344F58C54B3ddB66b';
	let _spookySwapFactory = '0xEE4bC42157cf65291Ba2FE839AE127e3Cc76f741';
	let _spookySwapRotuer = '0xa6AD18C2aC47803E193F75c3677b14BF19B94883';
	let _lockAddressRegistry = '0x2D86a40Ff217493cCE3a23627F6A749dAe1f9018';
	let _tokenVault = '0x4b7dC9E2Cc8B97Fe6073d03667Aed96c071c532B';
  let NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

  let _fnft = "0x7b88137d10394537F1EEa6cEd3ec4f778EEfAAc3";

  let _farm1 = "0xC464e6d45004Bf56772E70e22d9cF61C5Ae63970";
  let _farm2 = "0x55869De94AB1F18295C1C5aC3C1c80995F2D5a2E";

  let _fakeFarm = "0x44E867C51146932ac10728E86107bF488F38fA1e";

  let VotingsData = [_farm1];
  let votingWeightsData = ["100"];

  let votingFakeFarmsData = [_fakeFarm];
  let votingFakeFarmsData1 = [_farm1, _farm2, _fakeFarm];
  let votingFakeWeightsData = ["101"];
  let votingFakeWeightsData1 = ["30", "70", "10"];

  let fnftIds = [0];

  before(async () => {
    const signers: SignerWithAddress[] = await ethers.getSigners();

    deployer = signers[0];
    alice = signers[1];
    bob = signers[2];

    // FNFT
    fnft = FNFT__factory.connect(_fnft, deployer);
    console.log("FNFT: ", fnft.address);

    // HEC
    hec = IERC20__factory.connect(_hec, deployer);
    console.log("HEC: ", hec.address);

    // Farm1
    farm1 = LockFarm__factory.connect(_farm1, deployer);
    console.log("Farm1: ", farm1.address);

    // Farm2
    farm2 = LockFarm__factory.connect(_farm2, deployer);
    console.log("Farm2: ", farm2.address);

    // Voting
    Voting = await deployVoting(_hec, _sHec, _wsHec, _usdc, _spookySwapFactory, _spookySwapRotuer);
    console.log("Voting: ", Voting.address);

    console.log("Deployer: ", deployer.address);
    console.log("Alice: ", alice.address);

    await Voting.connect(deployer).addLockFarmForOwner(farm1.address, _fnft, _lockAddressRegistry, _tokenVault);
    await Voting.connect(deployer).setMaxPercentageFarm(200);
  });

  describe("#1: AddLockFarmForOwner", async () => {
    it("Should set the right owner", async function () {
      await expect(Voting.connect(alice).addLockFarmForOwner(farm1.address, _fnft, _lockAddressRegistry,_tokenVault)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should set the non-existed farm", async function () {
      await expect(Voting.connect(deployer).addLockFarmForOwner(farm1.address, _fnft, _lockAddressRegistry, _tokenVault)).to.be.revertedWith("Already existed farm");
    });
  });

  describe("#2: Vote", async () => {

    it("Failed - user can't vote", async function () {
      expect(true).to.equal(await Voting.connect(deployer).canVote(deployer.address));
    });

    it("Failed - inputted weights total percentage is not 100%", async function () {
      await expect(Voting.connect(deployer).vote(VotingsData, votingFakeWeightsData, NULL_ADDRESS, 0, NULL_ADDRESS, [])).to.be.revertedWith("Weights total percentage is not 100%");
    });

    it("Failed - inputted one of weights exceeded max limit", async function () {
      await Voting.connect(deployer).setMaxPercentageFarm(30);
      await expect(Voting.connect(deployer).vote(VotingsData, votingWeightsData, NULL_ADDRESS, 0, NULL_ADDRESS, [])).to.be.revertedWith("One of Weights exceeded max limit");
      await Voting.connect(deployer).setMaxPercentageFarm(200);
    });

    it("Failed - inputted farms and weights length size are difference", async function () {
      await expect(Voting.connect(deployer).vote(votingFakeFarmsData1, votingWeightsData, NULL_ADDRESS, 0, NULL_ADDRESS, [])).to.be.revertedWith("Farms and Weights length size are difference");
    });

    it("Failed - inputted invalid farms", async function () {
      await expect(Voting.connect(deployer).vote(votingFakeFarmsData, votingWeightsData, NULL_ADDRESS, 0, NULL_ADDRESS, [])).to.be.revertedWith("Invalid Farms");
    });

  });

  describe("#3: setConfiguration", async () => {
    it("Failed - only admin can set configuration", async function () {
      await expect(Voting.connect(alice).setConfiguration(hec.address, _sHec, _wsHec, _usdc, _spookySwapFactory, _spookySwapRotuer)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Compare - configurations after set", async function () {
      const thec = hec.address;
      await Voting.connect(deployer).setConfiguration(hec.address, _sHec, _wsHec, _usdc, _spookySwapFactory, _spookySwapRotuer);

      expect(thec).to.equal(await Voting.connect(deployer).HEC());
    });
  });

  describe("#4: setMaxPercentageFarm", async () => {
    it("Failed - only admin can set max percentage of the farms", async function () {
      await expect(Voting.connect(alice).setMaxPercentageFarm("60")).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Compare - max percentage after set", async function () {
      const maxPercentage = 60;
      await Voting.connect(deployer).setMaxPercentageFarm(maxPercentage);
      const maxPercentage1 = await Voting.connect(deployer).maxPercentage();
      expect(maxPercentage).to.equal(maxPercentage1);
    });
  });

  describe("#5: setVoteDelay", async () => {
    it("Failed - only admin can set vote delay time", async function () {
      const voteDelay = 60;
      await expect(Voting.connect(alice).setVoteDelay(voteDelay)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Compare - vote delay time after set", async function () {
      const voteDelay = 60;
      await Voting.connect(deployer).setVoteDelay(voteDelay);
      const voteDelay1 = await Voting.connect(deployer).voteDelay();
      expect(voteDelay).to.equal(voteDelay1);
    });
  });

  describe("#6: setAdmin", async () => {
    it("Failed - only admin can change admin", async function () {
      await expect(Voting.connect(alice).pushManagement(alice.address)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Compare - admin after set", async function () {
      await Voting.connect(deployer).pushManagement(alice.address);
      expect(alice.address).to.equal(await Voting.connect(alice).owner());
    });
  });
});
