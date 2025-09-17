import React, { useState, useEffect } from "react";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { AnchorWallet } from "@solana/wallet-adapter-react";

// Import hooks
import { useVault } from "@/lib/useVault";
import { useTokenSelection, useNFTSelection } from "@/context/SelectionContext";

// UI Components
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
import { Separator } from "@/components/ui/separator";

// Icons
import {
  Wallet,
  Loader2,
  CheckCircle2,
  XCircle,
  Copy,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Shield,
  Info,
  Coins,
  Sparkles,
  CreditCard,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

// Shared components
import { AppHeader } from "@/components/shared/AppHeader";

export const VaultManager: React.FC = () => {
  console.log("[VaultManager] === COMPONENT RENDER START ===");

  const { address, isConnected } = useAppKitAccount();

  // Selection context
  const {
    selectedTokenAccount,
    selectedTokenMint,
    setSelectedTokenAccount,
    setSelectedTokenMint,
  } = useTokenSelection();

  const { selectedNFT, setSelectedNFT } = useNFTSelection();

  console.log("[VaultManager] Context state:", {
    selectedTokenAccount: selectedTokenAccount?.toBase58(),
    selectedTokenMint: selectedTokenMint?.toBase58(),
    selectedNFT: selectedNFT?.toBase58(),
  });

  // Vault hook - now follows established pattern (store consumer)
  const {
    // Store data (read-only)
    program,
    vault,
    selectedNFTPosition,
    allUserPositions,
    loading,
    userPositionLoading,
    error,

    // Network state (read-only)
    connection,
    currentNetwork,
    isSolanaNetwork,
    isNetworkReady,

    // AppKit state
    isConnected: hookConnected,
    walletAddress,

    // Selection state
    hasRequiredSelections,

    // Config
    vaultConfig,

    // Actions only
    deposit,
    withdraw,
    refreshVaultData,
    refreshUserPosition,
    refreshAllData,
  } = useVault();

  // Local UI state
  const [depositAmount, setDepositAmount] = useState("100");
  const [withdrawShares, setWithdrawShares] = useState("50");
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  const { walletProvider: debugProvider } =
    useAppKitProvider<AnchorWallet>("solana");

  useEffect(() => {
    console.log("[VaultManager] === WALLET PROVIDER DEBUG ===");
    console.log("[VaultManager] Solana provider:", {
      exists: !!debugProvider,
      type: typeof debugProvider,
      publicKey: debugProvider?.publicKey?.toBase58(),
      hasSignTransaction: !!debugProvider?.signTransaction,
    });
  }, [debugProvider]);

  // Show notification helper
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

  // Deposit handler
  const handleDeposit = async () => {
    console.log("[VaultManager] === DEPOSIT HANDLER START ===");

    // DEBUG: Check all the deposit dependencies
    console.log("[VaultManager] Deposit dependencies check:", {
      hasProgram: !!program,
      hasConnection: !!connection,
      hasAddress: !!address,
      selectedTokenMint: selectedTokenMint?.toBase58(),
      selectedNFT: selectedNFT?.toBase58(),
      isConnected,
      isNetworkReady,
      isSolanaNetwork,
    });

    if (!selectedTokenMint || !selectedNFT) {
      showNotification("error", "Please select both token and NFT");
      return;
    }

    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      showNotification("error", "Please enter a valid deposit amount");
      return;
    }

    // CRITICAL DEBUG: Check exactly what's missing for deposit
    if (!program) {
      console.error("[VaultManager] DEPOSIT BLOCKED: No program");
      showNotification(
        "error",
        "Program not initialized. Check wallet connection."
      );
      return;
    }

    if (!address) {
      console.error("[VaultManager] DEPOSIT BLOCKED: No address");
      showNotification("error", "Wallet address not available.");
      return;
    }

    if (!connection) {
      console.error("[VaultManager] DEPOSIT BLOCKED: No connection");
      showNotification("error", "Network connection not available.");
      return;
    }

    setIsDepositing(true);
    try {
      const amount = new BN(parseFloat(depositAmount) * 1e9); // Convert to lamports
      const signature = await deposit(amount, selectedTokenMint, selectedNFT);

      if (signature) {
        showNotification(
          "success",
          `Deposit successful! Signature: ${signature.slice(0, 8)}...`
        );
        setDepositAmount("100");
      } else {
        showNotification("error", "Deposit failed");
      }
    } catch (err) {
      showNotification("error", `Deposit failed: ${(err as Error).message}`);
    } finally {
      setIsDepositing(false);
    }
  };

  // Withdraw handler
  const handleWithdraw = async () => {
    if (!selectedTokenMint || !selectedNFT) {
      showNotification("error", "Please select both token and NFT");
      return;
    }

    setIsWithdrawing(true);
    try {
      const shares = new BN(parseFloat(withdrawShares) * 1e9); // Convert to lamports
      const signature = await withdraw(shares, selectedTokenMint, selectedNFT);

      if (signature) {
        showNotification(
          "success",
          `Withdraw successful! Signature: ${signature.slice(0, 8)}...`
        );
        setWithdrawShares("50");
      } else {
        showNotification("error", "Withdraw failed");
      }
    } catch (err) {
      showNotification("error", `Withdraw failed: ${(err as Error).message}`);
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Manual refresh handlers
  const handleRefreshVault = () => {
    console.log("[VaultManager] Manual vault refresh triggered");
    refreshVaultData();
  };

  const handleRefreshPosition = () => {
    console.log("[VaultManager] Manual position refresh triggered");
    refreshUserPosition();
  };

  const handleRefreshAll = () => {
    console.log("[VaultManager] Manual full refresh triggered");
    refreshAllData();
  };

  // Render connection status
  const renderConnectionStatus = () => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Connection Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              Wallet: {isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isNetworkReady ? "default" : "secondary"}>
              {isNetworkReady ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              Network: {isNetworkReady ? "Ready" : "Not Ready"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {/* <Badge variant={!!program ? "default" : "secondary"}>
              {!!program ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              Program: {!!program ? "Loaded" : "Not Loaded"}
            </Badge> */}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={hasRequiredSelections ? "default" : "secondary"}>
              {hasRequiredSelections ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              Selections: {hasRequiredSelections ? "Complete" : "Incomplete"}
            </Badge>
          </div>
        </div>
        {address && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Wallet Address:</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono">
                  {address.slice(0, 4)}...{address.slice(-4)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(address, "Wallet address")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Render vault info
  const renderVaultInfo = () => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Vault Information
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefreshVault}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && !vault ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading vault data...</span>
          </div>
        ) : vault ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Vault Owner</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono">
                    {vault.owner.toBase58().slice(0, 8)}...
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(vault.owner.toBase58(), "Vault owner")
                    }
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Asset Mint</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono">
                    {vault.assetMint.toBase58().slice(0, 8)}...
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(vault.assetMint.toBase58(), "Asset mint")
                    }
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Total Shares</Label>
                <span className="text-sm font-mono">
                  {vault.totalShares.toString()}
                </span>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Total Borrowed</Label>
                <span className="text-sm font-mono">
                  {vault.totalBorrowed.toString()}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center p-8">
            <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No vault data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Render user position
  const renderUserPosition = () => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Your Position
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefreshPosition}
            disabled={userPositionLoading}
          >
            {userPositionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </CardTitle>
        <CardDescription>
          Position for selected NFT:{" "}
          {selectedNFT
            ? selectedNFT.toBase58().slice(0, 8) + "..."
            : "None selected"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {userPositionLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading position data...</span>
          </div>
        ) : selectedNFTPosition ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Deposit Amount</Label>
                <span className="text-lg font-mono">
                  {selectedNFTPosition.depositAmount.toFixed(4)}
                </span>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Share Amount</Label>
                <span className="text-lg font-mono">
                  {selectedNFTPosition.shareAmount.toFixed(4)}
                </span>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">NFT Mint</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono">
                    {selectedNFTPosition.nftMint.toBase58().slice(0, 8)}...
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(
                        selectedNFTPosition.nftMint.toBase58(),
                        "NFT mint"
                      )
                    }
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Last Updated</Label>
                <span className="text-sm">
                  {new Date(selectedNFTPosition.timestamp).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center p-8">
            <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {selectedNFT
                ? "No position found for selected NFT"
                : "Select an NFT to view position"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Render transactions
  const renderTransactions = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Vault Operations
        </CardTitle>
        <CardDescription>
          Deposit or withdraw from the vault using your selected NFT
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="deposit" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="deposit">Deposit</TabsTrigger>
            <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
          </TabsList>

          <TabsContent value="deposit" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deposit-amount">Deposit Amount</Label>
              <Input
                id="deposit-amount"
                type="number"
                placeholder="Enter amount to deposit"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                disabled={isDepositing || !hasRequiredSelections}
              />
            </div>
            <Button
              onClick={handleDeposit}
              disabled={
                isDepositing || !hasRequiredSelections || !depositAmount
              }
              className="w-full"
            >
              {isDepositing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing Deposit...
                </>
              ) : (
                <>
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                  Deposit {depositAmount} Tokens
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="withdraw" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="withdraw-shares">Withdraw Shares</Label>
              <Input
                id="withdraw-shares"
                type="number"
                placeholder="Enter shares to withdraw"
                value={withdrawShares}
                onChange={(e) => setWithdrawShares(e.target.value)}
                disabled={isWithdrawing || !hasRequiredSelections}
              />
            </div>
            <Button
              onClick={handleWithdraw}
              disabled={
                isWithdrawing || !hasRequiredSelections || !withdrawShares
              }
              variant="outline"
              className="w-full"
            >
              {isWithdrawing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing Withdrawal...
                </>
              ) : (
                <>
                  <ArrowDownLeft className="mr-2 h-4 w-4" />
                  Withdraw {withdrawShares} Shares
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>

        {!hasRequiredSelections && (
          <Alert className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please select both a token account and an NFT to perform vault
              operations.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );

  // Error display
  if (error) {
    return (
      <div className="container max-w-4xl mx-auto p-6">
        <AppHeader
          title="Vault Manager"
          hasAddress={!!address}
          hasSelectedToken={!!selectedTokenMint}
          hasSelectedNFT={!!selectedNFT}
          programConnected={!!program}
          currentNetwork={currentNetwork}
        />
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={handleRefreshAll} className="mt-4">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  console.log("[VaultManager] Rendering main interface");

  return (
    <div className="container max-w-4xl mx-auto p-6">
      <AppHeader
        title="Vault Manager"
        hasAddress={!!address}
        hasSelectedToken={!!selectedTokenMint}
        hasSelectedNFT={!!selectedNFT}
        programConnected={!!program}
        currentNetwork={currentNetwork}
      />

      {notification.type && (
        <Alert
          className={`mb-6 ${
            notification.type === "error"
              ? "border-destructive"
              : "border-green-500"
          }`}
        >
          {notification.type === "error" ? (
            <XCircle className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          <AlertDescription>{notification.message}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {renderConnectionStatus()}
        {renderVaultInfo()}
        {renderUserPosition()}
        {renderTransactions()}
      </div>

      <div className="mt-8 flex justify-center">
        <Button onClick={handleRefreshAll} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh All Data
        </Button>
      </div>
    </div>
  );
};
