import React, { useState, useEffect } from "react";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { useAppKitAccount } from "@reown/appkit/react";

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

  console.log("[VaultManager] Store state from hook:", {
    hasConnection: !!connection,
    currentNetwork,
    isNetworkReady,
    hasProgram: !!program,
    hasVault: !!vault,
    hasSelectedPosition: !!selectedNFTPosition,
    totalPositions: allUserPositions.length,
    loading,
    userPositionLoading,
    hasError: !!error,
  });

  // Local UI state
  const [depositAmount, setDepositAmount] = useState("100");
  const [withdrawShares, setWithdrawShares] = useState("50");
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  console.log("[VaultManager] Local UI state:", {
    depositAmount,
    withdrawShares,
    isDepositing,
    isWithdrawing,
    hasNotification: !!notification.type
  });

  // Show notification helper
  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification({ type: null, message: '' }), 5000);
  };

  // Copy to clipboard helper
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showNotification('success', `${label} copied to clipboard`);
    } catch (err) {
      showNotification('error', `Failed to copy: ${(err as Error).message}`);
    }
  };

  // Deposit handler
  const handleDeposit = async () => {
    if (!selectedTokenMint || !selectedNFT) {
      showNotification('error', 'Please select both token and NFT');
      return;
    }

    setIsDepositing(true);
    try {
      const amount = new BN(parseFloat(depositAmount) * 1e9); // Convert to lamports
      const signature = await deposit(amount, selectedTokenMint, selectedNFT);
      
      if (signature) {
        showNotification('success', `Deposit successful! Signature: ${signature.slice(0, 8)}...`);
        setDepositAmount("100");
      } else {
        showNotification('error', 'Deposit failed');
      }
    } catch (err) {
      showNotification('error', `Deposit failed: ${(err as Error).message}`);
    } finally {
      setIsDepositing(false);
    }
  };

  // Withdraw handler
  const handleWithdraw = async () => {
    if (!selectedTokenMint || !selectedNFT) {
      showNotification('error', 'Please select both token and NFT');
      return;
    }

    setIsWithdrawing(true);
    try {
      const shares = new BN(parseFloat(withdrawShares) * 1e9); // Convert to lamports
      const signature = await withdraw(shares, selectedTokenMint, selectedNFT);
      
      if (signature) {
        showNotification('success', `Withdraw successful! Signature: ${signature.slice(0, 8)}...`);
        setWithdrawShares("50");
      } else {
        showNotification('error', 'Withdraw failed');
      }
    } catch (err) {
      showNotification('error', `Withdraw failed: ${(err as Error).message}`);
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
              {isConnected ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              Wallet: {isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isNetworkReady ? "default" : "secondary"}>
              {isNetworkReady ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
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
              {hasRequiredSelections ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              Selections: {hasRequiredSelections ? "Complete" : "Incomplete"}
            </Badge>
          </div>
        </div>
        {address && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Wallet Address:</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono">{address.slice(0, 4)}...{address.slice(-4)}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(address, 'Wallet address')}
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
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
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
                  <span className="text-sm font-mono">{vault.owner.toBase58().slice(0, 8)}...</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(vault.owner.toBase58(), 'Vault owner')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Asset Mint</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono">{vault.assetMint.toBase58().slice(0, 8)}...</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(vault.assetMint.toBase58(), 'Asset mint')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Total Shares</Label>
                <span className="text-sm font-mono">{vault.totalShares.toString()}</span>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Total Borrowed</Label>
                <span className="text-sm font-mono">{vault.totalBorrowed.toString()}</span>
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
            {userPositionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </CardTitle>
        <CardDescription>
          Position for selected NFT: {selectedNFT ? selectedNFT.toBase58().slice(0, 8) + '...' : 'None selected'}
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
                <span className="text-lg font-mono">{selectedNFTPosition.depositAmount.toFixed(4)}</span>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Share Amount</Label>
                <span className="text-lg font-mono">{selectedNFTPosition.shareAmount.toFixed(4)}</span>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">NFT Mint</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono">{selectedNFTPosition.nftMint.toBase58().slice(0, 8)}...</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(selectedNFTPosition.nftMint.toBase58(), 'NFT mint')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Last Updated</Label>
                <span className="text-sm">{new Date(selectedNFTPosition.timestamp).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center p-8">
            <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {selectedNFT ? 'No position found for selected NFT' : 'Select an NFT to view position'}
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
              disabled={isDepositing || !hasRequiredSelections || !depositAmount}
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
              disabled={isWithdrawing || !hasRequiredSelections || !withdrawShares}
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
              Please select both a token account and an NFT to perform vault operations.
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
        <Alert className={`mb-6 ${notification.type === 'error' ? 'border-destructive' : 'border-green-500'}`}>
          {notification.type === 'error' ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
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

// import React, { useState, useEffect } from "react";
// import { BN } from "@coral-xyz/anchor";
// import { PublicKey } from "@solana/web3.js";
// import { useAppKitAccount } from "@reown/appkit/react";


// // Import hooks
// import { useVault } from "@/lib/useVault";
// import { useTokenSelection, useNFTSelection } from "@/context/SelectionContext";

// // UI Components
// import { Button } from "@/components/ui/button";
// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardHeader,
//   CardTitle,
//   CardFooter,
// } from "@/components/ui/card";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Alert, AlertDescription } from "@/components/ui/alert";
// import { Badge } from "@/components/ui/badge";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { ScrollArea } from "@/components/ui/scroll-area";
// import { Separator } from "@/components/ui/separator";

// // Icons
// import {
//   Wallet,
//   Loader2,
//   CheckCircle2,
//   XCircle,
//   Copy,
//   AlertCircle,
//   ArrowUpRight,
//   ArrowDownLeft,
//   RefreshCw,
//   Shield,
//   Info,
//   Coins,
//   Sparkles,
//   CreditCard,
//   TrendingUp,
//   TrendingDown,
// } from "lucide-react";

// // Shared components
// import { AppHeader } from "@/components/shared/AppHeader";

// export const VaultManager: React.FC = () => {
//   console.log("[VaultManager] === COMPONENT RENDER START ===");

//   const { address, isConnected } = useAppKitAccount();

//   // Selection context
//   const {
//     selectedTokenAccount,
//     selectedTokenMint,
//     setSelectedTokenAccount,
//     setSelectedTokenMint,
//   } = useTokenSelection();

//   const { selectedNFT, setSelectedNFT } = useNFTSelection();

//   console.log("[VaultManager] Context state:", {
//     selectedTokenAccount: selectedTokenAccount?.toBase58(),
//     selectedTokenMint: selectedTokenMint?.toBase58(),
//     selectedNFT: selectedNFT?.toBase58(),
//   });

//   // Vault hook - now follows established pattern
//   const {
//     // Store data (read-only)
//     program,
//     vault,
//     userPositions,
//     selectedNFT: vaultSelectedNFT,
//     loading,
//     error,

//     // Network state (read-only)
//     connection,
//     currentNetwork,
//     isSolanaNetwork,
//     isNetworkReady,

//     // AppKit state
//     isConnected: hookConnected,
//     walletAddress,

//     // Selection state
//     hasRequiredSelections,

//     // Config
//     vaultConfig,

//     // Actions only
//     deposit,
//     withdraw,
//     refreshAllData,
//     setSelectedVaultNFT,
//   } = useVault();

//   console.log("[VaultManager] Store state from hook:", {
//     hasConnection: !!connection,
//     currentNetwork,
//     isNetworkReady,
//     hasProgram: !!program,
//     hasVault: !!vault,
//     userPositionsCount: userPositions.length,
//     loading,
//     hookConnected,
//     hasRequiredSelections,
//   });

//   // Local state - only for UI
//   const [depositAmount, setDepositAmount] = useState<string>("100");
//   const [withdrawShares, setWithdrawShares] = useState<string>("50");
//   const [isDepositing, setIsDepositing] = useState(false);
//   const [isWithdrawing, setIsWithdrawing] = useState(false);
//   const [notification, setNotification] = useState<{
//     type: "success" | "error" | null;
//     message: string;
//   }>({ type: null, message: "" });

//   console.log("[VaultManager] Local UI state:", {
//     depositAmount,
//     withdrawShares,
//     isDepositing,
//     isWithdrawing,
//     hasNotification: !!notification.type,
//   });



//   const showNotification = (type: "success" | "error", message: string) => {
//     console.log("[VaultManager] Showing notification:", { type, message });
//     setNotification({ type, message });
//     setTimeout(() => {
//       console.log("[VaultManager] Clearing notification");
//       setNotification({ type: null, message: "" });
//     }, 5000);
//   };

//   const copyToClipboard = async (text: string, label: string) => {
//     console.log("[VaultManager] Copying to clipboard:", {
//       label,
//       text: text.slice(0, 16) + "...",
//     });
//     try {
//       await navigator.clipboard.writeText(text);
//       showNotification("success", `${label} copied to clipboard`);
//     } catch (err) {
//       showNotification("error", `Failed to copy: ${(err as Error).message}`);
//     }
//   };

//   // Wrapper function for AppHeader onCopyToClipboard prop
//   const handleCopyToClipboard = (text: string, label: string) => {
//     copyToClipboard(text, label);
//   };

//   const handleDeposit = async () => {
//     console.log("[VaultManager] === DEPOSIT HANDLER START ===");

//     if (!selectedTokenMint || !selectedNFT) {
//       showNotification("error", "Please select both a token and NFT first");
//       return;
//     }

//     if (!depositAmount || parseFloat(depositAmount) <= 0) {
//       showNotification("error", "Please enter a valid deposit amount");
//       return;
//     }

//     setIsDepositing(true);
//     try {
//       const decimals = 6; // Assuming 6 decimals for vault tokens
//       const amount = new BN(parseFloat(depositAmount)).mul(
//         new BN(10).pow(new BN(decimals))
//       );

//       console.log("[VaultManager] Depositing:", {
//         amount: amount.toString(),
//         assetMint: selectedTokenMint.toBase58(),
//         userNftMint: selectedNFT.toBase58(),
//         decimals,
//       });

//       const tx = await deposit(amount, selectedTokenMint, selectedNFT);
//       if (tx) {
//         showNotification(
//           "success",
//           `Successfully deposited ${depositAmount} tokens!`
//         );
//         setDepositAmount("100"); // Reset
//         console.log("[VaultManager] Deposit completed successfully");
//       }
//     } catch (err) {
//       console.error("[VaultManager] Deposit failed:", err);
//       showNotification("error", `Deposit failed: ${(err as Error).message}`);
//     } finally {
//       setIsDepositing(false);
//     }
//     console.log("[VaultManager] === DEPOSIT HANDLER END ===");
//   };

//   const handleWithdraw = async () => {
//     console.log("[VaultManager] === WITHDRAW HANDLER START ===");

//     if (!selectedTokenMint || !selectedNFT) {
//       showNotification("error", "Please select both a token and NFT first");
//       return;
//     }

//     if (!withdrawShares || parseFloat(withdrawShares) <= 0) {
//       showNotification("error", "Please enter a valid share amount");
//       return;
//     }

//     setIsWithdrawing(true);
//     try {
//       const decimals = 6; // Assuming 6 decimals for share tokens
//       const shares = new BN(parseFloat(withdrawShares)).mul(
//         new BN(10).pow(new BN(decimals))
//       );

//       console.log("[VaultManager] Withdrawing:", {
//         shares: shares.toString(),
//         assetMint: selectedTokenMint.toBase58(),
//         userNftMint: selectedNFT.toBase58(),
//         decimals,
//       });

//       const tx = await withdraw(shares, selectedTokenMint, selectedNFT);
//       if (tx) {
//         showNotification(
//           "success",
//           `Successfully withdrew ${withdrawShares} shares!`
//         );
//         setWithdrawShares("50"); // Reset
//         console.log("[VaultManager] Withdraw completed successfully");
//       }
//     } catch (err) {
//       console.error("[VaultManager] Withdraw failed:", err);
//       showNotification("error", `Withdraw failed: ${(err as Error).message}`);
//     } finally {
//       setIsWithdrawing(false);
//     }
//     console.log("[VaultManager] === WITHDRAW HANDLER END ===");
//   };

//   const handleRefresh = () => {
//     console.log("[VaultManager] Manual refresh triggered");
//     refreshAllData();
//   };

//   const formatAmount = (amount: number, decimals: number = 6) => {
//     return (amount / Math.pow(10, decimals)).toLocaleString();
//   };

//   // Not connected state
//   if (!isConnected) {
//     console.log("[VaultManager] Rendering not connected state");
//     return (
//       <Card className="w-full max-w-md mx-auto mt-10">
//         <CardHeader>
//           <CardTitle className="flex items-center gap-2">
//             <Wallet className="h-5 w-5" />
//             Connect Wallet
//           </CardTitle>
//           <CardDescription>
//             Please connect your Solana wallet to use the Vault Manager
//           </CardDescription>
//         </CardHeader>
//       </Card>
//     );
//   }

//   // Network not ready state
//   if (!isSolanaNetwork || !isNetworkReady) {
//     console.log("[VaultManager] Rendering network issue state");
//     return (
//       <Card className="w-full max-w-md mx-auto mt-10">
//         <CardHeader>
//           <CardTitle className="flex items-center gap-2">
//             <AlertCircle className="h-5 w-5" />
//             Network Issue
//           </CardTitle>
//           <CardDescription>
//             Please switch to a supported Solana network
//           </CardDescription>
//         </CardHeader>
//       </Card>
//     );
//   }

//   console.log("[VaultManager] Rendering main interface");

//   return (
//     <div className="container mx-auto p-4 space-y-6">
//       {/* Notification */}
//       {notification.type && (
//         <Alert
//           variant={notification.type === "error" ? "destructive" : "default"}
//         >
//           {notification.type === "success" ? (
//             <CheckCircle2 className="h-4 w-4" />
//           ) : (
//             <XCircle className="h-4 w-4" />
//           )}
//           <AlertDescription>{notification.message}</AlertDescription>
//         </Alert>
//       )}

//       {/* Header with Current Selections */}
//       <AppHeader
//         title="Vault Manager"
//         description="Deposit and withdraw assets using NFT-gated vault access"
//         icon={<Shield className="h-5 w-5" />}
//         programStatus={{
//           connected: !!program && !!vault,
//           label: "Vault Status",
//         }}
//         currentNetwork={currentNetwork}
//         onCopyToClipboard={handleCopyToClipboard}
//       />

//       {/* Error Alert */}
//       {error && (
//         <Alert variant="destructive">
//           <XCircle className="h-4 w-4" />
//           <AlertDescription>{error}</AlertDescription>
//         </Alert>
//       )}

//       {/* Requirements Check */}
//       {!hasRequiredSelections && (
//         <Alert>
//           <Info className="h-4 w-4" />
//           <AlertDescription>
//             Please select both a token and NFT in the Asset & Identity Hub to
//             proceed with vault operations.
//           </AlertDescription>
//         </Alert>
//       )}

//       {/* Vault Status Card */}
//       {vault && (
//         <Card>
//           <CardHeader>
//             <CardTitle className="flex items-center gap-2">
//               <CreditCard className="h-4 w-4" />
//               Vault Status
//             </CardTitle>
//             <CardDescription>
//               Current vault configuration and statistics
//             </CardDescription>
//           </CardHeader>
//           <CardContent>
//             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//               <div className="space-y-1">
//                 <Label className="text-sm text-muted-foreground">
//                   Vault Owner
//                 </Label>
//                 <div className="flex items-center gap-2">
//                   <Badge variant="outline" className="font-mono text-xs">
//                     {vault.owner.toBase58().slice(0, 8)}...
//                   </Badge>
//                   <Button
//                     size="icon"
//                     variant="ghost"
//                     className="h-6 w-6"
//                     onClick={() =>
//                       copyToClipboard(vault.owner.toBase58(), "Vault owner")
//                     }
//                   >
//                     <Copy className="h-3 w-3" />
//                   </Button>
//                 </div>
//               </div>

//               <div className="space-y-1">
//                 <Label className="text-sm text-muted-foreground">
//                   Asset Mint
//                 </Label>
//                 <div className="flex items-center gap-2">
//                   <Badge variant="outline" className="font-mono text-xs">
//                     {vault.assetMint.toBase58().slice(0, 8)}...
//                   </Badge>
//                   <Button
//                     size="icon"
//                     variant="ghost"
//                     className="h-6 w-6"
//                     onClick={() =>
//                       copyToClipboard(vault.assetMint.toBase58(), "Asset mint")
//                     }
//                   >
//                     <Copy className="h-3 w-3" />
//                   </Button>
//                 </div>
//               </div>

//               <div className="space-y-1">
//                 <Label className="text-sm text-muted-foreground">
//                   Total Shares
//                 </Label>
//                 <div className="flex items-center gap-1">
//                   <TrendingUp className="h-4 w-4 text-muted-foreground" />
//                   <span className="font-semibold">
//                     {vault.totalShares?.toNumber()|| 0}
//                   </span>
//                 </div>
//               </div>
//             </div>

//             <Separator className="my-4" />

//             <div className="p-3 bg-muted rounded-lg">
//               <Label className="text-sm font-medium">Vault Configuration</Label>
//               <div className="grid grid-cols-1 gap-2 mt-2 text-sm">
//                 <div className="flex justify-between">
//                   <span className="text-muted-foreground">Vault PDA:</span>
//                   <span className="font-mono text-xs">
//                     {vaultConfig.VAULT_PDA.toBase58().slice(0, 16)}...
//                   </span>
//                 </div>
//                 <div className="flex justify-between">
//                   <span className="text-muted-foreground">Share Mint:</span>
//                   <span className="font-mono text-xs">
//                     {vaultConfig.SHARE_MINT.toBase58().slice(0, 16)}...
//                   </span>
//                 </div>
//                 <div className="flex justify-between">
//                   <span className="text-muted-foreground">Collection:</span>
//                   <span className="font-mono text-xs">
//                     {vaultConfig.COLLECTION_PDA.toBase58().slice(0, 16)}...
//                   </span>
//                 </div>
//               </div>
//             </div>
//           </CardContent>
//           <CardFooter>
//             <Button
//               onClick={handleRefresh}
//               variant="outline"
//               size="sm"
//               disabled={loading}
//               className="w-full"
//             >
//               {loading ? (
//                 <Loader2 className="h-4 w-4 animate-spin" />
//               ) : (
//                 <RefreshCw className="h-4 w-4" />
//               )}
//               <span className="ml-2">Refresh Vault Data</span>
//             </Button>
//           </CardFooter>
//         </Card>
//       )}

//       {/* Main Operations Tabs */}
//       <Tabs defaultValue="deposit" className="w-full">
//         <TabsList className="grid w-full grid-cols-3">
//           <TabsTrigger value="deposit">Deposit</TabsTrigger>
//           <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
//           <TabsTrigger value="positions">Positions</TabsTrigger>
//         </TabsList>

//         {/* Deposit Tab */}
//         <TabsContent value="deposit" className="space-y-4">
//           <Card>
//             <CardHeader>
//               <CardTitle className="flex items-center gap-2">
//                 <ArrowUpRight className="h-4 w-4" />
//                 Deposit Assets
//               </CardTitle>
//               <CardDescription>
//                 Deposit tokens to the vault using your selected NFT for access
//                 control
//               </CardDescription>
//             </CardHeader>
//             <CardContent className="space-y-4">
//               {/* Selection Status */}
//               <div className="p-3 bg-muted rounded-lg space-y-2">
//                 <Label className="text-sm font-medium">Selected Assets</Label>
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
//                   <div className="flex items-center gap-2">
//                     <Coins className="h-3 w-3 text-muted-foreground" />
//                     <span className="text-muted-foreground">Token:</span>
//                     {selectedTokenMint ? (
//                       <Badge variant="outline" className="font-mono text-xs">
//                         {selectedTokenMint.toBase58().slice(0, 8)}...
//                       </Badge>
//                     ) : (
//                       <span className="text-sm text-destructive">
//                         Not selected
//                       </span>
//                     )}
//                   </div>
//                   <div className="flex items-center gap-2">
//                     <Sparkles className="h-3 w-3 text-muted-foreground" />
//                     <span className="text-muted-foreground">NFT:</span>
//                     {selectedNFT ? (
//                       <Badge variant="outline" className="font-mono text-xs">
//                         {selectedNFT.toBase58().slice(0, 8)}...
//                       </Badge>
//                     ) : (
//                       <span className="text-sm text-destructive">
//                         Not selected
//                       </span>
//                     )}
//                   </div>
//                 </div>
//               </div>

//               {hasRequiredSelections ? (
//                 <>
//                   <div className="space-y-2">
//                     <Label htmlFor="deposit-amount">Amount (in tokens)</Label>
//                     <Input
//                       id="deposit-amount"
//                       type="number"
//                       placeholder="100"
//                       value={depositAmount}
//                       onChange={(e) => setDepositAmount(e.target.value)}
//                       min="0"
//                       step="0.000001"
//                     />
//                     <p className="text-sm text-muted-foreground">
//                       Tokens will be deposited to the vault and you'll receive
//                       share tokens
//                     </p>
//                   </div>

//                   <Alert>
//                     <Info className="h-4 w-4" />
//                     <AlertDescription>
//                       Your selected NFT will be used for access control. You
//                       must own an NFT from the required collection to deposit.
//                     </AlertDescription>
//                   </Alert>
//                 </>
//               ) : (
//                 <Alert>
//                   <AlertCircle className="h-4 w-4" />
//                   <AlertDescription>
//                     Please go to the Asset & Identity Hub to select both a token
//                     and NFT before depositing.
//                   </AlertDescription>
//                 </Alert>
//               )}
//             </CardContent>
//             <CardFooter>
//               <Button
//                 onClick={handleDeposit}
//                 disabled={
//                   isDepositing ||
//                   !hasRequiredSelections ||
//                   !depositAmount ||
//                   parseFloat(depositAmount) <= 0 ||
//                   loading
//                 }
//                 className="w-full"
//               >
//                 {isDepositing ? (
//                   <>
//                     <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//                     Depositing...
//                   </>
//                 ) : (
//                   <>
//                     <ArrowUpRight className="mr-2 h-4 w-4" />
//                     Deposit {depositAmount} Tokens
//                   </>
//                 )}
//               </Button>
//             </CardFooter>
//           </Card>
//         </TabsContent>

//         {/* Withdraw Tab */}
//         <TabsContent value="withdraw" className="space-y-4">
//           <Card>
//             <CardHeader>
//               <CardTitle className="flex items-center gap-2">
//                 <ArrowDownLeft className="h-4 w-4" />
//                 Withdraw Assets
//               </CardTitle>
//               <CardDescription>
//                 Withdraw assets from the vault by burning share tokens
//               </CardDescription>
//             </CardHeader>
//             <CardContent className="space-y-4">
//               {/* Selection Status */}
//               <div className="p-3 bg-muted rounded-lg space-y-2">
//                 <Label className="text-sm font-medium">Selected Assets</Label>
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
//                   <div className="flex items-center gap-2">
//                     <Coins className="h-3 w-3 text-muted-foreground" />
//                     <span className="text-muted-foreground">Token:</span>
//                     {selectedTokenMint ? (
//                       <Badge variant="outline" className="font-mono text-xs">
//                         {selectedTokenMint.toBase58().slice(0, 8)}...
//                       </Badge>
//                     ) : (
//                       <span className="text-sm text-destructive">
//                         Not selected
//                       </span>
//                     )}
//                   </div>
//                   <div className="flex items-center gap-2">
//                     <Sparkles className="h-3 w-3 text-muted-foreground" />
//                     <span className="text-muted-foreground">NFT:</span>
//                     {selectedNFT ? (
//                       <Badge variant="outline" className="font-mono text-xs">
//                         {selectedNFT.toBase58().slice(0, 8)}...
//                       </Badge>
//                     ) : (
//                       <span className="text-sm text-destructive">
//                         Not selected
//                       </span>
//                     )}
//                   </div>
//                 </div>
//               </div>

//               {hasRequiredSelections ? (
//                 <>
//                   <div className="space-y-2">
//                     <Label htmlFor="withdraw-shares">Share Amount</Label>
//                     <Input
//                       id="withdraw-shares"
//                       type="number"
//                       placeholder="50"
//                       value={withdrawShares}
//                       onChange={(e) => setWithdrawShares(e.target.value)}
//                       min="0"
//                       step="0.000001"
//                     />
//                     <p className="text-sm text-muted-foreground">
//                       Share tokens will be burned and you'll receive underlying
//                       assets
//                     </p>
//                   </div>

//                   <Alert>
//                     <Info className="h-4 w-4" />
//                     <AlertDescription>
//                       You must own share tokens and the same NFT used for
//                       deposit to withdraw.
//                     </AlertDescription>
//                   </Alert>
//                 </>
//               ) : (
//                 <Alert>
//                   <AlertCircle className="h-4 w-4" />
//                   <AlertDescription>
//                     Please go to the Asset & Identity Hub to select both a token
//                     and NFT before withdrawing.
//                   </AlertDescription>
//                 </Alert>
//               )}
//             </CardContent>
//             <CardFooter>
//               <Button
//                 onClick={handleWithdraw}
//                 disabled={
//                   isWithdrawing ||
//                   !hasRequiredSelections ||
//                   !withdrawShares ||
//                   parseFloat(withdrawShares) <= 0 ||
//                   loading
//                 }
//                 className="w-full"
//                 variant="outline"
//               >
//                 {isWithdrawing ? (
//                   <>
//                     <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//                     Withdrawing...
//                   </>
//                 ) : (
//                   <>
//                     <ArrowDownLeft className="mr-2 h-4 w-4" />
//                     Withdraw {withdrawShares} Shares
//                   </>
//                 )}
//               </Button>
//             </CardFooter>
//           </Card>
//         </TabsContent>

//         {/* Positions Tab */}
//         <TabsContent value="positions" className="space-y-4">
//           <Card>
//             <CardHeader>
//               <CardTitle className="flex items-center gap-2">
//                 <TrendingUp className="h-4 w-4" />
//                 Your Positions
//               </CardTitle>
//               <CardDescription>
//                 View your current vault positions and NFT-based access
//               </CardDescription>
//             </CardHeader>
//             <CardContent>
//               <ScrollArea className="h-[300px]">
//                 <div className="space-y-2">
//                   {userPositions.length > 0 ? (
//                     userPositions.map((position, index) => (
//                       <Card key={index} className="p-3">
//                         <div className="space-y-2">
//                           <div className="flex justify-between items-center">
//                             <Badge variant="outline" className="font-mono text-xs">
//                               NFT: {position.nftMint.toBase58().slice(0, 8)}...
//                             </Badge>
//                             <Badge variant="secondary">
//                               Active
//                             </Badge>
//                           </div>
//                           <div className="grid grid-cols-2 gap-4 text-sm">
//                             <div>
//                               <Label className="text-xs text-muted-foreground">Deposited</Label>
//                               <p className="font-semibold">
//                                 {formatAmount(position.depositAmount)} tokens
//                               </p>
//                             </div>
//                             <div>
//                               <Label className="text-xs text-muted-foreground">Shares</Label>
//                               <p className="font-semibold">
//                                 {formatAmount(position.shareAmount)} shares
//                               </p>
//                             </div>
//                           </div>
//                           <div className="flex items-center gap-2 text-xs text-muted-foreground">
//                             <span>
//                               Deposited: {new Date(position.timestamp).toLocaleDateString()}
//                             </span>
//                             <Button
//                               size="icon"
//                               variant="ghost"
//                               className="h-4 w-4"
//                               onClick={() => copyToClipboard(position.nftMint.toBase58(), "NFT mint")}
//                             >
//                               <Copy className="h-3 w-3" />
//                             </Button>
//                           </div>
//                         </div>
//                       </Card>
//                     ))
//                   ) : (
//                     <Alert>
//                       <Info className="h-4 w-4" />
//                       <AlertDescription>
//                         {loading 
//                           ? "Loading positions..." 
//                           : "No vault positions found. Make a deposit to create your first position."
//                         }
//                       </AlertDescription>
//                     </Alert>
//                   )}
//                 </div>
//               </ScrollArea>
//             </CardContent>
//             <CardFooter>
//               <Button
//                 onClick={handleRefresh}
//                 variant="outline"
//                 size="sm"
//                 disabled={loading}
//                 className="w-full"
//               >
//                 {loading ? (
//                   <Loader2 className="h-4 w-4 animate-spin" />
//                 ) : (
//                   <RefreshCw className="h-4 w-4" />
//                 )}
//                 <span className="ml-2">Refresh Positions</span>
//               </Button>
//             </CardFooter>
//           </Card>
//         </TabsContent>
//       </Tabs>

//       {/* Debug Information */}
//       {vault && (
//         <Card>
//           <CardHeader>
//             <CardTitle className="text-sm">Debug Information</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <details className="space-y-2">
//               <summary className="cursor-pointer text-sm font-medium">
//                 Vault Configuration
//               </summary>
//               <div className="p-3 bg-muted rounded-lg text-xs">
//                 <pre className="overflow-auto">
//                   {JSON.stringify(
//                     {
//                       programId: vaultConfig.PROGRAM_ID,
//                       vaultPda: vaultConfig.VAULT_PDA.toBase58(),
//                       assetMint: vaultConfig.VAULT_ASSET_MINT.toBase58(),
//                       shareMint: vaultConfig.SHARE_MINT.toBase58(),
//                       collectionPda: vaultConfig.COLLECTION_PDA.toBase58(),
//                       vaultTokenAccount:
//                         vaultConfig.VAULT_TOKEN_ACCOUNT.toBase58(),
//                       hasRequiredSelections,
//                       vault: vault
//                         ? {
//                             owner: vault.owner.toBase58(),
//                             assetMint: vault.assetMint.toBase58(),
//                             shareMint: vault.shareMint.toBase58(),
//                             totalShares: vault.totalShares?.toNumber(),
//                           }
//                         : null,
//                     },
//                     null,
//                     2
//                   )}
//                 </pre>
//               </div>
//             </details>
//           </CardContent>
//         </Card>
//       )}
//     </div>
//   );
// };
