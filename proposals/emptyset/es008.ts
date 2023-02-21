import { Proposal } from '../../test/testutil/govern'

import { EMPTYSET_CONTRACTS } from './contracts'
export const DFP_VESTER_ADDRESS = '0xaC4673a22A0A292Da0c975690d1463253Ad26DdF'

const PROPOSAL_TEXT = `
## Background
Back in March 2021, the DeFi Pulse team was hired to lead business development & growth for the EmptySet DAO. See [TIP-14](https://snapshot.org/#/esd.eth/proposal/QmVKTGTTgYhhzemXN7vdtxqKpWSLcL8QQ2pHzy8ur9rzAR). For its services, DeFi Pulse received a stream of 16.5mn ESS + performance incentives over the course of 2 years. The 16.5mn ESS has been being streamed from this contract.

## Proposal

At the request of the DeFi Pulse team, we propose to end the token stream currently being allocated to them. The DeFi Pulse team as of their recent pivot, has moved on to other activities and is no longer performing this role.

To execute this, the DAO will call \`.revoke(ESS)\` on the address of their [vesting contract](https://etherscan.io/address/0xaC4673a22A0A292Da0c975690d1463253Ad26DdF#readContract). This will pause the stream. The remaining unvested tokens will then be returned to the DAO and burned.
`

export const ES_008 = (): Proposal => {
  return {
    clauses: [
      {
        to: DFP_VESTER_ADDRESS,
        value: 0,
        method: 'revoke(address)',
        argTypes: ['address'],
        argValues: [EMPTYSET_CONTRACTS.ESS],
      },
    ],
    description: PROPOSAL_TEXT,
  }
}
