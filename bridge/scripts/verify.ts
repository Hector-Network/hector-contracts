require('dotenv').config();
/**
 * Verifying script in all networks
 * If you want to verify in single network, please use this: yarn test ftm
 */
import exec from 'child_process';

async function main() {
	const cmd = exec.exec;

  	console.log('Verifying on the FTM network...');
	const cmdForVerify = `hardhat verify --contract \"contracts/HecBridgeSplitter.sol:HecBridgeSplitter\" 0xf9fF08Baf7E25439b0255f247CFE7236370Ec401 --network ftm`;
	console.log(cmdForVerify);
	cmd(cmdForVerify, (error) => {
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
