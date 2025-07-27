import { useDisconnect, useAppKit, useAppKitNetwork  } from '@reown/appkit/react'
import { networks } from '../config'
import { Button } from "@/components/ui/button"

export const ActionButtonList = () => {
    const { disconnect } = useDisconnect();
    const { open } = useAppKit();
    const { switchNetwork } = useAppKitNetwork();

    const handleDisconnect = async () => {
      try {
        await disconnect();
      } catch (error) {
        console.error("Failed to disconnect:", error);
      }
    };
  return (
    <div >
        <Button onClick={() => open({ view: 'Connect', namespace: 'eip155' })}>Open EVM</Button>
        <Button onClick={() => open({ view: 'Connect', namespace: 'solana' })}>Open Solana</Button>
        <Button onClick={handleDisconnect}>Disconnect</Button>
        <Button onClick={() => switchNetwork(networks[1]) }>Switch</Button>
    </div>
  )
}
