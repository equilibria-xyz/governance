import { ethers } from 'ethers'
import { EMPTYSET_CONTRACTS } from './contracts'
import { Proposal } from '../../test/testutil/govern'

export const NEW_RESERVE_IMPLEMENTATION_ADDRESS = '0x363aF3acFfEd0B7181C2E3c56C00922E142100a8'
export const TWO_WAY_BATCHER_ADDRESS = '0xAEf566ca7E84d1E736f999765a804687f39D9094'
export const TWO_WAY_BATCHER_AMOUNT = ethers.utils.parseEther('1000000')

const PROPOSAL_TEXT = `# Add TwoWay Batcher
## Background

Previously in [EIP-2](https://www.emptyset.xyz/t/eip2-enabling-cheaper-l1-l2-wrapping/307), a new system called *trusted borrowing* was added to enable wrap / unwrap batcher contracts among other use cases.

The initial batcher contract \`WrapOnlyBatcher\`, as the name suggests, allowed for significantly cheaper USDC-to-DSU **wrap** transactions, however this batcher could not support DSU-to-USDC **unwrap** transactions, due to the requirement to hold non-reserve USDC.

## TwoWayBatcher

We propose a new batcher implementation that supports the permissionless deposit / withdraw of USDC by interested parties to fund the batcher’s supply of USDC.

By holding non-reserve USDC as well as DSU from the reserve’s *trusted borrow* system, we can then enable bidirectional batching. This primarily serves to enable significantly cheaper DSU-to-USDC **unwraps**.

#### Resources
- The Reserve update implementation can be seen [here](https://github.com/equilibria-xyz/emptyset/pull/2).
- The TwoWay Batcher implementation can be seen [here](https://github.com/equilibria-xyz/emptyset-batcher/blob/master/contracts/batcher/TwoWayBatcher.sol).
- Further discussion [here](https://www.emptyset.xyz/t/add-twoway-batcher/349).`

export const ES_006 = (newReserveImplAddress = NEW_RESERVE_IMPLEMENTATION_ADDRESS): Proposal => {
  return {
    clauses: [
      {
        to: EMPTYSET_CONTRACTS.PROXY_ADMIN,
        value: 0,
        method: 'upgrade(address,address)',
        argTypes: ['address', 'address'],
        argValues: [EMPTYSET_CONTRACTS.RESERVE, NEW_RESERVE_IMPLEMENTATION_ADDRESS],
      },
      {
        to: TWO_WAY_BATCHER_ADDRESS,
        value: 0,
        method: 'acceptOwner()',
        argTypes: [],
        argValues: [],
      },
      {
        to: EMPTYSET_CONTRACTS.RESERVE,
        value: 0,
        method: 'borrow(address,uint256)',
        argTypes: ['address', 'uint256'],
        argValues: [TWO_WAY_BATCHER_ADDRESS, TWO_WAY_BATCHER_AMOUNT],
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
