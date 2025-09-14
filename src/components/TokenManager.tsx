import React, { useState, useEffect } from "react";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { useAppKitAccount, useAppKitNetwork } from "@reown/appkit/react";
import { shallow } from "zustand/shallow";

// Import separated stores
import {
  useNetworkStore,
  selectConnection,
  selectCurrentNetwork,
  selectIsSolanaNetwork,
  selectIsNetworkReady,
} from "@/store/networkStore";

import {
  useTokenStore,
  selectTokenState,
  selectTokenData,
  type UserToken,
} from "@/store/tokenStore";

// Import the updated hook that uses separated stores
import { useToken } from "@/lib/useToken";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Icons (using lucide-react)
import {
  Wallet,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Plus,
  Copy,
  ExternalLink,
  AlertCircle,
  Coins,
  Zap,
  Info,
  DollarSign,
} from "lucide-react";

export const TokenManager: React.FC = () => {
  // AppKit hooks for wallet info
  const { address, isConnected } = useAppKitAccount();
  const { caipNetwork } = useAppKitNetwork();

  // Network store state
  const connection = useNetworkStore((state) => state.connection);
  const currentNetwork = useNetworkStore((state) => state.currentNetwork);
  const isSolanaNetwork = useNetworkStore((state) => state.isSolanaNetwork);
  const isNetworkReady = useNetworkStore((state) => state.isReady);
  const { syncNetworkFromAppKit, reset: resetNetwork } = useNetworkStore();

  // Token store state
  // const tokenState = useTokenStore(selectTokenState);
  const program = useTokenStore((state) => state.program);
  const mintAuthPda = useTokenStore((state) => state.mintAuthPda);
  const loading = useTokenStore((state) => state.loading);
  const error = useTokenStore((state) => state.error);
  // const tokenData = useTokenStore(selectTokenData);
  const tokenInfo = useTokenStore((state) => state.tokenInfo);
  const userTokens = useTokenStore((state) => state.userTokens);
  const selectedToken = useTokenStore((state) => state.selectedToken);
  const { setLoading, setError, reset: resetToken } = useTokenStore();

  // Use the updated hook for business logic
  const {
    initializeToken,
    mintTokens,
    getUserBalance,
    refreshTokenInfo,
    getAllUserTokenAccounts,
    userBalance,
    userTokenAccount,
    mintPda,
  } = useToken();

  // Local component state
  const [mintAmount, setMintAmount] = useState<string>("1000");
  const [customMint, setCustomMint] = useState<string>("");
  const [allTokenAccounts, setAllTokenAccounts] = useState<UserToken[]>([]);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });
  const [wasConnected, setWasConnected] = useState(false);
  // console.log("first");

  // Add this useEffect in TokenManager to sync network when wallet connects
  useEffect(() => {
    console.log("[TokenManager] AppKit network info:", {
      caipNetwork: caipNetwork?.name,
      caipNetworkId: caipNetwork?.id,
      isConnected,
    });

    if (isConnected && (caipNetwork?.name || caipNetwork?.id)) {
      console.log("[TokenManager] Triggering network sync...");
      syncNetworkFromAppKit(
        caipNetwork?.name || null,
        caipNetwork?.id?.toString() || null // Convert to string
      );
    }
  }, [isConnected, caipNetwork?.name, caipNetwork?.id, syncNetworkFromAppKit]);

  // Sync network when AppKit changes - ONLY place for sync
  // useEffect(() => {
  //   console.log("[TokenManager] Wallet connection changed:", {
  //     isConnected,
  //     address: !!address,
  //   });
  //   if (!isConnected) {
  //     // console.log("[TokenManager] Calling reset due to wallet disconnect");
  //     resetNetwork();
  //     // resetToken();
  //   }
  // }, [isConnected, resetNetwork, address]);

  // Load all user token accounts on connection
  useEffect(() => {
    if (isConnected && isNetworkReady && mintAuthPda) {
      loadAllTokenAccounts();
      // console.log("i am here");
    }
  }, [isConnected, isNetworkReady, mintAuthPda]);

  // Show notification
  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification({ type: null, message: "" }), 5000);
  };

  // Copy to clipboard helper
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showNotification("success", `${label} copied to clipboard`);
    } catch (err) {
      showNotification("error", `Failed to copy: ${(err as Error).message}`);
    }
  };

  // const loadAllTokenAccounts = async () => {
  //   console.log("[TokenManager] loadAllTokenAccounts called - placeholder");
  //   // TODO: Implement token accounts loading
  //   return;
  // };

  const loadAllTokenAccounts = async () => {
    try {
      setLoading(true);
      const accounts = await getAllUserTokenAccounts();
      console.log(accounts)
      setAllTokenAccounts(accounts);
    } catch (err) {
      console.error("Failed to load token accounts:", err);
      setError(`Failed to load token accounts: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInitializeToken = async () => {
    setIsInitializing(true);
    try {
      const result = await initializeToken();
      if (result) {
        showNotification(
          "success",
          `Token created! Mint: ${result.mint.toBase58().slice(0, 8)}...`
        );
        await loadAllTokenAccounts();
      }
    } catch (err) {
      showNotification(
        "error",
        `Token creation failed: ${(err as Error).message}`
      );
    } finally {
      setIsInitializing(false);
    }
  };

  const handleMintTokens = async () => {
    if (!mintAmount || parseFloat(mintAmount) <= 0) {
      showNotification("error", "Please enter a valid amount");
      return;
    }

    const targetMint = customMint ? new PublicKey(customMint) : mintPda;
    if (!targetMint) {
      showNotification(
        "error",
        "Please initialize a token first or enter a custom mint address"
      );
      return;
    }

    setIsMinting(true);
    try {
      const decimals = tokenInfo?.decimals || 9;
      const amount = new BN(parseFloat(mintAmount)).mul(
        new BN(10).pow(new BN(decimals))
      );

      const tx = await mintTokens(amount, targetMint);
      if (tx) {
        showNotification(
          "success",
          `Successfully minted ${mintAmount} tokens!`
        );
        await loadAllTokenAccounts();
        if (
          targetMint.equals(
            mintPda || new PublicKey("11111111111111111111111111111111")
          )
        ) {
          await refreshTokenInfo(targetMint);
        }
      }
    } catch (err) {
      showNotification("error", `Minting failed: ${(err as Error).message}`);
    } finally {
      setIsMinting(false);
    }
  };

  const handleRefresh = async () => {
    const targetMint = customMint ? new PublicKey(customMint) : mintPda;
    if (targetMint) {
      await refreshTokenInfo(targetMint);
    }
    await loadAllTokenAccounts();
  };

  const formatBalance = (balance: number, decimals: number = 9) => {
    return (balance / Math.pow(10, decimals)).toLocaleString();
  };

  const handleSelectToken = (mintAddress: string) => {
    setCustomMint(mintAddress);
    try {
      refreshTokenInfo(new PublicKey(mintAddress));
    } catch (err) {
      showNotification("error", "Invalid mint address");
    }
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
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Use the wallet button in the top right to connect
            </AlertDescription>
          </Alert>
        </CardContent>
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
        <CardContent>
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              {!isSolanaNetwork
                ? "You are not connected to a Solana network"
                : "Network connection is not ready"}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Notification Alert */}
      {notification.type && (
        <Alert
          variant={notification.type === "error" ? "destructive" : "default"}
          className="mb-4"
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertDescription>{notification.message}</AlertDescription>
        </Alert>
      )}

      {/* Header Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Test Token Manager
          </CardTitle>
          <CardDescription>
            Network: {currentNetwork || "Unknown"} | Connection:{" "}
            {connection ? "Connected" : "Disconnected"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  onClick={() =>
                    copyToClipboard(address || "", "Wallet address")
                  }
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">
                Program Status
              </Label>
              <Badge variant={program ? "default" : "secondary"}>
                {program ? "Connected" : "Not Connected"}
              </Badge>
            </div>

            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">
                Mint Authority
              </Label>
              <div className="flex items-center gap-1">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-mono">
                  {mintAuthPda?.toBase58().slice(0, 8)}...
                </span>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Refresh Data</span>
          </Button>
        </CardFooter>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Tabs */}
      <Tabs defaultValue="create" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="create">Create</TabsTrigger>
          <TabsTrigger value="mint" disabled={!program}>
            Mint
          </TabsTrigger>
          <TabsTrigger value="accounts" disabled={!program}>
            Accounts
          </TabsTrigger>
          <TabsTrigger value="info" disabled={!tokenInfo}>
            Info
          </TabsTrigger>
        </TabsList>

        {/* Create Token Tab */}
        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create Test Token</CardTitle>
              <CardDescription>
                Initialize a new SPL token with PDA mint authority for testing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    This creates a new token with 9 decimals and a Program
                    Derived Address (PDA) as mint authority. Anyone can mint
                    tokens from this program for testing purposes.
                  </AlertDescription>
                </Alert>

                {mintAuthPda && (
                  <div className="p-3 bg-muted rounded-lg">
                    <Label className="text-sm text-muted-foreground">
                      Mint Authority PDA
                    </Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-sm">{mintAuthPda.toBase58()}</code>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() =>
                          copyToClipboard(
                            mintAuthPda!.toBase58(),
                            "Mint Authority PDA"
                          )
                        }
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleInitializeToken}
                disabled={isInitializing || !program}
                className="w-full"
              >
                {isInitializing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Token...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Test Token
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Mint Tokens Tab */}
        <TabsContent value="mint" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mint Tokens</CardTitle>
              <CardDescription>
                Mint tokens to your wallet for testing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customMint">
                  Token Mint Address (optional)
                </Label>
                <Input
                  id="customMint"
                  placeholder="Leave empty to use current token"
                  value={customMint}
                  onChange={(e) => setCustomMint(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Enter a custom mint address or leave empty to use the
                  currently selected token
                </p>
              </div>

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
                  Amount in human-readable format (will be converted to base
                  units)
                </p>
              </div>

              {tokenInfo && (
                <div className="p-3 bg-muted rounded-lg">
                  <Label className="text-sm text-muted-foreground">
                    Current Token Info
                  </Label>
                  <div className="mt-1 space-y-1 text-sm">
                    <p>
                      Mint: {tokenInfo.mint.toBase58().slice(0, 8)}...
                      {tokenInfo.mint.toBase58().slice(-8)}
                    </p>
                    <p>Decimals: {tokenInfo.decimals}</p>
                    <p>
                      Your Balance:{" "}
                      {formatBalance(userBalance, tokenInfo.decimals)}
                    </p>
                  </div>
                </div>
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
        </TabsContent>

        {/* Token Accounts Tab */}
        <TabsContent value="accounts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Test Tokens</CardTitle>
              <CardDescription>
                Tokens minted from your test_token program (mint authority:{" "}
                {mintAuthPda?.toBase58().slice(0, 8)}...)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allTokenAccounts.length === 0 ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    No token accounts found. Create and mint some tokens first!
                  </AlertDescription>
                </Alert>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableCaption>
                      Your token accounts with positive balances
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mint Address</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Token Account</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allTokenAccounts.map((account, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="text-xs">
                                {account.mint.toBase58().slice(0, 8)}...
                                {account.mint.toBase58().slice(-6)}
                              </code>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() =>
                                  copyToClipboard(
                                    account.mint.toBase58(),
                                    "Mint address"
                                  )
                                }
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">
                              {formatBalance(account.balance, account.decimals)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="text-xs">
                                {account.account.toBase58().slice(0, 8)}...
                                {account.account.toBase58().slice(-6)}
                              </code>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() =>
                                  window.open(
                                    `https://explorer.solana.com/address/${account.account.toBase58()}?cluster=${currentNetwork}`,
                                    "_blank"
                                  )
                                }
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleSelectToken(account.mint.toBase58())
                              }
                            >
                              Select
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Token Info Tab */}
        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Token Details</CardTitle>
              <CardDescription>
                Detailed information about the selected token
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tokenInfo ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <Label className="text-sm text-muted-foreground">
                        Mint Address
                      </Label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-sm break-all">
                          {tokenInfo.mint.toBase58()}
                        </code>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 flex-shrink-0"
                          onClick={() =>
                            copyToClipboard(
                              tokenInfo!.mint.toBase58(),
                              "Mint address"
                            )
                          }
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <Label className="text-sm text-muted-foreground">
                        Mint Authority
                      </Label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-sm break-all">
                          {tokenInfo.mintAuthority.toBase58()}
                        </code>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 flex-shrink-0"
                          onClick={() =>
                            copyToClipboard(
                              tokenInfo!.mintAuthority.toBase58(),
                              "Mint authority"
                            )
                          }
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <Label className="text-sm text-muted-foreground">
                        Decimals
                      </Label>
                      <div className="flex items-center gap-2 mt-1">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">
                          {tokenInfo.decimals}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <Label className="text-sm text-muted-foreground">
                        Total Supply
                      </Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Coins className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">
                          {formatBalance(
                            Number(tokenInfo.supply),
                            tokenInfo.decimals
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <Label className="text-sm text-muted-foreground">
                        Your Balance
                      </Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">
                          {formatBalance(userBalance, tokenInfo.decimals)}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <Label className="text-sm text-muted-foreground">
                        Your Token Account
                      </Label>
                      <div className="flex items-center gap-2 mt-1">
                        {userTokenAccount && (
                          <>
                            <code className="text-sm break-all">
                              {userTokenAccount.toBase58()}
                            </code>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 flex-shrink-0"
                              onClick={() =>
                                copyToClipboard(
                                  userTokenAccount.toBase58(),
                                  "Token account"
                                )
                              }
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      This token can be used as an asset in your vault program.
                      Copy the mint address and use it in your vault
                      configuration.
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No token selected. Create a token or select one from your
                    accounts.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
