import HRE from 'hardhat'
import { expect } from 'chai'
import { Signer } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import {
  CompoundGovernor__factory,
  CompoundGovernor,
  CErc20Delegator,
  CErc20Delegator__factory,
  CToken,
  CToken__factory,
} from '../../types/generated'
import { govern, impersonate, time } from '../testutil'

const { ethers, deployments } = HRE
const DEPLOYED_IMPL = '0xFcB924Ae46C7DDc6ad4F873a59ad6F3b5A2e20d5'
const PROPOSER_ADDRESS = '0x8169522c2c57883e8ef80c498aab7820da539806'
const CDAI_ADDRESS = '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643'
const SUPPORTER_ADDRESSES = ['0x9aa835bc7b8ce13b9b0c9764a52fbf71ac62ccf1', '0x6626593c237f530d15ae9980a95ef938ac15c35c']

describe('Compound Proposal X', () => {
  let funder: SignerWithAddress
  let proposerSigner: Signer
  let supporterSigners: Signer[]
  let cdai: CToken
  let cerc20Delgator: CErc20Delegator
  let governor: CompoundGovernor

  beforeEach(async () => {
    time.reset(HRE.config)
    ;[funder] = await ethers.getSigners()
    proposerSigner = await impersonate.impersonate(PROPOSER_ADDRESS, funder)
    supporterSigners = await Promise.all(SUPPORTER_ADDRESSES.map(s => impersonate.impersonate(s, funder)))
    cdai = await CToken__factory.connect(CDAI_ADDRESS, funder)
    cerc20Delgator = await CErc20Delegator__factory.connect(CDAI_ADDRESS, funder)
    governor = await CompoundGovernor__factory.connect(
      (
        await deployments.get('CompoundGovernor')
      ).address,
      proposerSigner,
    )
  })

  it('proposes and executes', async () => {
    expect(await cerc20Delgator.implementation()).to.equal('0xa035b9e130F2B1AedC733eEFb1C67Ba4c503491F')
    const prevTotalSupply = await cdai.totalSupply()
    const prevTotalBorrows = await cdai.totalBorrows()
    const prevTotalReserves = await cdai.totalReserves()
    // This will return an error (old impl)
    expect(await cdai.callStatic._setPendingAdmin(funder.address)).to.equal('1')

    await govern.propose(
      governor,
      (
        await deployments.get('COMP')
      ).address,
      {
        clauses: [
          {
            to: CDAI_ADDRESS,
            value: 0,
            method: '_setImplementation(address,bool,bytes)',
            argTypes: ['address', 'bool', 'bytes'],
            argValues: [DEPLOYED_IMPL, true, '0x'],
          },
        ],
        description: 'Proposal',
      },
      proposerSigner,
      supporterSigners,
      true,
    )

    expect(await cerc20Delgator.implementation()).to.equal(DEPLOYED_IMPL)
    expect(await cdai.totalSupply()).to.equal(prevTotalSupply)
    expect(await cdai.totalBorrows()).to.equal(prevTotalBorrows)
    expect(await cdai.totalReserves()).to.equal(prevTotalReserves)
    // This will now revert with a custom error
    await expect(cdai.callStatic._setPendingAdmin(funder.address)).to.be.reverted
  }).timeout(120000)
})
