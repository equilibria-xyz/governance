import HRE from 'hardhat'
import { expect } from 'chai'
import { BigNumber, Signer } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import {
  EmptySetGovernor2__factory,
  EmptySetGovernor2,
  V1DaoImpl2,
  V1DaoImpl2__factory,
  IERC20,
  IERC20__factory,
  EmptySetMigrator,
  EmptySetMigrator__factory,
  ReserveImpl3__factory,
  ReserveImpl3,
} from '../../types/generated'
import { govern, impersonate, time } from '../testutil'
import { EMPTYSET_CONTRACTS } from '../../proposals/emptyset/contracts'
import { ES_005, NEW_V1_DAO_IMPL_ADDRESS } from '../../proposals/emptyset/es005'

const { ethers, deployments } = HRE
const PROPOSER_ADDRESS = '0x589CDCf60aea6B961720214e80b713eB66B89A4d' // Equilibria Multisig
const SUPPORTER_ADDRESSES = ['0x07b991579b4e1Ee01d7a3342AF93E96ecC59E0B3']
const USDC_HOLDER_ADDRESS = '0xae2d4617c862309a3d75a0ffb358c7a5009c673f'

const USE_REAL_DEPLOY = false
const FORK_BLOCK = 15901714

describe('Empty Set Proposal 005', () => {
  let funder: SignerWithAddress
  let proposerSigner: Signer
  let multisigSigner: Signer
  let usdcHolderSigner: SignerWithAddress
  let supporterSigners: Signer[]
  let governor: EmptySetGovernor2
  let newV1DaoImpl: V1DaoImpl2
  let reserve: ReserveImpl3
  let migrator: EmptySetMigrator
  let ess: IERC20
  let v1Dao: V1DaoImpl2

  let priorReserveEssBalance: BigNumber
  let priorMigratorEssBalance: BigNumber
  let priorEssSupply: BigNumber

  before(async () => {
    if (USE_REAL_DEPLOY) {
      console.log(`Using V1DaoImpl2 impl deployed at ${NEW_V1_DAO_IMPL_ADDRESS}`)
    } else {
      console.log('Deploying a new V1DaoImpl2 implementation')
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
    newV1DaoImpl = USE_REAL_DEPLOY
      ? await V1DaoImpl2__factory.connect(NEW_V1_DAO_IMPL_ADDRESS, funder)
      : await new V1DaoImpl2__factory(funder).deploy()

    reserve = ReserveImpl3__factory.connect((await deployments.get('EmptySetReserve')).address, funder)
    migrator = EmptySetMigrator__factory.connect((await deployments.get('EmptySetMigrator')).address, funder)
    ess = IERC20__factory.connect((await deployments.get('EmptySetShare')).address, funder)

    priorEssSupply = await ess.totalSupply()
    priorMigratorEssBalance = await ess.balanceOf(migrator.address)
    priorReserveEssBalance = await ess.balanceOf(reserve.address)

    await govern.propose(
      governor,
      ess.address,
      ES_005(newV1DaoImpl.address),
      proposerSigner,
      supporterSigners,
      false,
      false,
    )

    v1Dao = V1DaoImpl2__factory.connect(EMPTYSET_CONTRACTS.V1_DAO, funder)
  })

  it('upgrades the impl', async () => {
    expect(await v1Dao.implementation()).to.equal(newV1DaoImpl.address)
  })

  it('sunsets migrator', async () => {
    expect(await ess.balanceOf(migrator.address)).to.equal(0)
    expect(await ess.balanceOf(v1Dao.address)).to.equal(0)
    expect(await ess.balanceOf(reserve.address)).to.equal(0)

    expect(await ess.totalSupply()).to.equal(priorEssSupply.sub(priorMigratorEssBalance).sub(priorReserveEssBalance))

    console.log(
      `supply reduced by ${priorMigratorEssBalance.add(priorReserveEssBalance).mul(100).div(priorEssSupply)}%`,
    )
  })

  context('v1 DAO', async () => {
    let newV1DaoImpl2: V1DaoImpl2

    beforeEach(async () => {
      newV1DaoImpl2 = await new V1DaoImpl2__factory(funder).deploy()
    })

    it('still current owner again', async () => {
      expect(await v1Dao.owner()).to.equal(EMPTYSET_CONTRACTS.TIMELOCK)
    })

    it('reverts when committing from non-owner', async () => {
      await expect(v1Dao.connect(multisigSigner).commit(newV1DaoImpl2.address)).to.revertedWith('Permission: Not owner')
    })

    it('upgrades again', async () => {
      await govern.propose(
        governor,
        ess.address,
        ES_005(newV1DaoImpl2.address),
        proposerSigner,
        supporterSigners,
        false,
        false,
      )

      expect(await v1Dao.implementation()).to.equal(newV1DaoImpl2.address)
    })
  })

  context('guardian', () => {
    let USDC: IERC20
    let DSU: IERC20

    beforeEach(async () => {
      USDC = IERC20__factory.connect('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', usdcHolderSigner)
      DSU = IERC20__factory.connect(EMPTYSET_CONTRACTS.DSU, usdcHolderSigner)

      await USDC.approve(reserve.address, ethers.constants.MaxUint256)
      await DSU.approve(reserve.address, ethers.constants.MaxUint256)
    })

    it('pauses and unpauses', async () => {
      expect(await reserve.paused()).to.be.false

      await reserve.connect(multisigSigner).setPaused(true)

      expect(await reserve.paused()).to.be.true
      await expect(reserve.connect(usdcHolderSigner).mint(1000)).to.be.revertedWith('Implementation: paused')

      await reserve.connect(multisigSigner).setPaused(false)

      expect(await reserve.paused()).to.be.false
      await expect(reserve.connect(usdcHolderSigner).mint(1000)).to.not.be.reverted

      await reserve.connect(multisigSigner).setPaused(true)
      await expect(reserve.connect(usdcHolderSigner).redeem(1000)).to.be.revertedWith('Implementation: paused')

      await reserve.connect(multisigSigner).setPaused(false)
      await expect(reserve.connect(usdcHolderSigner).redeem(1000)).to.not.be.reverted
    })
  })
})
