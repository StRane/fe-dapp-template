// lib/useUniqueId.ts
import { useState, useEffect, useCallback } from 'react';
import { useAppKitAccount, useAppKitNetwork, useAppKitProvider } from '@reown/appkit/react';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import {
  PublicKey,
  Keypair,
  Commitment,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import { AnchorWallet } from '@solana/wallet-adapter-react';

import type { UniqueLow } from '@/types/unique_low';
import IDL from '@/idl/unique_low.json';

// Import stores
import {
  useNetworkStore,
  selectConnection,
  selectCurrentNetwork,
  selectIsSolanaNetwork,
  selectIsNetworkReady
} from '@/store/networkStore';

import {
  useUniqueIdStore,
  selectUniqueIdState,
  selectCollectionData,
  selectNFTData,
  type Collection,
  type UserState,
  type MintedNFT
} from '@/store/uniqueIdStore';

const CONFIG = {
  PROGRAM_ID: '5XdsDEXPiHndfBkrvJKjsFZy3Zf95bUZLRZQvJ4W6Bpa',
  COLLECTION_SEED: Buffer.from("collection"),
  USER_STATE_SEED: Buffer.from("user_state"),
  // Hardcoded collection PDA from your config
  COLLECTION_PDA: new PublicKey("EoZ5NFigrZ7uqUUSH6ShDsYGMooe5ziTfgWvAbFmVTXt"),
};

export interface UseUniqueIdReturn {
  // Network state from network store
  connection: any | null;
  currentNetwork: string | null;
  isSolanaNetwork: boolean;
  isNetworkReady: boolean;

  // UniqueId state from uniqueId store
  program: Program<UniqueLow> | null;
  collection: Collection | null;
  userState: UserState | null;
  totalSupply: number;
  userNonce: number;
  isCollectionInitialized: boolean;
  loading: boolean;
  error: string | null;

  // AppKit state
  isConnected: boolean;
  walletAddress: string | undefined;

  // Local state (specific to this hook)
  userStatePda: PublicKey | null;

  // Computed values
  programId: string;

  // Functions
  initializeCollection: (name: string, symbol: string, baseUri: string) => Promise<string | null>;
  mintNFT: () => Promise<MintedNFT | null>;
  mintMultipleNFTs: (count: number) => Promise<MintedNFT[] | null>;
  uniqueIdExists: (uniqueId: number[]) => Promise<boolean>;
  getTokenIdByUniqueId: (uniqueId: number[]) => Promise<number | null>;
  getUniqueIdByTokenId: (tokenId: number) => Promise<number[] | null>;
  getUniqueIdByMint: (mint: PublicKey) => Promise<number[] | null>;
  refreshData: () => Promise<void>;
}

export const useUniqueId = (): UseUniqueIdReturn => {
  console.log('[useUniqueId] === HOOK CALL START ===');
  
  // AppKit hooks (wallet info only)
  const { address, isConnected } = useAppKitAccount();
  const { caipNetwork } = useAppKitNetwork();
  const { walletProvider } = useAppKitProvider<AnchorWallet>('solana');

  console.log('[useUniqueId] AppKit state:', {
    isConnected,
    address: address?.slice(0, 8),
    hasWalletProvider: !!walletProvider,
    networkName: caipNetwork?.name
  });

  // Network store (shared across all programs)
  const connection = useNetworkStore((state) => state.connection);
  const currentNetwork = useNetworkStore((state) => state.currentNetwork);
  const isSolanaNetwork = useNetworkStore((state) => state.isSolanaNetwork);
  const isNetworkReady = useNetworkStore((state) => state.isReady);
  const { syncNetworkFromAppKit } = useNetworkStore();

  console.log('[useUniqueId] Network store state:', {
    hasConnection: !!connection,
    connectionRpc: connection?.rpcEndpoint,
    currentNetwork,
    isSolanaNetwork,
    isNetworkReady
  });

  // UniqueId store (program-specific)
  const program = useUniqueIdStore((state) => state.program);
  const collection = useUniqueIdStore((state) => state.collection);
  const userState = useUniqueIdStore((state) => state.userState);
  const totalSupply = useUniqueIdStore((state) => state.totalSupply);
  const userNonce = useUniqueIdStore((state) => state.userNonce);
  const isCollectionInitialized = useUniqueIdStore((state) => state.isCollectionInitialized);
  const loading = useUniqueIdStore((state) => state.loading);
  const error = useUniqueIdStore((state) => state.error);

  const {
    setProgram,
    setCollection,
    setUserState,
    setIsCollectionInitialized,
    setLoading,
    setError,
    syncWithNetwork
  } = useUniqueIdStore();

  console.log('[useUniqueId] UniqueId store state:', {
    hasProgram: !!program,
    hasCollection: !!collection,
    isCollectionInitialized,
    totalSupply,
    userNonce,
    loading,
    hasError: !!error
  });

  // Local state (specific to this hook)
  const [userStatePda, setUserStatePda] = useState<PublicKey | null>(null);

  const programId = new PublicKey(CONFIG.PROGRAM_ID);

  console.log('[useUniqueId] Derived values:', {
    programId: programId.toBase58(),
    collectionPda: CONFIG.COLLECTION_PDA.toBase58(),
    userStatePda: userStatePda?.toBase58()
  });

  // Network sync - happens in component, following TokenManager pattern
  useEffect(() => {
    console.log('[useUniqueId] === NETWORK SYNC EFFECT START ===');
    console.log('[useUniqueId] Network sync inputs:', {
      isConnected,
      networkName: caipNetwork?.name,
      networkId: caipNetwork?.id
    });

    if (isConnected && (caipNetwork?.name || caipNetwork?.id)) {
      console.log('[useUniqueId] Triggering network sync from AppKit');
      syncNetworkFromAppKit(
        caipNetwork?.name || null,
        caipNetwork?.id?.toString() || null
      );
    }
    console.log('[useUniqueId] === NETWORK SYNC EFFECT END ===');
  }, [isConnected, caipNetwork?.name, caipNetwork?.id, syncNetworkFromAppKit]);

  // Store sync - trigger when network state changes
  useEffect(() => {
    console.log('[useUniqueId] === STORE SYNC EFFECT START ===');
    console.log('[useUniqueId] Store sync trigger conditions:', {
      isConnected,
      isNetworkReady,
      hasAddress: !!address
    });

    if (isConnected && isNetworkReady && address) {
      console.log('[useUniqueId] Triggering store sync');
      syncWithNetwork();
    }
    console.log('[useUniqueId] === STORE SYNC EFFECT END ===');
  }, [isConnected, isNetworkReady, address, syncWithNetwork]);

  // Initialize program when network is ready
  useEffect(() => {
    const initializeProgram = async () => {
      console.log('[useUniqueId] === PROGRAM INIT EFFECT START ===');
      console.log('[useUniqueId] Program initialization check:', {
        isConnected,
        hasAddress: !!address,
        hasConnection: !!connection,
        hasWalletProvider: !!walletProvider,
        isNetworkReady,
        hasExistingProgram: !!program,
        connectionRpc: connection?.rpcEndpoint
      });

      if (!isConnected || !address || !connection || !walletProvider || !isNetworkReady) {
        console.log('[useUniqueId] Program init conditions not met, clearing state');
        if (program) {
          console.log('[useUniqueId] Clearing existing program state');
          setProgram(null);
          setUserStatePda(null);
        }
        console.log('[useUniqueId] === PROGRAM INIT EFFECT END (early) ===');
        return;
      }

      // Don't reinitialize if program already exists for this network
      if (program && userStatePda) {
        console.log('[useUniqueId] Program already initialized, skipping');
        console.log('[useUniqueId] === PROGRAM INIT EFFECT END (existing) ===');
        return;
      }

      try {
        setLoading(true);
        setError(null);

        console.log('[useUniqueId] Initializing program...');

        const anchorProvider = new AnchorProvider(
          connection,
          walletProvider as AnchorWallet,
          { commitment: 'confirmed' as Commitment }
        );

        const newProgram = new Program<UniqueLow>(
          IDL as UniqueLow,
          anchorProvider
        );

        // Derive user state PDA
        const [derivedUserStatePda] = PublicKey.findProgramAddressSync(
          [CONFIG.USER_STATE_SEED, new PublicKey(address).toBuffer()],
          programId
        );

        console.log('[useUniqueId] Derived PDAs:', {
          collectionPda: CONFIG.COLLECTION_PDA.toBase58(),
          userStatePda: derivedUserStatePda.toBase58(),
          programId: programId.toBase58()
        });

        // Update stores
        setProgram(newProgram);
        setUserStatePda(derivedUserStatePda);

        console.log('[useUniqueId] Program initialized successfully:', {
          programId: programId.toBase58(),
          collectionPda: CONFIG.COLLECTION_PDA.toBase58(),
          userStatePda: derivedUserStatePda.toBase58(),
          userAddress: address,
          network: currentNetwork,
        });

        // Load initial data
        await refreshData();

      } catch (err) {
        console.error('[useUniqueId] Failed to initialize program:', err);
        setError(`Failed to initialize: ${(err as Error).message}`);
      } finally {
        setLoading(false);
      }
      console.log('[useUniqueId] === PROGRAM INIT EFFECT END ===');
    };

    initializeProgram();
  }, [
    isConnected,
    address,
    connection?.rpcEndpoint, // Use stable property instead of connection object
    walletProvider?.publicKey, // Use stable property instead of walletProvider object
    isNetworkReady,
    currentNetwork,
    program, // This is fine - checking if program exists
  ]);

  // Initialize collection (only needs to be called once ever!)
  const initializeCollection = useCallback(async (
    name: string,
    symbol: string,
    baseUri: string
  ): Promise<string | null> => {
    console.log('[useUniqueId] === INITIALIZE COLLECTION START ===');
    console.log('[useUniqueId] Initialize collection inputs:', { name, symbol, baseUri });

    if (!program || !address) {
      const errorMsg = 'Program not initialized or wallet not connected';
      console.error('[useUniqueId] Initialize collection failed:', errorMsg);
      setError(errorMsg);
      return null;
    }

    if (isCollectionInitialized) {
      const errorMsg = 'Collection already initialized';
      console.error('[useUniqueId] Initialize collection failed:', errorMsg);
      setError(errorMsg);
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // Generate a random Wormhole program ID (or use a real one if you have it)
      const wormholeProgramId = Keypair.generate().publicKey;

      console.log('[useUniqueId] Initializing collection with params:', {
        name,
        symbol,
        baseUri,
        authority: address,
        wormholeProgramId: wormholeProgramId.toBase58(),
        network: currentNetwork
      });

      const tx = await program.methods
        .initialize(name, symbol, baseUri, wormholeProgramId)
        .accounts({
          authority: new PublicKey(address),
        })
        .rpc({
          commitment: 'confirmed',
          skipPreflight: false,
        });

      console.log('[useUniqueId] Collection initialized successfully! TX:', tx);

      // Refresh to load the new collection data
      await refreshData();

      console.log('[useUniqueId] === INITIALIZE COLLECTION END (success) ===');
      return tx;
    } catch (err) {
      console.error('[useUniqueId] Error initializing collection:', err);
      setError(`Failed to initialize: ${(err as Error).message}`);
      console.log('[useUniqueId] === INITIALIZE COLLECTION END (error) ===');
      return null;
    } finally {
      setLoading(false);
    }
  }, [program, address, isCollectionInitialized, currentNetwork, setLoading, setError]);

  // Refresh all data
  const refreshData = useCallback(async () => {
    console.log('[useUniqueId] === REFRESH DATA START ===');
    console.log('[useUniqueId] Refresh data conditions:', {
      hasProgram: !!program,
      hasUserStatePda: !!userStatePda,
      hasConnection: !!connection
    });

    if (!userStatePda || !connection || !program) {
      console.log('[useUniqueId] Refresh data - missing dependencies, skipping');
      console.log('[useUniqueId] === REFRESH DATA END (early) ===');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('[useUniqueId] Fetching collection data from:', CONFIG.COLLECTION_PDA.toBase58());
      
      // Fetch collection data
      const collectionData = await program.account.collection.fetchNullable(CONFIG.COLLECTION_PDA);
      if (collectionData) {
        console.log('[useUniqueId] Collection data loaded:', {
          name: collectionData.name,
          totalSupply: collectionData.totalSupply.toNumber(),
          authority: collectionData.authority.toBase58()
        });
        setCollection(collectionData as Collection);
        setIsCollectionInitialized(true);
      } else {
        console.log('[useUniqueId] Collection not found - needs initialization');
        setIsCollectionInitialized(false);
      }

      console.log('[useUniqueId] Fetching user state from:', userStatePda.toBase58());
      
      // Fetch user state
      const userStateData = await program.account.userState.fetchNullable(userStatePda);
      if (userStateData) {
        console.log('[useUniqueId] User state loaded:', {
          nonce: userStateData.nonce.toNumber()
        });
        setUserState({ nonce: userStateData.nonce.toNumber() } as UserState);
      } else {
        console.log('[useUniqueId] User state not found - will be created on first mint');
        setUserState(null);
      }

    } catch (err) {
      console.error('[useUniqueId] Error fetching data:', err);
      setError(`Failed to fetch data: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
    console.log('[useUniqueId] === REFRESH DATA END ===');
  }, [program, userStatePda, connection, setCollection, setUserState, setIsCollectionInitialized, setLoading, setError]);

  // Mint single NFT
  const mintNFT = useCallback(async (): Promise<MintedNFT | null> => {
    console.log('[useUniqueId] === MINT NFT START ===');

    if (!program || !address || !userStatePda || !walletProvider) {
      const errorMsg = 'Wallet not connected or program not initialized';
      console.error('[useUniqueId] Mint NFT failed:', errorMsg);
      setError(errorMsg);
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const userPublicKey = new PublicKey(address);
      const mintKeypair = Keypair.generate();

      const tokenAccount = await getAssociatedTokenAddress(
        mintKeypair.publicKey,
        userPublicKey,
        false,
        TOKEN_PROGRAM_ID
      );

      console.log('[useUniqueId] Minting NFT with params:', {
        mint: mintKeypair.publicKey.toBase58(),
        user: userPublicKey.toBase58(),
        tokenAccount: tokenAccount.toBase58()
      });

      // Build and send transaction
      const tx = await program.methods
        .mintNft()
        .accounts({
          mint: mintKeypair.publicKey,
          user: userPublicKey,
        })
        .signers([mintKeypair])
        .rpc();

      console.log('[useUniqueId] Mint transaction successful:', tx);

      // Refresh data to get updated state
      await refreshData();

      // Get the unique ID for this mint
      const collectionData = await program.account.collection.fetch(CONFIG.COLLECTION_PDA);
      const mintMapping = collectionData.mintToUniqueId.find(
        m => m.mint.toBase58() === mintKeypair.publicKey.toBase58()
      );

      const nftData: MintedNFT = {
        mint: mintKeypair.publicKey,
        tokenAccount,
        tokenId: collectionData.totalSupply.toNumber(),
        uniqueId: mintMapping?.uniqueId || [],
        txSignature: tx,
      };

      console.log('[useUniqueId] NFT minted successfully:', nftData);
      console.log('[useUniqueId] === MINT NFT END (success) ===');
      return nftData;
    } catch (err) {
      console.error('[useUniqueId] Error minting NFT:', err);
      setError(`Failed to mint NFT: ${(err as Error).message}`);
      console.log('[useUniqueId] === MINT NFT END (error) ===');
      return null;
    } finally {
      setLoading(false);
    }
  }, [program, address, userStatePda, walletProvider, refreshData, setLoading, setError]);

  // Mint multiple NFTs
  const mintMultipleNFTs = useCallback(async (count: number): Promise<MintedNFT[] | null> => {
    console.log('[useUniqueId] === MINT MULTIPLE NFTS START ===');
    console.log('[useUniqueId] Minting count:', count);

    const mintedNFTs: MintedNFT[] = [];

    for (let i = 0; i < count; i++) {
      console.log(`[useUniqueId] Minting NFT ${i + 1}/${count}`);
      const nft = await mintNFT();
      if (nft) {
        mintedNFTs.push(nft);
      } else {
        console.log(`[useUniqueId] Failed to mint NFT ${i + 1}, stopping batch`);
        break; // Stop if minting fails
      }
    }

    console.log('[useUniqueId] Batch mint completed:', {
      requested: count,
      successful: mintedNFTs.length
    });
    console.log('[useUniqueId] === MINT MULTIPLE NFTS END ===');

    return mintedNFTs.length > 0 ? mintedNFTs : null;
  }, [mintNFT]);

  // View functions
  const uniqueIdExists = useCallback(async (uniqueId: number[]): Promise<boolean> => {
    console.log('[useUniqueId] Checking unique ID exists:', uniqueId);
    
    if (!program) {
      console.log('[useUniqueId] No program, returning false');
      return false;
    }

    try {
      const exists = await program.methods
        .uniqueIdExists(uniqueId)
        .accounts({
          collection: CONFIG.COLLECTION_PDA,
        })
        .view();

      console.log('[useUniqueId] Unique ID exists result:', { uniqueId, exists });
      return exists;
    } catch (err) {
      console.error('[useUniqueId] Error checking unique ID:', err);
      return false;
    }
  }, [program]);

  const getTokenIdByUniqueId = useCallback(async (uniqueId: number[]): Promise<number | null> => {
    console.log('[useUniqueId] Getting token ID by unique ID:', uniqueId);
    
    if (!program) {
      console.log('[useUniqueId] No program, returning null');
      return null;
    }

    try {
      const tokenId = await program.methods
        .getTokenIdByUniqueId(uniqueId)
        .accounts({
          collection: CONFIG.COLLECTION_PDA,
        })
        .view();

      const result = tokenId.toNumber();
      console.log('[useUniqueId] Token ID result:', { uniqueId, tokenId: result });
      return result;
    } catch (err) {
      console.error('[useUniqueId] Error getting token ID:', err);
      return null;
    }
  }, [program]);

  const getUniqueIdByTokenId = useCallback(async (tokenId: number): Promise<number[] | null> => {
    console.log('[useUniqueId] Getting unique ID by token ID:', tokenId);
    
    if (!collection) {
      console.log('[useUniqueId] No collection data, returning null');
      return null;
    }

    const mapping = collection.tokenIdToUniqueId.find(
      m => m.tokenId === tokenId
    );

    const result = mapping?.uniqueId || null;
    console.log('[useUniqueId] Unique ID by token ID result:', { tokenId, uniqueId: result });
    return result;
  }, [collection]);

  const getUniqueIdByMint = useCallback(async (mint: PublicKey): Promise<number[] | null> => {
    console.log('[useUniqueId] Getting unique ID by mint:', mint.toBase58());
    
    if (!collection) {
      console.log('[useUniqueId] No collection data, returning null');
      return null;
    }

    const mapping = collection.mintToUniqueId.find(
      m => m.mint.toBase58() === mint.toBase58()
    );

    const result = mapping?.uniqueId || null;
    console.log('[useUniqueId] Unique ID by mint result:', { mint: mint.toBase58(), uniqueId: result });
    return result;
  }, [collection]);

  console.log('[useUniqueId] === HOOK CALL END ===');

  return {
    // Network state from network store
    connection,
    currentNetwork,
    isSolanaNetwork,
    isNetworkReady,

    // UniqueId state from uniqueId store
    program,
    collection,
    userState,
    totalSupply,
    userNonce,
    isCollectionInitialized,
    loading,
    error,

    // AppKit state
    isConnected: isConnected && isSolanaNetwork,
    walletAddress: address,

    // Local state
    userStatePda,

    // Computed values
    programId: CONFIG.PROGRAM_ID,

    // Functions
    initializeCollection,
    mintNFT,
    mintMultipleNFTs,
    uniqueIdExists,
    getTokenIdByUniqueId,
    getUniqueIdByTokenId,
    getUniqueIdByMint,
    refreshData,
  };
};
