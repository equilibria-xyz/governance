import { ethers } from 'ethers'
import { EMPTYSET_CONTRACTS, L1_TO_L2_MESSAGING_CONTRACTS, L2_CROSSCHAIN_OWNERS } from './contracts'
import { Proposal } from '../../test/testutil/govern'

const proxyAdminIface = new ethers.utils.Interface(['function upgrade(address,address)'])
const xchainOwnerIface = new ethers.utils.Interface(['function execute(address,bytes,uint256)'])

const PROPOSAL_TEXT = `
## Motivation
The Emptyset DAO treasury has COMP rewards & has accrued interest in the form of cUSDC. We propose an open order on the DAO to acquire ESS tokens in the treasury. We also propose to migrate Optimism DSU to native USDC.

## Overview
This proposal aims to accomplish three main objectives:
 * Sell a portion of our cUSDC holdings for ESS
 * Sell accumulated COMP for ESS
 * Upgrade the Optimism reserve to use native USDC for deposits and redemptions
`

const ownerExecuteUpgradeCalldata = xchainOwnerIface.encodeFunctionData('execute', [
  '0x16b38364bA6f55B6E150cC7f52D22E89643f3535', // ProxyAdmin
  proxyAdminIface.encodeFunctionData('upgrade', [
    '0x0d49c416103Cbd276d9c3cd96710dB264e3A0c27', // ReserveProxy
    '0x4a0f50b19b02AC927911C559629536B9a24d9314', // MigrationReserve
  ]),
  0,
])

export const ES_011 = (): Proposal => {
  return {
    clauses: [
      {
        // Upgrade Optimism Reserve to use native USDC
        to: L1_TO_L2_MESSAGING_CONTRACTS.OPTIMISM,
        value: 0,
        method: 'sendMessage(address,bytes,uint32)',
        argTypes: ['address', 'bytes', 'uint32'],
        argValues: [
          L2_CROSSCHAIN_OWNERS.OPTIMISM, // _target
          ownerExecuteUpgradeCalldata, // _message
          1000000, // _gasLimit
        ],
      },
      {
        // Register COMP/ESS order
        // Sell 93629178158121074194 COMP (18 decimals) for 25000000000000000000000000 ESS (18 Decimals)
        to: EMPTYSET_CONTRACTS.RESERVE,
        value: 0,
        method: 'registerOrder(address,address,uint256,uint256)',
        argTypes: ['address', 'address', 'uint256', 'uint256'],
        argValues: [
          '0xc00e94cb662c3520282e6f5717214004a7f26888', // _makerToken: COMP
          EMPTYSET_CONTRACTS.ESS, // _takerToken: ESS
          '267010781166742363801758', // _price: ESSAmount * 1e18 / compAmount
          '93629178158121074194', // _amount (current full balance)
        ],
      },
      {
        // Register cUSDC/ESS order
        // Sell 20781431194086 cUSDC (8 decimals) for 25000000000000000000000000 ESS (18 Decimals)
        to: EMPTYSET_CONTRACTS.RESERVE,
        value: 0,
        method: 'registerOrder(address,address,uint256,uint256)',
        argTypes: ['address', 'address', 'uint256', 'uint256'],
        argValues: [
          '0x39AA39c021dfbaE8faC545936693aC917d5E7563', // _makerToken: cUSDC
          EMPTYSET_CONTRACTS.ESS, // _takerToken: ESS
          '1202997029728853536989138641122', // _price: ESSAmount * 1e18 / cUSDCAmount
          '20781431194086', // _amount
        ],
      },
    ],
    description: PROPOSAL_TEXT,
  }
}
