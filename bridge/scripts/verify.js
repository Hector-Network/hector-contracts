/**
 * Verifying script in all networks
 * If you want to verify in single network, please use this: yarn test ftm
 */
const exec = require("child_process").exec;
require('dotenv').config();

async function main() {
  console.log('Verifying on the FTM network...');
	const cmdForVerify = `hardhat verify --contract \"contracts/HecBridgeSplitter.sol:HecBridgeSplitter\" ${process.env.SPLITTER_ADDRESS} --network ftm`;
	console.log(cmdForVerify);
	exec(cmdForVerify, (error) => {
		if (error !== null) {
			console.log(`exec error: ${error}`);
		}
		console.log('Done verify on the FTM network.');
	});
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
