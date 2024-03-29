import { EMPTYSET_CONTRACTS } from './contracts'
import { Proposal } from '../../test/testutil/govern'

export const NEW_GOVERNOR_ALPHA_ADDRESS = '0x47C61a54B1d24d571F07a79d54543231292f769b'

const PROPOSAL_TEXT = `# Update Governance Parameters

### Background
Currently, the Empty Set protocol is governed using a fork of Compound’s original GovernorAlpha contract.

This contract is not upgradable, however a new instance may be deployed with updated hardcoded parameters, then switched over to through governance.

### Motivation
As protocols start to implement DSU as a unit of account, ensuring the sound governance of the protocol managing DSU is imperative. Given the current value of the governance token, we feel it prudent to raise the quorum & proposal requirements. Similarly, we feel that we should extend the voting periods due to various attacks on other protocols that have occured in the last few months.

We intend to make it significantly harder to attack the Empty Set protocol via a malicious governance action through the implementation of these changes.

### Overview
We propose using the current audited GovernorAlpha contract but adjusting the hard-coded values to the ones below.

#### Proposed parameters

*Quorum:* Increase from 5.0% to 10.0%
*Proposal:* Increase from 0.5% to 2.0%
*Voting Delay:* Increase from 1 block to 2 days
*Voting Period:* Increase from 3 days to 7 days
*Timelock:* Remain at 2 days

#### Operation
Due to the GovernorAlpha guardian pattern, in order to fully enable the new governor, the Empty Set treasury multisig will need to execute one final \`__acceptAdmin()\` transaction call after the onchain proposal is executed. The passing of this proposal will thereby give this treasury multisig the authority to do so.

#### Resources
- The implementation of the new GovernorAlpha can be viewed [here](https://github.com/emptysetsquad/emptyset/pull/31).
- Further discussion [here](https://www.emptyset.xyz/t/update-governance-parameters/342).\`

`

export const ES_003 = (newGovernorAddress: string = NEW_GOVERNOR_ALPHA_ADDRESS): Proposal => {
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
