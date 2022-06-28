import HRE from 'hardhat'
import { expect } from 'chai'
import { Signer } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import {
  GovernorAlpha2,
  EmptySetGovernor__factory,
  EmptySetGovernor,
  GovernorAlpha2__factory,
  EmptySetTimelock__factory,
  EmptySetTimelock,
  EmptySetRegistry,
  EmptySetRegistry__factory,
} from '../../types/generated'
import { govern, impersonate, time } from '../testutil'
import { EMPTYSET_CONTRACTS } from '../../proposals/emptyset/contracts'
import { ES_003, NEW_GOVERNOR_ALPHA_ADDRESS } from '../../proposals/emptyset/es003'

const { ethers, deployments } = HRE
const PROPOSER_ADDRESS = '0x589CDCf60aea6B961720214e80b713eB66B89A4d' // Equilibria Multisig

const USE_REAL_DEPLOY = true
const FORK_BLOCK = 15038185

describe('Empty Set Proposal 003', () => {
  let funder: SignerWithAddress
  let proposerSigner: Signer
  let multisigSigner: Signer
  let governor: EmptySetGovernor
  let newGovernorAlpha: GovernorAlpha2
  let timelock: EmptySetTimelock
  let registry: EmptySetRegistry

  before(async () => {
    if (USE_REAL_DEPLOY) {
      console.log(`Using EmptySetGovernor2 impl deployed at ${NEW_GOVERNOR_ALPHA_ADDRESS}`)
    } else {
      console.log('Deploying a new EmptySetGovernor2 implementation')
    }
  })

  beforeEach(async () => {
    console.log(`Forking at block ${FORK_BLOCK}`)
    await time.reset(HRE.config, FORK_BLOCK)

    proposerSigner = await impersonate.impersonateWithBalance(PROPOSER_ADDRESS, ethers.utils.parseEther('10'))
    multisigSigner = await impersonate.impersonateWithBalance(
      EMPTYSET_CONTRACTS.GUARDIAN,
      ethers.utils.parseEther('10'),
    )
    ;[funder] = await ethers.getSigners()
    governor = await EmptySetGovernor__factory.connect(
      (
        await deployments.get('EmptySetGovernor')
      ).address,
      proposerSigner,
    )
    newGovernorAlpha = USE_REAL_DEPLOY
      ? await GovernorAlpha2__factory.connect(NEW_GOVERNOR_ALPHA_ADDRESS, funder)
      : await new GovernorAlpha2__factory(funder).deploy(
          (
            await deployments.get('EmptySetTimelock')
          ).address,
          (
            await deployments.get('EmptySetShare')
          ).address,
          EMPTYSET_CONTRACTS.GUARDIAN,
        )

    timelock = EmptySetTimelock__factory.connect((await deployments.get('EmptySetTimelock')).address, funder)
    registry = EmptySetRegistry__factory.connect((await deployments.get('EmptySetRegistry')).address, funder)

    await govern.propose(
      governor,
      (
        await deployments.get('EmptySetShare')
      ).address,
      ES_003(newGovernorAlpha.address),
      proposerSigner,
      [],
      false,
      false,
    )
  })

  it('upgrades the governor', async () => {
    expect(await timelock.pendingAdmin()).to.equal(newGovernorAlpha.address)
    expect(await registry.governor()).to.equal(newGovernorAlpha.address)

    expect(await newGovernorAlpha.timelock()).to.equal((await deployments.get('EmptySetTimelock')).address)
    expect(await newGovernorAlpha.stake()).to.equal((await deployments.get('EmptySetShare')).address)
    expect(await newGovernorAlpha.guardian()).to.equal(EMPTYSET_CONTRACTS.GUARDIAN)

    expect(await newGovernorAlpha.proposalThreshold()).to.equal(ethers.utils.parseEther('40000000'))
    expect(await newGovernorAlpha.quorumVotes()).to.equal(ethers.utils.parseEther('200000000'))
    expect(await newGovernorAlpha.votingDelay()).to.equal(13292)
    expect(await newGovernorAlpha.votingPeriod()).to.equal(46523)
  })

  context('guardian', () => {
    beforeEach(async () => {
      await newGovernorAlpha.connect(multisigSigner).__acceptAdmin()
    })

    it('accepts ownership', async () => {
      expect(await timelock.pendingAdmin()).to.equal(ethers.constants.AddressZero)
      expect(await timelock.admin()).to.equal(newGovernorAlpha.address)
      expect(await newGovernorAlpha.guardian()).to.equal(EMPTYSET_CONTRACTS.GUARDIAN)
    })

    it('is able to propose another', async () => {
      const newGovernor = await EmptySetGovernor__factory.connect(newGovernorAlpha.address, proposerSigner)
      const supporters = await Promise.all(
        [EMPTYSET_CONTRACTS.ESS_HOLDER_ADDRESS].map(s =>
          impersonate.impersonateWithBalance(s, ethers.utils.parseEther('10')),
        ),
      )

      // This proposal should be idempotent
      await govern.propose(
        newGovernor,
        (
          await deployments.get('EmptySetShare')
        ).address,
        ES_003(newGovernorAlpha.address),
        proposerSigner,
        supporters,
        false,
        false,
      )

      expect(await timelock.pendingAdmin()).to.equal(newGovernorAlpha.address) // test if it was re-called
    })
  })
})
