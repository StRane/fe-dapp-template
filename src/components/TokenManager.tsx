import React, { useState, useEffect } from "react";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { useAppKitAccount, useAppKitNetwork } from "@reown/appkit/react";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

import { useNetworkStore } from "@/store/networkStore";
import { useTokenStore } from "@/store/tokenStore";
import { useToken } from "@/lib/useToken";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

import { Wallet, Loader2, CheckCircle2, XCircle, Copy, AlertCircle, Coins, Zap, Info } from "lucide-react";

// Shared test token mint address
const DEFAULT_MINT = "4kXBWAG92UZA1FPEQDN5bjePoFyQsbTnZ9rpxgRBbFYk";

export const TokenManager: React.FC = () => {
  const { address, isConnected } = useAppKitAccount();
  const { caipNetwork } = useAppKitNetwork();

  // Store state
  // const connection = useNetworkStore((state) => state.connection);
  const currentNetwork = useNetworkStore((state) => state.currentNetwork);
  const isSolanaNetwork = useNetworkStore((state) => state.isSolanaNetwork);
  const isNetworkReady = useNetworkStore((state) => state.isReady);
  const { syncNetworkFromAppKit } = useNetworkStore();

  const program = useTokenStore((state) => state.program);
  const mintAuthPda = useTokenStore((state) => state.mintAuthPda);
  const loading = useTokenStore((state) => state.loading);
  const error = useTokenStore((state) => state.error);

  // Hook for business logic
  const { mintTokens, getUserBalance } = useToken();

  // Local state
  const [mintAmount, setMintAmount] = useState<string>("1000");
  const [isMinting, setIsMinting] = useState(false);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [userTokenAccount, setUserTokenAccount] = useState<PublicKey | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  // Network sync
  useEffect(() => {
    if (isConnected && (caipNetwork?.name || caipNetwork?.id)) {
      syncNetworkFromAppKit(
        caipNetwork?.name || null,
        caipNetwork?.id?.toString() || null
      );
    }
  }, [isConnected, caipNetwork?.name, caipNetwork?.id, syncNetworkFromAppKit]);

  // Load balance and token account when ready
  useEffect(() => {
    if (isConnected && isNetworkReady && address) {
      loadBalance();
      calculateTokenAccount();
    }
  }, [isConnected, isNetworkReady, address]);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification({ type: null, message: "" }), 5000);
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showNotification("success", `${label} copied to clipboard`);
    } catch (err) {
      showNotification("error", `Failed to copy: ${(err as Error).message}`);
    }
  };

  const loadBalance = async () => {
    if (!address) return;
    
    try {
      const mint = new PublicKey(DEFAULT_MINT);
      const balance = await getUserBalance(mint);
      setUserBalance(balance);
    } catch (err) {
      console.error("Failed to load balance:", err);
    }
  };

  const calculateTokenAccount = () => {
    if (!address) return;
    
    try {
      const mint = new PublicKey(DEFAULT_MINT);
      const tokenAccount = getAssociatedTokenAddressSync(mint, new PublicKey(address));
      setUserTokenAccount(tokenAccount);
    } catch (err) {
      console.error("Failed to calculate token account:", err);
    }
  };

  const handleMintTokens = async () => {
    if (!mintAmount || parseFloat(mintAmount) <= 0) {
      showNotification("error", "Please enter a valid amount");
      return;
    }

    setIsMinting(true);
    try {
      const targetMint = new PublicKey(DEFAULT_MINT);
      const decimals = 9; // Standard token decimals
      const amount = new BN(parseFloat(mintAmount)).mul(new BN(10).pow(new BN(decimals)));

      const tx = await mintTokens(amount, targetMint);
      if (tx) {
        showNotification("success", `Successfully minted ${mintAmount} tokens!`);
        await loadBalance(); // Refresh balance
        setMintAmount("1000"); // Reset
      }
    } catch (err) {
      showNotification("error", `Minting failed: ${(err as Error).message}`);
    } finally {
      setIsMinting(false);
    }
  };

  const formatBalance = (balance: number, decimals: number = 9) => {
    return (balance / Math.pow(10, decimals)).toLocaleString();
  };

  // Not connected state
  if (!isConnected) {
    return (
      <Card className="w-full max-w-md mx-auto mt-10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Connect Wallet
          </CardTitle>
          <CardDescription>
            Please connect your Solana wallet to use the Token Manager
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Network not ready state
  if (!isSolanaNetwork || !isNetworkReady) {
    return (
      <Card className="w-full max-w-md mx-auto mt-10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Network Issue
          </CardTitle>
          <CardDescription>
            Please switch to a supported Solana network
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Notification */}
      {notification.type && (
        <Alert variant={notification.type === "error" ? "destructive" : "default"}>
          {notification.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          <AlertDescription>{notification.message}</AlertDescription>
        </Alert>
      )}

      {/* Header with Balance and Token Account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Test Token Manager
          </CardTitle>
          <CardDescription>
            Mint test tokens for vault testing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Wallet</Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  {address?.slice(0, 4)}...{address?.slice(-4)}
                </Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => copyToClipboard(address || "", "Wallet address")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Current Balance</Label>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono">
                  {formatBalance(userBalance)} tokens
                </Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={loadBalance}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Token Account Info */}
          {userTokenAccount && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <Label className="text-sm text-muted-foreground">Your Token Account</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-sm">{userTokenAccount.toBase58()}</code>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => copyToClipboard(userTokenAccount.toBase58(), "Token account")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Program Status */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Program Status</Label>
              <Badge variant={program ? "default" : "secondary"}>
                {program ? "Connected" : "Not Connected"}
              </Badge>
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Network</Label>
              <Badge variant="outline">{currentNetwork || "Unknown"}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Mint Interface */}
      <Card>
        <CardHeader>
          <CardTitle>Mint Test Tokens</CardTitle>
          <CardDescription>
            Mint tokens for testing your vault program
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mintAmount">Amount (in tokens)</Label>
            <Input
              id="mintAmount"
              type="number"
              placeholder="1000"
              value={mintAmount}
              onChange={(e) => setMintAmount(e.target.value)}
              min="0"
              step="0.000000001"
            />
            <p className="text-sm text-muted-foreground">
              Amount in human-readable format (9 decimals)
            </p>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Token Mint: {DEFAULT_MINT.slice(0, 8)}...{DEFAULT_MINT.slice(-8)}
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 ml-2"
                onClick={() => copyToClipboard(DEFAULT_MINT, "Mint address")}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </AlertDescription>
          </Alert>

          {mintAuthPda && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Mint Authority: {mintAuthPda.toBase58().slice(0, 8)}...{mintAuthPda.toBase58().slice(-8)}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleMintTokens}
            disabled={isMinting || !program || !mintAmount}
            className="w-full"
          >
            {isMinting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Minting...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Mint {mintAmount} Tokens
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};