// hooks/useNetworkCycle.ts
import { useAppKitNetwork } from '@reown/appkit/react'
import { networks } from '@/config'

export function useNetworkCycle() {
  const { chainId, switchNetwork } = useAppKitNetwork()

  const switchToNext = async () => {

    // Find the index of the currently active network
    const currentIndex = networks.findIndex(network => {
      console.log(`Comparing network ${network.name}:`, {
        networkId: network.id,
        networkIdType: typeof network.id,
        chainId: chainId,
        chainIdType: typeof chainId
      })
      
      // Handle Ethereum networks (numeric chainId like 11155111)
      if (typeof network.id === 'number' && typeof chainId === 'number') {
        const match = network.id === chainId
        console.log(`Numeric comparison: ${network.id} === ${chainId} = ${match}`)
        return match
      }
      
      // Handle Solana networks (string chainId like "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z")
      if (typeof network.id === 'string' && typeof chainId === 'string') {
        const match = chainId.includes(network.id)
        console.log(`String comparison: "${chainId}".includes("${network.id}") = ${match}`)
        return match
      }
      
      // Handle mixed types - convert both to string
      if (network.id && chainId) {
        const networkIdStr = network.id.toString()
        const chainIdStr = chainId.toString()
        const match = chainIdStr.includes(networkIdStr) || networkIdStr === chainIdStr
        console.log(`Mixed type comparison: "${chainIdStr}".includes("${networkIdStr}") || "${networkIdStr}" === "${chainIdStr}" = ${match}`)
        return match
      }
      
      return false
    })
    
    
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % networks.length
    const nextNetwork = networks[nextIndex]
    
    
    // Switch to the next network
    try {
      await switchNetwork(nextNetwork)
    } catch (error) {
      console.error('❌ Failed to switch network:', error)
    }
  }

  return { switchToNext }
}