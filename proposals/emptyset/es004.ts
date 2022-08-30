import { EMPTYSET_CONTRACTS } from './contracts'
import { Proposal } from '../../test/testutil/govern'

export const NEW_RESERVE_IMPL_ADDRESS = '0x52C64b8998eB7C80b6F526E99E29ABdcC86B841b'

const PROPOSAL_TEXT = `# Add Guardian Pausing

## Authors

@kbrizzle (Equilibria)

### Motivation

Currently, the Empty Set governor is the only mechanism by which privileged actions can be taken. This is the most secure and strict setup, however it does not provide the flexibility for swift actions during security incidents.

Other protocols solve this dilemma by introducing a separate protocol role with limited pausing privileges.

### Overview

We propose adding a pauser role to the Empty Set protocol alongside the original owner role. This pauser role will be set by the owner role and have limited privileges to pause and unpause all state-mutating methods within the protocol.

### Permissions Breakdown

\`pauser\`
Update paused status
\`owner\` (GovernorAlpha)
Update or revoke pauser address
Update or remove pausing functionality altogether

#### Implementation
The implementation of the change can be viewed [here](https://github.com/emptysetsquad/emptyset/pull/32).

#### Operation

Since the protocol multisig already has guardian powers per the GovernorAlpha contract, we propose this multisig as the initial pauser.

### Vote
The vote will take place on the [governance page](https://app.emptyset.finance/governance) of the Empty Set webapp.
`

export const ES_004 = (newReserveImplAddress: string = NEW_RESERVE_IMPL_ADDRESS): Proposal => {
  return {
    clauses: [
      {
        to: EMPTYSET_CONTRACTS.PROXY_ADMIN,
        value: 0,
        method: 'upgrade(address,address)',
        argTypes: ['address', 'address'],
        argValues: [EMPTYSET_CONTRACTS.RESERVE, newReserveImplAddress],
      },
      {
        to: EMPTYSET_CONTRACTS.RESERVE,
        value: 0,
        method: 'setPauser(address)',
        argTypes: ['address'],
        argValues: [EMPTYSET_CONTRACTS.GUARDIAN],
      },
    ],
    description: PROPOSAL_TEXT,
  }
}
