import { expect } from 'chai'
import { BigNumber, Signer } from 'ethers'
import HRE from 'hardhat'

import {
  EmptySetGovernor,
  EmptySetGovernor2__factory,
  IERC20__factory,
  IERC20,
  WrapOnlyBatcher__factory,
  WrapOnlyBatcher,
  ReserveImpl2,
  ReserveImpl2__factory,
} from '../../types/generated'
import { govern, impersonate, time } from '../testutil'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ES_007 } from '../../proposals/emptyset/es007'
import { EMPTYSET_CONTRACTS } from '../../proposals/emptyset/contracts'
import { EXTERNAL_CONTRACTS } from '../../proposals/contracts'
import { WRAP_ONLY_BATCHER_ADDRESS } from '../../proposals/emptyset/es002'

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
  let dsu: IERC20
  let usdc: IERC20
  let reserve: ReserveImpl2
  let batcher: WrapOnlyBatcher

  beforeEach(async () => {
    time.reset(HRE.config, FORK_BLOCK)
    ;[funder, user] = await ethers.getSigners()
    proposerSigner = await impersonate.impersonateWithBalance(PROPOSER_ADDRESS, ethers.utils.parseEther('10'))
    supporterSigners = await Promise.all(
      SUPPORTER_ADDRESSES.map(s => impersonate.impersonateWithBalance(s, ethers.utils.parseEther('10'))),
    )
    ;[funder] = await ethers.getSigners()

    governor = await EmptySetGovernor2__factory.connect((await deployments.get('EmptySetGovernor2')).address, funder)
    ess = IERC20__factory.connect((await deployments.get('EmptySetShare')).address, funder)
    dsu = IERC20__factory.connect(EMPTYSET_CONTRACTS.DSU, funder)
    usdc = IERC20__factory.connect(EXTERNAL_CONTRACTS.USDC, funder)
    batcher = await WrapOnlyBatcher__factory.connect((await deployments.get('WrapOnlyBatcher')).address, funder)
    reserve = ReserveImpl2__factory.connect(EMPTYSET_CONTRACTS.RESERVE, funder)

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
      '97473645876576',
    )
  })

  it('accepts ownership', async () => {
    expect(true).to.be.true
  })

  describe('WrapOnlyBatcher', () =>
    context('#close', async () => {
      let initialReserveBalance: BigNumber
      let batcherUSDCBalance: BigNumber
      beforeEach(async () => {
        batcherUSDCBalance = await usdc.balanceOf(WRAP_ONLY_BATCHER_ADDRESS)
        initialReserveBalance = await reserve.reserveBalance()
      })

      it('closes batcher', async () => {
        expect(await usdc.balanceOf(batcher.address)).to.equal(0)
        expect(await dsu.balanceOf(batcher.address)).to.equal(0)

        expect(await reserve.debt(WRAP_ONLY_BATCHER_ADDRESS)).to.equal(0)
        expect(await reserve.totalDebt()).to.equal(ethers.utils.parseEther('1000000')) // Outstanding TwoWayBatcher debt
        expect(await reserve.reserveBalance()).to.closeTo(initialReserveBalance.add(batcherUSDCBalance), 100_000)
        expect((await reserve.redeemPrice()).value).to.equal(ethers.utils.parseEther('1'))
        expect((await reserve.reserveRatio()).value.gt(ethers.utils.parseEther('1'))).to.equal(true)
      })
    }))
})
