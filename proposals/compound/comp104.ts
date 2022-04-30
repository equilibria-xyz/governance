import { COMPOUND_CONTRACTS } from './contracts'
import { Proposal } from '../../test/testutil/govern'
import { ethers } from 'ethers'

const PROPOSAL_TEXT = `# Update High-TVL cToken Implementations
## Summary
This proposal is a patch developed by Equilibria which updates the cToken implementation contract for high TVL assets. The new implementation has been deployed to [0x3363BAe2Fc44dA742Df13CD3ee94b6bB868ea376](https://etherscan.io/address/0x3363bae2fc44da742df13cd3ee94b6bb868ea376).

This is the final proposal to bring all upgradeable cTokens up to the new implementation. In addition to updating the implementation, it grants $350,000[1] worth of COMP Equilibria and 79,764.36 USDC to Compound Labs for the ChainSecrity audit of the protocol[2].

[1] COMP value based on the current spot price at time of this proposal ($116)
[2] ChainSecurity Payment Transaction can be viewed [here](https://etherscan.io/tx/0x8aa026292f1bc869a1353b66d47673dbcf23cab2980e0d293fa3c7474caf17d0)

## Changelog
These changes implement the following:

* Upgrade the Solidity version of the cToken and related contracts to 0.8.10 - all contracts in the repo were changed to 0.8.10 but only the cTokens will be upgraded as part of upcoming governance proposals. This is due to the complexity of having multiple Solidity versions in the same repo.
* Remove the usage of SafeMath and CarefulMath in favor of Solidity 0.8’s checked math - Solidity will now automatically revert when math errors occur (overflows, division by zero, etc)
* Remove the custom errorCode return values in favor of reverts and custom errors - this allows for a more structured way to deal with errors rather than enum or string comparisons.

The previous upgrade can be seen here: [Proposal 101](https://compound.finance/governance/proposals/101)

## Development
The code changes can be viewed here: [Pull Request #152](https://github.com/compound-finance/compound-protocol/pull/152).

Audits of these changes were completed by ChainSecurity and OpenZeppelin and all issues were either fixed or out of scope for this change. For further discussion, please view the [Community Forum thread](https://www.comp.xyz/t/rfp12-implementation-ctoken-cleanup/2694).`

const EQUILIBRIA_MULTISIG = '0x589CDCf60aea6B961720214e80b713eB66B89A4d'

export const COMP_104 = (implAddress: string): { proposal: Proposal; ctokens: string[] } => {
  const ctokens = [COMPOUND_CONTRACTS.CUSDT_ADDRESS, COMPOUND_CONTRACTS.CDAI_ADDRESS, COMPOUND_CONTRACTS.CWBTC2_ADDRESS]
  return {
    ctokens,
    proposal: {
      clauses: [
        ...ctokens.map(to => ({
          to,
          value: 0,
          method: '_setImplementation(address,bool,bytes)',
          argTypes: ['address', 'bool', 'bytes'],
          argValues: [implAddress, true, '0x'],
        })),
        // Equilibria Payment
        {
          to: '0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B',
          value: 0,
          method: '_grantComp(address,uint256)',
          argTypes: ['address', 'uint256'],
          argValues: [EQUILIBRIA_MULTISIG, ethers.utils.parseEther('3017.2413793103')],
        },
        // Compound Payment
        {
          to: '0x39AA39c021dfbaE8faC545936693aC917d5E7563',
          value: 0,
          method: '_reduceReserves(uint256)',
          argTypes: ['uint256'],
          argValues: [79764.36e6],
        },
        {
          to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          value: 0,
          method: 'transfer(address,uint256)',
          argTypes: ['address', 'uint256'],
          argValues: ['0xe8F0c9059b8Db5B863d48dB8e8C1A09f97D3B991', 79764.36e6],
        },
      ],
      description: PROPOSAL_TEXT,
    },
  }
}
