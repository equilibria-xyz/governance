import { expect } from 'chai'
import { Signer } from 'ethers'
import { Deployment } from 'hardhat-deploy/types'
import HRE from 'hardhat'

import { time } from '../testutil'
import { EmptySetProp1Initializer__factory } from '../../types/generated/factories/EmptySetProp1Initializer__factory'
import { EmptySetShare__factory } from '../../types/generated/factories/EmptySetShare__factory'

const { ethers, deployments } = HRE

describe('EmptySetProp1Initializer', () => {
  let owner: Signer

  beforeEach(async () => {
    ;[owner] = await ethers.getSigners()
  })

  it('uses mainnet deployments', async () => {
    const essAddress = (await deployments.get('EmptySetShare')).address
    const ess = EmptySetShare__factory.connect(essAddress, owner)
    expect(await ess.totalSupply()).to.equal('1952000000000000000000000000')
  })

  it('deploys the initializer', async () => {
    const contract = await new EmptySetProp1Initializer__factory(owner).deploy()
    expect(await contract.RESERVE()).to.equal('0xD05aCe63789cCb35B9cE71d01e4d632a0486Da4B')
    expect(await ethers.provider.getBlockNumber()).to.eq(13046799)
    await time.increase(100)
    expect(await ethers.provider.getBlockNumber()).to.eq(13046800)
  })
})
