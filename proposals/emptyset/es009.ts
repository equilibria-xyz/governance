import { ethers } from 'ethers'
import { L1_TO_L2_MESSAGING_CONTRACTS } from './contracts'
import { Proposal } from '../../test/testutil/govern'

export const BASE_UCROSSCHAIN_OWNER_ADDRESS = '0x58e0c542Ab540E0Dd3B4fD96Cc46b0AaD1196bfe'

const acceptOwnerIFace = new ethers.utils.Interface(['function acceptOwner()'])

const PROPOSAL_TEXT = `# Accept Base L2 Ownership
## Background
XXX

#### Resources
- Further discussion [here](https://www.emptyset.xyz/t/XXX/XXX).
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
