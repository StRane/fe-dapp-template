import React, { useState, useEffect, useMemo } from 'react';
import { BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { useAppKitAccount } from '@reown/appkit/react';

// Import your existing hooks and stores
import { useToken } from '@/lib/useToken';
import { useUniqueId } from '@/lib/useUniqueId';
import { useTokenSelection, useNFTSelection } from '@/context/SelectionContext';

// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

// Icons
import {
  Wallet, Loader2, CheckCircle2, XCircle, Copy, AlertCircle, 
  Coins, Sparkles, RefreshCw, Plus, Check, Zap, Shield, 
  ArrowRight, Settings, Info, User, CreditCard
} from 'lucide-react';

// Constants
const DEFAULT_TOKEN_MINT = "4kXBWAG92UZA1FPEQDN5bjePoFyQsbTnZ9rpxgRBbFYk";

// Custom hooks for unified state management
const useAssetReadiness = () => {
  const { userTokens, loading: tokenLoading, error: tokenError } = useToken();
  const { 
    collection, 
    isCollectionInitialized, 
    loading: nftLoading, 
    error: nftError 
  } = useUniqueId();
  const { selectedTokenMint } = useTokenSelection();
  const { selectedNFT } = useNFTSelection();

  return useMemo(() => {
    const hasTokens = userTokens.length > 0;
    const hasNFTs = collection && collection.mintToUniqueId && collection.mintToUniqueId.length > 0;
    const hasSelectedToken = !!selectedTokenMint;
    const hasSelectedNFT = !!selectedNFT;
    
    return {
      // Asset status
      tokens: {
        available: hasTokens,
        count: userTokens.length,
        selected: hasSelectedToken,
        loading: tokenLoading,
        error: tokenError
      },
      nfts: {
        collectionReady: isCollectionInitialized,
        available: hasNFTs,
        count: collection?.mintToUniqueId?.length || 0,
        selected: hasSelectedNFT,
        loading: nftLoading,
        error: nftError
      },
      // Overall readiness
      ready: hasTokens && hasNFTs && hasSelectedToken && hasSelectedNFT,
      setupNeeded: !isCollectionInitialized || !hasTokens || !hasNFTs,
      loading: tokenLoading || nftLoading,
      errors: [tokenError, nftError].filter(Boolean)
    };
  }, [
    userTokens, collection, isCollectionInitialized, selectedTokenMint, selectedNFT,
    tokenLoading, nftLoading, tokenError, nftError
  ]);
};

const useAssetActions = () => {
  const { mintTokens, refreshAllData: refreshTokens } = useToken();
  const { 
    initializeCollection, 
    mintNFT, 
    refreshAllData: refreshNFTs 
  } = useUniqueId();
  const { setSelectedTokenMint } = useTokenSelection();
  const { setSelectedNFT } = useNFTSelection();

  const setupCollection = async (name: string, symbol: string, baseUri: string) => {
    const tx = await initializeCollection(name, symbol, baseUri);
    if (tx) {
      await refreshNFTs();
    }
    return tx;
  };

  const mintTokensQuick = async (amount: string) => {
    const targetMint = new PublicKey(DEFAULT_TOKEN_MINT);
    const decimals = 9;
    const amountBN = new BN(parseFloat(amount)).mul(new BN(10).pow(new BN(decimals)));
    
    const tx = await mintTokens(amountBN, targetMint);
    if (tx) {
      await refreshTokens();
      // Auto-select the minted token
      setSelectedTokenMint(targetMint);
    }
    return tx;
  };

  const mintNFTQuick = async () => {
    const nft = await mintNFT();
    if (nft) {
      await refreshNFTs();
      // Auto-select the minted NFT
      setSelectedNFT(nft.mint);
    }
    return nft;
  };

  const refreshAll = async () => {
    await Promise.all([refreshTokens(), refreshNFTs()]);
  };

  return {
    setupCollection,
    mintTokensQuick,
    mintNFTQuick,
    refreshAll
  };
};

export const AssetIdentityHub: React.FC = () => {
  const { address, isConnected } = useAppKitAccount();
  const readiness = useAssetReadiness();
  const actions = useAssetActions();

  // UI state
  const [activeTab, setActiveTab] = useState("overview");
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  // Form states
  const [tokenAmount, setTokenAmount] = useState("1000");
  const [collectionForm, setCollectionForm] = useState({
    name: 'My Vault Collection',
    symbol: 'VAULT',
    baseUri: 'https://example.com/metadata/'
  });

  // Loading states
  const [isSetupLoading, setIsSetupLoading] = useState(false);
  const [isTokenMinting, setIsTokenMinting] = useState(false);
  const [isNFTMinting, setIsNFTMinting] = useState(false);

  // Selection hooks
  const { 
    selectedTokenAccount, 
    selectedTokenMint, 
    setSelectedTokenAccount, 
    setSelectedTokenMint 
  } = useTokenSelection();
  const { selectedNFT, setSelectedNFT } = useNFTSelection();

  // Get data from stores
  const { userTokens, currentNetwork } = useToken();
  const { collection } = useUniqueId();

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification({ type: null, message: '' }), 5000);
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showNotification('success', `${label} copied to clipboard`);
    } catch (err) {
      showNotification('error', `Failed to copy: ${(err as Error).message}`);
    }
  };

  const handleQuickSetup = async () => {
    setIsSetupLoading(true);
    try {
      // Step 1: Initialize collection if needed
      if (!readiness.nfts.collectionReady) {
        const tx = await actions.setupCollection(
          collectionForm.name,
          collectionForm.symbol,
          collectionForm.baseUri
        );
        if (!tx) throw new Error("Failed to initialize collection");
      }

      // Step 2: Mint NFT if needed
      if (!readiness.nfts.available) {
        const nft = await actions.mintNFTQuick();
        if (!nft) throw new Error("Failed to mint NFT");
      }

      // Step 3: Mint tokens if needed
      if (!readiness.tokens.available) {
        const tx = await actions.mintTokensQuick(tokenAmount);
        if (!tx) throw new Error("Failed to mint tokens");
      }

      showNotification('success', 'Quick setup completed successfully!');
    } catch (err) {
      showNotification('error', `Setup failed: ${(err as Error).message}`);
    } finally {
      setIsSetupLoading(false);
    }
  };

  const handleMintTokens = async () => {
    setIsTokenMinting(true);
    try {
      const tx = await actions.mintTokensQuick(tokenAmount);
      if (tx) {
        showNotification('success', `Successfully minted ${tokenAmount} tokens!`);
        setTokenAmount("1000");
      }
    } catch (err) {
      showNotification('error', `Token minting failed: ${(err as Error).message}`);
    } finally {
      setIsTokenMinting(false);
    }
  };

  const handleMintNFT = async () => {
    setIsNFTMinting(true);
    try {
      const nft = await actions.mintNFTQuick();
      if (nft) {
        showNotification('success', 'NFT minted successfully!');
      }
    } catch (err) {
      showNotification('error', `NFT minting failed: ${(err as Error).message}`);
    } finally {
      setIsNFTMinting(false);
    }
  };

  const handleTokenSelect = (tokenAccount: PublicKey, mint: PublicKey) => {
    setSelectedTokenAccount(tokenAccount);
    setSelectedTokenMint(mint);
    showNotification('success', 'Token selected for operations');
  };

  const handleNFTSelect = (nftMint: PublicKey) => {
    setSelectedNFT(nftMint);
    showNotification('success', 'NFT selected for operations');
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
            Please connect your Solana wallet to manage your assets and identity
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Notification */}
      {notification.type && (
        <Alert variant={notification.type === 'error' ? 'destructive' : 'default'}>
          {notification.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertDescription>{notification.message}</AlertDescription>
        </Alert>
      )}

      {/* Header with Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Asset & Identity Hub
          </CardTitle>
          <CardDescription>
            Manage your tokens and NFT identity in one place. Network: {currentNetwork}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Status Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Wallet Info */}
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" />
                Wallet
              </Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  {address?.slice(0, 4)}...{address?.slice(-4)}
                </Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => copyToClipboard(address || '', 'Wallet address')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Token Status */}
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground flex items-center gap-1">
                <Coins className="h-3 w-3" />
                Token Assets
              </Label>
              <div className="flex items-center gap-2">
                <Badge 
                  variant={readiness.tokens.available ? "default" : "secondary"}
                  className="flex items-center gap-1"
                >
                  {readiness.tokens.loading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : readiness.tokens.available ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                  {readiness.tokens.count} tokens
                </Badge>
                {readiness.tokens.selected && (
                  <Badge variant="outline" className="text-xs">Selected</Badge>
                )}
              </div>
            </div>

            {/* NFT Status */}
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                NFT Identity
              </Label>
              <div className="flex items-center gap-2">
                <Badge 
                  variant={readiness.nfts.available ? "default" : "secondary"}
                  className="flex items-center gap-1"
                >
                  {readiness.nfts.loading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : readiness.nfts.available ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                  {readiness.nfts.count} NFTs
                </Badge>
                {readiness.nfts.selected && (
                  <Badge variant="outline" className="text-xs">Selected</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Quick Setup Section */}
          {readiness.setupNeeded && (
            <>
              <Separator className="my-4" />
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Quick Setup</h3>
                    <p className="text-sm text-muted-foreground">
                      Get started with tokens and NFT identity in one click
                    </p>
                  </div>
                  <Button 
                    onClick={handleQuickSetup}
                    disabled={isSetupLoading}
                    className="flex items-center gap-2"
                  >
                    {isSetupLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    Setup Assets
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Ready Status */}
          {readiness.ready && (
            <>
              <Separator className="my-4" />
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>✅ Ready for vault operations! You have tokens and NFT identity.</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      {/* Error Alerts */}
      {readiness.errors.map((error, index) => (
        <Alert key={index} variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ))}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="manage">Manage Assets</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Current Selections */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Current Selection
                </CardTitle>
                <CardDescription>
                  Assets selected for operations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Selected Token */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Selected Token</Label>
                  {selectedTokenMint ? (
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono text-sm">
                            {selectedTokenMint.toBase58().slice(0, 8)}...
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Ready for operations
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(selectedTokenMint.toBase58(), 'Token mint')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 border-2 border-dashed rounded-lg text-center">
                      <p className="text-sm text-muted-foreground">No token selected</p>
                    </div>
                  )}
                </div>

                {/* Selected NFT */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Selected NFT Identity</Label>
                  {selectedNFT ? (
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono text-sm">
                            {selectedNFT.toBase58().slice(0, 8)}...
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Identity verified
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(selectedNFT.toBase58(), 'NFT mint')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 border-2 border-dashed rounded-lg text-center">
                      <p className="text-sm text-muted-foreground">No NFT selected</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Quick Actions
                </CardTitle>
                <CardDescription>
                  Common operations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Mint Tokens */}
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="1000"
                    value={tokenAmount}
                    onChange={(e) => setTokenAmount(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleMintTokens}
                    disabled={isTokenMinting || !tokenAmount}
                    className="flex items-center gap-2"
                  >
                    {isTokenMinting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Mint Tokens
                  </Button>
                </div>

                {/* Mint NFT */}
                <Button
                  onClick={handleMintNFT}
                  disabled={isNFTMinting || !readiness.nfts.collectionReady}
                  variant="outline"
                  className="w-full flex items-center gap-2"
                >
                  {isNFTMinting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Mint NFT Identity
                </Button>

                {/* Refresh All */}
                <Button
                  onClick={actions.refreshAll}
                  disabled={readiness.loading}
                  variant="outline"
                  className="w-full flex items-center gap-2"
                >
                  {readiness.loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Refresh All Data
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Manage Assets Tab */}
        <TabsContent value="manage" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Token Management */}
            <Card>
              <CardHeader>
                <CardTitle>Token Portfolio</CardTitle>
                <CardDescription>
                  Select and manage your token assets
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
                          onClick={() => handleTokenSelect(token.account, token.mint)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono text-xs">
                                  {token.mint.toBase58().slice(0, 8)}...
                                </Badge>
                                {selectedTokenAccount?.equals(token.account) && (
                                  <Check className="h-4 w-4 text-primary" />
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Balance: {formatBalance(token.balance, token.decimals)}
                              </p>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(token.account.toBase58(), 'Token account');
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
                          {readiness.tokens.loading 
                            ? "Loading token accounts..." 
                            : "No token accounts found. Mint some tokens first."
                          }
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* NFT Management */}
            <Card>
              <CardHeader>
                <CardTitle>NFT Identity</CardTitle>
                <CardDescription>
                  Select your identity NFT for verification
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {readiness.nfts.available && collection?.mintToUniqueId ? (
                      collection.mintToUniqueId.map((item, index) => {
                        const tokenData = collection.tokenIdToUniqueId[index];
                        return (
                          <Card
                            key={item.mint.toBase58()}
                            className={`p-3 cursor-pointer transition-colors ${
                              selectedNFT?.equals(item.mint)
                                ? "ring-2 ring-primary bg-primary/5"
                                : "hover:bg-muted"
                            }`}
                            onClick={() => handleNFTSelect(item.mint)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="font-mono text-xs">
                                    NFT #{tokenData?.uniqueId.slice(0, 3).join("-") || index + 1}
                                  </Badge>
                                  {selectedNFT?.equals(item.mint) && (
                                    <Check className="h-4 w-4 text-primary" />
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  Unique ID: [{item.uniqueId.slice(0, 3).join(", ")}...]
                                </p>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(item.mint.toBase58(), 'NFT mint');
                                }}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </Card>
                        );
                      })
                    ) : (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          {readiness.nfts.loading 
                            ? "Loading NFTs..." 
                            : !readiness.nfts.collectionReady
                            ? "Collection not initialized. Run quick setup first."
                            : "No NFTs found. Mint an NFT first."
                          }
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Advanced Tab */}
        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Advanced Settings
              </CardTitle>
              <CardDescription>
                Collection management and power user features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Collection Form */}
              {!readiness.nfts.collectionReady && (
                <div className="space-y-4">
                  <h3 className="font-semibold">Initialize NFT Collection</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Collection Name</Label>
                      <Input
                        id="name"
                        value={collectionForm.name}
                        onChange={(e) => setCollectionForm(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="symbol">Symbol</Label>
                      <Input
                        id="symbol"
                        value={collectionForm.symbol}
                        onChange={(e) => setCollectionForm(prev => ({ ...prev, symbol: e.target.value }))}
                      />
                    </div>
                    <div className="col-span-full space-y-2">
                      <Label htmlFor="baseUri">Base URI</Label>
                      <Input
                        id="baseUri"
                        value={collectionForm.baseUri}
                        onChange={(e) => setCollectionForm(prev => ({ ...prev, baseUri: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Collection Info */}
              {readiness.nfts.collectionReady && collection && (
                <div className="space-y-4">
                  <h3 className="font-semibold">Collection Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Name</Label>
                      <p className="font-semibold">{collection.name}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Symbol</Label>
                      <p className="font-semibold">{collection.symbol}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Total Supply</Label>
                      <p className="font-semibold">{collection.totalSupply?.toString() || "0"}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Authority</Label>
                      <div className="flex items-center gap-2">
                        <code className="text-xs">{collection.authority.toBase58().slice(0, 8)}...</code>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-4 w-4"
                          onClick={() => copyToClipboard(collection.authority.toBase58(), 'Authority')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="col-span-full">
                      <Label className="text-sm text-muted-foreground">Base URI</Label>
                      <p className="font-mono text-xs break-all">{collection.baseUri}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Debug Information */}
              <div className="space-y-4">
                <h3 className="font-semibold">Debug Information</h3>
                <div className="p-4 bg-muted rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Network:</span>
                    <span className="font-mono">{currentNetwork}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Token Program Ready:</span>
                    <span>{readiness.tokens.available ? "✅" : "❌"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>NFT Collection Ready:</span>
                    <span>{readiness.nfts.collectionReady ? "✅" : "❌"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Assets Selected:</span>
                    <span>{readiness.tokens.selected && readiness.nfts.selected ? "✅" : "❌"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Vault Ready:</span>
                    <span>{readiness.ready ? "✅" : "❌"}</span>
                  </div>
                </div>
              </div>

              {/* Raw Data */}
              <details className="space-y-2">
                <summary className="cursor-pointer font-semibold">Raw Store Data</summary>
                <div className="p-4 bg-muted rounded-lg">
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify({
                      readiness,
                      userTokens: userTokens.map(t => ({
                        mint: t.mint.toBase58(),
                        balance: t.balance,
                        decimals: t.decimals
                      })),
                      collection: collection ? {
                        name: collection.name,
                        symbol: collection.symbol,
                        totalSupply: collection.totalSupply?.toString(),
                        mintCount: collection.mintToUniqueId?.length
                      } : null,
                      selections: {
                        token: selectedTokenMint?.toBase58(),
                        nft: selectedNFT?.toBase58()
                      }
                    }, null, 2)}
                  </pre>
                </div>
              </details>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-semibold">Ready for Vault Operations?</h3>
              <p className="text-sm text-muted-foreground">
                {readiness.ready 
                  ? "You have all required assets selected. Ready to proceed to vault operations."
                  : "Complete asset setup and selection to enable vault operations."
                }
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={actions.refreshAll}
                disabled={readiness.loading}
              >
                {readiness.loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              <Button
                disabled={!readiness.ready}
                className="flex items-center gap-2"
              >
                <ArrowRight className="h-4 w-4" />
                Proceed to Vault
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};