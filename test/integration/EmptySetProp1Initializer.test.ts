import { expect } from 'chai'
import { Signer } from 'ethers'
import { Deployment } from 'hardhat-deploy/types'
import HRE from 'hardhat'

import { time } from '../testutil'
import { EmptySetProp1Initializer__factory } from '../../types/generated/factories/EmptySetProp1Initializer__factory'
import { EmptySetShare__factory } from '../../types/generated/factories/EmptySetShare__factory'
import { EmptySetGovernor__factory } from '../../types/generated/factories/EmptySetGovernor__factory'
import { EmptySetGovernor } from '../../types/generated'

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
    const eqlAddress = '0x589CDCf60aea6B961720214e80b713eB66B89A4d'
    const reserveAddress = '0xD05aCe63789cCb35B9cE71d01e4d632a0486Da4B'

    const governorAddress = (await deployments.get('EmptySetGovernor')).address
    const governor = EmptySetGovernor__factory.connect(governorAddress, owner)

    const essAddress = (await deployments.get('EmptySetShare')).address
    const ess = EmptySetShare__factory.connect(essAddress, owner)

    const contract = await new EmptySetProp1Initializer__factory(owner).deploy()
    expect(await contract.RESERVE()).to.equal('0xD05aCe63789cCb35B9cE71d01e4d632a0486Da4B')

    await proposeProp1(eqlAddress, governor, contract.address, reserveAddress)

    expect(await governor.proposalCount()).to.eq(1)
    expect(await governor.state(1)).to.eq(0)

    console.log('Advancing block...')
    await time.advanceBlock()
    await time.advanceBlock()

    expect(await governor.state(1)).to.eq(1)

    await governor.connect(eqlAddress).castVote(1, true)

    const receipt = await governor.getReceipt(1, eqlAddress)
    expect(receipt.hasVoted).to.eq(true)
    expect(receipt.support).to.eq(true)
    expect(receipt.votes).to.eq('0') // TODO: voting power

    const proposal = await governor.proposals(1)
    const endBlock = await proposal.endBlock
    console.log('Ending block ' + endBlock + ', advancing...')
    console.log('')

    await time.advanceBlockTo(endBlock.toNumber() + 1)
    expect(await governor.state(1)).to.eq(4) // succeeded

    await governor.connect(eqlAddress).queue(1)

    expect(await governor.state(1)).to.eq(4) // queued

    await time.increase(86400 * 2)

    await governor.connect(eqlAddress).execute(1)

    expect(await ess.balanceOf(contract.address)).to.equal('0')
  })
})

async function proposeProp1(
  sender: string,
  governor: EmptySetGovernor,
  initializerAddress: string,
  reserveAddress: string,
) {
  const mintStakeParams = ethers.utils.defaultAbiCoder.encode(
    ['address', 'uint256'],
    [initializerAddress, '12000000000000000000000000'],
  )
  return await governor
    .connect(sender)
    .propose(
      [reserveAddress, initializerAddress],
      [0, 0],
      ['mintStake(address,amount)', 'start()'],
      [mintStakeParams, '0x'],
      'Upgrade the V1 implementation contract.',
    )
}
