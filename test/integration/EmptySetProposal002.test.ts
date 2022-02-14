import { expect } from 'chai'
import { ContractReceipt, ContractTransaction, Signer } from 'ethers'
import HRE from 'hardhat'

import {
  EmptySetProp1Initializer,
  EmptySetShare,
  UniswapV3Staker,
  EmptySetProp1Initializer__factory,
  EmptySetShare__factory,
  UniswapV3Staker__factory,
  EmptySetGovernor,
  EmptySetGovernor__factory,
  ReserveImpl2__factory,
  ReserveImpl2,
  IERC20__factory,
  IERC20,
} from '../../types/generated'
import { govern, impersonate, time } from '../testutil'

const { ethers, deployments } = HRE
const FORK_BLOCK = 13071489

const DSU_ADDRESS = '0x605D26FBd5be761089281d5cec2Ce86eeA667109'
const ESS_ADDRESS = '0x07b991579b4e1Ee01d7a3342AF93E96ecC59E0B3'
const RESERVE_ADDRESS = '0xD05aCe63789cCb35B9cE71d01e4d632a0486Da4B'
const PROXY_ADMIN_ADDRESS = '0x4d2A5E3b7831156f62C8dF47604E321cdAF35fec'
const NEW_RESERVE_ADDRESS = '' // TODO: after reserve implementation deploy

const WRAP_ONLY_BATCHER_ADDRESS = '0x0B663CeaCEF01f2f88EB7451C70Aa069f19dB997'
const WRAP_ONLY_BATCHER_AMOUNT = ethers.utils.parseEther('1000000')

const PROPOSAL_TEXT = `This a proposal` // TODO: complete

describe.only('Empty Set Proposal 002', () => {
  let funder: Signer
  let essSigner: Signer
  let ess: EmptySetShare
  let governor: EmptySetGovernor
  let dsu: IERC20
  let reserveImpl2: ReserveImpl2

  beforeEach(async () => {
    time.reset(HRE.config, FORK_BLOCK)
    ;[funder] = await ethers.getSigners()
    essSigner = await impersonate.impersonate(ESS_ADDRESS, funder)

    ess = EmptySetShare__factory.connect((await deployments.get('EmptySetShare')).address, funder)
    governor = await EmptySetGovernor__factory.connect((await deployments.get('EmptySetGovernor')).address, essSigner)

    dsu = IERC20__factory.connect(DSU_ADDRESS, funder)
    reserveImpl2 = await new ReserveImpl2__factory(funder).deploy()
  })

  it('starts the initializers', async () => {
    await govern.propose(
      governor,
      (
        await deployments.get('EmptySetShare')
      ).address,
      {
        clauses: [
          {
            to: PROXY_ADMIN_ADDRESS,
            value: 0,
            method: 'upgrade(address,address)',
            argTypes: ['address', 'address'],
            argValues: [RESERVE_ADDRESS, reserveImpl2.address],
          },
          {
            to: RESERVE_ADDRESS,
            value: 0,
            method: 'borrow(address,uint256)',
            argTypes: ['address', 'uint256'],
            argValues: [WRAP_ONLY_BATCHER_ADDRESS, WRAP_ONLY_BATCHER_AMOUNT],
          },
        ],
        description: PROPOSAL_TEXT,
      },
      essSigner,
    )

    expect(await dsu.balanceOf(WRAP_ONLY_BATCHER_ADDRESS)).to.equal(ethers.utils.parseEther('1000000'))

    //TODO: basic batcher tests

    //TODO: basic reserve tests

    //TODO: close workflow tests
  }).timeout(60000)
})
