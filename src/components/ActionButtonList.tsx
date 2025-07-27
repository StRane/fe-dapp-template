import {
  useDisconnect,
  useAppKit,
} from "@reown/appkit/react";

import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import { ModeToggle } from "@/components/ModeToggle";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  useAppKitAccount,
} from "@reown/appkit/react";
import { useNetworkCycle } from '@/lib/useNetWorkCycle';



export const ActionButtonList = () => {
  const { disconnect } = useDisconnect();
  const { open } = useAppKit();

  const eip155AccountState = useAppKitAccount({ namespace: "eip155" });
  const solanaAccountState = useAppKitAccount({ namespace: "solana" });
  const { switchToNext } = useNetworkCycle();
  const {address} = useAppKitAccount();



  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error("Failed to disconnect:", error);
    }
  };
  return (
    <div className="flex flex-row-reverse justify-start gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Wallet />
            {address ? (
              <span>{address}</span>
            ) : (
              <span>Connect Wallet</span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {eip155AccountState.isConnected ? (
            <DropdownMenuItem>
              {eip155AccountState.address}
              <br />
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => open({ view: "Connect", namespace: "eip155" })}
              disabled={eip155AccountState.isConnected}
            >
              Open EVM
            </DropdownMenuItem>
          )}
          {solanaAccountState.isConnected ? (
            <DropdownMenuItem>
              {solanaAccountState.address}
              <br />
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => open({ view: "Connect", namespace: "solana" })}
            >
              Open Solana
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={handleDisconnect}>Disconnect</DropdownMenuItem>
          <DropdownMenuItem onClick={switchToNext}>Switch</DropdownMenuItem>
          </DropdownMenuContent>
      </DropdownMenu>
      <ModeToggle />
    </div>
  );
};
