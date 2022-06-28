import { expect } from 'chai'
import { BigNumber } from 'ethers'
import HRE from 'hardhat'

import {
  EmptySetGovernor,
  EmptySetGovernor__factory,
  ReserveImpl2__factory,
  ReserveImpl2,
  IERC20__factory,
  IERC20,
  WrapOnlyBatcher,
  WrapOnlyBatcher__factory,
} from '../../types/generated'
import { govern, impersonate, time } from '../testutil'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ES_002 } from '../../proposals/emptyset/es002'
import { EMPTYSET_CONTRACTS } from '../../proposals/emptyset/contracts'
import { EXTERNAL_CONTRACTS } from '../../proposals/contracts'

const { ethers, deployments } = HRE
const FORK_BLOCK = 14279760
const USDC_HOLDER_ADDRESS = '0xE78388b4CE79068e89Bf8aA7f218eF6b9AB0e9d0'

const NEW_RESERVE_ADDRESS = '0xa3aA1b352711dd4aD4af1c555f873250b067e486'
const WRAP_ONLY_BATCHER_ADDRESS = '0x0B663CeaCEF01f2f88EB7451C70Aa069f19dB997'

const DSU_AMOUNT = ethers.utils.parseEther('1000000')
const USDC_AMOUNT = 1000000_000_000

