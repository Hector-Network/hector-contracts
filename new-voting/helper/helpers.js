const hre = require("hardhat");

const unlockAccount = async (address) => {
  await hre.network.provider.send("hardhat_impersonateAccount", [address]);
  return address;
};

const increaseTime = async (sec) => {
  await hre.network.provider.send("evm_increaseTime", [sec]);
  await hre.network.provider.send("evm_mine");
};

const mineBlocks = async (blockCount) => {
  for (let i = 0; i < blockCount; ++i) {
    await hre.network.provider.send("evm_mine");
  }
};

const getBlockNumber = async () => {
  const blockNumber = await hre.network.provider.send("eth_blockNumber");
  return parseInt(blockNumber.slice(2), 16);
};

const getTimeStamp = async () => {
  const blockNumber = await hre.network.provider.send("eth_blockNumber");
  const blockTimestamp = (await hre.network.provider.send("eth_getBlockByNumber", [blockNumber, false])).timestamp;
  return parseInt(blockTimestamp.slice(2), 16);
};

const getSnapShot = async () => {
  return await hre.network.provider.send("evm_snapshot");
};

const revertEvm = async (snapshotID) => {
  await hre.network.provider.send("evm_revert", [snapshotID]);
};

const waitSeconds = (sec) => new Promise((resolve) => setTimeout(resolve, sec * 1000));

module.exports = {
  unlockAccount,
  increaseTime,
  mineBlocks,
  getBlockNumber,
  getTimeStamp,
  getSnapShot,
  revertEvm,
  waitSeconds,
};
