import { ethers } from 'ethers'
import { EMPTYSET_CONTRACTS } from './contracts'
import { Proposal } from '../../test/testutil/govern'

const PROPOSAL_TEXT = `# Enabling Cheaper L1 / L2 Wrapping
## Background
Currently, wrapping and unwrapping USDC to and from DSU is gas cost prohibitive in the Empty Set protocol. These operations require performing a Compound mint or redeem internally so that no USDC sits idle in the Empty Set reserve contract. This ensures a trustless mechanism, however it comes at the expense of extremely high gas costs for these operations (approx. 250,000 - 275,000).

#### L2 Extensibility
In addition to the high gas costs on L1, there is no feasible way to wrap / unwrap directly on L2. Currently, DSU must be bridged to an L2 before it can be used there, making it less accessible and increasing its volatility around the peg.

## Trusted Borrowing
We propose adding a new feature to the Empty Set reserve called *Trusted Borrowing* which allows the Empty Set DAO to front DSU to programmatically-trusted contracts, which are able to ensure that they can repay the fronted DSU in full at all times.

#### L1 Batcher
The first of these trusted contracts would be a wrapping-only batcher contract. This is the lowest hanging fruit and doesn’t rely on a USDC buffer, but still grants a vastly cheaper onboarding experience into DSU.

#### Resources
- The Reserve update implementation can be seen [here](https://github.com/emptysetsquad/emptyset/pull/30).
- The initial Batcher implementatino can be seen [here](https://github.com/equilibria-xyz/emptyset-batcher).
- Further discussion [here](https://www.emptyset.xyz/t/enabling-cheaper-l1-l2-wrapping/307).`

export const ES_003 = (newGovernorAddress: string): Proposal => {
  return {
    clauses: [
      {
        to: EMPTYSET_CONTRACTS.TIMELOCK,
        value: 0,
        method: 'setPendingAdmin(address)',
        argTypes: ['address'],
        argValues: [newGovernorAddress],
      },
      {
        to: EMPTYSET_CONTRACTS.REGISTRY,
        value: 0,
        method: 'setGovernor(address)',
        argTypes: ['address'],
        argValues: [newGovernorAddress],
      },
    ],
    description: PROPOSAL_TEXT,
  }
}
