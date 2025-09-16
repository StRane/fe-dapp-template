import {
  useDisconnect,
  useAppKit,
  useAppKitAccount,
} from "@reown/appkit/react";

import { Button } from "@/components/ui/button";
import { Wallet, Coins, Fingerprint, Zap } from "lucide-react";
import { ModeToggle } from "@/components/ModeToggle";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNetworkCycle } from "@/lib/useNetWorkCycle";
import { useNavigate, useLocation } from "react-router-dom";

export const ActionButtonList = () => {
  const { disconnect } = useDisconnect();
  const { open } = useAppKit();
  const navigate = useNavigate();
  const location = useLocation();

  const eip155AccountState = useAppKitAccount({ namespace: "eip155" });
  const solanaAccountState = useAppKitAccount({ namespace: "solana" });
  const { switchToNext } = useNetworkCycle();
  const { address } = useAppKitAccount();

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error("Failed to disconnect:", error);
    }
  };

  // Determine current tab based on pathname
  const getCurrentTab = () => {
    switch (location.pathname) {
      case "/identitymanager":
        return "identitymanager";
      case "/token":
        return "token";
      case "/vault":
        return "vault";
      case "/uniqueid":
        return "uniqueid";
      default:
        return "uniqueid"; // Default tab
    }
  };

  const currentTab = getCurrentTab();

  const handleTabChange = (value: string) => {
    switch (value) {
      case "identitymanager":
        navigate("/identitymanager");
        break;
      case "token":
        navigate("/token");
        break;
      case "vault":
        navigate("/vault");
        break;
      case "uniqueid":
        navigate("/uniqueid");
        break;
      default:
        navigate("/uniqueid");
    }
  };

  return (
    <div className="flex items-center justify-between w-full px-4 py-2 border-b">
      {/* Left side - Navigation Tabs */}
      <div className="flex items-center gap-4">
        {solanaAccountState.isConnected && (
          <Tabs value={currentTab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="identitymanager" className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Identity Manager
              </TabsTrigger>
              <TabsTrigger value="token" className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Test Token
              </TabsTrigger>
              <TabsTrigger value="uniqueid" className="flex items-center gap-2">
                <Fingerprint className="w-4 h-4" />
                Unique ID NFT
              </TabsTrigger>
              <TabsTrigger value="vault" className="flex items-center gap-2">
                <Coins className="w-4 h-4" />
                NFT Vault
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        
        {/* Show program info when not connected */}
        {!solanaAccountState.isConnected && (
          <div className="text-sm text-muted-foreground">
            Connect Solana wallet to access programs
          </div>
        )}
      </div>

      {/* Right side - Wallet & Theme */}
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Wallet className="w-4 h-4 mr-2" />
              {address ? (
                <span className="max-w-[150px] truncate">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </span>
              ) : (
                <span>Connect Wallet</span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {eip155AccountState.isConnected ? (
              <DropdownMenuItem className="font-mono text-xs">
                EVM: {eip155AccountState.address?.slice(0, 10)}...
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => open({ view: "Connect", namespace: "eip155" })}
                disabled={eip155AccountState.isConnected}
              >
                Connect EVM
              </DropdownMenuItem>
            )}
            {solanaAccountState.isConnected ? (
              <DropdownMenuItem className="font-mono text-xs">
                SOL: {solanaAccountState.address?.slice(0, 10)}...
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => open({ view: "Connect", namespace: "solana" })}
              >
                Connect Solana
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={switchToNext}>
              Switch Network
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDisconnect}>
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ModeToggle />
      </div>
    </div>
  );
};