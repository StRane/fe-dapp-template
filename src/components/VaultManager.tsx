import React, { useState, useEffect } from "react";
import { BN } from "@coral-xyz/anchor";
import { Wallet, ArrowUpRight, AlertCircle } from "lucide-react";
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

import { useVault } from "@/lib/useVault";
import { useUniqueId } from "@/lib/useUniqueId";

const NFTVaultInterface = () => {
  const [depositAmount, setDepositAmount] = useState("");

  const {
    isConnected,
    walletAddress,
    vault,
    loading: vaultLoading,
    error: vaultError,
    deposit,
    refreshData: refreshVaultData,
  } = useVault();

  const { refreshData: refreshNFTData } = useUniqueId();

  useEffect(() => {
    if (isConnected && walletAddress && !vault) {
      refreshNFTData();
      refreshVaultData();
    }
  }, [isConnected, walletAddress,vault]);

  const handleDeposit = async () => {
    if (!depositAmount) return;

    try {
      const amountBN = new BN(parseFloat(depositAmount) * 10 ** 6);
      const tx = await deposit(amountBN);

      if (tx) {
        setDepositAmount("");
        await refreshVaultData();
      }
    } catch (err) {
      console.error("Deposit failed:", err);
    }
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

  return (
    <div className="container max-w-2xl mx-auto p-4 space-y-4">
      {vaultError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{vaultError}</AlertDescription>
        </Alert>
      )}

      {vault && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Deposit</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="deposit">
              <TabsList className="grid w-full grid-cols-1">
                <TabsTrigger value="deposit">Deposit</TabsTrigger>
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
                  disabled={!depositAmount || vaultLoading}
                  className="w-full"
                >
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                  Deposit
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NFTVaultInterface;




// import React, { useState, useEffect } from "react";
// import { PublicKey } from "@solana/web3.js";
// import { BN } from "@coral-xyz/anchor";
// import {
//   AlertCircle,
//   Wallet,
//   RefreshCw,
//   ArrowUpRight,
//   ArrowDownRight,
//   Repeat,
//   Plus,
// } from "lucide-react";
// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { Separator } from "@/components/ui/separator";
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogHeader,
//   DialogTitle,
//   DialogTrigger,
// } from "@/components/ui/dialog";
// import { useVault } from "@/lib/useVault";
// import { useUniqueId } from "@/lib/useUniqueId";

// const NFTVaultInterface = () => {
//   // Your deployed token mint

//   const [selectedNFT, setSelectedNFT] = useState<string>("");
//   const [depositAmount, setDepositAmount] = useState("");
//   const [withdrawShares, setWithdrawShares] = useState("");
//   const [targetNFT, setTargetNFT] = useState("");
//   const [nftPosition, setNftPosition] = useState<any>(null);

//   // Initialize vault form state
//   // const [reserveFactor, setReserveFactor] = useState("1000");
//   const [showInitDialog, setShowInitDialog] = useState(false);

//   // Vault hook
//   const {
//     isConnected,
//     walletAddress,
//     vault,
//     loading: vaultLoading,
//     error: vaultError,
//     deposit,
//     refreshData: refreshVaultData,
//   } = useVault();

//   // NFT hook for getting user's NFTs
//   const {
//     collection,

//     refreshData: refreshNFTData,
//   } = useUniqueId();

//   // Filter user's NFTs from collection
//   //   const userNFTs = collection?.mintToUniqueId || [];

//   // Debug log to check NFT data
//   //   useEffect(() => {
//   //     if (isConnected && walletAddress) {
//   //       refreshNFTData();
//   //       refreshVaultData()
//   //     }
//   //     if (collection) {
//   //       console.log("Collection loaded:", collection);
//   //       console.log("User NFTs available:", collection.mintToUniqueId);
//   //       console.log(
//   //         "Total NFTs in collection:",
//   //         collection.mintToUniqueId?.length || 0
//   //       );
//   //     }
//   //   }, [collection, walletAddress, refreshNFTData, isConnected, refreshVaultData]);

//   useEffect(() => {
//     if (isConnected && walletAddress) {
//       refreshNFTData();
//       refreshVaultData();
//     }
//   }, [isConnected, walletAddress]);

//   useEffect(() => {
//     if (collection) {
//       console.log("Collection loaded:", collection);
//       console.log("User NFTs available:", collection.mintToUniqueId);
//       console.log(
//         "Total NFTs in collection:",
//         collection.mintToUniqueId?.length || 0
//       );
//     }
//     if (!collection) {
//       refreshNFTData();
//       console.log("Collection not loaded:", collection);
//     }
//   }, [collection, walletAddress, refreshNFTData, isConnected]);
//   // Load NFT position when selected
//   //   useEffect(() => {
//   //     const loadPosition = async () => {
//   //       if (selectedNFT && getNFTPosition) {
//   //         try {
//   //           const position = await getNFTPosition(new PublicKey(selectedNFT));
//   //           setNftPosition(position);
//   //         } catch (err) {
//   //           console.error("Failed to load position:", err);
//   //         }
//   //       }
//   //     };
//   //     loadPosition();
//   //   }, [selectedNFT, getNFTPosition]);

//   // const handleInitializeVault = async () => {
//   //   console.log("I clicked");
//   //   console.log(`Init mint: ${initMint}, Init pool: ${initPool}}`);
//   //   // if (!initMint || !initPool) return;

//   //   try {
//   //     console.log(initMint, initPool);
//   //     const tx = await initializeVault(
//   //       tokenMint, // Token Mint
//   //       new PublicKey("GXHdciYz5RQS5oGyF7JWF61sxFNuM4RxXw2s2ZX25cVd"), // Pool (your wallet)
//   //       new BN(1000) // Reserve factor
//   //     );

//   //     if (tx) {
//   //       setShowInitDialog(false);
//   //       setInitMint("");
//   //       setInitPool("");
//   //       await refreshVaultData();
//   //     }
//   //   } catch (err) {
//   //     console.error("Initialize vault failed:", err);
//   //   }
//   // };

//   const handleDeposit = async () => {
//     if (!selectedNFT || !depositAmount) return;

//     try {
//       const amountBN = new BN(parseFloat(depositAmount) * 10 ** 6);
//       console.log(selectedNFT.toString(), amountBN.toString());
//       const tx = await deposit(amountBN);

//       if (tx) {
//         setDepositAmount("");
//         await refreshVaultData();
//         // Reload position
//         // const position = await getNFTPosition(new PublicKey(selectedNFT));
//         // setNftPosition(position);
//       }
//     } catch (err) {
//       console.error("Deposit failed:", err);
//     }
//   };

//   const formatAmount = (bn: BN | undefined) => {
//     if (!bn) return "0";
//     return (bn.toNumber() / 10 ** 6).toFixed(2);
//   };

//   if (!isConnected) {
//     return (
//       <Card className="max-w-md mx-auto mt-20">
//         <CardHeader className="text-center">
//           <Wallet className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
//           <CardTitle>Connect Wallet</CardTitle>
//           <CardDescription>
//             Connect your Solana wallet to access the NFT Vault
//           </CardDescription>
//         </CardHeader>
//       </Card>
//     );
//   }

//   //   if (!isCollectionInitialized) {
//   //     return (
//   //       <Button
//   //         onClick={refreshNFTData}
//   //         variant="outline"
//   //         size="sm"
//   //         disabled={nftLoading}
//   //       >
//   //         {nftLoading ? (
//   //           <Loader2 className="h-4 w-4 animate-spin" />
//   //         ) : (
//   //           <RefreshCw className="h-4 w-4" />
//   //         )}
//   //         <span className="ml-2">Refresh Data</span>
//   //       </Button>
//   //     );
//   //   }

//   return (
//     <div className="container max-w-4xl mx-auto p-4 space-y-4">
//       {/* Vault Status */}
//       {/* <Card>
//         <CardHeader>
//           <div className="flex justify-between items-center">
//             <CardTitle>NFT Vault</CardTitle>
//             <div className="flex gap-2">
//               {!vault && (
//                 <Dialog open={showInitDialog} onOpenChange={setShowInitDialog}>
//                   <DialogTrigger asChild>
//                     <Button variant="outline" size="sm">
//                       <Plus className="h-4 w-4 mr-2" />
//                       Initialize Vault
//                     </Button>
//                   </DialogTrigger>
//                   <DialogContent>
//                     <DialogHeader>
//                       <DialogTitle>Initialize Vault</DialogTitle>
//                       <DialogDescription>
//                         Initialize vault for token:{" "}
//                         {TOKEN_MINT.toBase58().slice(0, 8)}...
//                       </DialogDescription>
//                     </DialogHeader>
//                     <div className="space-y-4 pt-4">
//                       <div className="p-4 bg-muted rounded-lg space-y-2">
//                         <div className="text-sm">
//                           <span className="text-muted-foreground">
//                             Token Mint:
//                           </span>
//                           <p className="font-mono text-xs break-all">
//                             {TOKEN_MINT.toBase58()}
//                           </p>
//                         </div>
//                         <div className="text-sm">
//                           <span className="text-muted-foreground">
//                             Pool Address:
//                           </span>
//                           <p className="font-mono text-xs break-all">
//                             {walletAddress}
//                           </p>
//                         </div>
//                         <div className="text-sm">
//                           <span className="text-muted-foreground">
//                             Reserve Factor:
//                           </span>
//                           <p>1000</p>
//                         </div>
//                       </div>
//                       <Button
//                         onClick={handleInitializeVault}
//                         disabled={vaultLoading}
//                         className="w-full"
//                       >
//                         {vaultLoading ? "Initializing..." : "Initialize Vault"}
//                       </Button>
//                     </div>
//                   </DialogContent>
//                 </Dialog>
//               )}
//               <Button
//                 variant="outline"
//                 size="icon"
//                 onClick={refreshVaultData}
//                 // disabled={vaultLoading || nftLoading}
//                 disabled={vaultLoading}
//               >
//                 <RefreshCw
//                   className={`h-4 w-4 ${vaultLoading ? "animate-spin" : ""}`}
//                 />
//               </Button>
//             </div>
//           </div>
//         </CardHeader>
//         <CardContent>
//           {vault ? (
//             <>
//               <div className="grid grid-cols-2 gap-4">
//                 <div>
//                   <Label className="text-muted-foreground">
//                     Total Vault Shares
//                   </Label>
//                   <p className="text-2xl font-bold">
//                     {formatAmount(vault.totalShares)}
//                   </p>
//                 </div>
//                 <div>
//                   <Label className="text-muted-foreground">
//                     Total Borrowed
//                   </Label>
//                   <p className="text-2xl font-bold">
//                     {formatAmount(vault.totalBorrowed)}
//                   </p>
//                 </div>
//               </div>
//               {vault.isPaused && (
//                 <Alert className="mt-4">
//                   <AlertCircle className="h-4 w-4" />
//                   <AlertDescription>Vault is currently paused</AlertDescription>
//                 </Alert>
//               )}
//             </>
//           ) : (
//             <div className="text-center py-4 text-muted-foreground">
//               <p>No vault initialized for this token</p>
//               <p className="text-sm mt-2">
//                 Click "Initialize Vault" to create one
//               </p>
//             </div>
//           )}
//         </CardContent>
//       </Card> */}

//       {vaultError && (
//         <Alert variant="destructive">
//           <AlertCircle className="h-4 w-4" />
//           <AlertTitle>Error</AlertTitle>
//           <AlertDescription>{vaultError}</AlertDescription>
//         </Alert>
//       )}

//       {vault && (
//         <div className="grid md:grid-cols-3 gap-4">
//           {/* NFT Selection */}
//           <Card>
//             <CardHeader>
//               <CardTitle className="text-lg">Your NFTs</CardTitle>
//               <CardDescription>Select an NFT to manage</CardDescription>
//             </CardHeader>
//             {/* <CardContent className="space-y-2">
//               {collection &&
//               Object.entries(collection.mintToUniqueId).length === 0 ? (
//                 <div className="text-sm text-muted-foreground text-center py-4">
//                   <p>No NFTs found in collection</p>
//                   <div className="mt-2 text-xs">
//                     <p>Collection: {collection.name}</p>
//                     <p>
//                       Total Supply: {collection.totalSupply?.toString() || "0"}
//                     </p>
//                     <p className="mt-2">
//                       Go to Unique ID tab to mint NFTs first
//                     </p>
//                   </div>
//                 </div>
//               ) : (
//                 Object.entries(collection!.mintToUniqueId).map(
//                   ([mint, uniqueId]) => (
//                     <Button
//                       key={mint}
//                       variant={selectedNFT === mint ? "default" : "outline"}
//                       className="w-full justify-start"
//                       onClick={() => setSelectedNFT(mint)}
//                     >
//                       <span className="truncate">
//                         NFT #{uniqueId.uniqueId.slice(0, 3).join("-")}
//                       </span>
//                     </Button>
//                   )
//                 )
//               )}
//             </CardContent> */}
// {/* selectedNFT && nftPosition && */}
//             { (
//               <>
//                 {/* <Separator /> */}
//                 {/* <CardContent className="pt-4">
//                   <h4 className="font-semibold mb-2">Position Details</h4>
//                   <div className="space-y-2 text-sm">
//                     <div className="flex justify-between">
//                       <span className="text-muted-foreground">Shares:</span>
//                       <span>{formatAmount(nftPosition.shares)}</span>
//                     </div>
//                     <div className="flex justify-between">
//                       <span className="text-muted-foreground">
//                         Asset Value:
//                       </span>
//                       <span>{formatAmount(nftPosition.assetValue)}</span>
//                     </div>
//                     <div className="flex justify-between">
//                       <span className="text-muted-foreground">Deposited:</span>
//                       <span>{formatAmount(nftPosition.depositedAmount)}</span>
//                     </div>
//                     {nftPosition.borrowedAmount && (
//                       <div className="flex justify-between">
//                         <span className="text-muted-foreground">Borrowed:</span>
//                         <span>{formatAmount(nftPosition.borrowedAmount)}</span>
//                       </div>
//                     )}
//                   </div>
//                 </CardContent> */}
//               </>
//             )}
//           </Card>

//           {/* Actions */}
//           <Card className="md:col-span-2">
//             <CardHeader>
//               <CardTitle className="text-lg">Manage Position</CardTitle>
//             </CardHeader>
//             <CardContent>
//               {/* {!selectedNFT ? (
//                 <div className="text-center py-8 text-muted-foreground">
//                   Select an NFT to manage your position
//                 </div>
//               ) : ( */}
//                 <Tabs defaultValue="deposit">
//                   <TabsList className="grid w-full grid-cols-3">
//                     <TabsTrigger value="deposit">Deposit</TabsTrigger>
//                     {/* <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
//                     <TabsTrigger value="transfer">Transfer</TabsTrigger> */}
//                   </TabsList>

//                   <TabsContent value="deposit" className="space-y-4">
//                     <div className="space-y-2">
//                       <Label htmlFor="deposit-amount">Amount to Deposit</Label>
//                       <Input
//                         id="deposit-amount"
//                         type="number"
//                         placeholder="0.00"
//                         value={depositAmount}
//                         onChange={(e) => setDepositAmount(e.target.value)}
//                       />
//                     </div>
//                     <Button
//                       onClick={handleDeposit}
//                       disabled={!depositAmount || vaultLoading}
//                       className="w-full"
//                     >
//                       <ArrowUpRight className="mr-2 h-4 w-4" />
//                       Deposit
//                     </Button>
//                   </TabsContent>
//                   {/* 
//                   <TabsContent value="withdraw" className="space-y-4">
//                     <div className="space-y-2">
//                       <Label htmlFor="withdraw-shares">
//                         Shares to Withdraw
//                       </Label>
//                       <Input
//                         id="withdraw-shares"
//                         type="number"
//                         placeholder="0.00"
//                         value={withdrawShares}
//                         onChange={(e) => setWithdrawShares(e.target.value)}
//                       />
//                       {nftPosition && (
//                         <p className="text-sm text-muted-foreground">
//                           Available: {formatAmount(nftPosition.shares)} shares
//                         </p>
//                       )}
//                     </div>
//                     <Button
//                       onClick={handleWithdraw}
//                       disabled={
//                         !withdrawShares || vaultLoading || vault.isPaused
//                       }
//                       className="w-full"
//                     >
//                       <ArrowDownRight className="mr-2 h-4 w-4" />
//                       Withdraw
//                     </Button>
//                   </TabsContent> */}

//                   {/* <TabsContent value="transfer" className="space-y-4">
//                     <div className="space-y-2">
//                       <Label htmlFor="target-nft">Target NFT</Label>
//                       <Select value={targetNFT} onValueChange={setTargetNFT}>
//                         <SelectTrigger id="target-nft">
//                           <SelectValue placeholder="Select target NFT" />
//                         </SelectTrigger>
                        
//                       </Select>
//                     </div>
//                     <Button
//                       onClick={handleTransfer}
//                       disabled={!targetNFT || vaultLoading || vault.isPaused}
//                       className="w-full"
//                     >
//                       <Repeat className="mr-2 h-4 w-4" />
//                       Transfer Position
//                     </Button>
//                   </TabsContent> */}
//                 </Tabs>
//               {/* ) */}
//               {/* } */}
//             </CardContent>
//           </Card>
//         </div>
//       )}
//     </div>
//   );
// };

// export default NFTVaultInterface;

// import React, { useState, useEffect } from "react";
// import { PublicKey } from "@solana/web3.js";
// import { BN } from "@coral-xyz/anchor";
// import {
//   AlertCircle,
//   Wallet,
//   RefreshCw,
//   ArrowUpRight,
// } from "lucide-react";
// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// import { useSimpleVault } from "@/lib/useVault";
// import { useUniqueId } from "@/lib/useUniqueId";

// const NFTVaultInterface = () => {
//   const [selectedNFT, setSelectedNFT] = useState<string>("");
//   const [depositAmount, setDepositAmount] = useState("");

//   // Vault hook
//   const {
//     isConnected,
//     walletAddress,
//     vault,
//     loading: vaultLoading,
//     error: vaultError,
//     deposit,
//     refreshData: refreshVaultData,
//     assetMint,
//     shareMint,
//     vaultPda,
//     nftCollection,
//   } = useSimpleVault();

//   // NFT hook for getting user's NFTs
//   const {
//     collection,
//     loading: nftLoading,
//     error: nftError,
//     refreshData: refreshNFTData,
//   } = useUniqueId();

//   // Refresh data when connected
//   useEffect(() => {
//     if (isConnected && walletAddress) {
//       refreshNFTData();
//       refreshVaultData();
//     }
//   }, [isConnected, walletAddress, refreshNFTData, refreshVaultData]);

//   useEffect(() => {
//     if (collection) {
//       console.log("Collection loaded:", collection);
//       console.log("User NFTs available:", collection.mintToUniqueId);
//       console.log(
//         "Total NFTs in collection:",
//         collection.mintToUniqueId?.length || 0
//       );
//     }
//   }, [collection]);

//   const handleDeposit = async () => {
//     if (!selectedNFT || !depositAmount) return;

//     try {
//       const amountBN = new BN(parseFloat(depositAmount) * 10 ** 6); // Assuming 6 decimals
//       console.log("Depositing:", amountBN.toString());

//       const tx = await deposit(amountBN);

//       if (tx) {
//         setDepositAmount("");
//         await refreshVaultData();
//         console.log("Deposit successful:", tx);
//       }
//     } catch (err) {
//       console.error("Deposit failed:", err);
//     }
//   };

//   const formatAmount = (bn: BN | undefined, decimals: number = 6) => {
//     if (!bn) return "0";
//     return (bn.toNumber() / (10 ** decimals)).toFixed(2);
//   };

//   if (!isConnected) {
//     return (
//       <Card className="max-w-md mx-auto mt-20">
//         <CardHeader className="text-center">
//           <Wallet className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
//           <CardTitle>Connect Wallet</CardTitle>
//           <CardDescription>
//             Connect your Solana wallet to access the Simple Vault
//           </CardDescription>
//         </CardHeader>
//       </Card>
//     );
//   }

//   return (
//     <div className="container max-w-4xl mx-auto p-4 space-y-4">
//       {/* Vault Status */}
//       <Card>
//         <CardHeader>
//           <div className="flex justify-between items-center">
//             <CardTitle>Simple Vault</CardTitle>
//             <div className="flex gap-2">
//               <Button
//                 variant="outline"
//                 size="icon"
//                 onClick={() => {
//                   refreshVaultData();
//                   refreshNFTData();
//                 }}
//                 disabled={vaultLoading || nftLoading}
//               >
//                 <RefreshCw
//                   className={`h-4 w-4 ${(vaultLoading || nftLoading) ? "animate-spin" : ""}`}
//                 />
//               </Button>
//             </div>
//           </div>
//           <CardDescription>
//             NFT-gated vault for token deposits
//           </CardDescription>
//         </CardHeader>
//         <CardContent>
//           {vault ? (
//             <div className="space-y-4">
//               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                 <div className="p-4 border rounded-lg">
//                   <Label className="text-muted-foreground">Vault Owner</Label>
//                   <p className="font-mono text-sm mt-1 break-all">
//                     {vault.owner.toBase58()}
//                   </p>
//                 </div>
//                 <div className="p-4 border rounded-lg">
//                   <Label className="text-muted-foreground">Asset Mint</Label>
//                   <p className="font-mono text-sm mt-1 break-all">
//                     {vault.assetMint.toBase58()}
//                   </p>
//                 </div>
//                 <div className="p-4 border rounded-lg">
//                   <Label className="text-muted-foreground">Share Mint</Label>
//                   <p className="font-mono text-sm mt-1 break-all">
//                     {vault.shareMint.toBase58()}
//                   </p>
//                 </div>
//                 <div className="p-4 border rounded-lg">
//                   <Label className="text-muted-foreground">NFT Collection</Label>
//                   <p className="font-mono text-sm mt-1 break-all">
//                     {vault.nftCollectionAddress.toBase58()}
//                   </p>
//                 </div>
//               </div>

//               {/* Hardcoded values display */}
//               <div className="p-4 bg-muted rounded-lg">
//                 <h4 className="font-semibold mb-2">Deployed Configuration</h4>
//                 <div className="grid grid-cols-1 gap-2 text-sm">
//                   <div>
//                     <span className="text-muted-foreground">Vault PDA: </span>
//                     <span className="font-mono">{vaultPda.toBase58()}</span>
//                   </div>
//                   <div>
//                     <span className="text-muted-foreground">Asset Mint: </span>
//                     <span className="font-mono">{assetMint.toBase58()}</span>
//                   </div>
//                   <div>
//                     <span className="text-muted-foreground">Share Mint: </span>
//                     <span className="font-mono">{shareMint.toBase58()}</span>
//                   </div>
//                   <div>
//                     <span className="text-muted-foreground">Collection: </span>
//                     <span className="font-mono">{nftCollection.toBase58()}</span>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           ) : (
//             <div className="text-center py-4 text-muted-foreground">
//               <p>Vault not found or not loaded</p>
//               <p className="text-sm mt-2">Check if the vault is properly initialized</p>
//             </div>
//           )}
//         </CardContent>
//       </Card>

//       {/* Error Display */}
//       {(vaultError || nftError) && (
//         <Alert variant="destructive">
//           <AlertCircle className="h-4 w-4" />
//           <AlertTitle>Error</AlertTitle>
//           <AlertDescription>
//             {vaultError || nftError}
//           </AlertDescription>
//         </Alert>
//       )}

//       {vault && (
//         <div className="grid md:grid-cols-2 gap-4">
//           {/* NFT Selection */}
//           <Card>
//             <CardHeader>
//               <CardTitle className="text-lg">Your Access NFTs</CardTitle>
//               <CardDescription>
//                 Select an NFT from the required collection to deposit
//               </CardDescription>
//             </CardHeader>
//             <CardContent className="space-y-2">
//               {nftLoading ? (
//                 <div className="text-center py-4 text-muted-foreground">
//                   <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />
//                   <p>Loading NFTs...</p>
//                 </div>
//               ) : !collection?.mintToUniqueId || collection.mintToUniqueId.length === 0 ? (
//                 <div className="text-sm text-muted-foreground text-center py-4">
//                   <p>No NFTs found from the required collection</p>
//                   {collection && (
//                     <div className="mt-2 text-xs space-y-1">
//                       <p>Collection: {collection.name || "Unknown"}</p>
//                       <p>
//                         Total Supply: {collection.totalSupply?.toString() || "0"}
//                       </p>
//                       <p className="mt-2 p-2 bg-amber-50 rounded border border-amber-200">
//                         You need to own an NFT from this collection to deposit
//                       </p>
//                     </div>
//                   )}
//                 </div>
//               ) : (
//                 collection.mintToUniqueId.map((item, index) => {
//                   const tokenData = collection.tokenIdToUniqueId[index];
//                   return (
//                     <Button
//                       key={item.mint.toBase58()}
//                       variant={
//                         selectedNFT === item.mint.toBase58()
//                           ? "default"
//                           : "outline"
//                       }
//                       className="w-full justify-start"
//                       onClick={() => setSelectedNFT(item.mint.toBase58())}
//                     >
//                       <span className="truncate">
//                         NFT #{tokenData?.uniqueId.slice(0, 3).join("-") || index + 1}
//                       </span>
//                     </Button>
//                   );
//                 })
//               )}
//             </CardContent>
//           </Card>

//           {/* Deposit Action */}
//           <Card>
//             <CardHeader>
//               <CardTitle className="text-lg">Deposit Assets</CardTitle>
//               <CardDescription>
//                 Deposit tokens using your selected NFT as access control
//               </CardDescription>
//             </CardHeader>
//             <CardContent>
//               {!selectedNFT ? (
//                 <div className="text-center py-8 text-muted-foreground">
//                   <p>Select an NFT to proceed with deposit</p>
//                   <p className="text-sm mt-2">
//                     Only NFT holders can deposit to this vault
//                   </p>
//                 </div>
//               ) : (
//                 <div className="space-y-4">
//                   <div className="p-3 bg-muted rounded-lg">
//                     <p className="text-sm text-muted-foreground mb-1">
//                       Selected NFT:
//                     </p>
//                     <p className="font-mono text-sm">
//                       {selectedNFT.slice(0, 8)}...{selectedNFT.slice(-8)}
//                     </p>
//                   </div>

//                   <div className="space-y-2">
//                     <Label htmlFor="deposit-amount">
//                       Amount to Deposit (Asset Tokens)
//                     </Label>
//                     <Input
//                       id="deposit-amount"
//                       type="number"
//                       placeholder="0.00"
//                       value={depositAmount}
//                       onChange={(e) => setDepositAmount(e.target.value)}
//                       min="0"
//                       step="0.000001"
//                     />
//                     <p className="text-xs text-muted-foreground">
//                       Asset Token: {assetMint.toBase58().slice(0, 8)}...
//                     </p>
//                   </div>

//                   <Button
//                     onClick={handleDeposit}
//                     disabled={!depositAmount || vaultLoading || parseFloat(depositAmount) <= 0}
//                     className="w-full"
//                   >
//                     {vaultLoading ? (
//                       <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
//                     ) : (
//                       <ArrowUpRight className="mr-2 h-4 w-4" />
//                     )}
//                     {vaultLoading ? "Processing..." : "Deposit"}
//                   </Button>

//                   <div className="text-xs text-muted-foreground space-y-1">
//                     <p>• You will receive share tokens in return</p>
//                     <p>• Share tokens represent your vault ownership</p>
//                     <p>• Currently using 1:1 deposit ratio</p>
//                   </div>
//                 </div>
//               )}
//             </CardContent>
//           </Card>
//         </div>
//       )}

//       {/* Collection Info */}
//       {collection && (
//         <Card>
//           <CardHeader>
//             <CardTitle className="text-lg">Collection Information</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
//               <div>
//                 <Label className="text-muted-foreground">Collection Name</Label>
//                 <p className="mt-1">{collection.name || "Unknown"}</p>
//               </div>
//               <div>
//                 <Label className="text-muted-foreground">Symbol</Label>
//                 <p className="mt-1">{collection.symbol || "N/A"}</p>
//               </div>
//               <div>
//                 <Label className="text-muted-foreground">Total Supply</Label>
//                 <p className="mt-1">{collection.totalSupply?.toString() || "0"}</p>
//               </div>
//               <div className="md:col-span-3">
//                 <Label className="text-muted-foreground">Collection Address</Label>
//                 <p className="mt-1 font-mono text-xs break-all">
//                   {nftCollection.toBase58()}
//                 </p>
//               </div>
//             </div>
//           </CardContent>
//         </Card>
//       )}
//     </div>
//   );
// };

// export default NFTVaultInterface;
