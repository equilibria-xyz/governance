import { expect } from 'chai'
import { BigNumber, Contract, Signer } from 'ethers'
import HRE from 'hardhat'

import { EmptySetGovernor, EmptySetGovernor2__factory, IERC20__factory, IERC20 } from '../../types/generated'
import { govern, impersonate, time } from '../testutil'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ES_008, DFP_VESTER_ADDRESS } from '../../proposals/emptyset/es008'
import { EMPTYSET_CONTRACTS } from '../../proposals/emptyset/contracts'
const { ESS, TIMELOCK } = EMPTYSET_CONTRACTS

const { ethers, deployments } = HRE
const FORK_BLOCK = 16678982
const PROPOSER_ADDRESS = '0x589CDCf60aea6B961720214e80b713eB66B89A4d' // Equilibria Multisig
const SUPPORTER_ADDRESSES = ['0x07b991579b4e1Ee01d7a3342AF93E96ecC59E0B3']

describe('Empty Set Proposal 008', () => {
  let funder: SignerWithAddress
  let proposerSigner: Signer
  let supporterSigners: Signer[]
  let governor: EmptySetGovernor
  let ess: IERC20
  let vester: Contract

  beforeEach(async () => {
    time.reset(HRE.config, FORK_BLOCK)
    ;[funder] = await ethers.getSigners()
    proposerSigner = await impersonate.impersonateWithBalance(PROPOSER_ADDRESS, ethers.utils.parseEther('10'))
    supporterSigners = await Promise.all(
      SUPPORTER_ADDRESSES.map(s => impersonate.impersonateWithBalance(s, ethers.utils.parseEther('10'))),
    )
    ;[funder] = await ethers.getSigners()

    governor = await EmptySetGovernor2__factory.connect((await deployments.get('EmptySetGovernor2')).address, funder)
    ess = IERC20__factory.connect((await deployments.get('EmptySetShare')).address, funder)
    vester = await ethers.getContractAt(VesterIface, DFP_VESTER_ADDRESS)

    await HRE.network.provider.request({
      method: 'hardhat_setBalance',
      params: [PROPOSER_ADDRESS, ethers.utils.parseEther('10').toHexString()],
    })
  })

  it('revokes ESS stream', async () => {
    const vesterBalanceBefore = await ess.callStatic.balanceOf(vester.address)
    const tiemlockBalanceBefore = await ess.callStatic.balanceOf(TIMELOCK)
    await govern.propose(governor, ess.address, ES_008(), proposerSigner, supporterSigners, false, true)
    const releaseable: BigNumber = await vester.callStatic.releaseableAmount(ESS)
    const refund = vesterBalanceBefore.sub(releaseable)
    expect(await vester.callStatic.revoked(ESS)).to.be.true
    expect(await ess.balanceOf(vester.address)).to.equal(releaseable)
    expect(await ess.balanceOf(TIMELOCK)).to.equal(tiemlockBalanceBefore.add(refund))
  })
})

const VesterIface = [
  'function revoked(address) returns (bool)',
  'function releaseableAmount(address) returns (uint256)',
]
