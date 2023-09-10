import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { govern } from '../test/testutil'
import { EmptySetGovernor__factory } from '../types/generated'
import { ES_007 } from '../proposals/emptyset/es007'
import { getWalletConnectDeployer } from './utils/walletconntect'

const deploy_es007: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre
  const deployer = await getWalletConnectDeployer()

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
