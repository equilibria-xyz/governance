import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { govern } from '../test/testutil'
import { EmptySetGovernor__factory } from '../types/generated'
import { ES_004 } from '../proposals/emptyset/es004'
import WalletConnectProvider from '@walletconnect/web3-provider'
import { providers } from 'ethers'

const deploy_es004: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const provider = new WalletConnectProvider({
    rpc: {
      1: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
    },
    qrcode: false,
  })

  provider.connector.on('display_uri', (err, payload) => {
    console.log(`\nConnector URI 🔗\n${payload.params[0]}`)
  })

  await provider.enable()

  const { deployments } = hre

  const web3Provider = new providers.Web3Provider(provider)
  const deployer = await web3Provider.getSigner(0)

  const governor = await EmptySetGovernor__factory.connect(
    (
      await deployments.get('EmptySetGovernor')
    ).address,
    deployer,
  )
  await govern.proposeTx(governor, ES_004(), deployer)
  console.log('proposed ES004!')
}

export default deploy_es004
deploy_es004.tags = ['ES004']
