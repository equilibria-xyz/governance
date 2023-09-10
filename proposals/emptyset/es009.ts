import { ethers } from 'ethers'
import { L1_TO_L2_MESSAGING_CONTRACTS } from './contracts'
import { Proposal } from '../../test/testutil/govern'

export const BASE_UCROSSCHAIN_OWNER_ADDRESS = '0x58e0c542Ab540E0Dd3B4fD96Cc46b0AaD1196bfe'

const acceptOwnerIFace = new ethers.utils.Interface(['function acceptOwner()'])

const PROPOSAL_TEXT = `# Accept Base L2 Ownership
## Background
Since EIP-7, DSU has been multi-chain. In that time, DSU’s supply has grown to 6m USDC at peak. This is primarily due to adoption on the Arbitrum Chain.

## Motivation
This proposal extends DSU onto BASE. Following on from the traction DSU has seen on Arbitrum, DSU could be a powerful primitive for the nascent DeFi ecosystem on this new chain.

## Accepting Ownership
To make the BASE deployments a verified component of the Empty Set Protocol, the ownership is accepted by the L1 DAO through this proposal. Once executed, the L1 DAO will have all ownership rights over the BASE L2 deployment.

#### Resources
- Further discussion [here](https://www.emptyset.xyz/t/accept-base-l2-ownership/356).
`

export const ES_009 = (): Proposal => {
  return {
    clauses: [
      {
        to: L1_TO_L2_MESSAGING_CONTRACTS.BASE,
        value: 0,
        method: 'sendMessage(address,bytes,uint32)',
        argTypes: ['address', 'bytes', 'uint32'],
        argValues: [
          BASE_UCROSSCHAIN_OWNER_ADDRESS, // _target
          acceptOwnerIFace.encodeFunctionData('acceptOwner'), // _message
          300000, // _gasLimit
        ],
      },
    ],
    description: PROPOSAL_TEXT,
  }
}
