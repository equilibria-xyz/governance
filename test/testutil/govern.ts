import { BigNumberish, ContractTransaction, Signer } from 'ethers'
import HRE from 'hardhat'
import { expect } from 'chai'
import { time } from './index'
import { COMP, COMP__factory, EmptySetGovernor, CompoundGovernor } from '../../types/generated'
const { ethers } = HRE

export interface Proposal {
  clauses: ProposalClause[]
  description: string
}

export interface ProposalClause {
  to: string
  value: BigNumberish
  method: string
  argTypes: string[]
  argValues: unknown[]
}

export async function propose(
  governor: CompoundGovernor | EmptySetGovernor,
  tokenAddress: string,
  proposal: Proposal,
  proposer: Signer,
  supporters: Signer[] = [],
  compoundGovernor = false,
  verbose = true,
): Promise<ContractTransaction> {
  verbose && console.log('>> Starting Proposal Flow')
  const token: COMP = COMP__factory.connect(tokenAddress, proposer)
  const votingPower = await token.getCurrentVotes(await proposer.getAddress())

  await proposeTx(governor, proposal, proposer, verbose)
  const proposalId = await governor.proposalCount()
  verbose && console.log('>> TX Proposed')

  expect(await governor.proposalCount()).to.eq(proposalId)
  expect(await governor.state(proposalId)).to.eq(0)

  const currBlock = await ethers.provider.getBlockNumber()
  const votingDelay = await governor.votingDelay()
  await time.advanceBlockTo(currBlock + votingDelay.toNumber() + 1)

  expect(await governor.state(proposalId)).to.eq(1)
  verbose && console.log('>> Proposal Active')

  if (compoundGovernor) {
    await (governor.connect(proposer) as CompoundGovernor).castVote(proposalId, 1)
    await Promise.all(supporters.map(async s => (governor.connect(s) as CompoundGovernor).castVote(proposalId, 1)))
  } else {
    await (governor.connect(proposer) as EmptySetGovernor).castVote(proposalId, true)
    await Promise.all(supporters.map(async s => (governor.connect(s) as EmptySetGovernor).castVote(proposalId, true)))
  }
  verbose && console.log('>> Votes Cast')

  const receipt = await governor.getReceipt(proposalId, await proposer.getAddress())
  expect(receipt.hasVoted).to.eq(true)
  expect(receipt.support).to.eq(compoundGovernor ? 1 : true)
  expect(receipt.votes).to.eq(votingPower)

  const endBlock = (await governor.proposals(proposalId)).endBlock
  await time.advanceBlockTo(endBlock.toNumber() + 1)
  expect(await governor.state(proposalId)).to.eq(4) // succeeded
  verbose && console.log('>> Proposal Succeeded')

  await governor.connect(proposer).queue(proposalId)

  expect(await governor.state(proposalId)).to.eq(5) // queued
  verbose && console.log('>> Proposal Queued')
  await time.increase(86400 * 2)

  const txExecute = await governor.connect(proposer).execute(proposalId)
  verbose && console.log('>> Proposal Executed')
  expect(await governor.state(proposalId)).to.eq(7) // executed

  return txExecute
}

export async function proposeTx(
  governor: EmptySetGovernor | CompoundGovernor,
  proposal: Proposal,
  signer: Signer,
  verbose = true,
) {
  const params = proposal.clauses.map(clause => ethers.utils.defaultAbiCoder.encode(clause.argTypes, clause.argValues))
  verbose && console.log(`>>>> Calldatas: ${params}`)
  return await governor.connect(signer).propose(
    proposal.clauses.map(({ to }) => to),
    proposal.clauses.map(({ value }) => value),
    proposal.clauses.map(({ method }) => method),
    params,
    proposal.description,
  )
}
