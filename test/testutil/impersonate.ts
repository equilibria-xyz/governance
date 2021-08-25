import { Signer } from 'ethers'
import HRE from 'hardhat'
const { ethers } = HRE

export async function impersonate(address: string, funder: Signer): Promise<Signer> {
  await funder.sendTransaction({
    to: address,
    value: ethers.utils.parseEther('1'),
  })
  await HRE.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  })
  return ethers.getSigner(address)
}
