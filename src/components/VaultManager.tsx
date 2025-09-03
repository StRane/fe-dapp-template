import React, { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  AlertCircle,
  Wallet,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Repeat,
  Plus,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useVault } from "@/lib/useVault";
import { useUniqueId } from "@/lib/useUniqueId";

const NFTVaultInterface = () => {
  // Your deployed token mint
  const TOKEN_MINT = new PublicKey(
    "G9zh2Gpiz13nZ8THKw6kJMscUZpAzhLn1n8Z462321AG"
  );
  const tokenMint = TOKEN_MINT;
  const [selectedNFT, setSelectedNFT] = useState<string>("");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawShares, setWithdrawShares] = useState("");
  const [targetNFT, setTargetNFT] = useState("");
  const [nftPosition, setNftPosition] = useState<any>(null);

  // Initialize vault form state
  const [initMint, setInitMint] = useState("");
  const [initPool, setInitPool] = useState("");
  const [reserveFactor, setReserveFactor] = useState("1000");
  const [showInitDialog, setShowInitDialog] = useState(false);

  // Vault hook
  const {
    isConnected,
    walletAddress,
    vault,
    loading: vaultLoading,
    error: vaultError,
    depositWithNFT,
    withdrawWithNFT,
    transferPosition,
    getNFTPosition,
    refreshData: refreshVaultData,
    refreshNFTPosition,
    initializeVault,
  } = useVault(tokenMint);

  // NFT hook for getting user's NFTs
  const {
    collection,
    isCollectionInitialized,
    loading: nftLoading,
    refreshData: refreshNFTData,
  } = useUniqueId();

  // Filter user's NFTs from collection
//   const userNFTs = collection?.mintToUniqueId || [];

  // Debug log to check NFT data
//   useEffect(() => {
//     if (isConnected && walletAddress) {
//       refreshNFTData();
//       refreshVaultData()
//     }
//     if (collection) {
//       console.log("Collection loaded:", collection);
//       console.log("User NFTs available:", collection.mintToUniqueId);
//       console.log(
//         "Total NFTs in collection:",
//         collection.mintToUniqueId?.length || 0
//       );
//     }
//   }, [collection, walletAddress, refreshNFTData, isConnected, refreshVaultData]);

useEffect(() => {
  if (isConnected && walletAddress) {
    refreshNFTData();
    refreshVaultData();
  }
}, [isConnected, walletAddress]);

useEffect(() => {
  if (collection) {
    console.log("Collection loaded:", collection);
    console.log("User NFTs available:", collection.mintToUniqueId);
    console.log(
      "Total NFTs in collection:",
      collection.mintToUniqueId?.length || 0
    );
  }
  if(!collection){
    refreshNFTData();
    console.log("Collection not loaded:", collection);
  }
}, [collection, walletAddress, refreshNFTData, isConnected]);
  // Load NFT position when selected
