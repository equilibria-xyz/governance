import { BigNumber, BigNumberish } from 'ethers'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

function addressEqual(addressA: string, addressB: string): boolean {
  return addressA.toLowerCase() === addressB.toLowerCase()
}

function trimAddress(addreessHex: string): string {
  return `0x${addreessHex.substring(addreessHex.length - 40)}`
}

function bnCloseTo(
  stringOrBNA: BigNumberish,
  stringOrBNB: BigNumberish,
  maxDiff: BigNumberish
): boolean {
  const bnA = BigNumber.from(stringOrBNA)
  const bnB = BigNumber.from(stringOrBNB)
  const diff = bnA.sub(bnB).abs()
  return diff.lte(BigNumber.from(maxDiff))
}

export {
  ZERO_ADDRESS,
  addressEqual,
  trimAddress,
  bnCloseTo,
}
