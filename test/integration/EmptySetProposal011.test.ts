import { expect } from 'chai'
import { Signer } from 'ethers'
import HRE from 'hardhat'

import {
  EmptySetGovernor,
  EmptySetGovernor2__factory,
  IERC20__factory,
  IERC20,
  EmptySetReserve__factory,
  EmptySetReserve,
} from '../../types/generated'
import { govern, impersonate, time } from '../testutil'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ES_011 } from '../../proposals/emptyset/es011'

const { ethers, deployments } = HRE
const FORK_BLOCK = 20435868
const PROPOSER_ADDRESS = '0x589CDCf60aea6B961720214e80b713eB66B89A4d' // Equilibria Multisig
const SUPPORTER_ADDRESSES = ['0x07b991579b4e1Ee01d7a3342AF93E96ecC59E0B3']
const ESS_HOLDER = '0x0b7376f2a063C771D460210a4Fa8787C9A7379f9'

describe('Empty Set Proposal 011', () => {
  let funder: SignerWithAddress
  let proposerSigner: Signer
  let supporterSigners: Signer[]
  let governor: EmptySetGovernor
  let reserve: EmptySetReserve
  let ess: IERC20

  beforeEach(async () => {
    time.reset(HRE.config, FORK_BLOCK)
    ;[funder] = await ethers.getSigners()
    proposerSigner = await impersonate.impersonateWithBalance(PROPOSER_ADDRESS, ethers.utils.parseEther('10'))
    supporterSigners = await Promise.all(
      SUPPORTER_ADDRESSES.map(s => impersonate.impersonateWithBalance(s, ethers.utils.parseEther('10'))),
    )
    ;[funder] = await ethers.getSigners()

    governor = EmptySetGovernor2__factory.connect((await deployments.get('EmptySetGovernor2')).address, funder)
    reserve = EmptySetReserve__factory.connect((await deployments.get('EmptySetReserve')).address, funder)
    ess = IERC20__factory.connect((await deployments.get('EmptySetShare')).address, funder)

    await HRE.network.provider.request({
      method: 'hardhat_setBalance',
      params: [PROPOSER_ADDRESS, ethers.utils.parseEther('10').toHexString()],
    })
  })

  it('creates a COMP -> ESS Order', async () => {
    const comp = IERC20__factory.connect('0xc00e94cb662c3520282e6f5717214004a7f26888', funder)

    const compBalanceBefore = await comp.balanceOf(reserve.address)
    await govern.propose(governor, ess.address, ES_011(), proposerSigner, supporterSigners, false, true)

    const order = await reserve.order(comp.address, ess.address)
    expect(order.price.value).to.equal('267010781166742363801758')
    expect(order.amount).to.equal('93629178158121074194')

    const essHolderSigner = await impersonate.impersonateWithBalance(ESS_HOLDER, ethers.utils.parseEther('10'))
    await ess.connect(essHolderSigner).approve(reserve.address, '267010781166742363801758')
    await reserve.connect(essHolderSigner).swap(comp.address, ess.address, '267010781166742363801758') // Swap for 1 COMP
    const compBalanceAfter = await comp.balanceOf(reserve.address)
    expect(compBalanceAfter).to.eq(compBalanceBefore.sub(ethers.utils.parseEther('1')))
  })

  it('creates a cUSDC -> ESS Order', async () => {
    const cUSDC = IERC20__factory.connect('0x39aa39c021dfbae8fac545936693ac917d5e7563', funder)

    const cusdBalanceBefore = await cUSDC.balanceOf(reserve.address)
    await govern.propose(governor, ess.address, ES_011(), proposerSigner, supporterSigners, false, true)

    const order = await reserve.order(cUSDC.address, ess.address)
    expect(order.price.value).to.equal('1202997029728853536989138641122')
    expect(order.amount).to.equal('20781431194086')

    const essHolderSigner = await impersonate.impersonateWithBalance(ESS_HOLDER, ethers.utils.parseEther('10'))
    await ess.connect(essHolderSigner).approve(reserve.address, '120299702972885353699')
    await reserve.connect(essHolderSigner).swap(cUSDC.address, ess.address, '120299702972885353699') // Swap for 1 cUSDC
    const cUSDCBalanceAfter = await cUSDC.balanceOf(reserve.address)
    expect(cUSDCBalanceAfter).to.eq(cusdBalanceBefore.sub(ethers.utils.parseUnits('1', 8)))
  })
})
