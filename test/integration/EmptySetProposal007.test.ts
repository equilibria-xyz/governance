import { expect } from 'chai'
import { Signer } from 'ethers'
import HRE from 'hardhat'

import {
  EmptySetGovernor,
  EmptySetGovernor__factory,
  IERC20__factory,
  IERC20,
  EmptySetGovernor2__factory,
} from '../../types/generated'
import { govern, impersonate, time } from '../testutil'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ES_007 } from '../../proposals/emptyset/es007'

const { ethers, deployments } = HRE
const FORK_BLOCK = 16429016
const PROPOSER_ADDRESS = '0x589CDCf60aea6B961720214e80b713eB66B89A4d' // Equilibria Multisig
const SUPPORTER_ADDRESSES = ['0x07b991579b4e1Ee01d7a3342AF93E96ecC59E0B3']

describe('Empty Set Proposal 007', () => {
  let funder: SignerWithAddress
  let proposerSigner: Signer
  let supporterSigners: Signer[]
  let user: SignerWithAddress
  let governor: EmptySetGovernor
  let ess: IERC20

  beforeEach(async () => {
    time.reset(HRE.config, FORK_BLOCK)
    ;[funder, user] = await ethers.getSigners()
    proposerSigner = await impersonate.impersonateWithBalance(PROPOSER_ADDRESS, ethers.utils.parseEther('10'))
    supporterSigners = await Promise.all(
      SUPPORTER_ADDRESSES.map(s => impersonate.impersonateWithBalance(s, ethers.utils.parseEther('10'))),
    )
    ;[funder] = await ethers.getSigners()
    governor = await EmptySetGovernor2__factory.connect(
      (
        await deployments.get('EmptySetGovernor2')
      ).address,
      proposerSigner,
    )

    governor = await EmptySetGovernor__factory.connect((await deployments.get('EmptySetGovernor2')).address, funder)
    ess = IERC20__factory.connect((await deployments.get('EmptySetShare')).address, funder)

    await HRE.network.provider.request({
      method: 'hardhat_setBalance',
      params: [PROPOSER_ADDRESS, ethers.utils.parseEther('10').toHexString()],
    })

    await govern.propose(
      governor,
      ess.address,
      ES_007(),
      proposerSigner,
      supporterSigners,
      false,
      true,
      '78525380935798',
    )
  })

  it('accepts ownership', async () => {
    expect(true).to.be.true
  })
})
