import '@typechain/hardhat';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import 'hardhat-contract-sizer';
import 'solidity-coverage';
import 'hardhat-deploy';
import '@nomiclabs/hardhat-etherscan';
import 'hardhat-gas-reporter';

require('@openzeppelin/hardhat-upgrades');
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
				url: process.env.ETHMAIN_NET_API_URL,
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
		deploy: 'deploy',
		deployments: 'deployments',
		imports: 'imports',
	},
	etherscan: {
		apiKey: {
			bsc: 'A2HNWK3VKZNQFAGU254HW1DAG4RPB8FI8T',
			avalanche: 'Z7ICD5QD8WJ3MGAF7PA7WBKV2YUBHU67M3',
			polygon: 'WZB1DPUWYZ13SQSGHFTTEY43YJYAEFY2EH',
			polygonMumbai: process.env.POLYGON_API_KEY,
			goerli: process.env.ETH_API_KEY,
			opera: process.env.FTM_API_KEY,
			ftmTestnet: process.env.FTM_API_KEY,
		},
	},
	mocha: {
		timeout: 100000,
	},
};
