import { ethers } from 'ethers'
import { L1_TO_L2_MESSAGING_CONTRACTS } from './contracts'
import { Proposal } from '../../test/testutil/govern'
import { WRAP_ONLY_BATCHER_ADDRESS } from './es002'

export const OPTIMISM_UCROSSCHAIN_OWNER_ADDRESS = '0x7b4Adf64B0d60fF97D672E473420203D52562A84'
export const ARBITRUM_UCROSSCHAIN_OWNER_ADDRESS = '0x7b4Adf64B0d60fF97D672E473420203D52562A84'
const ABRITRUM_REFUND_ADDRESS = '0x66a7fDB96C583c59597de16d8b2B989231415339'

const acceptOwnerIFace = new ethers.utils.Interface(['function acceptOwner()'])

const PROPOSAL_TEXT = ``

export const ES_007 = (): Proposal => {
  return {
    clauses: [
      {
        to: L1_TO_L2_MESSAGING_CONTRACTS.OPTIMISM,
        value: 0,
        method: 'sendMessage(address,bytes,uint32)',
        argTypes: ['address', 'bytes', 'uint32'],
        argValues: [
          OPTIMISM_UCROSSCHAIN_OWNER_ADDRESS, // _target
          acceptOwnerIFace.encodeFunctionData('acceptOwner'), // _message
          300000, // _gasLimit
        ],
      },
      {
        // Uses https://gist.github.com/arjun-io/b4a3c666ea3d59e294298a2a6be14e6c to estimate gas
        to: L1_TO_L2_MESSAGING_CONTRACTS.ARBITRUM,
        value: '87473645876576',
        method: 'createRetryableTicket(address,uint256,uint256,address,address,uint256,uint256,bytes)',
        argTypes: ['address', 'uint256', 'uint256', 'address', 'address', 'uint256', 'uint256', 'bytes'],
        argValues: [
          ARBITRUM_UCROSSCHAIN_OWNER_ADDRESS, // to
          0, // l2CallValue
          '61781245876576', // maxSubmissionCost
          ABRITRUM_REFUND_ADDRESS, // excessFeeRefundAddress
          ABRITRUM_REFUND_ADDRESS, // callValueRefundAddress
          '128462', // gasLimit
          '200000000', // maxFeePerGas
          acceptOwnerIFace.encodeFunctionData('acceptOwner'), // data
        ],
      },
      {
        to: WRAP_ONLY_BATCHER_ADDRESS,
        value: 0,
        method: 'close()',
        argTypes: [],
        argValues: [],
      },
    ],
    description: PROPOSAL_TEXT,
  }
}
