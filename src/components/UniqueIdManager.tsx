// components/UniqueIdManager.tsx
import React, { useState, useEffect } from 'react';
import { useUniqueId } from '@/lib/useUniqueId';
import { PublicKey } from '@solana/web3.js';
import { useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react';

// shadcn/ui components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Icons (using lucide-react)
import { 
  Wallet, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Plus,
  Search,
  Copy,
  ExternalLink,
  AlertCircle,
  Sparkles,
  Hash,
  Info
} from 'lucide-react';

export const UniqueIdManager: React.FC = () => {
  console.log('[UniqueIdManager] === COMPONENT RENDER START ===');
  
  const { address, isConnected } = useAppKitAccount();
  const { caipNetwork } = useAppKitNetwork();

  console.log('[UniqueIdManager] Component props:', {
    isConnected,
    address: address?.slice(0, 8),
    networkName: caipNetwork?.name,
    networkId: caipNetwork?.id
  });

  // Use the hook for all business logic and state
  const {
    // Network state
    connection,
    currentNetwork,
    isSolanaNetwork,
    isNetworkReady,

    // Program state  
    program,
    collection,
    userState,
    totalSupply,
    userNonce,
    isCollectionInitialized,
    loading,
    error,

    // AppKit state
    isConnected: hookConnected,
    walletAddress,

    // Local state
    userStatePda,

    // Computed values
    programId,

    // Functions
    initializeCollection,
    mintNFT,
    mintMultipleNFTs,
    uniqueIdExists,
    getTokenIdByUniqueId,
    getUniqueIdByTokenId,
    getUniqueIdByMint,
    refreshData,
  } = useUniqueId();

  console.log('[UniqueIdManager] Hook state:', {
    hasConnection: !!connection,
    connectionRpc: connection?.rpcEndpoint,
    currentNetwork,
    isSolanaNetwork,
    isNetworkReady,
    hasProgram: !!program,
    isCollectionInitialized,
    totalSupply,
    userNonce,
    loading,
    hasError: !!error,
    hookConnected,
    walletAddress: walletAddress?.slice(0, 8),
    programId
  });

  // Network sync effect - follows TokenManager pattern
  useEffect(() => {
    console.log('[UniqueIdManager] === NETWORK SYNC EFFECT START ===');
    console.log('[UniqueIdManager] Network sync conditions:', {
      isConnected,
      networkName: caipNetwork?.name,
      networkId: caipNetwork?.id
    });

    if (isConnected && (caipNetwork?.name || caipNetwork?.id)) {
      console.log('[UniqueIdManager] Network sync will be handled by hook');
      // Network sync happens in the hook, not here
    }
    console.log('[UniqueIdManager] === NETWORK SYNC EFFECT END ===');
  }, [isConnected, caipNetwork?.name, caipNetwork?.id]);

  // Refresh data when ready - follows TokenManager pattern
  useEffect(() => {
    console.log('[UniqueIdManager] === REFRESH DATA EFFECT START ===');
    console.log('[UniqueIdManager] Refresh conditions:', {
      hookConnected,
      isNetworkReady,
      walletAddress: !!walletAddress
    });

    if (hookConnected && isNetworkReady && walletAddress) {
      console.log('[UniqueIdManager] Triggering data refresh');
      refreshData();
    }
    console.log('[UniqueIdManager] === REFRESH DATA EFFECT END ===');
  }, [hookConnected, isNetworkReady, walletAddress, refreshData]);

  // Local state for forms
  const [collectionForm, setCollectionForm] = useState({
    name: '',
    symbol: '',
    baseUri: ''
  });
  
  const [mintCount, setMintCount] = useState(1);
  const [searchUniqueId, setSearchUniqueId] = useState('');
  const [searchTokenId, setSearchTokenId] = useState('');
  const [searchMint, setSearchMint] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [mintedNFTs, setMintedNFTs] = useState<any[]>([]);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | null; message: string }>({ 
    type: null, 
    message: '' 
  });

  console.log('[UniqueIdManager] Local state:', {
    collectionForm,
    mintCount,
    isInitializing,
    isMinting,
    mintedNFTsCount: mintedNFTs.length,
    hasNotification: !!notification.type
  });

  // Show notification
  const showNotification = (type: 'success' | 'error', message: string) => {
    console.log('[UniqueIdManager] Showing notification:', { type, message });
    setNotification({ type, message });
    setTimeout(() => {
      console.log('[UniqueIdManager] Clearing notification');
      setNotification({ type: null, message: '' });
    }, 5000);
  };

  // Copy to clipboard helper
  const copyToClipboard = async (text: string, label: string) => {
    console.log('[UniqueIdManager] Copying to clipboard:', { label, text: text.slice(0, 16) + '...' });
    try {
      await navigator.clipboard.writeText(text);
      showNotification('success', `${label} copied to clipboard`);
    } catch (err) {
      console.error('[UniqueIdManager] Copy failed:', err);
      showNotification('error', (err as Error).message);
    }
  };

  // Initialize collection handler
  const handleInitializeCollection = async () => {
    console.log('[UniqueIdManager] === INITIALIZE COLLECTION HANDLER START ===');
    console.log('[UniqueIdManager] Collection form data:', collectionForm);

    if (!collectionForm.name || !collectionForm.symbol || !collectionForm.baseUri) {
      showNotification('error', 'Please fill in all fields');
      return;
    }

    setIsInitializing(true);
    try {
      console.log('[UniqueIdManager] Calling initializeCollection...');
      const txId = await initializeCollection(
        collectionForm.name,
        collectionForm.symbol,
        collectionForm.baseUri
      );
      
      if (txId) {
        console.log('[UniqueIdManager] Collection initialized successfully:', txId);
        showNotification('success', `Collection initialized! Transaction: ${txId.slice(0, 8)}...`);
        setCollectionForm({ name: '', symbol: '', baseUri: '' });
      } else {
        console.log('[UniqueIdManager] Collection initialization returned null');
      }
    } catch (err) {
      console.error('[UniqueIdManager] Collection initialization failed:', err);
      showNotification('error', `Initialization failed: ${(err as Error).message}`);
    } finally {
      setIsInitializing(false);
    }
    console.log('[UniqueIdManager] === INITIALIZE COLLECTION HANDLER END ===');
  };

  // Mint NFT handler
  const handleMintNFT = async () => {
    console.log('[UniqueIdManager] === MINT NFT HANDLER START ===');
    console.log('[UniqueIdManager] Mint parameters:', { mintCount });

    setIsMinting(true);
    try {
      let result;
      if (mintCount === 1) {
        console.log('[UniqueIdManager] Minting single NFT');
        const nft = await mintNFT();
        result = nft ? [nft] : null;
      } else {
        console.log('[UniqueIdManager] Minting multiple NFTs:', mintCount);
        result = await mintMultipleNFTs(mintCount);
      }
      
      if (result) {
        console.log('[UniqueIdManager] NFTs minted successfully:', {
          count: result.length,
          mints: result.map(nft => nft.mint.toBase58())
        });
        setMintedNFTs(prev => [...result, ...prev]);
        showNotification('success', `Successfully minted ${result.length} NFT(s)`);
      } else {
        console.log('[UniqueIdManager] Minting returned null');
      }
    } catch (err) {
      console.error('[UniqueIdManager] Minting failed:', err);
      showNotification('error', `Minting failed: ${(err as Error).message}`);
    } finally {
      setIsMinting(false);
    }
    console.log('[UniqueIdManager] === MINT NFT HANDLER END ===');
  };

  // Search by unique ID
  const handleSearchByUniqueId = async () => {
    console.log('[UniqueIdManager] === SEARCH BY UNIQUE ID START ===');
    console.log('[UniqueIdManager] Search input:', searchUniqueId);

    try {
      const uniqueIdArray = searchUniqueId.split(',').map(id => parseInt(id.trim()));
      console.log('[UniqueIdManager] Parsed unique ID array:', uniqueIdArray);
      
      const exists = await uniqueIdExists(uniqueIdArray);
      const tokenId = exists ? await getTokenIdByUniqueId(uniqueIdArray) : null;
      
      const results = {
        type: 'uniqueId',
        uniqueId: uniqueIdArray,
        exists,
        tokenId
      };
      
      console.log('[UniqueIdManager] Search results:', results);
      setSearchResults(results);
    } catch (err) {
      console.error('[UniqueIdManager] Search by unique ID failed:', err);
      showNotification('error', `Search failed: ${(err as Error).message}`);
    }
    console.log('[UniqueIdManager] === SEARCH BY UNIQUE ID END ===');
  };

  // Search by token ID
  const handleSearchByTokenId = async () => {
    console.log('[UniqueIdManager] === SEARCH BY TOKEN ID START ===');
    console.log('[UniqueIdManager] Search input:', searchTokenId);

    try {
      const tokenId = parseInt(searchTokenId);
      console.log('[UniqueIdManager] Parsed token ID:', tokenId);
      
      const uniqueId = await getUniqueIdByTokenId(tokenId);
      
      const results = {
        type: 'tokenId',
        tokenId,
        uniqueId
      };
      
      console.log('[UniqueIdManager] Search results:', results);
      setSearchResults(results);
    } catch (err) {
      console.error('[UniqueIdManager] Search by token ID failed:', err);
      showNotification('error', `Search failed: ${(err as Error).message}`);
    }
    console.log('[UniqueIdManager] === SEARCH BY TOKEN ID END ===');
  };

  // Search by mint address
  const handleSearchByMint = async () => {
    console.log('[UniqueIdManager] === SEARCH BY MINT START ===');
    console.log('[UniqueIdManager] Search input:', searchMint);

    try {
      const mintPubkey = new PublicKey(searchMint);
      console.log('[UniqueIdManager] Parsed mint pubkey:', mintPubkey.toBase58());
      
      const uniqueId = await getUniqueIdByMint(mintPubkey);
      
      const results = {
        type: 'mint',
        mint: searchMint,
        uniqueId
      };
      
      console.log('[UniqueIdManager] Search results:', results);
      setSearchResults(results);
    } catch (err) {
      console.error('[UniqueIdManager] Search by mint failed:', err);
      showNotification('error', `Search failed: ${(err as Error).message}`);
    }
    console.log('[UniqueIdManager] === SEARCH BY MINT END ===');
  };

  // Not connected state
  if (!isConnected) {
    console.log('[UniqueIdManager] Rendering not connected state');
    return (
      <Card className="w-full max-w-md mx-auto mt-10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Connect Wallet
          </CardTitle>
          <CardDescription>
            Please connect your Solana wallet to use the Unique ID NFT system
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
    console.log('[UniqueIdManager] Rendering network issue state:', {
      isSolanaNetwork,
      isNetworkReady
    });
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
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Current network: {currentNetwork || 'Unknown'}
              <br />
              Solana network: {isSolanaNetwork ? 'Yes' : 'No'}
              <br />
              Network ready: {isNetworkReady ? 'Yes' : 'No'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  console.log('[UniqueIdManager] Rendering main interface');

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Notification Alert */}
      {notification.type && (
        <Alert variant={notification.type === 'error' ? 'destructive' : 'default'} className="mb-4">
          {notification.type === 'success' ? (
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
            <Sparkles className="h-5 w-5" />
            Unique ID NFT System
          </CardTitle>
          <CardDescription>
            Network: {currentNetwork || 'Unknown'} | Program: {programId.slice(0, 8)}...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Wallet</Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  {walletAddress?.slice(0, 4)}...{walletAddress?.slice(-4)}
                </Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => copyToClipboard(walletAddress || '', 'Wallet address')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Collection Status</Label>
              <Badge variant={isCollectionInitialized ? "default" : "secondary"}>
                {isCollectionInitialized ? "Initialized" : "Not Initialized"}
              </Badge>
            </div>
            
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Total Supply</Label>
              <div className="flex items-center gap-1">
                <Hash className="h-4 w-4 text-muted-foreground" />
                {/* <span className="font-semibold">{totalSupply}</span> */}
              </div>
            </div>
            
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Your Nonce</Label>
              <div className="flex items-center gap-1">
                <Info className="h-4 w-4 text-muted-foreground" />
                {/* <span className="font-semibold">{userNonce}</span> */}
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={refreshData} 
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
      <Tabs defaultValue="collection" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="collection">Collection</TabsTrigger>
          <TabsTrigger value="mint" disabled={!isCollectionInitialized}>Mint</TabsTrigger>
          <TabsTrigger value="search" disabled={!isCollectionInitialized}>Search</TabsTrigger>
          <TabsTrigger value="history" disabled={!isCollectionInitialized}>History</TabsTrigger>
        </TabsList>

        {/* Collection Tab */}
        <TabsContent value="collection" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Collection Management</CardTitle>
              <CardDescription>
                {isCollectionInitialized 
                  ? "Collection is initialized and ready"
                  : "Initialize your NFT collection to get started"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isCollectionInitialized ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Collection Name</Label>
                    <Input
                      id="name"
                      placeholder="My Unique NFT Collection"
                      value={collectionForm.name}
                      onChange={(e) => setCollectionForm(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="symbol">Symbol</Label>
                    <Input
                      id="symbol"
                      placeholder="UNIQ"
                      value={collectionForm.symbol}
                      onChange={(e) => setCollectionForm(prev => ({ ...prev, symbol: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="baseUri">Base URI</Label>
                    <Input
                      id="baseUri"
                      placeholder="https://example.com/metadata/"
                      value={collectionForm.baseUri}
                      onChange={(e) => setCollectionForm(prev => ({ ...prev, baseUri: e.target.value }))}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Name</Label>
                      <p className="font-semibold">{collection?.name}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Symbol</Label>
                      <p className="font-semibold">{collection?.symbol}</p>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-sm text-muted-foreground">Base URI</Label>
                      <p className="font-mono text-sm break-all">{collection?.baseUri}</p>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-sm text-muted-foreground">Authority</Label>
                      <div className="flex items-center gap-2">
                        <code className="text-sm">{collection?.authority.toBase58()}</code>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(collection?.authority.toBase58() || '', 'Authority')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            {!isCollectionInitialized && (
              <CardFooter>
                <Button 
                  onClick={handleInitializeCollection}
                  disabled={isInitializing || !collectionForm.name || !collectionForm.symbol || !collectionForm.baseUri}
                  className="w-full"
                >
                  {isInitializing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Initializing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Initialize Collection
                    </>
                  )}
                </Button>
              </CardFooter>
            )}
          </Card>
        </TabsContent>

        {/* Mint Tab */}
        <TabsContent value="mint" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mint NFTs</CardTitle>
              <CardDescription>
                Create new NFTs with unique identifiers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mintCount">Number of NFTs to Mint</Label>
                <Input
                  id="mintCount"
                  type="number"
                  min="1"
                  max="10"
                  value={mintCount}
                  onChange={(e) => setMintCount(parseInt(e.target.value) || 1)}
                />
                <p className="text-sm text-muted-foreground">
                  Each NFT will have a unique, verifiable identifier
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleMintNFT}
                disabled={isMinting || loading}
                className="w-full"
              >
                {isMinting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Minting...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Mint {mintCount} NFT{mintCount > 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* Recently Minted NFTs */}
          {mintedNFTs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recently Minted</CardTitle>
                <CardDescription>
                  Your latest minted NFTs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {mintedNFTs.map((nft, index) => (
                      <Card key={index} className="p-3">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <Badge>Token ID: {nft.tokenId}</Badge>
                            <Badge variant="outline">
                              Unique ID: [{nft.uniqueId.join(', ')}]
                            </Badge>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Label className="text-xs">Mint:</Label>
                              <code className="text-xs">{nft.mint.toBase58().slice(0, 16)}...</code>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-4 w-4"
                                onClick={() => copyToClipboard(nft.mint.toBase58(), 'Mint address')}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs">Tx:</Label>
                              <code className="text-xs">{nft.txSignature.slice(0, 16)}...</code>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-4 w-4"
                                onClick={() => window.open(`https://explorer.solana.com/tx/${nft.txSignature}?cluster=${currentNetwork}`, '_blank')}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Search Tab */}
        <TabsContent value="search" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search by Unique ID */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Search by Unique ID</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Input
                  placeholder="e.g., 1,2,3,4"
                  value={searchUniqueId}
                  onChange={(e) => setSearchUniqueId(e.target.value)}
                />
                <Button 
                  onClick={handleSearchByUniqueId}
                  className="w-full"
                  size="sm"
                  disabled={!searchUniqueId}
                >
                  <Search className="mr-2 h-3 w-3" />
                  Search
                </Button>
              </CardContent>
            </Card>

            {/* Search by Token ID */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Search by Token ID</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Input
                  placeholder="e.g., 1"
                  type="number"
                  value={searchTokenId}
                  onChange={(e) => setSearchTokenId(e.target.value)}
                />
                <Button 
                  onClick={handleSearchByTokenId}
                  className="w-full"
                  size="sm"
                  disabled={!searchTokenId}
                >
                  <Search className="mr-2 h-3 w-3" />
                  Search
                </Button>
              </CardContent>
            </Card>

            {/* Search by Mint */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Search by Mint Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Input
                  placeholder="Mint public key"
                  value={searchMint}
                  onChange={(e) => setSearchMint(e.target.value)}
                />
                <Button 
                  onClick={handleSearchByMint}
                  className="w-full"
                  size="sm"
                  disabled={!searchMint}
                >
                  <Search className="mr-2 h-3 w-3" />
                  Search
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Search Results */}
          {searchResults && (
            <Card>
              <CardHeader>
                <CardTitle>Search Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {searchResults.type === 'uniqueId' && (
                    <>
                      <div className="flex justify-between">
                        <Label>Unique ID:</Label>
                        <span>[{searchResults.uniqueId.join(', ')}]</span>
                      </div>
                      <div className="flex justify-between">
                        <Label>Exists:</Label>
                        <Badge variant={searchResults.exists ? "default" : "secondary"}>
                          {searchResults.exists ? "Yes" : "No"}
                        </Badge>
                      </div>
                      {searchResults.tokenId !== null && (
                        <div className="flex justify-between">
                          <Label>Token ID:</Label>
                          <span>{searchResults.tokenId}</span>
                        </div>
                      )}
                    </>
                  )}
                  
                  {searchResults.type === 'tokenId' && (
                    <>
                      <div className="flex justify-between">
                        <Label>Token ID:</Label>
                        <span>{searchResults.tokenId}</span>
                      </div>
                      <div className="flex justify-between">
                        <Label>Unique ID:</Label>
                        <span>
                          {searchResults.uniqueId 
                            ? `[${searchResults.uniqueId.join(', ')}]`
                            : 'Not found'}
                        </span>
                      </div>
                    </>
                  )}
                  
                  {searchResults.type === 'mint' && (
                    <>
                      <div className="flex justify-between">
                        <Label>Mint:</Label>
                        <code className="text-sm">{searchResults.mint.slice(0, 8)}...</code>
                      </div>
                      <div className="flex justify-between">
                        <Label>Unique ID:</Label>
                        <span>
                          {searchResults.uniqueId 
                            ? `[${searchResults.uniqueId.join(', ')}]`
                            : 'Not found'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mapping History</CardTitle>
              <CardDescription>
                All unique ID to token ID mappings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {collection && collection.uniqueIdToTokenId.length > 0 ? (
                <Table>
                  <TableCaption>Complete mapping of unique IDs to token IDs</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Token ID</TableHead>
                      <TableHead>Unique ID</TableHead>
                      <TableHead>Mint Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collection.tokenIdToUniqueId.map((item, index) => {
                      const mint = collection.mintToUniqueId[index];
                      // Convert BN to number for display
                      const tokenId = typeof item.tokenId === 'object' 
                        ? item.tokenId.toString() 
                        : item.tokenId.toString();
                      
                      return (
                        <TableRow key={index}>
                          <TableCell>{tokenId}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              [{item.uniqueId.join(', ')}]
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {mint && (
                              <div className="flex items-center gap-2">
                                <code className="text-xs">
                                  {mint.mint.toBase58().slice(0, 8)}...
                                </code>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-4 w-4"
                                  onClick={() => copyToClipboard(mint.mint.toBase58(), 'Mint address')}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    No NFTs minted yet. Mint your first NFT to see the history.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );

  console.log('[UniqueIdManager] === COMPONENT RENDER END ===');
};