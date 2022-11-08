import { EMPTYSET_CONTRACTS } from './contracts'
import { Proposal } from '../../test/testutil/govern'

export const NEW_V1_DAO_IMPL_ADDRESS = '0xDC8C5D7645a7a1B4968eC9e1D983940a259B0aDF'

const PROPOSAL_TEXT = `# Sunset V1-to-V2 Migrator

## Motivation
In the past weeks the community has taken a number of steps to help secure the governance process of the Emptyset DAO. Extending the voting period, increasing the quorum, & liquidating the treasury all help secure the governance of the protocol, which in turn reduces risks for protocols utilising DSU within their protocol.

## Effect
The migrator as it stands still holds a large portion of the total ESS supply which represents yet-to-be migrated V1 stake. In order to continue to improve the security of the V2 protocol and remove potential governance risks, we propose sunsetting this migration path, which has been open for over a year, and burning all remaining ESS held in the migrator.

#### Resources
- Further discussion [here](https://www.emptyset.xyz/t/close-esd-ess-migration-pathway/347).
`

export const ES_005 = (newV1DaoImplAddress = NEW_V1_DAO_IMPL_ADDRESS): Proposal => {
  return {
    clauses: [
      {
        to: EMPTYSET_CONTRACTS.V1_DAO,
        value: 0,
        method: 'commit(address)',
        argTypes: ['address'],
        argValues: [newV1DaoImplAddress],
      },
      {
        to: EMPTYSET_CONTRACTS.RESERVE,
        value: 0,
        method: 'burnStake()',
        argTypes: [],
        argValues: [],
      },
    ],
    description: PROPOSAL_TEXT,
  }
}
