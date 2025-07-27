import {
  useDisconnect,
  useAppKit,
  useAppKitNetwork,
} from "@reown/appkit/react";
import { networks } from "../config";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import { ModeToggle } from "@/components/ModeToggle";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  useAppKitState,
  useAppKitTheme,
  useAppKitEvents,
  useAppKitAccount,
  useWalletInfo,
} from "@reown/appkit/react";
import { useNetworkCycle } from '@/lib/useNetworkCycle'



export const ActionButtonList = () => {
  const { disconnect } = useDisconnect();
  const { open } = useAppKit();

  const eip155AccountState = useAppKitAccount({ namespace: "eip155" });
  const solanaAccountState = useAppKitAccount({ namespace: "solana" });
  const { switchToNext } = useNetworkCycle();


  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error("Failed to disconnect:", error);
    }
  };
  return (
    <div className="flex flex-row-reverse justify-start gap-1">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline">
            <Wallet /> Connect Wallet
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetTitle className="mt-5">Connect Wallet</SheetTitle>
          {eip155AccountState.isConnected ? (
            <section>
              {eip155AccountState.address}
              <br />
            </section>
          ) : (
            <Button
              onClick={() => open({ view: "Connect", namespace: "eip155" })}
              disabled={eip155AccountState.isConnected}
            >
              Open EVM
            </Button>
          )}
          {solanaAccountState.isConnected ? (
            <section>
              {solanaAccountState.address}
              <br />
            </section>
          ) : (
            <Button
              onClick={() => open({ view: "Connect", namespace: "solana" })}
            >
              Open Solana
            </Button>
          )}
          <Button onClick={handleDisconnect}>Disconnect</Button>
          <Button onClick={switchToNext}>Switch</Button>
        </SheetContent>
      </Sheet>
      <ModeToggle />
    </div>
  );
};
