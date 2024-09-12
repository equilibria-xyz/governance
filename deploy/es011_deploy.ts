import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { govern } from '../test/testutil'
import { EmptySetGovernor__factory } from '../types/generated'
import { ES_011 } from '../proposals/emptyset/es011'
import { getWalletConnectDeployer } from './utils/walletconntect'

const deploy_es011: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre

  const deployer = await getWalletConnectDeployer()

  const governor = await EmptySetGovernor__factory.connect(
    (
      await deployments.get('EmptySetGovernor2')
    ).address,
    deployer,
  )
  await govern.proposeTx(governor, ES_011(), deployer)
  console.log('proposed ES011!')
}

export default deploy_es011
deploy_es011.tags = ['ES011']
