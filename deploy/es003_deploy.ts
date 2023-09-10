import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { govern } from '../test/testutil'
import { EmptySetGovernor__factory } from '../types/generated'
import { ES_003 } from '../proposals/emptyset/es003'
import { getWalletConnectDeployer } from './utils/walletconntect'

const deploy_es003: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre
  const deployer = await getWalletConnectDeployer()

  const governor = await EmptySetGovernor__factory.connect(
    (
      await deployments.get('EmptySetGovernor')
    ).address,
    deployer,
  )
  await govern.proposeTx(governor, ES_003(), deployer)
  console.log('proposed ES002!')
}

export default deploy_es003
deploy_es003.tags = ['ES003']
