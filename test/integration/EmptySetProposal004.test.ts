import HRE from 'hardhat'
import { expect } from 'chai'
import { Signer } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import {
  EmptySetGovernor2__factory,
  EmptySetGovernor2,
  EmptySetReserve,
  EmptySetReserve__factory,
  ReserveImpl3,
  ReserveImpl3__factory,
  IERC20,
  IERC20__factory,
} from '../../types/generated'
import { govern, impersonate, time } from '../testutil'
import { EMPTYSET_CONTRACTS } from '../../proposals/emptyset/contracts'
import { ES_004, NEW_RESERVE_IMPL_ADDRESS } from '../../proposals/emptyset/es004'

const { ethers, deployments } = HRE
const PROPOSER_ADDRESS = '0x589CDCf60aea6B961720214e80b713eB66B89A4d' // Equilibria Multisig
const SUPPORTER_ADDRESSES = ['0x07b991579b4e1Ee01d7a3342AF93E96ecC59E0B3']
const USDC_HOLDER_ADDRESS = '0xae2d4617c862309a3d75a0ffb358c7a5009c673f'

const USE_REAL_DEPLOY = true
const FORK_BLOCK = 15410363

describe('Empty Set Proposal 004', () => {
  let funder: SignerWithAddress
  let proposerSigner: Signer
  let multisigSigner: Signer
  let usdcHolderSigner: SignerWithAddress
  let supporterSigners: Signer[]
  let governor: EmptySetGovernor2
  let newReserveImpl: ReserveImpl3
  let reserve: EmptySetReserve

  before(async () => {
    if (USE_REAL_DEPLOY) {
      console.log(`Using ReserveImpl3 impl deployed at ${NEW_RESERVE_IMPL_ADDRESS}`)
    } else {
      console.log('Deploying a new ReserveImpl3 implementation')
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
    usdcHolderSigner = await impersonate.impersonateWithBalance(USDC_HOLDER_ADDRESS, ethers.utils.parseEther('10'))
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
    newReserveImpl = USE_REAL_DEPLOY
      ? await ReserveImpl3__factory.connect(NEW_RESERVE_IMPL_ADDRESS, funder)
      : await new ReserveImpl3__factory(funder).deploy()

    reserve = EmptySetReserve__factory.connect((await deployments.get('EmptySetReserve')).address, funder)

    await govern.propose(
      governor,
      (
        await deployments.get('EmptySetShare')
      ).address,
      ES_004(newReserveImpl.address),
      proposerSigner,
      supporterSigners,
      false,
      false,
    )
  })

  it('upgrades the impl', async () => {
    expect(await reserve.callStatic.implementation()).to.equal(newReserveImpl.address)
    const reserveReader = ReserveImpl3__factory.connect(reserve.address, funder)

    expect(await reserveReader.pauser()).to.equal(await multisigSigner.getAddress())
    expect(await reserveReader.paused()).to.be.false
  })

  context('guardian', () => {
    let USDC: IERC20
    let DSU: IERC20

    beforeEach(async () => {
      USDC = IERC20__factory.connect('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', usdcHolderSigner)
      DSU = IERC20__factory.connect(EMPTYSET_CONTRACTS.DSU, usdcHolderSigner)
      newReserveImpl = ReserveImpl3__factory.connect(reserve.address, multisigSigner)

      await USDC.approve(reserve.address, ethers.constants.MaxUint256)
      await DSU.approve(reserve.address, ethers.constants.MaxUint256)
    })

    it('pauses and unpauses', async () => {
      expect(await newReserveImpl.paused()).to.be.false

      await newReserveImpl.setPaused(true)

      expect(await newReserveImpl.paused()).to.be.true
      await expect(newReserveImpl.connect(usdcHolderSigner).mint(1000)).to.be.revertedWith('Implementation: paused')

      await newReserveImpl.setPaused(false)

      expect(await newReserveImpl.paused()).to.be.false
      await expect(newReserveImpl.connect(usdcHolderSigner).mint(1000)).to.not.be.reverted

      await newReserveImpl.setPaused(true)
      await expect(newReserveImpl.connect(usdcHolderSigner).redeem(1000)).to.be.revertedWith('Implementation: paused')

      await newReserveImpl.setPaused(false)
      await expect(newReserveImpl.connect(usdcHolderSigner).redeem(1000)).to.not.be.reverted
    })
  })
})
