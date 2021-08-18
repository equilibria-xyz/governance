import { expect } from 'chai'
import { Signer } from 'ethers'
import HRE from 'hardhat'

import { time } from '../testutil'
import { Operator } from '../../util/operator'
import { EmptySetProp1Initializer__factory } from '../../types/generated/factories/EmptySetProp1Initializer__factory'
import { EmptySetProp1Initializer } from '../../types/generated/EmptySetProp1Initializer'

const { ethers } = HRE

describe('EmptySetProp1Initializer', () => {
  let owner: Signer
  const operator = new Operator(HRE, "1")

  beforeEach(async () => {
    [owner] = await ethers.getSigners()
  })

  it ('deploys the initializer', async () => {
    const contract: EmptySetProp1Initializer = await operator.attachOrDeploy(
      new EmptySetProp1Initializer__factory(owner), "EmptySetProp1Initializer", () => [])
    expect(await contract.RESERVE()).to.equal("0xD05aCe63789cCb35B9cE71d01e4d632a0486Da4B")
    expect(await ethers.provider.getBlockNumber()).to.eq(13046799)
    await time.increase(100)
    expect(await ethers.provider.getBlockNumber()).to.eq(13046800)
  })
})
