import { task } from 'hardhat/config'

import { config as dotenvConfig } from 'dotenv'
import { resolve } from 'path'
dotenvConfig({ path: resolve(__dirname, './.env') })

import { HardhatUserConfig } from 'hardhat/types'
import { NetworkUserConfig } from 'hardhat/types'

import '@typechain/hardhat'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-etherscan'
import 'hardhat-gas-reporter'
import 'hardhat-deploy'
import { ethers } from 'ethers'

const chainIds = {
  ganache: 1337,
  goerli: 5,
  hardhat: 31337,
  kovan: 42,
  mainnet: 1,
  rinkeby: 4,
  ropsten: 3,
}

const MNEMONIC = process.env.MNEMONIC || ''
const PRIVATE_KEY = process.env.PRIVATE_KEY || ''
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || ''
const INFURA_API_KEY = process.env.INFURA_API_KEY || ''
const ALCHEMY_KEY = process.env.ALCHEMY_KEY || ''
const FORK_ENABLED = process.env.FORK_ENABLED === 'true' || false

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (args, hre) => {
  const accounts = await hre.ethers.getSigners()

  for (const account of accounts) {
    console.log(await account.address)
  }
})

function createTestnetConfig(network: keyof typeof chainIds): NetworkUserConfig {
  const url = `https://${network}.infura.io/v3/${INFURA_API_KEY}`
  return {
    accounts: PRIVATE_KEY !== '' ? [PRIVATE_KEY] : [],
    chainId: chainIds[network],
    url,
  }
}

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      accounts: {
        mnemonic: MNEMONIC,
      },
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_KEY}`,
        enabled: FORK_ENABLED,
      },
      chainId: chainIds.hardhat,
    },
    goerli: createTestnetConfig('goerli'),
    kovan: createTestnetConfig('kovan'),
    rinkeby: createTestnetConfig('rinkeby'),
    ropsten: createTestnetConfig('ropsten'),
    mainnet: {
      chainId: chainIds.mainnet,
      url: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_KEY}`,
      accounts: PRIVATE_KEY !== '' ? [PRIVATE_KEY] : [],
    },
  },
  solidity: {
    compilers: [
      {
        version: '0.8.10',
      },
      {
        version: '0.8.6',
      },
      {
        version: '0.7.6',
      },
    ],
  },
  mocha: {
    timeout: 60000,
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
  gasReporter: {
    currency: 'USD',
    gasPrice: 100,
    enabled: process.env.REPORT_GAS ? true : false,
  },
  typechain: {
    outDir: 'types/generated',
    target: 'ethers-v5',
    externalArtifacts: [
      'external/contracts/*.json',
      'external/deployments/**/*.json',
      '@openzeppelin/contracts/token/ERC20/IERC20.sol',
    ],
  },
  external: {
    contracts: [{ artifacts: 'external/contracts' }],
    deployments: {
      mainnet: ['external/deployments/mainnet'],
      hardhat: [FORK_ENABLED ? 'external/deployments/mainnet' : ''],
    },
  },
}

export default config
