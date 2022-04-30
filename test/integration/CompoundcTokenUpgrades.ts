import HRE from 'hardhat'
import { expect } from 'chai'
import { Signer, utils } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import {
  CompoundGovernor__factory,
  CompoundGovernor,
  CErc20Delegator__factory,
  CToken__factory,
  CErc20DelegateNew,
  CErc20DelegateNew__factory,
  IERC20,
  IERC20__factory,
} from '../../types/generated'
import { govern, impersonate, time } from '../testutil'
import { COMP_096 } from '../../proposals/compound/comp096'
import { COMP_101 } from '../../proposals/compound/comp101'
import { COMP_104 } from '../../proposals/compound/comp104'

const { ethers, deployments } = HRE
const PROPOSER_ADDRESS = '0x589CDCf60aea6B961720214e80b713eB66B89A4d' // Equilibria Multisig
const SUPPORTER_ADDRESSES = ['0x9aa835bc7b8ce13b9b0c9764a52fbf71ac62ccf1', '0xea6C3Db2e7FCA00Ea9d7211a03e83f568Fc13BF7']

const USE_REAL_DEPLOY = true

describe('Compound cToken Upgrades', () => {
  let forkBlock: number
  let funder: SignerWithAddress
  let proposerSigner: Signer
  let supporterSigners: Signer[]
  let governor: CompoundGovernor
  let newDelegate: CErc20DelegateNew

  let COMP: IERC20
  let USDC: IERC20

  before(async () => {
    if (USE_REAL_DEPLOY) {
      console.log(`Using cERC20Delegate impl deployed at ${(await deployments.get('CErc20Delegate')).address}`)
    } else {
      console.log('Deploying a new cERC20Delegate implementation')
    }
  })

  beforeEach(async () => {
    console.log(`Forking at block ${forkBlock}`)
    await time.reset(HRE.config, forkBlock)

    proposerSigner = await impersonate.impersonateWithBalance(PROPOSER_ADDRESS, ethers.utils.parseEther('10'))
    ;[funder] = await ethers.getSigners()
    supporterSigners = await Promise.all(
      SUPPORTER_ADDRESSES.map(s => impersonate.impersonateWithBalance(s, ethers.utils.parseEther('10'))),
    )
    governor = await CompoundGovernor__factory.connect(
      (
        await deployments.get('CompoundGovernor')
      ).address,
      proposerSigner,
    )

    newDelegate = USE_REAL_DEPLOY
      ? await CErc20DelegateNew__factory.connect((await deployments.get('CErc20Delegate')).address, funder)
      : await new CErc20DelegateNew__factory(funder).deploy()

    COMP = await IERC20__factory.connect('0xc00e94Cb662C3520282E6f5717214004A7f26888', funder)
    USDC = await IERC20__factory.connect('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', funder)
  })

  async function testProposal(proposal: govern.Proposal, ctokens: string[]) {
    const before = await Promise.all(
      ctokens.map(async ctokenAddress => {
        const cerc20Delegator = await CErc20Delegator__factory.connect(ctokenAddress, funder)
        const ctoken = await CToken__factory.connect(ctokenAddress, funder)
        expect(await cerc20Delegator.implementation()).to.not.equal(newDelegate.address)
        // This will return an error code (old impl)
        expect(await ctoken.callStatic._setPendingAdmin(funder.address)).to.equal('1')
        return {
          cerc20Delegator,
          ctoken,
          symbol: await ctoken.symbol(),
          totalSupply: await ctoken.totalSupply(),
          totalBorrows: await ctoken.totalBorrows(),
          totalReserves: await ctoken.totalReserves(),
        }
      }),
    )

    await govern.propose(
      governor,
      (
        await deployments.get('COMP')
      ).address,
      proposal,
      proposerSigner,
      supporterSigners,
      true,
    )

    await Promise.all(
      before.map(async ({ cerc20Delegator, ctoken, totalSupply, totalBorrows, totalReserves, symbol }) => {
        expect(await cerc20Delegator.implementation()).to.equal(newDelegate.address)
        expect(await ctoken.totalSupply()).to.equal(totalSupply)
        expect(await ctoken.totalBorrows()).to.equal(totalBorrows)
        expect(await ctoken.totalReserves()).to.equal(totalReserves)
        // This will now revert with a custom error
        await expect(ctoken.callStatic._setPendingAdmin(funder.address)).to.be.reverted
        console.log(`Verified ${symbol}`)
        return true
      }),
    )
  }

  describe('COMP096', () => {
    before(async () => {
      forkBlock = 14476802
    })
    it('performs Compound 96 Proposal', async () => {
      const { proposal, ctokens } = COMP_096(newDelegate.address)
      await testProposal(proposal, ctokens)
    }).timeout(600000)
  })

  describe('COMP101', () => {
    before(async () => {
      forkBlock = 14579191
    })

    it('performs Compound 101 Proposal', async () => {
      const { proposal, ctokens } = COMP_101(newDelegate.address)
      await testProposal(proposal, ctokens)
    }).timeout(600000)
  })

  describe.only('COMP104', () => {
    before(async () => {
      forkBlock = 14683075
    })

    it('performs Compound 104 Proposal', async () => {
      const { proposal, ctokens } = COMP_104(newDelegate.address)
      const eqCOMPBalanceBefore = await COMP.balanceOf(PROPOSER_ADDRESS)
      const clabsUSDCBalanceBefore = await USDC.balanceOf('0xe8F0c9059b8Db5B863d48dB8e8C1A09f97D3B991')

      await testProposal(proposal, ctokens)

      const eqCOMPBalanceAfter = await COMP.balanceOf(PROPOSER_ADDRESS)
      const clabsUSDCBalanceAfter = await USDC.balanceOf('0xe8F0c9059b8Db5B863d48dB8e8C1A09f97D3B991')

      expect(eqCOMPBalanceAfter.sub(eqCOMPBalanceBefore)).to.equal(utils.parseEther('3070.1754385965'))
      console.log('Verified Equilibria COMP Grant')
      expect(clabsUSDCBalanceAfter.sub(clabsUSDCBalanceBefore)).to.equal(79764.36e6)
      console.log('Verified Compound Labs USDC Repayment')
    }).timeout(600000)
  })
})
