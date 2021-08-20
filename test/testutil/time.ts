import HRE from 'hardhat'
const { ethers } = HRE

export async function advanceBlock(): Promise<void> {
  await ethers.provider.send('evm_mine', [])
}

export async function increase(duration: number): Promise<void> {
  await ethers.provider.send('evm_increaseTime', [duration])
  await advanceBlock()
}
