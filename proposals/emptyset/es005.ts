import { EMPTYSET_CONTRACTS } from './contracts'
import { Proposal } from '../../test/testutil/govern'

export const NEW_V1_DAO_IMPL_ADDRESS = '0xDC8C5D7645a7a1B4968eC9e1D983940a259B0aDF'

const PROPOSAL_TEXT = `# Sunset V1-to-V2 Migrator

... TBD ...

### Vote
The vote will take place on the [governance page](https://app.emptyset.finance/governance) of the Empty Set webapp.
`

export const ES_005 = (newV1DaoImplAddress: string = NEW_V1_DAO_IMPL_ADDRESS): Proposal => {
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