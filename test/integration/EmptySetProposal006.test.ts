import { expect } from 'chai'
import { BigNumber, Signer } from 'ethers'
import HRE from 'hardhat'

import {
  EmptySetGovernor,
  EmptySetGovernor__factory,
  ReserveImpl4__factory,
  ReserveImpl4,
  IERC20__factory,
  IERC20,
  TwoWayBatcher,
  TwoWayBatcher__factory,
  EmptySetGovernor2__factory,
} from '../../types/generated'
import { govern, impersonate, time } from '../testutil'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { EMPTYSET_CONTRACTS } from '../../proposals/emptyset/contracts'
import { EXTERNAL_CONTRACTS } from '../../proposals/contracts'
import { ES_006 } from '../../proposals/emptyset/es006'

const { ethers, deployments } = HRE
const FORK_BLOCK = 16307564
const PROPOSER_ADDRESS = '0x589CDCf60aea6B961720214e80b713eB66B89A4d' // Equilibria Multisig
const SUPPORTER_ADDRESSES = ['0x07b991579b4e1Ee01d7a3342AF93E96ecC59E0B3']
const USDC_HOLDER_ADDRESS = '0xae2d4617c862309a3d75a0ffb358c7a5009c673f'

const NEW_RESERVE_ADDRESS = '0x363aF3acFfEd0B7181C2E3c56C00922E142100a8'
const TWO_WAY_BATCHER_ADDRESS = '0xAEf566ca7E84d1E736f999765a804687f39D9094'

const DSU_AMOUNT = ethers.utils.parseEther('1000000')
const USDC_AMOUNT = 1000000_000_000

