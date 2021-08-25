import { BigNumberish, ContractTransaction, Signer } from 'ethers'
import HRE from 'hardhat'
import { expect } from 'chai'
import { time } from './index'
import {
  EmptySetGovernor,
  EmptySetGovernor__factory,
  EmptySetShare,
  EmptySetShare__factory,
} from '../../types/generated'
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
  argValues: any[]
}

export async function propose(
  governorAddress: string,
  tokenAddress: string,
  proposal: Proposal,
  proposer: Signer,
): Promise<ContractTransaction> {
  const governor: EmptySetGovernor = EmptySetGovernor__factory.connect(governorAddress, proposer)
  const token: EmptySetShare = EmptySetShare__factory.connect(tokenAddress, proposer)
  const votingPower = await token.getCurrentVotes(await proposer.getAddress())

  await proposeTx(governor, proposal, proposer)
  const proposalId = await governor.proposalCount()

  expect(await governor.proposalCount()).to.eq(proposalId)
  expect(await governor.state(proposalId)).to.eq(0)

  await time.advanceBlock()
  await time.advanceBlock()

  expect(await governor.state(proposalId)).to.eq(1)

  await governor.connect(proposer).castVote(proposalId, true)

  const receipt = await governor.getReceipt(proposalId, await proposer.getAddress())
  expect(receipt.hasVoted).to.eq(true)
  expect(receipt.support).to.eq(true)
  expect(receipt.votes).to.eq(votingPower)

  const endBlock = (await governor.proposals(proposalId)).endBlock
  await time.advanceBlockTo(endBlock.toNumber() + 1)
  expect(await governor.state(proposalId)).to.eq(4) // succeeded

  await governor.connect(proposer).queue(proposalId)

  expect(await governor.state(proposalId)).to.eq(5) // queued

  await time.increase(86400 * 2)

  const txExecute = await governor.connect(proposer).execute(proposalId)

  expect(await governor.state(proposalId)).to.eq(7) // executed

  return txExecute
}

async function proposeTx(governor: EmptySetGovernor, proposal: Proposal, signer: Signer) {
  const params = proposal.clauses.map(clause => ethers.utils.defaultAbiCoder.encode(clause.argTypes, clause.argValues))
  return await governor.connect(signer).propose(
    proposal.clauses.map(({ to }) => to),
    proposal.clauses.map(({ value }) => value),
    proposal.clauses.map(({ method }) => method),
    params,
    proposal.description,
  )
}
