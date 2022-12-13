require("dotenv").config();
require("@nomiclabs/hardhat-etherscan");
require("@openzeppelin/hardhat-upgrades");
require("@nomicfoundation/hardhat-toolbox");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html

task("balance", "Prints an account's balance").setAction(async () => {});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  defaultNetwork: "goerli",
  networks: {
    hardhat: {
      forking: {
        url: process.env.ETHMAIN_NET_API_URL,
      },
      hardfork: "london",
      gasPrice: "auto",
    },
    localhost: {
      url: `http://127.0.0.1:8545`,
    },
    ftm: {
      url: process.env.FTMMAIN_NET_API_URL,
      accounts: [process.env.PRIVATE_KEY],
      chainId: 250,
      saveDeployments: true,
    },
    ftmtest: {
      url: process.env.FTMTEST_NET_API_URL,
      accounts: [process.env.PRIVATE_KEY],
      chainId: 4002,
      saveDeployments: true,
    },
    polygon: {
      url: process.env.POLYGONMAIN_NET_API_URL,
      accounts: [process.env.PRIVATE_KEY],
      saveDeployments: true,
    },
    mumbai: {
      url: process.env.POLYGONTEST_NET_API_URL,
      accounts: [process.env.PRIVATE_KEY],
      saveDeployments: true,
    },
    goerli: {
      url: process.env.ETHTEST_NET_API_URL,
      accounts: [process.env.PRIVATE_KEY],
      saveDeployments: true,
    },
  },
  paths: {
    deploy: "deploy",
    deployments: "deployments",
    imports: "imports",
  },
  etherscan: {
    apiKey: {
      bsc: "A2HNWK3VKZNQFAGU254HW1DAG4RPB8FI8T",
      avalanche: "Z7ICD5QD8WJ3MGAF7PA7WBKV2YUBHU67M3",
      polygon: "WZB1DPUWYZ13SQSGHFTTEY43YJYAEFY2EH",
      polygonMumbai: process.env.POLYGON_API_KEY,
      goerli: process.env.ETH_API_KEY,
    },
  },
  mocha: {
    timeout: 100000,
  },
};
