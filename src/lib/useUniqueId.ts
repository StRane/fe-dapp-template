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
import { useNetworkStore } from '@/store/networkStore';
import { useUniqueIdStore, type MintedNFT } from '@/store/uniqueIdStore';

const CONFIG = {
  PROGRAM_ID: '5XdsDEXPiHndfBkrvJKjsFZy3Zf95bUZLRZQvJ4W6Bpa',
  COLLECTION_SEED: Buffer.from("collection"),
  USER_STATE_SEED: Buffer.from("user_state"),
  COLLECTION_PDA: new PublicKey("EoZ5NFigrZ7uqUUSH6ShDsYGMooe5ziTfgWvAbFmVTXt"),
};

export interface UseUniqueIdReturn {
  // Store state (read-only)
  program: Program<UniqueLow> | null;
  collection: any | null;
  userState: any | null;
  totalSupply: number;
  userNonce: number;
  isCollectionInitialized: boolean;
  loading: boolean;
  error: string | null;

  // Network state (read-only)
  connection: any | null;
  currentNetwork: string | null;
  isSolanaNetwork: boolean;
  isNetworkReady: boolean;

  // AppKit state (read-only)
  isConnected: boolean;
  walletAddress: string | undefined;

  // Local state
  userStatePda: PublicKey | null;

  // Computed values
  programId: string;

  // Actions only (no direct data fetching in components)
  initializeCollection: (name: string, symbol: string, baseUri: string) => Promise<string | null>;
  mintNFT: () => Promise<MintedNFT | null>;
  mintMultipleNFTs: (count: number) => Promise<MintedNFT[] | null>;
  uniqueIdExists: (uniqueId: number[]) => Promise<boolean>;
  getTokenIdByUniqueId: (uniqueId: number[]) => Promise<number | null>;
  getUniqueIdByTokenId: (tokenId: number) => Promise<number[] | null>;
  getUniqueIdByMint: (mint: PublicKey) => Promise<number[] | null>;
  
  // Store actions
  refreshAllData: () => void;
}

