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
		version: '0.8.17',
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
			accounts: [process.env.PRIVATE_KEY, process.env.PRIVATE_KEY_ALICE],
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
			accounts: [process.env.PRIVATE_KEY, process.env.PRIVATE_KEY_ALICE],
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
		mainnet: {
			url: process.env.ETHMAIN_NET_API_URL,
			accounts: [process.env.PRIVATE_KEY],
			saveDeployments: true,
		},
		arbitrumOne: {
			url: process.env.ARBITRUMMAIN_NET_API_URL,
			accounts: [process.env.PRIVATE_KEY],
			saveDeployments: true,
		},
		avalanche: {
			url: process.env.AVALANCHEMAIN_NET_API_URL,
			accounts: [process.env.PRIVATE_KEY],
			saveDeployments: true,
		},
		optimism: {
			url: process.env.OPTIMISMMAIN_NET_API_URL,
			accounts: [process.env.PRIVATE_KEY],
			saveDeployments: true,
		},
		moonriver: {
			url: process.env.MOONRIVERMAIN_NET_API_URL,
			accounts: [process.env.PRIVATE_KEY],
			saveDeployments: true,
		},
		bsc: {
			url: process.env.BSCMAIN_NET_API_URL,
			accounts: [process.env.PRIVATE_KEY],
			saveDeployments: true,
		},
		moonbeam: {
			url: process.env.MOONBEAM_NET_API_URL,
			accounts: [process.env.PRIVATE_KEY],
			saveDeployments: true,
		},
		gnosis: {
			url: process.env.GNOSIS_NET_API_URL,
			accounts: [process.env.PRIVATE_KEY],
			saveDeployments: true,
		},
		aurora: {
			url: process.env.AURORA_NET_API_URL,
			accounts: [process.env.PRIVATE_KEY],
			saveDeployments: true,
		},
		cronos: {
			url: process.env.CRONOS_NET_API_URL,
			accounts: [process.env.PRIVATE_KEY],
			saveDeployments: true,
		},
		fuse: {
			url: process.env.FUSE_NET_API_URL,
			accounts: [process.env.PRIVATE_KEY],
			saveDeployments: true,
		},
		celo: {
			url: process.env.CELO_NET_API_URL,
			accounts: [process.env.PRIVATE_KEY],
			saveDeployments: true,
		},
		okex: {
			url: process.env.OKXCHAIN_NET_API_URL,
			accounts: [process.env.PRIVATE_KEY],
			saveDeployments: true,
		},
		boba: {
			url: process.env.BOBA_NET_API_URL,
			accounts: [process.env.PRIVATE_KEY],
			saveDeployments: true,
		},
		velas: {
			url: process.env.VELAS_NET_API_URL,
			accounts: [process.env.PRIVATE_KEY],
			saveDeployments: true,
		}
		
	},
	paths: {
		deploy: 'deploy',
		deployments: 'deployments',
		imports: 'imports',
	},
	etherscan: {
		apiKey: {
			mainnet: process.env.ETH_API_KEY,
			bsc: process.env.BSC_API_KEY,
			avalanche: process.env.AVALANCHE_API_KEY,
			polygon: process.env.POLYGON_API_KEY,
			opera: process.env.FTM_API_KEY,
			optimisticEthereum: process.env.OPTIMISM_API_KEY,
			arbitrumOne: process.env.ARBITRUM_API_KEY,
			moonriver: process.env.MOONRIVER_API_KEY,
			moonbeam: process.env.MOONBEAM_API_KEY,
			gnosis: process.env.GNOSIS_API_KEY,
			aurora: process.env.AURORA_API_KEY,
		},
	},
	mocha: {
		timeout: 1000000000,
	},
};
