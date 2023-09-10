import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { govern } from '../test/testutil'
import { CompoundGovernor__factory } from '../types/generated'
import { COMP_104 } from '../proposals/compound/comp104'
import { getWalletConnectDeployer } from './utils/walletconntect'

const deploy_comp104: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre
  const deployer = await getWalletConnectDeployer()

  const governor = await CompoundGovernor__factory.connect(
    (
      await deployments.get('CompoundGovernor')
    ).address,
    deployer,
  )
  const cerc20delegate = await deployments.get('CErc20Delegate')
  await govern.proposeTx(governor, COMP_104(cerc20delegate.address).proposal, deployer)
  console.log('proposed COMP104!')
}

export default deploy_comp104
deploy_comp104.tags = ['COMP104']
