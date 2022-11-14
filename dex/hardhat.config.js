require("dotenv").config();
require("@nomiclabs/hardhat-etherscan");
require("@openzeppelin/hardhat-upgrades");
require("@nomicfoundation/hardhat-toolbox");

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
      {
        version: '0.8.9',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.8.2',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.7.5',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.6.12',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  namedAccounts: {
    deployer: {
      default: 0,
      42: '0x9De5B00012A27b3efd50d5B90bF2e07413cED178',
    },
  },
  typechain: {
    outDir: 'types/',
    target: 'ethers-v5',
  },
  networks: {
    hardhat: {
      forking: {
        url: process.env.MAIN_NET_API_URL,
      },
      hardfork: 'london',
      gasPrice: 'auto',
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
      accounts: [process.env.PRIVATE_KEY, process.env.PRIVATE_KEY_ALICE],
      chainId: 4002,
      saveDeployments: true,
    },
  },
  paths: {
    deploy: 'deploy',
    deployments: 'deployments',
    imports: 'imports',
  },
  etherscan: {
    apiKey: process.env.FTM_API_KEY,
  },
  mocha: {
    timeout: 100000,
  },
};
