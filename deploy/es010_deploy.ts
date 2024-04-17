import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { govern } from '../test/testutil'
import { EmptySetGovernor__factory } from '../types/generated'
import { ES_010 } from '../proposals/emptyset/es010'
import { getWalletConnectDeployer } from './utils/walletconntect'

const deploy_es010: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre

  const deployer = await getWalletConnectDeployer()

  const governor = await EmptySetGovernor__factory.connect(
    (
      await deployments.get('EmptySetGovernor2')
    ).address,
    deployer,
  )
  await govern.proposeTx(governor, ES_010(), deployer)
  console.log('proposed ES010!')
}

export default deploy_es010
deploy_es010.tags = ['ES010']
