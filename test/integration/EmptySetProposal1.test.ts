import { expect } from 'chai'
import { ContractReceipt, ContractTransaction, Signer } from 'ethers'
import HRE from 'hardhat'

import {
  EmptySetProp1Initializer,
  EmptySetShare,
  UniswapV3Staker,
  EmptySetProp1Initializer__factory,
  EmptySetShare__factory,
  UniswapV3Staker__factory,
} from '../../types/generated'
import { govern, impersonate, time } from '../testutil'

const { ethers, deployments } = HRE
const ESS_ADDRESS = '0x07b991579b4e1Ee01d7a3342AF93E96ecC59E0B3'
const RESERVE_ADDRESS = '0xD05aCe63789cCb35B9cE71d01e4d632a0486Da4B'
const DSU_INCENTIVE_AMOUNT = ethers.utils.parseEther('8000000')
const ESS_INCENTIVE_AMOUNT = ethers.utils.parseEther('4000000')

describe('Empty Set Proposal 1', () => {
  let funder: Signer
  let essSigner: Signer
  let ess: EmptySetShare
  let staker: UniswapV3Staker
  let prop1Initializer: EmptySetProp1Initializer

  beforeEach(async () => {
    time.reset(HRE.config)
    ;[funder] = await ethers.getSigners()
    essSigner = await impersonate.impersonate(ESS_ADDRESS, funder)

    ess = EmptySetShare__factory.connect((await deployments.get('EmptySetShare')).address, funder)
    staker = UniswapV3Staker__factory.connect((await deployments.get('UniswapV3Staker')).address, funder)
    prop1Initializer = await new EmptySetProp1Initializer__factory(funder).deploy()
  })

  it('starts the initializers', async () => {
    const txExecute = await govern.propose(
      (
        await deployments.get('EmptySetGovernor')
      ).address,
      (
        await deployments.get('EmptySetShare')
      ).address,
      {
        clauses: [
          {
            to: RESERVE_ADDRESS,
            value: 0,
            method: 'mintStake(address,uint256)',
            argTypes: ['address', 'uint256'],
            argValues: [prop1Initializer.address, DSU_INCENTIVE_AMOUNT.add(ESS_INCENTIVE_AMOUNT)],
          },
          {
            to: prop1Initializer.address,
            value: 0,
            method: 'start()',
            argTypes: [],
            argValues: [],
          },
        ],
        description: 'Initiates the new incentive programs.',
      },
      essSigner,
    )

    const [dsuIncentiveId, essIncentiveId] = await parseIncentiveIds(txExecute)

    const dsuIncentives = await staker.incentives(dsuIncentiveId)
    expect(dsuIncentives.totalRewardUnclaimed).to.eq(DSU_INCENTIVE_AMOUNT)
    expect(dsuIncentives.totalSecondsClaimedX128).to.eq(0)
    expect(dsuIncentives.numberOfStakes).to.eq(0)

    const essIncentives = await staker.incentives(essIncentiveId)
    expect(essIncentives.totalRewardUnclaimed).to.eq(ESS_INCENTIVE_AMOUNT)
    expect(essIncentives.totalSecondsClaimedX128).to.eq(0)
    expect(essIncentives.numberOfStakes).to.eq(0)

    expect(await ess.balanceOf(prop1Initializer.address)).to.equal(0)
    expect(await ess.balanceOf(staker.address)).to.equal(DSU_INCENTIVE_AMOUNT.add(ESS_INCENTIVE_AMOUNT))
  }).timeout(60000)

  it('cancels the initializers', async () => {
    const reserveBalanceBefore = await ess.balanceOf(RESERVE_ADDRESS)

    await govern.propose(
      (
        await deployments.get('EmptySetGovernor')
      ).address,
      (
        await deployments.get('EmptySetShare')
      ).address,
      {
        clauses: [
          {
            to: RESERVE_ADDRESS,
            value: 0,
            method: 'mintStake(address,uint256)',
            argTypes: ['address', 'uint256'],
            argValues: [prop1Initializer.address, DSU_INCENTIVE_AMOUNT.add(ESS_INCENTIVE_AMOUNT)],
          },
          {
            to: prop1Initializer.address,
            value: 0,
            method: 'cancel()',
            argTypes: [],
            argValues: [],
          },
        ],
        description: 'Initiates the new incentive programs.',
      },
      essSigner,
    )

    expect(await ess.balanceOf(prop1Initializer.address)).to.equal(0)
    expect(await ess.balanceOf(staker.address)).to.equal(0)
    expect(await ess.balanceOf(RESERVE_ADDRESS)).to.equal(
      reserveBalanceBefore.add(DSU_INCENTIVE_AMOUNT).add(ESS_INCENTIVE_AMOUNT),
    )
  }).timeout(60000)
})

async function parseIncentiveIds(tx: ContractTransaction) {
  const txExecuteReceipt: ContractReceipt = await tx.wait()
  const rawData = txExecuteReceipt.logs[11].data
  return ethers.utils.defaultAbiCoder.decode(['bytes32', 'bytes32'], rawData)
}
