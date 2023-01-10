require('dotenv').config();
/**
 * Verifying script in all networks
 * If you want to verify in single network, please use this: yarn test ftm
 */
import exec from 'child_process';

async function main() {
	const prod_mode = process.env.PROD_MODE == "true" ? true : false;
	const cmd = exec.exec;
	const network = prod_mode ? 'ftm' : 'ftmtest';
	
  console.log({prod_mode})
	console.log('Verifying on the FTM network...');
	const cmdForVerify = `hardhat verify --contract \"contracts/Voting.sol:Voting\" ${process.env.VOTING_ADDRESS} --network ${network}`;
	console.log(cmdForVerify);
	cmd(cmdForVerify, (error: any) => {
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