//   useEffect(() => {
//     const loadPosition = async () => {
//       if (selectedNFT && getNFTPosition) {
//         try {
//           const position = await getNFTPosition(new PublicKey(selectedNFT));
//           setNftPosition(position);
//         } catch (err) {
//           console.error("Failed to load position:", err);
//         }
//       }
//     };
//     loadPosition();
//   }, [selectedNFT, getNFTPosition]);

  const handleInitializeVault = async () => {
     console.log("I clicked");
     console.log(`Init mint: ${initMint}, Init pool: ${initPool}}`)
    // if (!initMint || !initPool) return;

    try {
        console.log(initMint,initPool)
    const tx = await initializeVault(
      new PublicKey("G9zh2Gpiz13nZ8THKw6kJMscUZpAzhLn1n8Z462321AG"), // Token Mint
      new PublicKey("GXHdciYz5RQS5oGyF7JWF61sxFNuM4RxXw2s2ZX25cVd"), // Pool (your wallet)
      new BN(1000) // Reserve factor
    );

      if (tx) {
        setShowInitDialog(false);
        setInitMint("");
        setInitPool("");
        await refreshVaultData();
      }
    } catch (err) {
      console.error("Initialize vault failed:", err);
    }
  };

  const handleDeposit = async () => {
    if (!selectedNFT || !depositAmount) return;

    try {
      const amountBN = new BN(parseFloat(depositAmount) * 10 ** 6);
      const tx = await depositWithNFT(new PublicKey(selectedNFT), amountBN);

      if (tx) {
        setDepositAmount("");
        await refreshVaultData();
        await refreshNFTPosition(new PublicKey(selectedNFT));
        // Reload position
        const position = await getNFTPosition(new PublicKey(selectedNFT));
        setNftPosition(position);
      }
    } catch (err) {
      console.error("Deposit failed:", err);
    }
  };

  const handleWithdraw = async () => {
    if (!selectedNFT || !withdrawShares) return;

    try {
      const sharesBN = new BN(parseFloat(withdrawShares) * 10 ** 6);
      const tx = await withdrawWithNFT(new PublicKey(selectedNFT), sharesBN);

      if (tx) {
        setWithdrawShares("");
        await refreshVaultData();
        await refreshNFTPosition(new PublicKey(selectedNFT));
        const position = await getNFTPosition(new PublicKey(selectedNFT));
        setNftPosition(position);
      }
    } catch (err) {
      console.error("Withdraw failed:", err);
    }
  };

  const handleTransfer = async () => {
    if (!selectedNFT || !targetNFT || selectedNFT === targetNFT) return;

    try {
      const tx = await transferPosition(
        new PublicKey(selectedNFT),
        new PublicKey(targetNFT)
      );

      if (tx) {
        setTargetNFT("");
        await refreshVaultData();
        await refreshNFTPosition(new PublicKey(selectedNFT));
        await refreshNFTPosition(new PublicKey(targetNFT));
        setNftPosition(null);
      }
    } catch (err) {
      console.error("Transfer failed:", err);
    }
  };

  const formatAmount = (bn: BN | undefined) => {
    if (!bn) return "0";
    return (bn.toNumber() / 10 ** 6).toFixed(2);
  };

  if (!isConnected) {
    return (
      <Card className="max-w-md mx-auto mt-20">
        <CardHeader className="text-center">
          <Wallet className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
          <CardTitle>Connect Wallet</CardTitle>
          <CardDescription>
            Connect your Solana wallet to access the NFT Vault
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

//   if (!isCollectionInitialized) {
//     return (
//       <Button
//         onClick={refreshNFTData}
//         variant="outline"
//         size="sm"
//         disabled={nftLoading}
//       >
//         {nftLoading ? (
//           <Loader2 className="h-4 w-4 animate-spin" />
//         ) : (
//           <RefreshCw className="h-4 w-4" />
//         )}
//         <span className="ml-2">Refresh Data</span>
//       </Button>
//     );
//   }

  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-4">
      {/* Vault Status */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>NFT Vault</CardTitle>
            <div className="flex gap-2">
              {!vault && (
                <Dialog open={showInitDialog} onOpenChange={setShowInitDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Initialize Vault
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Initialize Vault</DialogTitle>
                      <DialogDescription>
                        Initialize vault for token:{" "}
                        {TOKEN_MINT.toBase58().slice(0, 8)}...
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="p-4 bg-muted rounded-lg space-y-2">
                        <div className="text-sm">
                          <span className="text-muted-foreground">
                            Token Mint:
                          </span>
                          <p className="font-mono text-xs break-all">
                            {TOKEN_MINT.toBase58()}
                          </p>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">
                            Pool Address:
                          </span>
                          <p className="font-mono text-xs break-all">
                            {walletAddress}
                          </p>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">
                            Reserve Factor:
                          </span>
                          <p>1000</p>
                        </div>
                      </div>
                      <Button
                        onClick={handleInitializeVault}
                        disabled={vaultLoading}
                        className="w-full"
                      >
                        {vaultLoading ? "Initializing..." : "Initialize Vault"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={refreshVaultData}
                // disabled={vaultLoading || nftLoading}
                 disabled={vaultLoading}
              >
                <RefreshCw
                  className={`h-4 w-4 ${vaultLoading ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {vault ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">
                    Total Vault Shares
                  </Label>
                  <p className="text-2xl font-bold">
                    {formatAmount(vault.totalShares)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">
                    Total Borrowed
                  </Label>
                  <p className="text-2xl font-bold">
                    {formatAmount(vault.totalBorrowed)}
                  </p>
                </div>
              </div>
              {vault.isPaused && (
                <Alert className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Vault is currently paused</AlertDescription>
                </Alert>
              )}
            </>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <p>No vault initialized for this token</p>
              <p className="text-sm mt-2">
                Click "Initialize Vault" to create one
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {vaultError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{vaultError}</AlertDescription>
        </Alert>
      )}

      {vault && (
        <div className="grid md:grid-cols-3 gap-4">
          {/* NFT Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your NFTs</CardTitle>
              <CardDescription>Select an NFT to manage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {collection?.uniqueIdToTokenId.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  <p>No NFTs found in collection</p>
                  {collection && (
                    <div className="mt-2 text-xs">
                      <p>Collection: {collection.name}</p>
                      <p>
                        Total Supply:{" "}
                        {collection.totalSupply?.toString() || "0"}
                      </p>
                      <p className="mt-2">
                        Go to Unique ID tab to mint NFTs first
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                collection?.uniqueIdToTokenId.map((nft) => (
                  <Button
                    key={nft.uniqueId.toString()}
                    variant={
                      selectedNFT === nft.uniqueId.toString()
                        ? "default"
                        : "outline"
                    }
                    className="w-full justify-start"
                    onClick={() => setSelectedNFT(nft.uniqueId.toString())}
                  >
                    <span className="truncate">
                      NFT #{nft.uniqueId.slice(0, 3).join("-")}
                    </span>
                  </Button>
                ))
              )}
            </CardContent>

            {selectedNFT && nftPosition && (
              <>
                <Separator />
                <CardContent className="pt-4">
                  <h4 className="font-semibold mb-2">Position Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shares:</span>
                      <span>{formatAmount(nftPosition.shares)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Asset Value:
                      </span>
                      <span>{formatAmount(nftPosition.assetValue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Deposited:</span>
                      <span>{formatAmount(nftPosition.depositedAmount)}</span>
                    </div>
                    {nftPosition.borrowedAmount && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Borrowed:</span>
                        <span>{formatAmount(nftPosition.borrowedAmount)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </>
            )}
          </Card>

          {/* Actions */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Manage Position</CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedNFT ? (
                <div className="text-center py-8 text-muted-foreground">
                  Select an NFT to manage your position
                </div>
              ) : (
                <Tabs defaultValue="deposit">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="deposit">Deposit</TabsTrigger>
                    <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
                    <TabsTrigger value="transfer">Transfer</TabsTrigger>
                  </TabsList>

                  <TabsContent value="deposit" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="deposit-amount">Amount to Deposit</Label>
                      <Input
                        id="deposit-amount"
                        type="number"
                        placeholder="0.00"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleDeposit}
                      disabled={
                        !depositAmount || vaultLoading || vault.isPaused
                      }
                      className="w-full"
                    >
                      <ArrowUpRight className="mr-2 h-4 w-4" />
                      Deposit
                    </Button>
                  </TabsContent>

                  <TabsContent value="withdraw" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="withdraw-shares">
                        Shares to Withdraw
                      </Label>
                      <Input
                        id="withdraw-shares"
                        type="number"
                        placeholder="0.00"
                        value={withdrawShares}
                        onChange={(e) => setWithdrawShares(e.target.value)}
                      />
                      {nftPosition && (
                        <p className="text-sm text-muted-foreground">
                          Available: {formatAmount(nftPosition.shares)} shares
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={handleWithdraw}
                      disabled={
                        !withdrawShares || vaultLoading || vault.isPaused
                      }
                      className="w-full"
                    >
                      <ArrowDownRight className="mr-2 h-4 w-4" />
                      Withdraw
                    </Button>
                  </TabsContent>

                  <TabsContent value="transfer" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="target-nft">Target NFT</Label>
                      <Select value={targetNFT} onValueChange={setTargetNFT}>
                        <SelectTrigger id="target-nft">
                          <SelectValue placeholder="Select target NFT" />
                        </SelectTrigger>
                        {/* <SelectContent>
                          {userNFTs
                            .filter(
                              (nft) => nft.mint.toBase58() !== selectedNFT
                            )
                            .map((nft) => (
                              <SelectItem
                                key={nft.mint.toBase58()}
                                value={nft.mint.toBase58()}
                              >
                                NFT #{nft.uniqueId.slice(0, 3).join("-")}
                              </SelectItem>
                            ))}
                        </SelectContent> */}
                      </Select>
                    </div>
                    <Button
                      onClick={handleTransfer}
                      disabled={!targetNFT || vaultLoading || vault.isPaused}
                      className="w-full"
                    >
                      <Repeat className="mr-2 h-4 w-4" />
                      Transfer Position
                    </Button>
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default NFTVaultInterface;
