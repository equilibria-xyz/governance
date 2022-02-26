import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const deploy_es001: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, ethers } = hre
  const { deploy } = deployments
  const ds = await deployments.all()

  const signers = await ethers.getSigners()
  const result = await deploy('EmptySetProp1Initializer', {
    from: await signers[0].getAddress(),
    args: [],
    log: true,
  })
  console.log('EmptySetProp1Initializer deployed to: ', result.address)
}

export default deploy_es001
deploy_es001.tags = ['EmptySetProp1Initializer']
