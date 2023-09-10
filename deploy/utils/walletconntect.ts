import { EthereumProvider } from '@walletconnect/ethereum-provider'
import { providers } from 'ethers'

export async function getWalletConnectDeployer(): Promise<providers.JsonRpcSigner> {
  const provider = await EthereumProvider.init({
    projectId: `${process.env.WALLET_CONNECT_PROJECT_ID}`,
    chains: [1],
    showQrModal: false,
  })

  provider.on('display_uri', (uri: string) => {
    console.log(`\nConnector URI 🔗\n${uri}`)
  })

  await provider.enable()

  const web3Provider = new providers.Web3Provider(provider)
  return await web3Provider.getSigner(0)
}
