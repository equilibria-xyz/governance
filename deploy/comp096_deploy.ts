import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { govern } from '../test/testutil'
import { CompoundGovernor__factory } from '../types/generated'
import { COMP_096 } from '../proposals/compound/comp096'
import WalletConnectProvider from '@walletconnect/web3-provider'
import { providers } from 'ethers'

const deploy_comp96: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
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

  const governor = await CompoundGovernor__factory.connect(
    (
      await deployments.get('CompoundGovernor')
    ).address,
    deployer,
  )
  const cerc20delegate = await deployments.get('CErc20Delegate')
  await govern.proposeTx(governor, COMP_096(cerc20delegate.address).proposal, deployer)
  console.log('proposed COMP96!')
}

export default deploy_comp96
deploy_comp96.tags = ['COMP96']
