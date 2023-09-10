import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { govern } from '../test/testutil'
import { EmptySetGovernor__factory } from '../types/generated'
import { ES_006 } from '../proposals/emptyset/es006'
import { getWalletConnectDeployer } from './utils/walletconntect'

const deploy_es006: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre
  const deployer = await getWalletConnectDeployer()

  const governor = await EmptySetGovernor__factory.connect(
    (
      await deployments.get('EmptySetGovernor2')
    ).address,
    deployer,
  )
  await govern.proposeTx(governor, ES_006(), deployer)
  console.log('proposed ES006!')
}

export default deploy_es006
deploy_es006.tags = ['ES006']
