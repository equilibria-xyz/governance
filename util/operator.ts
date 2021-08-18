import {} from 'ethers'
import HRE from 'hardhat'
import { Contract } from 'ethers'
import { writeFile } from 'fs/promises'
import { readFileSync } from 'fs'

const { ethers } = HRE

type DeployConfig =  { [k: string]: NetworkConfig }
type NetworkConfig = { [k: string]: string }

const NETWORK_MAP: { [k: string]: string } = {
  "1": "mainnet",
  "3": "ropsten",
  "4": "rinkeby",
  "5": "goerli"
}

export class Operator {
  private networkID: string
  private deployConfig: DeployConfig
  private networkConfig: NetworkConfig

  constructor(deployJSONPath: string, networkID: string) {
    const fileBuff = readFileSync(deployJSONPath)
    const config = fileBuff.toString()
    this.networkID = networkID
    this.deployConfig = JSON.parse(config)
    this.networkConfig = this.deployConfig[networkID]
  }

  getNetworkName(networkID: string): string {
    if (networkID === "1337") {
      return "ganache";
    }
    if (networkID === "31337") {
      return "hardhat"
    }

    return NETWORK_MAP[networkID] || "unknown"
  }

  getNetworkConfig(): NetworkConfig {
    return this.networkConfig
  }

  async attachOrDeploy(
    contractName: string,
    getArgs: () => any[]
  ): Promise<Contract> {
    const ContractFactory = await ethers.getContractFactory(contractName)
    const address = this.addressForContract(contractName)
    if (address) {
      console.info(`${contractName} already deployed at ${address}\n`)
      return ContractFactory.attach(address)
    }


    const deployedContract = await ContractFactory.deploy(...getArgs())
    this.writeAddress(contractName, deployedContract.address)
    console.info(`${contractName} deployed at ${deployedContract.address}\n`)

    return deployedContract
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
