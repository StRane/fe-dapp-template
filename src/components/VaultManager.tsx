import React, { useState, useEffect } from "react";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { useAppKitAccount } from "@reown/appkit/react";

// Import hooks
import { useVault, TransactionStatus } from "@/lib/useVault";
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
import { Progress } from "@/components/ui/progress";
import { Toaster } from "@/components/ui/sonner";

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
  ExternalLink,
  RefreshCw,
  Shield,
  Info,
  Coins,
  Sparkles,
  CreditCard,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

// Toast notifications
import { toast } from "sonner";

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

  // Vault hook - now includes transaction state
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

    // Actions
    deposit,
    withdraw,
    refreshVaultData,
    refreshUserPosition,
    refreshAllData,

    // Transaction state - NEW
    transactionState,
  } = useVault();

  // Local UI state
  const [depositAmount, setDepositAmount] = useState("100");
  const [withdrawShares, setWithdrawShares] = useState("50");

  // console.log("[VaultManager] Transaction state:", transactionState);

  // Handle transaction state changes with toast notifications
  useEffect(() => {
    if (
      transactionState.status === TransactionStatus.SUCCESS &&
      transactionState.signature
    ) {
      toast.success("Deposit Successful!", {
        description: (
          <div className="flex flex-col gap-2">
            <p>Your tokens have been deposited to the vault</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {transactionState.signature.slice(0, 8)}...
                {transactionState.signature.slice(-8)}
              </code>
              <button
                onClick={() =>
                  window.open(
                    `https://solscan.io/tx/${transactionState.signature}?cluster=testnet`,
                    "_blank"
                  )
                }
                className="text-xs underline hover:no-underline"
              >
                View on Solscan
              </button>
            </div>
          </div>
        ),
      });
    } else if (transactionState.status === TransactionStatus.FAILED) {
      toast.error("Transaction Failed", {
        description: transactionState.message,
      });
    }
  }, [transactionState.status, transactionState.signature]);

  // Copy to clipboard helper
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log(`${label} copied to clipboard`);
    } catch (err) {
      console.error(`Failed to copy: ${(err as Error).message}`);
    }
  };

  // Deposit handler
  const handleDeposit = async () => {
    console.log("[VaultManager] === DEPOSIT HANDLER START ===");

    if (!selectedTokenMint || !selectedNFT) {
      toast.error("Selection Required", {
        description: "Please select both a token and NFT first",
      });
      return;
    }

    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast.error("Invalid Amount", {
        description: "Please enter a valid deposit amount",
      });
      return;
    }

    // Prevent double submission
    if (transactionState.status !== TransactionStatus.IDLE) {
      console.log("[VaultManager] Transaction already in progress");
      return;
    }

    try {
      const decimals = 6;
      const amount = new BN(parseFloat(depositAmount)).mul(
        new BN(10).pow(new BN(decimals))
      );

      console.log("[VaultManager] Calling deposit with:", {
        amount: amount.toString(),
        assetMint: selectedTokenMint.toBase58(),
        userNftMint: selectedNFT.toBase58(),
      });

      const tx = await deposit(amount, selectedTokenMint, selectedNFT);

      if (tx) {
        setDepositAmount("100"); // Reset form on success
        console.log("[VaultManager] Deposit completed successfully");
      }
    } catch (err) {
      console.error("[VaultManager] Deposit failed:", err);
      // Error handling is done in the hook
    }
    console.log("[VaultManager] === DEPOSIT HANDLER END ===");
  };

  // Get deposit button props based on transaction state
  const getDepositButtonProps = () => {
    const baseDisabled = !hasRequiredSelections || !depositAmount;

    switch (transactionState.status) {
      case TransactionStatus.BUILDING:
        return {
          disabled: true,
          variant: "default" as const,
          children: (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Building Transaction...
            </>
          ),
        };
      case TransactionStatus.SIGNING:
        return {
          disabled: true,
          variant: "default" as const,
          children: (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sign in Wallet...
            </>
          ),
        };
      case TransactionStatus.CONFIRMING:
        return {
          disabled: true,
          variant: "default" as const,
          children: (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Confirming...
            </>
          ),
        };
      case TransactionStatus.SUCCESS:
        return {
          disabled: baseDisabled,
          variant: "default" as const,
          children: (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Deposit Complete
            </>
          ),
        };
      case TransactionStatus.FAILED:
        return {
          disabled: baseDisabled,
          variant: "destructive" as const,
          children: (
            <>
              <ArrowUpRight className="mr-2 h-4 w-4" />
              Try Again
            </>
          ),
        };
      default:
        return {
          disabled: baseDisabled,
          variant: "default" as const,
          children: (
            <>
              <ArrowUpRight className="mr-2 h-4 w-4" />
              Deposit {depositAmount} Tokens
            </>
          ),
        };
    }
  };

  const handleWithdraw = async () => {
    console.log("[VaultManager] === WITHDRAW HANDLER START ===");

    if (!selectedTokenMint || !selectedNFT) {
      toast.error("Invalid Selection", {
        description: "Please select both a token and NFT first",
      });
      return;
    }

    if (!selectedNFTPosition) {
      toast.error("No Position Found", {
        description: "You don't have a position for the selected NFT",
      });
      return;
    }

    const sharesAmount = parseFloat(withdrawShares);
    if (!sharesAmount || sharesAmount <= 0) {
      toast.error("Invalid Amount", {
        description: "Please enter a valid number of shares to withdraw",
      });
      return;
    }

    if (sharesAmount > selectedNFTPosition.shareAmount) {
      toast.error("Invalid Amount", {
        description: `You only have ${selectedNFTPosition.shareAmount} shares available`,
      });
      return;
    }

    // Prevent double submission
    if (transactionState.status !== TransactionStatus.IDLE) {
      console.log("[VaultManager] Transaction already in progress");
      return;
    }

    try {
      const shares:BN = new BN(Math.floor(sharesAmount));

      console.log("[VaultManager] Calling withdraw with:", {
        shares: shares.toString(),
        assetMint: selectedTokenMint.toBase58(),
        userNftMint: selectedNFT.toBase58(),
      });

      const tx = await withdraw(shares, selectedTokenMint, selectedNFT);

      if (tx) {
        setWithdrawShares("50"); // Reset form on success
        console.log("[VaultManager] Withdraw completed successfully");
      }
    } catch (err) {
      console.error("[VaultManager] Withdraw failed:", err);
      // Error handling is done in the hook
    }
    console.log("[VaultManager] === WITHDRAW HANDLER END ===");
  };

  const getWithdrawButtonProps = () => {
    const baseDisabled = !hasRequiredSelections || !withdrawShares;

    switch (transactionState.status) {
      case TransactionStatus.BUILDING:
        return {
          disabled: true,
          variant: "default" as const,
          children: (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Building Transaction...
            </>
          ),
        };

      case TransactionStatus.SIGNING:
        return {
          disabled: true,
          variant: "default" as const,
          children: (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Waiting for Signature...
            </>
          ),
        };

      case TransactionStatus.CONFIRMING:
        return {
          disabled: true,
          variant: "default" as const,
          children: (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Confirming Transaction...
            </>
          ),
        };

      case TransactionStatus.SUCCESS:
        return {
          disabled: baseDisabled,
          variant: "default" as const,
          children: (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Withdraw Again
            </>
          ),
        };

      case TransactionStatus.FAILED:
        return {
          disabled: baseDisabled,
          variant: "destructive" as const,
          children: (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Withdraw
            </>
          ),
        };

      default: // IDLE
        return {
          disabled: baseDisabled,
          variant: "default" as const,
          children: (
            <>
              <ArrowDownLeft className="mr-2 h-4 w-4" />
              Withdraw Assets
            </>
          ),
        };
    }
  };

  // Render loading state
  if (!isConnected) {
    return (
      <div className="container mx-auto p-6">
        <AppHeader
          title="Vault Manager"
          hasAddress={!!address}
          hasSelectedToken={!!selectedTokenMint}
          hasSelectedNFT={!!selectedNFT}
          programConnected={!!program}
          currentNetwork={currentNetwork}
          onCopyToClipboard={copyToClipboard}
        />

        <Card className="mt-6">
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center">
              <Wallet className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Connect Your Wallet
              </h3>
              <p className="text-muted-foreground">
                Please connect your wallet to access the vault
              </p>
            </div>
          </CardContent>
        </Card>

        <Toaster richColors position="top-right" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <AppHeader
        title="Vault Manager"
        hasAddress={!!address}
        hasSelectedToken={!!selectedTokenMint}
        hasSelectedNFT={!!selectedNFT}
        programConnected={!!program}
        currentNetwork={currentNetwork}
        onCopyToClipboard={copyToClipboard}
      />

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <Tabs defaultValue="operations" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
        </TabsList>

        <TabsContent value="operations" className="space-y-4">
          {/* Vault Operations */}
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
                      disabled={
                        transactionState.status !== TransactionStatus.IDLE ||
                        !hasRequiredSelections
                      }
                    />
                    <div className="text-xs text-muted-foreground">
                      Amount will be deposited using selected NFT as position
                      identifier
                    </div>
                  </div>
                  <Button
                    onClick={handleDeposit}
                    className="w-full"
                    {...getDepositButtonProps()}
                  />
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
                      disabled={
                        transactionState.status !== TransactionStatus.IDLE ||
                        !hasRequiredSelections
                      }
                    />
                    <div className="text-xs text-muted-foreground">
                      {selectedNFTPosition
                        ? `Available shares: ${selectedNFTPosition.shareAmount.toLocaleString()}`
                        : "Select an NFT to see your position"}
                    </div>
                  </div>
                  <Button
                    onClick={handleWithdraw}
                    className="w-full"
                    {...getWithdrawButtonProps()}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Selection Requirements */}
          {!hasRequiredSelections && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Please select both a token and NFT from the Asset Identity Hub
                to enable vault operations.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="positions" className="space-y-4">
          {/* Current Position */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Current Position
              </CardTitle>
              <CardDescription>
                Your vault position for the selected NFT
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedNFTPosition ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        NFT
                      </p>
                      <p className="font-mono text-sm">
                        {selectedNFTPosition.nftMint.toBase58().slice(0, 8)}...
                        {selectedNFTPosition.nftMint.toBase58().slice(-8)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Shares
                      </p>
                      <p className="font-semibold">
                        {selectedNFTPosition.shareAmount.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Deposited
                      </p>
                      <p className="font-semibold">
                        {selectedNFTPosition.depositAmount.toLocaleString()}{" "}
                        tokens
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Last Updated
                      </p>
                      <p className="text-sm">
                        {new Date(
                          selectedNFTPosition.timestamp * 1000
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <CreditCard className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {selectedNFT
                      ? "No position found for selected NFT"
                      : "Select an NFT to view position"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Toast notifications */}
      <Toaster richColors position="top-right" />
    </div>
  );
};