export const useUniqueId = (): UseUniqueIdReturn => {
  console.log('[useUniqueId] === HOOK CALL START ===');
  
  // AppKit hooks (wallet info only)
  const { address, isConnected } = useAppKitAccount();
  const { caipNetwork } = useAppKitNetwork();
  const { walletProvider } = useAppKitProvider<AnchorWallet>('solana');

  // Network store (read-only)
  const connection = useNetworkStore((state) => state.connection);
  const currentNetwork = useNetworkStore((state) => state.currentNetwork);
  const isSolanaNetwork = useNetworkStore((state) => state.isSolanaNetwork);
  const isNetworkReady = useNetworkStore((state) => state.isReady);

  // UniqueId store (read-only + actions)
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
    syncWithNetwork,
  } = useUniqueIdStore();

  // Local state (specific to this hook)
  const [userStatePda, setUserStatePda] = useState<PublicKey | null>(null);

  const programId = new PublicKey(CONFIG.PROGRAM_ID);

  console.log('[useUniqueId] Store state:', {
    hasProgram: !!program,
    hasCollection: !!collection,
    isCollectionInitialized,
    totalSupply,
    userNonce,
    loading,
    hasError: !!error
  });

  // NOTE: Network sync removed - handled centrally by useNetworkSync
  // The store will sync when network changes through store subscriptions

  // Store sync - trigger when network state changes
  useEffect(() => {
    console.log('[useUniqueId] === STORE SYNC EFFECT START ===');
    if (isConnected && isNetworkReady && address) {
      console.log('[useUniqueId] Triggering store sync');
      syncWithNetwork();
    }
    console.log('[useUniqueId] === STORE SYNC EFFECT END ===');
  }, [isConnected, isNetworkReady, address, syncWithNetwork]);

  // Program initialization - ONLY when store sync indicates it's needed
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

      // Don't reinitialize if program already exists
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

        console.log('[useUniqueId] Program initialized successfully');

        // Trigger data loading AFTER program is set - use setTimeout to ensure state is updated
        setTimeout(() => {
          loadAllNFTData();
        }, 100);

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
    connection?.rpcEndpoint,
    walletProvider?.publicKey,
    isNetworkReady,
    currentNetwork,
    program,
    userStatePda
  ]);

  // Load all NFT data - INTERNAL function for store updates
  const loadAllNFTData = useCallback(async () => {
    console.log('[useUniqueId] === LOAD ALL NFT DATA START ===');
    
    // Get fresh values from store and local state
    const currentConnection = useNetworkStore.getState().connection;
    const currentProgram = useUniqueIdStore.getState().program;
    
    // Derive userStatePda fresh if not available
    let currentUserStatePda = userStatePda;
    if (!currentUserStatePda && address) {
      const [derivedUserStatePda] = PublicKey.findProgramAddressSync(
        [CONFIG.USER_STATE_SEED, new PublicKey(address).toBuffer()],
        programId
      );
      currentUserStatePda = derivedUserStatePda;
      setUserStatePda(derivedUserStatePda);
    }
    
    console.log('[useUniqueId] Dependencies check:', {
      hasConnection: !!currentConnection,
      hasProgram: !!currentProgram,
      hasUserStatePda: !!currentUserStatePda,
      hasAddress: !!address
    });
    
    if (!currentConnection || !currentProgram || !currentUserStatePda) {
      console.log('[useUniqueId] Missing dependencies for data loading:', {
        connection: !!currentConnection,
        program: !!currentProgram,
        userStatePda: !!currentUserStatePda
      });
      return;
    }

    try {
      setLoading(true);
      
      console.log('[useUniqueId] Fetching collection data from:', CONFIG.COLLECTION_PDA.toBase58());
      
      // Fetch collection data
      const collectionData = await currentProgram.account.collection.fetchNullable(CONFIG.COLLECTION_PDA);
      if (collectionData) {
        console.log('[useUniqueId] Collection data loaded:', {
          name: collectionData.name,
          totalSupply: collectionData.totalSupply.toNumber(),
          authority: collectionData.authority.toBase58()
        });
        setCollection(collectionData);
        setIsCollectionInitialized(true);
      } else {
        console.log('[useUniqueId] Collection not found - needs initialization');
        setIsCollectionInitialized(false);
      }

      console.log('[useUniqueId] Fetching user state from:', currentUserStatePda.toBase58());
      
      // Fetch user state
      const userStateData = await currentProgram.account.userState.fetchNullable(currentUserStatePda);
      if (userStateData) {
        console.log('[useUniqueId] User state loaded:', {
          nonce: userStateData.nonce.toNumber()
        });
        setUserState({ 
          user: currentUserStatePda,
          nonce: userStateData.nonce.toNumber() 
        });
      } else {
        console.log('[useUniqueId] User state not found - will be created on first mint');
        setUserState(null);
      }

      console.log('[useUniqueId] NFT data loaded successfully');

    } catch (err) {
      console.error('[useUniqueId] Error loading NFT data:', err);
      setError(`Failed to load NFT data: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
    
    console.log('[useUniqueId] === LOAD ALL NFT DATA END ===');
  }, [address, userStatePda, setCollection, setUserState, setIsCollectionInitialized, setLoading, setError]); // Include address in dependencies

  // Initialize collection - ACTION only, updates store automatically
  const initializeCollection = useCallback(async (
    name: string,
    symbol: string,
    baseUri: string
  ): Promise<string | null> => {
    console.log('[useUniqueId] === INITIALIZE COLLECTION START ===');
    
    if (!program || !address) {
      setError('Program not initialized or wallet not connected');
      return null;
    }

    if (isCollectionInitialized) {
      setError('Collection already initialized');
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

      // Refresh store data after successful initialization
      await loadAllNFTData();

      return tx;
    } catch (err) {
      console.error('[useUniqueId] Error initializing collection:', err);
      setError(`Failed to initialize: ${(err as Error).message}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, [program, address, isCollectionInitialized, loadAllNFTData, setLoading, setError]);

  // Mint NFT - ACTION only, updates store automatically
  const mintNFT = useCallback(async (): Promise<MintedNFT | null> => {
    console.log('[useUniqueId] === MINT NFT START ===');

    if (!program || !address || !userStatePda || !walletProvider) {
      setError('Wallet not connected or program not initialized');
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

      const tx = await program.methods
        .mintNft()
        .accounts({
          mint: mintKeypair.publicKey,
          user: userPublicKey,
        })
        .signers([mintKeypair])
        .rpc();

      console.log('[useUniqueId] Mint transaction successful:', tx);

      // Refresh store data after successful mint
      await loadAllNFTData();

      // Get the unique ID for this mint from refreshed collection data
      const currentCollection = useUniqueIdStore.getState().collection;
      const mintMapping = currentCollection?.mintToUniqueId.find(
        m => m.mint.toBase58() === mintKeypair.publicKey.toBase58()
      );

      const nftData: MintedNFT = {
        mint: mintKeypair.publicKey,
        tokenAccount,
        tokenId: currentCollection?.totalSupply.toNumber() || 0,
        uniqueId: mintMapping?.uniqueId || [],
        txSignature: tx,
      };

      console.log('[useUniqueId] NFT minted successfully:', nftData);
      return nftData;
    } catch (err) {
      console.error('[useUniqueId] Error minting NFT:', err);
      setError(`Failed to mint NFT: ${(err as Error).message}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, [program, address, userStatePda, walletProvider, loadAllNFTData, setLoading, setError]);

  // Mint multiple NFTs - ACTION only
  const mintMultipleNFTs = useCallback(async (count: number): Promise<MintedNFT[] | null> => {
    console.log('[useUniqueId] === MINT MULTIPLE NFTS START ===');
    const mintedNFTs: MintedNFT[] = [];

    for (let i = 0; i < count; i++) {
      console.log(`[useUniqueId] Minting NFT ${i + 1}/${count}`);
      const nft = await mintNFT();
      if (nft) {
        mintedNFTs.push(nft);
      } else {
        console.log(`[useUniqueId] Failed to mint NFT ${i + 1}, stopping batch`);
        break;
      }
    }

    console.log('[useUniqueId] Batch mint completed:', {
      requested: count,
      successful: mintedNFTs.length
    });

    return mintedNFTs.length > 0 ? mintedNFTs : null;
  }, [mintNFT]);

  // View functions - UTILITY functions (don't update store)
  const uniqueIdExists = useCallback(async (uniqueId: number[]): Promise<boolean> => {
    if (!program) return false;

    try {
      const exists = await program.methods
        .uniqueIdExists(uniqueId)
        .accounts({
          collection: CONFIG.COLLECTION_PDA,
        })
        .view();

      return exists;
    } catch (err) {
      console.error('[useUniqueId] Error checking unique ID:', err);
      return false;
    }
  }, [program]);

  const getTokenIdByUniqueId = useCallback(async (uniqueId: number[]): Promise<number | null> => {
    if (!program) return null;

    try {
      const tokenId = await program.methods
        .getTokenIdByUniqueId(uniqueId)
        .accounts({
          collection: CONFIG.COLLECTION_PDA,
        })
        .view();

      return tokenId.toNumber();
    } catch (err) {
      console.error('[useUniqueId] Error getting token ID:', err);
      return null;
    }
  }, [program]);

  const getUniqueIdByTokenId = useCallback(async (tokenId: number): Promise<number[] | null> => {
    if (!collection) return null;

    const mapping = collection.tokenIdToUniqueId.find(
      m => m.tokenId === tokenId
    );

    return mapping?.uniqueId || null;
  }, [collection]);

  const getUniqueIdByMint = useCallback(async (mint: PublicKey): Promise<number[] | null> => {
    if (!collection) return null;

    const mapping = collection.mintToUniqueId.find(
      m => m.mint.toBase58() === mint.toBase58()
    );

    return mapping?.uniqueId || null;
  }, [collection]);

  // Manual refresh - PUBLIC action for components
  const refreshAllData = useCallback(() => {
    console.log('[useUniqueId] Manual refresh triggered');
    if (program && userStatePda) {
      loadAllNFTData();
    }
  }, [program, userStatePda, loadAllNFTData]);

  console.log('[useUniqueId] === HOOK CALL END ===');

  return {
    // Store state (read-only)
    program,
    collection,
    userState,
    totalSupply,
    userNonce,
    isCollectionInitialized,
    loading,
    error,

    // Network state (read-only)
    connection,
    currentNetwork,
    isSolanaNetwork,
    isNetworkReady,

    // AppKit state (read-only)
    isConnected: isConnected && isSolanaNetwork,
    walletAddress: address,

    // Local state
    userStatePda,

    // Computed values
    programId: CONFIG.PROGRAM_ID,

    // Actions only
    initializeCollection,
    mintNFT,
    mintMultipleNFTs,
    uniqueIdExists,
    getTokenIdByUniqueId,
    getUniqueIdByTokenId,
    getUniqueIdByMint,
    refreshAllData,
  };
};