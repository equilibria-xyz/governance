import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { govern } from '../test/testutil'
import { EmptySetGovernor__factory } from '../types/generated'
import WalletConnectProvider from '@walletconnect/web3-provider'
import { providers } from 'ethers'
import { ES_007 } from '../proposals/emptyset/es007'

const deploy_es007: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const provider = new WalletConnectProvider({
    rpc: {
      1: `${process.env.MAINNET_NODE_URL}`,
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
      await deployments.get('EmptySetGovernor2')
    ).address,
    deployer,
  )
  await govern.proposeTx(governor, ES_007(), deployer)
  console.log('proposed ES007!')
}

export default deploy_es007
deploy_es007.tags = ['ES007']
