import HRE from 'hardhat'
import { expect } from 'chai'
import { Signer } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import {
  CompoundGovernor__factory,
  CompoundGovernor,
  CErc20Delegator__factory,
  CToken__factory,
} from '../../types/generated'
import { govern, impersonate, time } from '../testutil'

const { ethers, deployments } = HRE
const DEPLOYED_IMPL = '0xFcB924Ae46C7DDc6ad4F873a59ad6F3b5A2e20d5'
const PROPOSER_ADDRESS = '0x8169522c2c57883e8ef80c498aab7820da539806' // COMP holder
// const PROPOSER_ADDRESS = '0x589CDCf60aea6B961720214e80b713eB66B89A4d' // Equilibria Multisig
const CDAI_ADDRESS = '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643'
const CSUSHI_ADDRESS = '0x4b0181102a0112a2ef11abee5563bb4a3176c9d7'
const SUPPORTER_ADDRESSES = ['0x9aa835bc7b8ce13b9b0c9764a52fbf71ac62ccf1', '0x6626593c237f530d15ae9980a95ef938ac15c35c']
const PROPOSAL_TEXT = `# Update cSUSHI cToken Implementation
This proposal is a patch developed by Equilibria which updates the cToken implementation contract for cSUSHI to a more recent
Solidity version (0.8.6) and removes error codes in favor of reverts with custom errors. No other core logic changes are
intended. The new implementation has been deployed to [0xFcB924Ae46C7DDc6ad4F873a59ad6F3b5A2e20d5](https://etherscan.io/address/0xfcb924ae46c7ddc6ad4f873a59ad6f3b5a2e20d5)

## Changelog
These changes implement the following:

* Upgrade the Solidity version of the cToken and related contracts to 0.8.6 - all contracts in the repo were changed to 0.8.6 but only the cTokens will be upgraded as part of upcoming governance proposals. This is due to the complexity of having multiple Solidity versions in the same repo.
* Remove the usage of SafeMath and CarefulMath in favor of Solidity 0.8’s checked math - Solidity will now automatically revert when math errors occur (overflows, division by zero, etc)
* Remove the custom errorCode return values in favor of reverts and custom errors - this allows for a more structured way to deal with errors rather than enum or string comparisons.

It is important to note that the goal is to have no behavior changes in the happy path case, and to only move away from errorCodes and to revert in the failure case (both math errors and checks). All existing unit and scenario tests should pass with only changes to the error code cases.

More tokens will be upgraded in a future proposal if this one passes and causes no issues.

## Development
The code changes can be viewed here: [Pull Request #152](https://github.com/compound-finance/compound-protocol/pull/152).

An audit was completed by the [ChainSecurity Team](https://chainsecurity.com/security-audit/compound-ctoken) and all issues
were either fixed or out of scope for this change. For futher discussion, please view the [Community Forum thread](https://www.comp.xyz/t/safety-and-gas-patches/1723).`

describe.only('Compound Proposal X', () => {
  let funder: SignerWithAddress
  let proposerSigner: Signer
  let supporterSigners: Signer[]
  let governor: CompoundGovernor

  beforeEach(async () => {
    time.reset(HRE.config)
    ;[funder] = await ethers.getSigners()
    proposerSigner = await impersonate.impersonate(PROPOSER_ADDRESS, funder)
    supporterSigners = await Promise.all(SUPPORTER_ADDRESSES.map(s => impersonate.impersonate(s, funder)))
    governor = await CompoundGovernor__factory.connect(
      (
        await deployments.get('CompoundGovernor')
      ).address,
      proposerSigner,
    )
  })

  async function testCTokenUpgrade(ctokenAddress: string) {
    const cerc20Delgator = await CErc20Delegator__factory.connect(ctokenAddress, funder)
    const ctoken = await CToken__factory.connect(ctokenAddress, funder)
    expect(await cerc20Delgator.implementation()).to.equal('0xa035b9e130F2B1AedC733eEFb1C67Ba4c503491F')
    const prevTotalSupply = await ctoken.totalSupply()
    const prevTotalBorrows = await ctoken.totalBorrows()
    const prevTotalReserves = await ctoken.totalReserves()
    // This will return an error (old impl)
    expect(await ctoken.callStatic._setPendingAdmin(funder.address)).to.equal('1')

    await govern.propose(
      governor,
      (
        await deployments.get('COMP')
      ).address,
      {
        clauses: [
          {
            to: ctokenAddress,
            value: 0,
            method: '_setImplementation(address,bool,bytes)',
            argTypes: ['address', 'bool', 'bytes'],
            argValues: [DEPLOYED_IMPL, true, '0x'],
          },
        ],
        description: PROPOSAL_TEXT,
      },
      proposerSigner,
      supporterSigners,
      true,
    )

    expect(await cerc20Delgator.implementation()).to.equal(DEPLOYED_IMPL)
    expect(await ctoken.totalSupply()).to.equal(prevTotalSupply)
    expect(await ctoken.totalBorrows()).to.equal(prevTotalBorrows)
    expect(await ctoken.totalReserves()).to.equal(prevTotalReserves)
    // This will now revert with a custom error
    await expect(ctoken.callStatic._setPendingAdmin(funder.address)).to.be.reverted
  }

  it('upgrades cSUSHI', async () => {
    await testCTokenUpgrade(CSUSHI_ADDRESS)
  }).timeout(120000)

  it('upgrades cDAI', async () => {
    await testCTokenUpgrade(CDAI_ADDRESS)
  }).timeout(120000)
})
