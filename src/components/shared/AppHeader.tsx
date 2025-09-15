// components/shared/AppHeader.tsx
import React from 'react';
import { useAppKitAccount } from "@reown/appkit/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Copy } from "lucide-react";

import { useTokenSelection, useNFTSelection } from "@/context/SelectionContext";

interface AppHeaderProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  programStatus?: {
    connected: boolean;
    label: string;
  };
  currentNetwork?: string | null;
  onCopyToClipboard?: (text: string, label: string) => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  description,
  icon,
  programStatus,
  currentNetwork,
  onCopyToClipboard
}) => {
  console.log('[AppHeader] === COMPONENT RENDER START ===');
  
  const { address } = useAppKitAccount();
  const { selectedTokenMint } = useTokenSelection();
  const { selectedNFT } = useNFTSelection();

  console.log('[AppHeader] Props and state:', {
    title,
    hasAddress: !!address,
    hasSelectedToken: !!selectedTokenMint,
    hasSelectedNFT: !!selectedNFT,
    programConnected: programStatus?.connected,
    currentNetwork
  });

  const handleCopy = (text: string, label: string) => {
    console.log('[AppHeader] Copy requested:', { label, text: text.slice(0, 16) + '...' });
    if (onCopyToClipboard) {
      onCopyToClipboard(text, label);
    } else {
      // Fallback copy functionality
      navigator.clipboard.writeText(text).then(() => {
        console.log('[AppHeader] Fallback copy successful');
      }).catch((err) => {
        console.error('[AppHeader] Fallback copy failed:', err);
      });
    }
  };

  console.log('[AppHeader] === COMPONENT RENDER END ===');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">Wallet</Label>
            <div className="flex items-center gap-2">
              {address ? (
                <>
                  <Badge variant="outline" className="font-mono">
                    {address.slice(0, 4)}...{address.slice(-4)}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => handleCopy(address, "Wallet address")}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <Badge variant="secondary">Not connected</Badge>
              )}
            </div>
          </div>
          
          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">Selected Token</Label>
            <div className="flex items-center gap-2">
              {selectedTokenMint ? (
                <>
                  <Badge variant="default" className="font-mono">
                    {selectedTokenMint.toBase58().slice(0, 8)}...
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => handleCopy(selectedTokenMint.toBase58(), "Token mint")}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <Badge variant="secondary">None selected</Badge>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">Selected NFT</Label>
            <div className="flex items-center gap-2">
              {selectedNFT ? (
                <>
                  <Badge variant="default" className="font-mono">
                    {selectedNFT.toBase58().slice(0, 8)}...
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => handleCopy(selectedNFT.toBase58(), "NFT mint")}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <Badge variant="secondary">None selected</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Program Status - Optional */}
        {(programStatus || currentNetwork) && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {programStatus && (
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">{programStatus.label}</Label>
                <Badge variant={programStatus.connected ? "default" : "secondary"}>
                  {programStatus.connected ? "Connected" : "Not Connected"}
                </Badge>
              </div>
            )}
            {currentNetwork && (
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Network</Label>
                <Badge variant="outline">{currentNetwork}</Badge>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};