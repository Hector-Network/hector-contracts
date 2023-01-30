import { BigNumber } from 'ethers';
const { defender } = require("hardhat");

async function main() {
    const proxyAddress = process.env.VOTING_ADDRESS;

    const VotingContractFactory = await ethers.getContractFactory("Voting");
    console.log("Preparing proposal...");
    const proposal = await defender.proposeUpgrade(proxyAddress, VotingContractFactory);
    console.log("Upgrade proposal created at:", proposal.url);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
