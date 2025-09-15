// components/TokenManager.tsx
import React, { useState, useEffect } from "react";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { useAppKitAccount, useAppKitNetwork } from "@reown/appkit/react";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { AppHeader } from "@/components/shared/AppHeader";

import { useToken } from "@/lib/useToken";
import { useTokenSelection, useNFTSelection } from "@/context/SelectionContext";


import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  Wallet,
  Loader2,
  CheckCircle2,
  XCircle,
  Copy,
  AlertCircle,
  Coins,
  Zap,
  Info,
  RefreshCw,
  Plus,
  Check,
} from "lucide-react";

// Shared test token mint address
const DEFAULT_MINT = "4kXBWAG92UZA1FPEQDN5bjePoFyQsbTnZ9rpxgRBbFYk";

export const TokenManager: React.FC = () => {
  console.log("[TokenManager] === COMPONENT RENDER START ===");

  const { address, isConnected } = useAppKitAccount();


  // Selection context
  const {
    selectedTokenAccount,
    selectedTokenMint,
    setSelectedTokenAccount,
    setSelectedTokenMint,
  } = useTokenSelection();

  const { selectedNFT, setSelectedNFT } = useNFTSelection();

  console.log("[TokenManager] Context state:", {
    selectedTokenAccount: selectedTokenAccount?.toBase58(),
    selectedTokenMint: selectedTokenMint?.toBase58(),
    selectedNFT: selectedNFT?.toBase58(),
  });

  // Hook for business logic
  const {
    // Network state
    connection,
    currentNetwork,
    isSolanaNetwork,
    isNetworkReady,

    // Token state
    program,
    mintAuthPda,
    userTokens,
    loading,
    error,

    // AppKit state
    isConnected: hookConnected,
    walletAddress,

    // Functions
    mintTokens,
    getUserBalance,
    getAllUserTokenAccounts,
  } = useToken();

  console.log("[TokenManager] Hook state:", {
    hasConnection: !!connection,
    currentNetwork,
    isNetworkReady,
    hasProgram: !!program,
    userTokensCount: userTokens.length,
    loading,
    hookConnected,
  });

  // Local state
  const [mintAmount, setMintAmount] = useState<string>("1000");
  const [isMinting, setIsMinting] = useState(false);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  // Mock NFT data for demonstration - replace with actual NFT hook data
  const [mockNFTs] = useState([
    {
      mint: new PublicKey("7Uc3xCQxiPqMHVXPrzcgUw8rrKQ7vCu5HUXL4TVRntDS"),
      name: "Access NFT #1",
      uniqueId: [1, 2, 3, 4],
    },
    {
      mint: new PublicKey("Ggbz1DvG6sh5FwTCFUqc85M6RYVduivGu3BhyxVHqpP1"),
      name: "Access NFT #2",
      uniqueId: [5, 6, 7, 8],
    },
  ]);

  console.log("[TokenManager] Local state:", {
    mintAmount,
    isMinting,
    userBalance,
    hasNotification: !!notification.type,
    mockNFTsCount: mockNFTs.length,
  });


  // Load data when ready
  useEffect(() => {
    console.log("[TokenManager] === LOAD DATA EFFECT START ===");
    if (hookConnected && isNetworkReady && walletAddress) {
      console.log("[TokenManager] Loading token accounts and balance");
      loadBalance();
      getAllUserTokenAccounts();
    }
    console.log("[TokenManager] === LOAD DATA EFFECT END ===");
  }, [hookConnected, isNetworkReady, walletAddress, getAllUserTokenAccounts]);

  const showNotification = (type: "success" | "error", message: string) => {
    console.log("[TokenManager] Showing notification:", { type, message });
    setNotification({ type, message });
    setTimeout(() => {
      console.log("[TokenManager] Clearing notification");
      setNotification({ type: null, message: "" });
    }, 5000);
  };

  const copyToClipboard = async (text: string, label: string) => {
    console.log("[TokenManager] Copying to clipboard:", {
      label,
      text: text.slice(0, 16) + "...",
    });
    try {
      await navigator.clipboard.writeText(text);
      showNotification("success", `${label} copied to clipboard`);
    } catch (err) {
      showNotification("error", `Failed to copy: ${(err as Error).message}`);
    }
  };

  const loadBalance = async () => {
    console.log("[TokenManager] Loading balance for default mint");
    if (!address) return;

    try {
      const mint = new PublicKey(DEFAULT_MINT);
      const balance = await getUserBalance(mint);
      setUserBalance(balance);
      console.log("[TokenManager] Balance loaded:", balance);
    } catch (err) {
      console.error("[TokenManager] Failed to load balance:", err);
    }
  };

  const handleMintTokens = async () => {
    console.log("[TokenManager] === MINT TOKENS START ===");
    console.log("[TokenManager] Mint amount:", mintAmount);

    if (!mintAmount || parseFloat(mintAmount) <= 0) {
      showNotification("error", "Please enter a valid amount");
      return;
    }

    setIsMinting(true);
    try {
      const targetMint = new PublicKey(DEFAULT_MINT);
      const decimals = 9; // Standard token decimals
      const amount = new BN(parseFloat(mintAmount)).mul(
        new BN(10).pow(new BN(decimals))
      );

      console.log("[TokenManager] Minting tokens:", {
        targetMint: targetMint.toBase58(),
        amount: amount.toString(),
        decimals,
      });

      const tx = await mintTokens(amount, targetMint);
      if (tx) {
        showNotification(
          "success",
          `Successfully minted ${mintAmount} tokens!`
        );
        await loadBalance(); // Refresh balance
        await getAllUserTokenAccounts(); // Refresh token accounts
        setMintAmount("1000"); // Reset
        console.log("[TokenManager] Minting completed successfully");
      }
    } catch (err) {
      console.error("[TokenManager] Minting failed:", err);
      showNotification("error", `Minting failed: ${(err as Error).message}`);
    } finally {
      setIsMinting(false);
    }
    console.log("[TokenManager] === MINT TOKENS END ===");
  };

  const handleSelectTokenAccount = (
    tokenAccount: PublicKey,
    mint: PublicKey
  ) => {
    console.log("[TokenManager] Selecting token account:", {
      tokenAccount: tokenAccount.toBase58(),
      mint: mint.toBase58(),
    });
    setSelectedTokenAccount(tokenAccount);
    setSelectedTokenMint(mint);
  };

  const handleSelectNFT = (nftMint: PublicKey) => {
    console.log("[TokenManager] Selecting NFT:", nftMint.toBase58());
    setSelectedNFT(nftMint);
  };

  const formatBalance = (balance: number, decimals: number = 9) => {
    return (balance / Math.pow(10, decimals)).toLocaleString();
  };

  // Not connected state
  if (!isConnected) {
    console.log("[TokenManager] Rendering not connected state");
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
    console.log("[TokenManager] Rendering network issue state");
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

  console.log("[TokenManager] Rendering main interface");

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Notification */}
      {notification.type && (
        <Alert
          variant={notification.type === "error" ? "destructive" : "default"}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertDescription>{notification.message}</AlertDescription>
        </Alert>
      )}

      {/* Header with Current Selections */}
      <AppHeader
        title="Token Manager"
        description="Mint and manage test tokens for vault operations"
        icon={<Coins className="h-5 w-5" />}
        programStatus={{
          connected: !!program,
          label: "Program Status",
        }}
        currentNetwork={currentNetwork}
        onCopyToClipboard={showNotification}
      />

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Tabs */}
      <Tabs defaultValue="mint" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="mint">Mint Tokens</TabsTrigger>
          <TabsTrigger value="history">Token & NFT Selection</TabsTrigger>
        </TabsList>

        {/* Mint Tab */}
        <TabsContent value="mint" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mint Test Tokens</CardTitle>
              <CardDescription>
                Create tokens for testing vault operations
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
                  Token Mint: {DEFAULT_MINT.slice(0, 8)}...
                  {DEFAULT_MINT.slice(-8)}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 ml-2"
                    onClick={() =>
                      copyToClipboard(DEFAULT_MINT, "Mint address")
                    }
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </AlertDescription>
              </Alert>

              {mintAuthPda && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Mint Authority: {mintAuthPda.toBase58().slice(0, 8)}...
                    {mintAuthPda.toBase58().slice(-8)}
                  </AlertDescription>
                </Alert>
              )}

              <div className="p-3 bg-muted rounded-lg">
                <Label className="text-sm text-muted-foreground">
                  Current Balance
                </Label>
                <div className="flex items-center gap-2 mt-1">
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
                    {loading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
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
        </TabsContent>

        {/* Token & NFT Selection Tab */}
        <TabsContent value="history" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Token Accounts Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Select Token Account</CardTitle>
                <CardDescription>
                  Choose a token account for vault operations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {userTokens.length > 0 ? (
                      userTokens.map((token, index) => (
                        <Card
                          key={index}
                          className={`p-3 cursor-pointer transition-colors ${
                            selectedTokenAccount?.equals(token.account)
                              ? "ring-2 ring-primary bg-primary/5"
                              : "hover:bg-muted"
                          }`}
                          onClick={() =>
                            handleSelectTokenAccount(token.account, token.mint)
                          }
                        >
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="font-mono text-xs"
                                >
                                  {token.mint.toBase58().slice(0, 8)}...
                                </Badge>
                                {selectedTokenAccount?.equals(
                                  token.account
                                ) && <Check className="h-4 w-4 text-primary" />}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Balance:{" "}
                                {formatBalance(token.balance, token.decimals)}
                              </p>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(
                                  token.account.toBase58(),
                                  "Token account"
                                );
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </Card>
                      ))
                    ) : (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          No token accounts found. Mint some tokens first.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={getAllUserTokenAccounts}
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span className="ml-2">Refresh Accounts</span>
                </Button>
              </CardFooter>
            </Card>

            {/* NFT Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Select NFT Identity</CardTitle>
                <CardDescription>
                  Choose an NFT for identity verification
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    NFT selection will be available when UniqueIdManager is
                    connected. Use the context to share NFT selections across
                    components.
                  </AlertDescription>
                </Alert>
              </CardContent>
              <CardFooter>
                <div className="w-full text-center">
                  <p className="text-sm text-muted-foreground">
                    Integrate with useUniqueId hook to display available NFTs
                  </p>
                </div>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );

  console.log("[TokenManager] === COMPONENT RENDER END ===");
};
