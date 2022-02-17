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

const { ethers, deployments } = HRE
const FORK_BLOCK = 14218725

const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const DSU_ADDRESS = '0x605D26FBd5be761089281d5cec2Ce86eeA667109'
const ESS_ADDRESS = '0x07b991579b4e1Ee01d7a3342AF93E96ecC59E0B3'
const RESERVE_ADDRESS = '0xD05aCe63789cCb35B9cE71d01e4d632a0486Da4B'
const PROXY_ADMIN_ADDRESS = '0x4d2A5E3b7831156f62C8dF47604E321cdAF35fec'
const TIMELOCK_ADDRESS = '0x1bba92F379375387bf8F927058da14D47464cB7A'
const NEW_RESERVE_ADDRESS = '' // TODO: after reserve implementation deploy

const WRAP_ONLY_BATCHER_ADDRESS = '0x0B663CeaCEF01f2f88EB7451C70Aa069f19dB997'
const WRAP_ONLY_BATCHER_AMOUNT = ethers.utils.parseEther('1000000')

const USDC_HOLDER_ADDRESS = '0xE78388b4CE79068e89Bf8aA7f218eF6b9AB0e9d0'

const PROPOSAL_TEXT = `This a proposal` // TODO: complete

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
    essSigner = await impersonate.impersonateWithBalance(ESS_ADDRESS, ethers.utils.parseEther('10'))
    timelockSigner = await impersonate.impersonateWithBalance(TIMELOCK_ADDRESS, ethers.utils.parseEther('10'))

    governor = await EmptySetGovernor__factory.connect((await deployments.get('EmptySetGovernor')).address, funder)
    batcher = await WrapOnlyBatcher__factory.connect((await deployments.get('WrapOnlyBatcher')).address, funder)

    dsu = IERC20__factory.connect(DSU_ADDRESS, funder)
    usdc = IERC20__factory.connect(USDC_ADDRESS, funder)
    reserveImpl2 = await new ReserveImpl2__factory(funder).deploy()
    reserve = ReserveImpl2__factory.connect(RESERVE_ADDRESS, funder)

    await govern.propose(
      governor,
      (
        await deployments.get('EmptySetShare')
      ).address,
      {
        clauses: [
          {
            to: PROXY_ADMIN_ADDRESS,
            value: 0,
            method: 'upgrade(address,address)',
            argTypes: ['address', 'address'],
            argValues: [RESERVE_ADDRESS, reserveImpl2.address],
          },
          {
            to: WRAP_ONLY_BATCHER_ADDRESS,
            value: 0,
            method: 'acceptOwner()',
            argTypes: [],
            argValues: [],
          },
          {
            to: RESERVE_ADDRESS,
            value: 0,
            method: 'borrow(address,uint256)',
            argTypes: ['address', 'uint256'],
            argValues: [WRAP_ONLY_BATCHER_ADDRESS, WRAP_ONLY_BATCHER_AMOUNT],
          },
        ],
        description: PROPOSAL_TEXT,
      },
      essSigner,
      [],
      false,
      false,
    )

    await reserve.mint(0)
    initialReserveBalance = await reserve.reserveBalance()
  })

  it('lends DSU to Wrap only Batcher', async () => {
    expect(await dsu.balanceOf(WRAP_ONLY_BATCHER_ADDRESS)).to.equal(ethers.utils.parseEther('1000000'))

    expect(await reserve.debt(WRAP_ONLY_BATCHER_ADDRESS)).to.equal(ethers.utils.parseEther('1000000'))
    expect(await reserve.totalDebt()).to.equal(ethers.utils.parseEther('1000000'))
    expect(await reserve.reserveBalance()).to.equal(initialReserveBalance)
    expect((await reserve.redeemPrice()).value).to.equal(ethers.utils.parseEther('1'))
    expect((await reserve.reserveRatio()).value.gt(ethers.utils.parseEther('1'))).to.equal(true)
  }).timeout(60000)

  it('upgrades the reserve', async () => {
    expect(await reserve.implementation()).to.equal(reserveImpl2.address)
  }).timeout(60000)

  describe('Reserve', () => {
    beforeEach(async () => {
      usdcHolder = await impersonate.impersonateWithBalance(USDC_HOLDER_ADDRESS, ethers.utils.parseEther('10'))
      await usdc.connect(usdcHolder).transfer(user.address, 1000000_000_000)
      await usdc.connect(user).approve(reserve.address, 1000000_000_000)
    })

    it('mints DSU', async () => {
      await expect(reserve.connect(user).mint(ethers.utils.parseEther('1000000')))
        .to.emit(reserve, 'Mint')
        .withArgs(user.address, ethers.utils.parseEther('1000000'), 1000000_000_000)

      expect(await usdc.balanceOf(user.address)).to.equal(0)
      expect(await dsu.balanceOf(user.address)).to.equal(ethers.utils.parseEther('1000000'))

      expect(await reserve.debt(WRAP_ONLY_BATCHER_ADDRESS)).to.equal(ethers.utils.parseEther('1000000'))
      expect(await reserve.totalDebt()).to.equal(ethers.utils.parseEther('1000000'))
      expect(await reserve.reserveBalance()).to.closeTo(initialReserveBalance.add(1000000_000_000), 100_000)
      expect((await reserve.redeemPrice()).value).to.equal(ethers.utils.parseEther('1'))
      expect((await reserve.reserveRatio()).value.gt(ethers.utils.parseEther('1'))).to.equal(true)
    }).timeout(60000)

    it('redeems DSU', async () => {
      await reserve.connect(user).mint(ethers.utils.parseEther('1000000'))
      await dsu.connect(user).approve(reserve.address, ethers.utils.parseEther('1000000'))

      await expect(reserve.connect(user).redeem(ethers.utils.parseEther('1000000')))
        .to.emit(reserve, 'Redeem')
        .withArgs(user.address, ethers.utils.parseEther('1000000'), 1000000_000_000)

      expect(await usdc.balanceOf(user.address)).to.equal(1000000_000_000)
      expect(await dsu.balanceOf(user.address)).to.equal(0)

      expect(await reserve.debt(WRAP_ONLY_BATCHER_ADDRESS)).to.equal(ethers.utils.parseEther('1000000'))
      expect(await reserve.totalDebt()).to.equal(ethers.utils.parseEther('1000000'))
      expect(await reserve.reserveBalance()).to.closeTo(initialReserveBalance, 100_000)
      expect((await reserve.redeemPrice()).value).to.equal(ethers.utils.parseEther('1'))
      expect((await reserve.reserveRatio()).value.gt(ethers.utils.parseEther('1'))).to.equal(true)
    }).timeout(60000)
  })

  describe('WrapOnlyBatcher', () => {
    beforeEach(async () => {
      usdcHolder = await impersonate.impersonateWithBalance(USDC_HOLDER_ADDRESS, ethers.utils.parseEther('10'))
      await usdc.connect(usdcHolder).transfer(user.address, 1000000_000_000)
      await usdc.connect(user).approve(batcher.address, 1000000_000_000)
    })

    context('initialize', async () => {
      it('takes ownership', async () => {
        expect(await batcher.owner()).to.equal(TIMELOCK_ADDRESS)
        expect(await batcher.pendingOwner()).to.equal(ethers.constants.AddressZero)
      }).timeout(60000)
    })

    context('#mint', async () => {
      it('mints DSU', async () => {
        await expect(batcher.connect(user).wrap(ethers.utils.parseEther('1000000'), user.address))
          .to.emit(batcher, 'Wrap')
          .withArgs(user.address, ethers.utils.parseEther('1000000'))

        expect(await usdc.balanceOf(user.address)).to.equal(0)
        expect(await dsu.balanceOf(user.address)).to.equal(ethers.utils.parseEther('1000000'))
        expect(await usdc.balanceOf(batcher.address)).to.equal(1000000_000_000)
        expect(await dsu.balanceOf(batcher.address)).to.equal(0)

        expect(await reserve.debt(WRAP_ONLY_BATCHER_ADDRESS)).to.equal(ethers.utils.parseEther('1000000'))
        expect(await reserve.totalDebt()).to.equal(ethers.utils.parseEther('1000000'))
        expect(await reserve.reserveBalance()).to.equal(initialReserveBalance)
        expect((await reserve.redeemPrice()).value).to.equal(ethers.utils.parseEther('1'))
        expect((await reserve.reserveRatio()).value.gt(ethers.utils.parseEther('1'))).to.equal(true)
      }).timeout(60000)
    })

    context('#rebalance', async () => {
      it('rebalances DSU', async () => {
        await batcher.connect(user).wrap(ethers.utils.parseEther('1000000'), user.address)

        await expect(batcher.connect(user).rebalance())
          .to.emit(batcher, 'Rebalance')
          .withArgs(ethers.utils.parseEther('1000000'), 0)

        expect(await usdc.balanceOf(batcher.address)).to.equal(0)
        expect(await dsu.balanceOf(batcher.address)).to.equal(ethers.utils.parseEther('1000000'))

        expect(await reserve.debt(WRAP_ONLY_BATCHER_ADDRESS)).to.equal(ethers.utils.parseEther('1000000'))
        expect(await reserve.totalDebt()).to.equal(ethers.utils.parseEther('1000000'))
        expect(await reserve.reserveBalance()).to.closeTo(initialReserveBalance.add(1000000_000_000), 100_000)
        expect((await reserve.redeemPrice()).value).to.equal(ethers.utils.parseEther('1'))
        expect((await reserve.reserveRatio()).value.gt(ethers.utils.parseEther('1'))).to.equal(true)
      }).timeout(60000)

      it('rebalances extra DSU', async () => {
        await batcher.connect(user).wrap(ethers.utils.parseEther('999999').add(1), user.address)

        await expect(batcher.connect(user).rebalance())
          .to.emit(batcher, 'Rebalance')
          .withArgs(ethers.utils.parseEther('999999.000001'), 0)

        expect(await usdc.balanceOf(batcher.address)).to.equal(0)
        expect(await dsu.balanceOf(batcher.address)).to.equal(ethers.utils.parseEther('1000000.000001').sub(1))

        expect(await reserve.debt(WRAP_ONLY_BATCHER_ADDRESS)).to.equal(ethers.utils.parseEther('1000000'))
        expect(await reserve.totalDebt()).to.equal(ethers.utils.parseEther('1000000'))
        expect(await reserve.reserveBalance()).to.closeTo(initialReserveBalance.add(999999_000_001), 100_000)
        expect((await reserve.redeemPrice()).value).to.equal(ethers.utils.parseEther('1'))
        expect((await reserve.reserveRatio()).value.gt(ethers.utils.parseEther('1'))).to.equal(true)
      }).timeout(60000)
    })

    context('#close', async () => {
      it('closes batcher (empty)', async () => {
        await expect(batcher.connect(timelockSigner).close())
          .to.emit(batcher, 'Close')
          .withArgs(ethers.utils.parseEther('1000000'))

        expect(await usdc.balanceOf(batcher.address)).to.equal(0)
        expect(await dsu.balanceOf(batcher.address)).to.equal(0)

        expect(await reserve.debt(WRAP_ONLY_BATCHER_ADDRESS)).to.equal(0)
        expect(await reserve.totalDebt()).to.equal(0)
        expect(await reserve.reserveBalance()).to.closeTo(initialReserveBalance, 100_000)
        expect((await reserve.redeemPrice()).value).to.equal(ethers.utils.parseEther('1'))
        expect((await reserve.reserveRatio()).value.gt(ethers.utils.parseEther('1'))).to.equal(true)
      }).timeout(60000)

      it('closes batcher (partial)', async () => {
        await batcher.connect(user).wrap(ethers.utils.parseEther('500000'), user.address)

        await expect(batcher.connect(timelockSigner).close())
          .to.emit(batcher, 'Close')
          .withArgs(ethers.utils.parseEther('1000000'))

        expect(await usdc.balanceOf(batcher.address)).to.equal(0)
        expect(await dsu.balanceOf(batcher.address)).to.equal(0)

        expect(await reserve.debt(WRAP_ONLY_BATCHER_ADDRESS)).to.equal(0)
        expect(await reserve.totalDebt()).to.equal(0)
        expect(await reserve.reserveBalance()).to.closeTo(initialReserveBalance.add(500000_000_000), 100_000)
        expect((await reserve.redeemPrice()).value).to.equal(ethers.utils.parseEther('1'))
        expect((await reserve.reserveRatio()).value.gt(ethers.utils.parseEther('1'))).to.equal(true)
      }).timeout(60000)

      it('closes batcher (full)', async () => {
        await batcher.connect(user).wrap(ethers.utils.parseEther('1000000'), user.address)

        await expect(batcher.connect(timelockSigner).close())
          .to.emit(batcher, 'Close')
          .withArgs(ethers.utils.parseEther('1000000'))

        expect(await usdc.balanceOf(batcher.address)).to.equal(0)
        expect(await dsu.balanceOf(batcher.address)).to.equal(0)

        expect(await reserve.debt(WRAP_ONLY_BATCHER_ADDRESS)).to.equal(0)
        expect(await reserve.totalDebt()).to.equal(0)
        expect(await reserve.reserveBalance()).to.closeTo(initialReserveBalance.add(1000000_000_000), 100_000)
        expect((await reserve.redeemPrice()).value).to.equal(ethers.utils.parseEther('1'))
        expect((await reserve.reserveRatio()).value.gt(ethers.utils.parseEther('1'))).to.equal(true)
      }).timeout(60000)

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
      }).timeout(60000)

      it('reverts if not owner', async () => {
        await expect(batcher.connect(user).close()).to.be.reverted
      }).timeout(60000)
    })
  })
})
