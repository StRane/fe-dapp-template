import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { sepolia, solanaTestnet} from '@reown/appkit/networks'
import type { AppKitNetwork } from '@reown/appkit/networks'
import { SolanaAdapter } from '@reown/appkit-adapter-solana/react'


// Get projectId from https://cloud.reown.com
export const projectId = import.meta.env.VITE_PROJECT_ID || "b56e18d47c72ab683b10814fe9495694" // this is a public projectId only to use on localhost

if (!projectId) {
  throw new Error('Project ID is not defined')
}

export const solanaLocal: AppKitNetwork = {
  id: '2G7gTWexYtKfRYKhLRHZ4UzDxm6kDimfUEZkR9pc4J4E',
  name: 'Solana Local',
  // chainId: 1337,
  testnet: true,
  rpcUrls: {
    default: {
      http: ['http://localhost:8899'],
      webSocket: ['ws://localhost:8900']
    }
  },
  blockExplorers: {
    default: {
      name: 'Solana Explorer',
      url: 'https://explorer.solana.com',
      apiUrl: 'https://explorer.solana.com'
    }
  },
  chainNamespace: 'solana',
  caipNetworkId: 'solana:2G7gTWexYtKfRYKhLRHZ4UzDxm6kDimfUEZkR9pc4J4E',
  nativeCurrency: {
    name: 'Solana',
    symbol: 'SOL',
    decimals: 9
  },
}

export const metadata = {
    name: 'AppKit',
    description: 'AppKit Example',
    url: 'http://localhost:5173',// origin must match your domain & subdomain
    icons: ['https://avatars.githubusercontent.com/u/179229932']
  }

// for custom networks visit -> https://docs.reown.com/appkit/react/core/custom-networks
export const networks = [sepolia, solanaTestnet] as [AppKitNetwork, ...AppKitNetwork[]]

//Set up the Wagmi Adapter (Config)
export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks
})

// Set up Solana Adapter
export const solanaWeb3JsAdapter = new SolanaAdapter()

export const config = wagmiAdapter.wagmiConfig