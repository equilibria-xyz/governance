import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { govern } from '../test/testutil'
import { EmptySetGovernor__factory } from '../types/generated'
import { ES_008 } from '../proposals/emptyset/es008'
import { getWalletConnectDeployer } from './utils/walletconntect'

const deploy_es008: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre
  const deployer = await getWalletConnectDeployer()

  const governor = EmptySetGovernor__factory.connect((await deployments.get('EmptySetGovernor2')).address, deployer)
  await govern.proposeTx(governor, ES_008(), deployer)
  console.log('proposed ES008!')
}

export default deploy_es008
deploy_es008.tags = ['ES008']