describe.only('Empty Set Proposal 006', () => {
  let funder: SignerWithAddress
  let proposerSigner: Signer
  let usdcHolderSigner: SignerWithAddress
  let supporterSigners: Signer[]
  let timelockSigner: SignerWithAddress
  let user: SignerWithAddress
  let governor: EmptySetGovernor
  let dsu: IERC20
  let usdc: IERC20
  let reserveImpl4: ReserveImpl4
  let reserve: ReserveImpl4
  let batcher: TwoWayBatcher
  let ess: IERC20

  let initialReserveBalance: BigNumber

  beforeEach(async () => {
    time.reset(HRE.config, FORK_BLOCK)
    ;[funder, user] = await ethers.getSigners()
    timelockSigner = await impersonate.impersonateWithBalance(
      (
        await deployments.get('EmptySetTimelock')
      ).address,
      ethers.utils.parseEther('10'),
    )
    proposerSigner = await impersonate.impersonateWithBalance(PROPOSER_ADDRESS, ethers.utils.parseEther('10'))
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

    governor = await EmptySetGovernor__factory.connect((await deployments.get('EmptySetGovernor2')).address, funder)
    batcher = await TwoWayBatcher__factory.connect((await deployments.get('TwoWayBatcher')).address, funder)
    ess = IERC20__factory.connect((await deployments.get('EmptySetShare')).address, funder)

    dsu = IERC20__factory.connect(EMPTYSET_CONTRACTS.DSU, funder)
    usdc = IERC20__factory.connect(EXTERNAL_CONTRACTS.USDC, funder)
    reserveImpl4 = await new ReserveImpl4__factory(funder).attach(NEW_RESERVE_ADDRESS)
    reserve = ReserveImpl4__factory.connect(EMPTYSET_CONTRACTS.RESERVE, funder)

    expect(await batcher.pendingOwner()).to.equal((await deployments.get('EmptySetTimelock')).address)

    await govern.propose(governor, ess.address, ES_006(), proposerSigner, supporterSigners, false, true)

    await reserve.mint(0)
    initialReserveBalance = await reserve.reserveBalance()
  })

  it('burns the reserve ESS', async () => {
    expect(await ess.balanceOf(reserve.address)).to.equal(0)
  })

  it('lends DSU to Two Way Batcher', async () => {
    expect(await dsu.balanceOf(TWO_WAY_BATCHER_ADDRESS)).to.equal(DSU_AMOUNT)

    expect(await reserve.debt(TWO_WAY_BATCHER_ADDRESS)).to.equal(DSU_AMOUNT)
    expect(await reserve.totalDebt()).to.equal(DSU_AMOUNT)
    expect(await reserve.reserveBalance()).to.equal(initialReserveBalance)
    expect((await reserve.redeemPrice()).value).to.equal(ethers.utils.parseEther('1'))
    expect((await reserve.reserveRatio()).value.gt(ethers.utils.parseEther('1'))).to.equal(true)
  })

  it('upgrades the reserve', async () => {
    expect(await reserve.implementation()).to.equal(reserveImpl4.address)
  })

  describe('Reserve', () => {
    beforeEach(async () => {
      await usdc.connect(usdcHolderSigner).transfer(user.address, USDC_AMOUNT)
      await usdc.connect(user).approve(reserve.address, USDC_AMOUNT)
    })

    it('mints DSU', async () => {
      await expect(reserve.connect(user).mint(DSU_AMOUNT))
        .to.emit(reserve, 'Mint')
        .withArgs(user.address, DSU_AMOUNT, USDC_AMOUNT)

      expect(await usdc.balanceOf(user.address)).to.equal(0)
      expect(await dsu.balanceOf(user.address)).to.equal(DSU_AMOUNT)

      expect(await reserve.debt(TWO_WAY_BATCHER_ADDRESS)).to.equal(DSU_AMOUNT)
      expect(await reserve.totalDebt()).to.equal(DSU_AMOUNT)
      expect(await reserve.reserveBalance()).to.closeTo(initialReserveBalance.add(USDC_AMOUNT), 100_000)
      expect((await reserve.redeemPrice()).value).to.equal(ethers.utils.parseEther('1'))
      expect((await reserve.reserveRatio()).value.gt(ethers.utils.parseEther('1'))).to.equal(true)
    })

    it('redeems DSU', async () => {
      await reserve.connect(user).mint(DSU_AMOUNT)
      await dsu.connect(user).approve(reserve.address, DSU_AMOUNT)

      await expect(reserve.connect(user).redeem(DSU_AMOUNT))
        .to.emit(reserve, 'Redeem')
        .withArgs(user.address, DSU_AMOUNT, USDC_AMOUNT)

      expect(await usdc.balanceOf(user.address)).to.equal(USDC_AMOUNT)
      expect(await dsu.balanceOf(user.address)).to.equal(0)

      expect(await reserve.debt(TWO_WAY_BATCHER_ADDRESS)).to.equal(DSU_AMOUNT)
      expect(await reserve.totalDebt()).to.equal(DSU_AMOUNT)
      expect(await reserve.reserveBalance()).to.closeTo(initialReserveBalance, 100_000)
      expect((await reserve.redeemPrice()).value).to.equal(ethers.utils.parseEther('1'))
      expect((await reserve.reserveRatio()).value.gt(ethers.utils.parseEther('1'))).to.equal(true)
    })
  })

  describe('WrapOnlyBatcher', () => {
    beforeEach(async () => {
      await usdc.connect(usdcHolderSigner).transfer(user.address, USDC_AMOUNT)
      await usdc.connect(user).approve(batcher.address, USDC_AMOUNT)

      await usdc.connect(usdcHolderSigner).transfer(batcher.address, USDC_AMOUNT)
      await batcher.connect(usdcHolderSigner).deposit(USDC_AMOUNT)
    })

    afterEach(async () => {
      const holderBalanceBefore = await usdc.balanceOf(usdcHolderSigner.address)
      await expect(batcher.connect(usdcHolderSigner).withdraw(USDC_AMOUNT))
        .to.emit(batcher, 'Withdraw')
        .withArgs(user.address, BigNumber.from(USDC_AMOUNT).mul(1e12))

      expect(await usdc.balanceOf(batcher.address)).to.equal(USDC_AMOUNT)
      expect(await usdc.balanceOf(usdcHolderSigner.address)).to.equal(holderBalanceBefore.add(USDC_AMOUNT))
    })

    context('initialize', async () => {
      it('takes ownership', async () => {
        expect(await batcher.owner()).to.equal((await deployments.get('EmptySetTimelock')).address)
        expect(await batcher.pendingOwner()).to.equal(ethers.constants.AddressZero)
      })
    })

    context('#wrap', async () => {
      it('mints DSU', async () => {
        await expect(batcher.connect(user).wrap(DSU_AMOUNT, user.address))
          .to.emit(batcher, 'Wrap')
          .withArgs(user.address, DSU_AMOUNT)

        expect(await usdc.balanceOf(user.address)).to.equal(0)
        expect(await dsu.balanceOf(user.address)).to.equal(DSU_AMOUNT)
        expect(await usdc.balanceOf(batcher.address)).to.equal(USDC_AMOUNT * 2)
        expect(await dsu.balanceOf(batcher.address)).to.equal(0)

        expect(await reserve.debt(TWO_WAY_BATCHER_ADDRESS)).to.equal(DSU_AMOUNT)
        expect(await reserve.totalDebt()).to.equal(DSU_AMOUNT.mul(2))
        expect(await reserve.reserveBalance()).to.equal(initialReserveBalance)
        expect((await reserve.redeemPrice()).value).to.equal(ethers.utils.parseEther('1'))
        expect((await reserve.reserveRatio()).value.gt(ethers.utils.parseEther('1'))).to.equal(true)
      })
    })

    context('#unwrap', async () => {
      await batcher.connect(user).wrap(DSU_AMOUNT, user.address)

      it('redeems DSU', async () => {
        await expect(batcher.connect(user).unwrap(DSU_AMOUNT, user.address))
          .to.emit(batcher, 'Unwrap')
          .withArgs(user.address, DSU_AMOUNT)

        expect(await usdc.balanceOf(user.address)).to.equal(USDC_AMOUNT)
        expect(await dsu.balanceOf(user.address)).to.equal(0)
        expect(await usdc.balanceOf(batcher.address)).to.equal(0)
        expect(await dsu.balanceOf(batcher.address)).to.equal(DSU_AMOUNT)

        expect(await reserve.debt(TWO_WAY_BATCHER_ADDRESS)).to.equal(DSU_AMOUNT)
        expect(await reserve.totalDebt()).to.equal(DSU_AMOUNT.mul(2))
        expect(await reserve.reserveBalance()).to.equal(initialReserveBalance)
        expect((await reserve.redeemPrice()).value).to.equal(ethers.utils.parseEther('1'))
        expect((await reserve.reserveRatio()).value.gt(ethers.utils.parseEther('1'))).to.equal(true)
      })
    })

    context('#rebalance', async () => {
      it('rebalances DSU', async () => {
        await batcher.connect(user).wrap(DSU_AMOUNT, user.address)

        await expect(batcher.connect(user).rebalance()).to.emit(batcher, 'Rebalance').withArgs(DSU_AMOUNT, 0)

        expect(await usdc.balanceOf(batcher.address)).to.equal(0)
        expect(await dsu.balanceOf(batcher.address)).to.equal(DSU_AMOUNT)

        expect(await reserve.debt(TWO_WAY_BATCHER_ADDRESS)).to.equal(DSU_AMOUNT)
        expect(await reserve.totalDebt()).to.equal(DSU_AMOUNT)
        expect(await reserve.reserveBalance()).to.closeTo(initialReserveBalance.add(USDC_AMOUNT), 100_000)
        expect((await reserve.redeemPrice()).value).to.equal(ethers.utils.parseEther('1'))
        expect((await reserve.reserveRatio()).value.gt(ethers.utils.parseEther('1'))).to.equal(true)
      })

      it('rebalances extra DSU', async () => {
        await batcher.connect(user).wrap(ethers.utils.parseEther('999999').add(1), user.address)

        await expect(batcher.connect(user).rebalance())
          .to.emit(batcher, 'Rebalance')
          .withArgs(ethers.utils.parseEther('999999.000001'), 0)

        expect(await usdc.balanceOf(batcher.address)).to.equal(0)
        expect(await dsu.balanceOf(batcher.address)).to.equal(ethers.utils.parseEther('1000000.000001').sub(1))

        expect(await reserve.debt(TWO_WAY_BATCHER_ADDRESS)).to.equal(DSU_AMOUNT)
        expect(await reserve.totalDebt()).to.equal(DSU_AMOUNT)
        expect(await reserve.reserveBalance()).to.closeTo(initialReserveBalance.add(999999_000_001), 100_000)
        expect((await reserve.redeemPrice()).value).to.equal(ethers.utils.parseEther('1'))
        expect((await reserve.reserveRatio()).value.gt(ethers.utils.parseEther('1'))).to.equal(true)
      })
    })

    context('#close', async () => {
      it('closes batcher (empty)', async () => {
        await expect(batcher.connect(timelockSigner).close()).to.emit(batcher, 'Close').withArgs(DSU_AMOUNT)

        expect(await usdc.balanceOf(batcher.address)).to.equal(0)
        expect(await dsu.balanceOf(batcher.address)).to.equal(0)

        expect(await reserve.debt(TWO_WAY_BATCHER_ADDRESS)).to.equal(0)
        expect(await reserve.totalDebt()).to.equal(DSU_AMOUNT)
        expect(await reserve.reserveBalance()).to.closeTo(initialReserveBalance, 100_000)
        expect((await reserve.redeemPrice()).value).to.equal(ethers.utils.parseEther('1'))
        expect((await reserve.reserveRatio()).value.gt(ethers.utils.parseEther('1'))).to.equal(true)
      })

      it('closes batcher (partial)', async () => {
        await batcher.connect(user).wrap(ethers.utils.parseEther('500000'), user.address)

        await expect(batcher.connect(timelockSigner).close()).to.emit(batcher, 'Close').withArgs(DSU_AMOUNT)

        expect(await usdc.balanceOf(batcher.address)).to.equal(0)
        expect(await dsu.balanceOf(batcher.address)).to.equal(0)

        expect(await reserve.debt(TWO_WAY_BATCHER_ADDRESS)).to.equal(0)
        expect(await reserve.totalDebt()).to.equal(DSU_AMOUNT)
        expect(await reserve.reserveBalance()).to.closeTo(initialReserveBalance.add(500000_000_000), 100_000)
        expect((await reserve.redeemPrice()).value).to.equal(ethers.utils.parseEther('1'))
        expect((await reserve.reserveRatio()).value.gt(ethers.utils.parseEther('1'))).to.equal(true)
      })

      it('closes batcher (full)', async () => {
        await batcher.connect(user).wrap(DSU_AMOUNT, user.address)

        await expect(batcher.connect(timelockSigner).close()).to.emit(batcher, 'Close').withArgs(DSU_AMOUNT)

        expect(await usdc.balanceOf(batcher.address)).to.equal(0)
        expect(await dsu.balanceOf(batcher.address)).to.equal(0)

        expect(await reserve.debt(TWO_WAY_BATCHER_ADDRESS)).to.equal(0)
        expect(await reserve.totalDebt()).to.equal(DSU_AMOUNT)
        expect(await reserve.reserveBalance()).to.closeTo(initialReserveBalance.add(USDC_AMOUNT), 100_000)
        expect((await reserve.redeemPrice()).value).to.equal(ethers.utils.parseEther('1'))
        expect((await reserve.reserveRatio()).value.gt(ethers.utils.parseEther('1'))).to.equal(true)
      })

      it('closes batcher (round up)', async () => {
        await batcher.connect(user).wrap(ethers.utils.parseEther('999999').add(1), user.address)

        await expect(batcher.connect(timelockSigner).close())
          .to.emit(batcher, 'Close')
          .withArgs(ethers.utils.parseEther('1000000.000001').sub(1))

        expect(await usdc.balanceOf(batcher.address)).to.equal(0)
        expect(await dsu.balanceOf(batcher.address)).to.equal(0)

        expect(await reserve.debt(TWO_WAY_BATCHER_ADDRESS)).to.equal(0)
        expect(await reserve.totalDebt()).to.equal(DSU_AMOUNT)
        expect(await reserve.reserveBalance()).to.closeTo(initialReserveBalance.add(999999_000_001), 100_000)
        expect((await reserve.redeemPrice()).value).to.equal(ethers.utils.parseEther('1'))
        expect((await reserve.reserveRatio()).value.gt(ethers.utils.parseEther('1'))).to.equal(true)
      })

      it('closes batcher (extra deposit)', async () => {
        const DEPOSIT_AMOUNT = 100_000_001
        await batcher.connect(user).wrap(DSU_AMOUNT, user.address)
        await usdc.connect(usdcHolderSigner).transfer(batcher.address, DEPOSIT_AMOUNT)

        await expect(batcher.connect(timelockSigner).close()).to.emit(batcher, 'Close').withArgs(DSU_AMOUNT)

        expect(await usdc.balanceOf(batcher.address)).to.equal(0)
        expect(await dsu.balanceOf(batcher.address)).to.equal(0)

        expect(await reserve.debt(TWO_WAY_BATCHER_ADDRESS)).to.equal(0)
        expect(await reserve.totalDebt()).to.equal(DSU_AMOUNT)
        expect(await reserve.reserveBalance()).to.closeTo(
          initialReserveBalance.add(USDC_AMOUNT).add(DEPOSIT_AMOUNT),
          100_000,
        )
        expect((await reserve.redeemPrice()).value).to.equal(ethers.utils.parseEther('1'))
        expect((await reserve.reserveRatio()).value.gt(ethers.utils.parseEther('1'))).to.equal(true)
      })

      it('reverts if not owner', async () => {
        await expect(batcher.connect(user).close()).to.be.reverted
      })
    })
  })
})
