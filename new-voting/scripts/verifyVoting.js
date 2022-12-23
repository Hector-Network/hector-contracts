/**
 * Verifying script in all networks
 * If you want to verify in single network, please use this: yarn test ftm
 */
const exec = require("child_process").exec;

async function main() {
  console.log("Verifying on the FTM network...");
  const cmdForVerify = `yarn verify ftm`;
  exec(cmdForVerify, (error, stdout, stderr) => {
    if (error !== null) {
      console.log(`exec error: ${error}`);
    }
    console.log("Done verify on the FTM network.");
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
