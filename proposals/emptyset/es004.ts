import { EMPTYSET_CONTRACTS } from './contracts'
import { Proposal } from '../../test/testutil/govern'

export const NEW_RESERVE_IMPL_ADDRESS = ''

const PROPOSAL_TEXT = `# Add Reserve Pausability

### Motivation
The current Reserve implementation does not have pausing functionality, this makes it impossible to react quickly in the case of emergencies

### Overview
Adds a PAUSER role which can toggle the PAUSED state. The PAUSER is set to the [multisig address](https://etherscan.io/address/0x460661bd4A5364A3ABCc9cfc4a8cE7038d05Ea22).

#### Resources
- The implementation of the new Reserve can be viewed [here](https://github.com/emptysetsquad/emptyset/pull/32).
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
