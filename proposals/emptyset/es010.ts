import { ethers } from 'ethers'
import { L1_TO_L2_MESSAGING_CONTRACTS, L2_CROSSCHAIN_OWNERS } from './contracts'
import { Proposal } from '../../test/testutil/govern'

const ARBITRUM_REFUND_ADDRESS = '0x66a7fDB96C583c59597de16d8b2B989231415339'

const proxyAdminIface = new ethers.utils.Interface(['function upgrade(address,address)'])
const xchainOwnerIface = new ethers.utils.Interface(['function execute(address,bytes,uint256)'])

const PROPOSAL_TEXT = `# Enable Native USDC on Arbitrum
## Motivation
When DSU was deployed on Arbitrum, the chain didn't have a native implementation of USDC. Instead USDCe, a bridged version of USDC was used. While this served as a good proxy for the underlying USDC, Circle has since launched native USDC on Arbitrum and liquidity conditions have improved to a point where it makes sense to transition to the native asset.

## Overview
This proposal switches the USDC address used by the reserve to the native USDC deployment to create a better user experience for DSU users on Arbitrum. It also introduces a hook to allow for 1:1 swapping of USDC.e to USDC to perform the migration.

## Migration Plan
Once this proposal is executed, the Arbitrum reserve will start using USDC for deposits and redemptions.

### Resources
- Reserve Code: https://github.com/equilibria-xyz/emptyset-mono/pull/10
- Audit report: https://audits.sherlock.xyz/contests/254/report
`

const ownerExecuteUpgradeCalldata = xchainOwnerIface.encodeFunctionData('execute', [
  '0x16b38364bA6f55B6E150cC7f52D22E89643f3535', // ProxyAdmin
  proxyAdminIface.encodeFunctionData('upgrade', [
    '0x0d49c416103Cbd276d9c3cd96710dB264e3A0c27', // ReserveProxy
    '0xaff9B28730779F5027EE08a4E8823F983697e1Dc', // MigrationReserve
  ]),
  0,
])

export const ES_010 = (): Proposal => {
  return {
    clauses: [
      {
        // Uses https://gist.github.com/arjun-io/b4a3c666ea3d59e294298a2a6be14e6c to estimate gas
        to: L1_TO_L2_MESSAGING_CONTRACTS.ARBITRUM,
        value: ethers.utils.parseEther('0.01').toString(),
        method: 'createRetryableTicket(address,uint256,uint256,address,address,uint256,uint256,bytes)',
        argTypes: ['address', 'uint256', 'uint256', 'address', 'address', 'uint256', 'uint256', 'bytes'],
        argValues: [
          L2_CROSSCHAIN_OWNERS.ARBITRUM, // to
          0, // l2CallValue
          '685405229370880', // maxSubmissionCost
          ARBITRUM_REFUND_ADDRESS, // excessFeeRefundAddress
          ARBITRUM_REFUND_ADDRESS, // callValueRefundAddress
          '204526', // gasLimit
          '10100000000', // maxFeePerGas
          ownerExecuteUpgradeCalldata, // data
        ],
      },
    ],
    description: PROPOSAL_TEXT,
  }
}
