import '@typechain/hardhat';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import 'hardhat-contract-sizer';
import 'solidity-coverage';
import 'hardhat-deploy';
import '@nomiclabs/hardhat-etherscan';

require('dotenv').config();

export default {
  solidity: {
    version: '0.8.9',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  // contractSizer: {
  //   alphaSort: true,
  //   runOnCompile: true,
  //   disambiguatePaths: false,
  // },
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
      url: 'http://127.0.0.1:8545',
    },
    kovan: {
      url: process.env.KOVAN_NET_API_URL,
      accounts: [process.env.PRIVATE_KEY],
      saveDeployments: true,
    },
    rinkeby: {
      url: process.env.RINKEBY_NET_API_URL,
      accounts: [process.env.PRIVATE_KEY],
      saveDeployments: true,
    },
    ftm: {
      url: process.env.FTM_NET_API_URL,
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
  },
  paths: {
    deploy: 'deploy',
    deployments: 'deployments',
    imports: 'imports',
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  mocha: {
    timeout: 100000,
  },
};
