import path from 'path'
import { ContractFactory } from 'ethers'
import { writeFile } from 'fs/promises'
import { readFileSync } from 'fs'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

type DeployConfig =  { [k: string]: NetworkConfig }
type NetworkConfig = { [k: string]: string }

const NETWORK_MAP: { [k: string]: string } = {
  "1": "mainnet",
  "3": "ropsten",
  "4": "rinkeby",
  "5": "goerli"
}

export class Operator {
  private HRE: HardhatRuntimeEnvironment
  private networkID: string
  private deployConfig: DeployConfig
  private networkConfig: NetworkConfig

  constructor(HRE: HardhatRuntimeEnvironment, networkID: string) {
    const fileBuff = readFileSync(path.join(process.cwd(), 'deploy/deploy.json'))
    const config = fileBuff.toString()
    this.networkID = networkID
    this.deployConfig = JSON.parse(config)
    this.networkConfig = this.deployConfig[networkID]
    this.HRE = HRE
  }

  getNetworkName(): string {
    if (this.networkID === "1337") {
      return "ganache";
    }
    if (this.networkID === "31337") {
      return "hardhat"
    }

    return NETWORK_MAP[this.networkID] || "unknown"
  }

  getNetworkConfig(): NetworkConfig {
    return this.networkConfig
  }

  async attachOrDeploy<T>(
    contractFactory: ContractFactory,
    contractName: string,
    getArgs: () => unknown[]
  ): Promise<T> {
    const address = this.addressForContract(contractName)
    if (address) {
      console.info(`${contractName} already deployed at ${address}\n`)
      return contractFactory.attach(address) as unknown as  T
    }


    const deployedContract = await contractFactory.deploy(...getArgs())
    this.writeAddress(contractName, deployedContract.address)
    console.info(`${contractName} deployed at ${deployedContract.address}\n`)

    return deployedContract as unknown as T
  }

  async setIfNot<T>(
    property: string,
    getter: () => Promise<T>,
    condition: (arg: T) => boolean,
    setter: () => Promise<void>,
    message: string,
  ): Promise<T> {
    const data = await getter()
    console.info(`${property} is ${data}`)
    if (condition(data)) {
      console.info(`Already set: ${data}`)
      return data
    }

    await setter()
    console.log(message.charAt(0).toUpperCase() + message.slice(1))
    console.log()

    return data
  }

  async verify<T>(
    property: string,
    getter: () => Promise<T>,
    condition: (arg: T) => Promise<boolean>,
  ): Promise<boolean> {
    const data = await getter();
    const res = await condition(data)
    if (res) {
      console.log(`✅ ${property} is: ${data}`);
    } else {
      console.log(`🚫 ${property} is: ${data}`);
    }

    return res
  }

  private addressForContract(contractName: string): string {
    return this.networkConfig[contractName] || ""
  }

  private async writeAddress(contractName: string, address: string) {
    this.networkConfig = {
      ...this.networkConfig,
      [contractName]: address,
    }

    this.deployConfig = {
      ...this.deployConfig,
      [this.networkID]: this.networkConfig
    }
    await writeFile("deploy.json", JSON.stringify(this.deployConfig, undefined, 2));
  }
}
