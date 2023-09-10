import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { govern } from '../test/testutil'
import { CompoundGovernor__factory } from '../types/generated'
import { COMP_096 } from '../proposals/compound/comp096'
import { getWalletConnectDeployer } from './utils/walletconntect'

const deploy_comp96: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre
  const deployer = await getWalletConnectDeployer()

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
