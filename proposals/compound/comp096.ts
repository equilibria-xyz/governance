import { COMPOUND_CONTRACTS } from './contracts'
import { Proposal } from '../../test/testutil/govern'

const PROPOSAL_TEXT = `# Update low TVL cToken Implementations
## Summary
This proposal is a patch developed by Equilibria which updates the cToken implementation contract for 5 low TVL assets to a more recent
Solidity version (0.8.10) and removes error codes in favor of reverts with custom errors. No other core logic changes are
intended. The new implementation has been deployed to [0x3363BAe2Fc44dA742Df13CD3ee94b6bB868ea376](https://etherscan.io/address/0x3363bae2fc44da742df13cd3ee94b6bb868ea376)

## Changelog
These changes implement the following:

* Upgrade the Solidity version of the cToken and related contracts to 0.8.10 - all contracts in the repo were changed to 0.8.10 but only the cTokens will be upgraded as part of upcoming governance proposals. This is due to the complexity of having multiple Solidity versions in the same repo.
* Remove the usage of SafeMath and CarefulMath in favor of Solidity 0.8’s checked math - Solidity will now automatically revert when math errors occur (overflows, division by zero, etc)
* Remove the custom errorCode return values in favor of reverts and custom errors - this allows for a more structured way to deal with errors rather than enum or string comparisons.

It is important to note that the goal is to have no behavior changes in the happy path case, and to only move away from errorCodes and to revert in the failure case (both math errors and checks). All existing unit and scenario tests should pass with only changes to the error code cases.

More cTokens will be upgraded in a future proposal if this one passes and causes no issues.

## Development
The code changes can be viewed here: [Pull Request #152](https://github.com/compound-finance/compound-protocol/pull/152).

Audits of these changes were completed by ChainSecurity and OpenZeppelin and all issues were either fixed or out of
scope for this change. For further discussion, please view the [Community Forum thread](https://www.comp.xyz/t/rfp12-implementation-ctoken-cleanup/2694).`

export const COMP_096 = (implAddress: string): { proposal: Proposal; ctokens: string[] } => {
  const ctokens = [
    COMPOUND_CONTRACTS.CUSDP_ADDRESS,
    COMPOUND_CONTRACTS.CSUSHI_ADDRESS,
    COMPOUND_CONTRACTS.CYFI_ADDRESS,
    COMPOUND_CONTRACTS.CAAVE_ADDRESS,
    COMPOUND_CONTRACTS.CFEI_ADDRESS,
  ]
  return {
    ctokens,
    proposal: {
      clauses: ctokens.map(to => ({
        to,
        value: 0,
        method: '_setImplementation(address,bool,bytes)',
        argTypes: ['address', 'bool', 'bytes'],
        argValues: [implAddress, true, '0x'],
      })),
      description: PROPOSAL_TEXT,
    },
  }
}