describe('Empty Set Proposal 002', () => {
  let funder: SignerWithAddress
  let user: SignerWithAddress
  let timelockSigner: SignerWithAddress
  let essSigner: SignerWithAddress
  let usdcHolder: SignerWithAddress
  let governor: EmptySetGovernor
  let dsu: IERC20
  let usdc: IERC20
  let reserveImpl2: ReserveImpl2
  let reserve: ReserveImpl2
  let batcher: WrapOnlyBatcher

  let initialReserveBalance: BigNumber

  beforeEach(async () => {
    time.reset(HRE.config, FORK_BLOCK)
    ;[funder, user] = await ethers.getSigners()
    essSigner = await impersonate.impersonateWithBalance(
      EMPTYSET_CONTRACTS.ESS_HOLDER_ADDRESS,
      ethers.utils.parseEther('10'),
    )
    timelockSigner = await impersonate.impersonateWithBalance(
      (
        await deployments.get('EmptySetTimelock')
      ).address,
      ethers.utils.parseEther('10'),
    )

    governor = await EmptySetGovernor__factory.connect((await deployments.get('EmptySetGovernor')).address, funder)
    batcher = await WrapOnlyBatcher__factory.connect((await deployments.get('WrapOnlyBatcher')).address, funder)

    dsu = IERC20__factory.connect(EMPTYSET_CONTRACTS.DSU, funder)
    usdc = IERC20__factory.connect(EXTERNAL_CONTRACTS.USDC, funder)
    // reserveImpl2 = await new ReserveImpl2__factory(funder).deploy()
    reserveImpl2 = await new ReserveImpl2__factory(funder).attach(NEW_RESERVE_ADDRESS)
    reserve = ReserveImpl2__factory.connect(EMPTYSET_CONTRACTS.RESERVE, funder)

    await govern.propose(
      governor,
      (
        await deployments.get('EmptySetShare')
      ).address,
      ES_002,
      essSigner,
      [],
      false,
      false,
    )

    await reserve.mint(0)
    initialReserveBalance = await reserve.reserveBalance()
  })

  it('lends DSU to Wrap only Batcher', async () => {
    expect(await dsu.balanceOf(WRAP_ONLY_BATCHER_ADDRESS)).to.equal(DSU_AMOUNT)

    expect(await reserve.debt(WRAP_ONLY_BATCHER_ADDRESS)).to.equal(DSU_AMOUNT)
    expect(await reserve.totalDebt()).to.equal(DSU_AMOUNT)
    expect(await reserve.reserveBalance()).to.equal(initialReserveBalance)
    expect((await reserve.redeemPrice()).value).to.equal(ethers.utils.parseEther('1'))
    expect((await reserve.reserveRatio()).value.gt(ethers.utils.parseEther('1'))).to.equal(true)
  })

  it('upgrades the reserve', async () => {
    expect(await reserve.implementation()).to.equal(reserveImpl2.address)
  })

  describe('Reserve', () => {
    beforeEach(async () => {
      usdcHolder = await impersonate.impersonateWithBalance(USDC_HOLDER_ADDRESS, ethers.utils.parseEther('10'))
      await usdc.connect(usdcHolder).transfer(user.address, USDC_AMOUNT)
      await usdc.connect(user).approve(reserve.address, USDC_AMOUNT)
    })

    it('mints DSU', async () => {
      await expect(reserve.connect(user).mint(DSU_AMOUNT))
        .to.emit(reserve, 'Mint')
        .withArgs(user.address, DSU_AMOUNT, USDC_AMOUNT)

      expect(await usdc.balanceOf(user.address)).to.equal(0)
      expect(await dsu.balanceOf(user.address)).to.equal(DSU_AMOUNT)

      expect(await reserve.debt(WRAP_ONLY_BATCHER_ADDRESS)).to.equal(DSU_AMOUNT)
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

      expect(await reserve.debt(WRAP_ONLY_BATCHER_ADDRESS)).to.equal(DSU_AMOUNT)
      expect(await reserve.totalDebt()).to.equal(DSU_AMOUNT)
      expect(await reserve.reserveBalance()).to.closeTo(initialReserveBalance, 100_000)
      expect((await reserve.redeemPrice()).value).to.equal(ethers.utils.parseEther('1'))
      expect((await reserve.reserveRatio()).value.gt(ethers.utils.parseEther('1'))).to.equal(true)
    })
  })

  describe('WrapOnlyBatcher', () => {
    beforeEach(async () => {
      usdcHolder = await impersonate.impersonateWithBalance(USDC_HOLDER_ADDRESS, ethers.utils.parseEther('10'))
      await usdc.connect(usdcHolder).transfer(user.address, USDC_AMOUNT)
      await usdc.connect(user).approve(batcher.address, USDC_AMOUNT)
    })

    context('initialize', async () => {
      it('takes ownership', async () => {
        expect(await batcher.owner()).to.equal((await deployments.get('EmptySetTimelock')).address)
        expect(await batcher.pendingOwner()).to.equal(ethers.constants.AddressZero)
      })
    })

    context('#mint', async () => {
      it('mints DSU', async () => {
        await expect(batcher.connect(user).wrap(DSU_AMOUNT, user.address))
          .to.emit(batcher, 'Wrap')
          .withArgs(user.address, DSU_AMOUNT)

        expect(await usdc.balanceOf(user.address)).to.equal(0)
        expect(await dsu.balanceOf(user.address)).to.equal(DSU_AMOUNT)
        expect(await usdc.balanceOf(batcher.address)).to.equal(USDC_AMOUNT)
        expect(await dsu.balanceOf(batcher.address)).to.equal(0)

        expect(await reserve.debt(WRAP_ONLY_BATCHER_ADDRESS)).to.equal(DSU_AMOUNT)
        expect(await reserve.totalDebt()).to.equal(DSU_AMOUNT)
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

        expect(await reserve.debt(WRAP_ONLY_BATCHER_ADDRESS)).to.equal(DSU_AMOUNT)
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

        expect(await reserve.debt(WRAP_ONLY_BATCHER_ADDRESS)).to.equal(DSU_AMOUNT)
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

        expect(await reserve.debt(WRAP_ONLY_BATCHER_ADDRESS)).to.equal(0)
        expect(await reserve.totalDebt()).to.equal(0)
        expect(await reserve.reserveBalance()).to.closeTo(initialReserveBalance, 100_000)
        expect((await reserve.redeemPrice()).value).to.equal(ethers.utils.parseEther('1'))
        expect((await reserve.reserveRatio()).value.gt(ethers.utils.parseEther('1'))).to.equal(true)
      })

      it('closes batcher (partial)', async () => {
        await batcher.connect(user).wrap(ethers.utils.parseEther('500000'), user.address)

        await expect(batcher.connect(timelockSigner).close()).to.emit(batcher, 'Close').withArgs(DSU_AMOUNT)

        expect(await usdc.balanceOf(batcher.address)).to.equal(0)
        expect(await dsu.balanceOf(batcher.address)).to.equal(0)

        expect(await reserve.debt(WRAP_ONLY_BATCHER_ADDRESS)).to.equal(0)
        expect(await reserve.totalDebt()).to.equal(0)
        expect(await reserve.reserveBalance()).to.closeTo(initialReserveBalance.add(500000_000_000), 100_000)
        expect((await reserve.redeemPrice()).value).to.equal(ethers.utils.parseEther('1'))
        expect((await reserve.reserveRatio()).value.gt(ethers.utils.parseEther('1'))).to.equal(true)
      })

      it('closes batcher (full)', async () => {
        await batcher.connect(user).wrap(DSU_AMOUNT, user.address)

        await expect(batcher.connect(timelockSigner).close()).to.emit(batcher, 'Close').withArgs(DSU_AMOUNT)

        expect(await usdc.balanceOf(batcher.address)).to.equal(0)
        expect(await dsu.balanceOf(batcher.address)).to.equal(0)

        expect(await reserve.debt(WRAP_ONLY_BATCHER_ADDRESS)).to.equal(0)
        expect(await reserve.totalDebt()).to.equal(0)
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

        expect(await reserve.debt(WRAP_ONLY_BATCHER_ADDRESS)).to.equal(0)
        expect(await reserve.totalDebt()).to.equal(0)
        expect(await reserve.reserveBalance()).to.closeTo(initialReserveBalance.add(999999_000_001), 100_000)
        expect((await reserve.redeemPrice()).value).to.equal(ethers.utils.parseEther('1'))
        expect((await reserve.reserveRatio()).value.gt(ethers.utils.parseEther('1'))).to.equal(true)
      })

      it('reverts if not owner', async () => {
        await expect(batcher.connect(user).close()).to.be.reverted
      })
    })
  })
})
