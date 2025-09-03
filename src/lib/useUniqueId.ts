import { useState, useEffect, useCallback } from 'react';
import { useAppKitAccount, useAppKitNetwork, useAppKitProvider } from '@reown/appkit/react';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import {
  PublicKey,
  Keypair,
  Connection,
  Commitment
} from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import { AnchorWallet } from '@solana/wallet-adapter-react'
// import type { Provider } from "@reown/appkit-adapter-solana/react";

import type { UniqueId } from '../types/unique_id';
import IDL from '../idl/unique_id.json';

// CONFIGURATION - Update with your deployed program
const CONFIG = {
  // Your deployed program ID on Solana Testnet/Devnet
  PROGRAM_ID: 'u7X6Ut4Mm9wqQ8ci2XiUjtcyqRJnHScStUo81Deh6bA', // <-- CHANGE THIS to your deployed address

  // RPC endpoints for different networks
  RPC_ENDPOINTS: {
    'solana-testnet': 'https://api.testnet.solana.com',
    'solana-devnet': 'https://api.devnet.solana.com',
    'solana-mainnet': 'https://api.mainnet-beta.solana.com',
    'solana-localnet': 'http://localhost:8899',
    'Solana Local': 'http://localhost:8899',
  },

  // Seeds
  COLLECTION_SEED: Buffer.from("collection"),
  USER_STATE_SEED: Buffer.from("user_state"),
};

// Types
export interface Collection {
  authority: PublicKey;
  name: string;
  symbol: string;
  baseUri: string;
  totalSupply: BN;
  wormholeProgramId: PublicKey;
  uniqueIdToTokenId: Array<{ uniqueId: number[], tokenId: BN }>;
  tokenIdToUniqueId: Array<{ tokenId: BN, uniqueId: number[] }>;
  mintToUniqueId: Array<{ mint: PublicKey, uniqueId: number[] }>;
}

export interface UserState {
  user: PublicKey;
  nonce: BN;
}

export interface MintedNFT {
  mint: PublicKey;
  tokenAccount: PublicKey;
  tokenId: number;
  uniqueId: number[];
  txSignature: string;
}

export interface UseUniqueIdReturn {
  // State
  program: Program<UniqueId> | null;
  collection: Collection | null;
  userState: UserState | null;
  totalSupply: number;
  userNonce: number;
  loading: boolean;
  error: string | null;
  isCollectionInitialized: boolean; // Renamed for clarity
  isConnected: boolean;
  walletAddress: string | undefined;

  // PDAs
  collectionPda: PublicKey | null;
  userStatePda: PublicKey | null;

  // Network info
  currentNetwork: string | null;
  programId: string;

  // Functions
  initializeCollection: (name: string, symbol: string, baseUri: string) => Promise<string | null>; // Added!
  mintNFT: () => Promise<MintedNFT | null>;
  mintMultipleNFTs: (count: number) => Promise<MintedNFT[] | null>;
  getNonce: () => Promise<number | null>;
  getTotalSupply: () => Promise<number | null>;
  uniqueIdExists: (uniqueId: number[]) => Promise<boolean>;
  getTokenIdByUniqueId: (uniqueId: number[]) => Promise<number | null>;
  getUniqueIdByTokenId: (tokenId: number) => Promise<number[] | null>;
  getUniqueIdByMint: (mint: PublicKey) => Promise<number[] | null>;
  refreshData: () => Promise<void>;
}

export const useUniqueId = (): UseUniqueIdReturn => {
  // AppKit hooks
  const { address, isConnected } = useAppKitAccount();
  const { caipNetwork, caipNetworkId } = useAppKitNetwork();
  const { walletProvider } = useAppKitProvider('solana');

  // State
  const [connection, setConnection] = useState<Connection | null>(null);
  const [program, setProgram] = useState<Program<UniqueId> | null>(null);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [userState, setUserState] = useState<UserState | null>(null);
  const [totalSupply, setTotalSupply] = useState<number>(0);
  const [userNonce, setUserNonce] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isCollectionInitialized, setIsCollectionInitialized] = useState<boolean>(false); // Renamed for clarity!

  // PDAs
  const [collectionPda, setCollectionPda] = useState<PublicKey | null>(null);
  const [userStatePda, setUserStatePda] = useState<PublicKey | null>(null);

  // Program ID
  const programId = new PublicKey(CONFIG.PROGRAM_ID);

  // Check if we're on Solana network
  const isSolanaNetwork = caipNetworkId?.includes('solana') || false;
  const currentNetwork = caipNetwork?.name || null;

  // Setup connection based on network
  useEffect(() => {
    if (isSolanaNetwork && currentNetwork) {
      const rpcUrl = CONFIG.RPC_ENDPOINTS[currentNetwork as keyof typeof CONFIG.RPC_ENDPOINTS] || CONFIG.RPC_ENDPOINTS['solana-testnet'];
      const newConnection = new Connection(rpcUrl, 'confirmed');
      setConnection(newConnection);
      console.log('Connected to Solana network:', currentNetwork, rpcUrl);
    }
  }, [isSolanaNetwork, currentNetwork]);

  // Initialize program when wallet and connection are ready
  useEffect(() => {
    const initializeProgram = async () => {
      if (!isConnected || !address || !connection || !walletProvider || !isSolanaNetwork) {
        setProgram(null);
        return;
      }

      try {
        // Create a custom provider using AppKit's wallet provider
        const anchorProvider = new AnchorProvider(
          connection,
          walletProvider as AnchorWallet,
          { commitment: 'confirmed' as Commitment }
        );

        // Initialize program
        const program = new Program<UniqueId>(
          IDL as UniqueId,
          anchorProvider
        );
        setProgram(program);


        // Derive PDAs
        const [collectionPda] = PublicKey.findProgramAddressSync(
          [CONFIG.COLLECTION_SEED],
          programId
        );
        setCollectionPda(collectionPda);

        const [userStatePda] = PublicKey.findProgramAddressSync(
          [CONFIG.USER_STATE_SEED, new PublicKey(address).toBuffer()],
          programId
        );
        setUserStatePda(userStatePda);

        console.log('Program initialized:', {
          programId: programId.toBase58(),
          collectionPda: collectionPda.toBase58(),
          userStatePda: userStatePda.toBase58(),
          userAddress: address,
          chainID: caipNetworkId,
        });

        // Load initial data
        await refreshData();
      } catch (err) {
        console.error('Failed to initialize program:', err);
        setError(`Failed to initialize: ${(err as Error).message}`);
      }
    };

    initializeProgram();
  }, [isConnected, address, connection, walletProvider, isSolanaNetwork]);

  // Refresh all data
  const refreshData = useCallback(async () => {
    if (!program || !collectionPda || !userStatePda || !connection) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch collection data
      const collectionData = await program.account.collection.fetchNullable(collectionPda);
      if (collectionData) {
        setCollection(collectionData as Collection);
        setTotalSupply(collectionData.totalSupply.toNumber());
        setIsCollectionInitialized(true); // Collection EXISTS on-chain
        console.log('Collection loaded:', {
          name: collectionData.name,
          totalSupply: collectionData.totalSupply.toNumber()
        });
      } else {
        setIsCollectionInitialized(false); // Collection DOESN'T EXIST yet
        console.log('Collection not created yet - need to call initialize()');
      }

      // Fetch user state
      const userStateData = await program.account.userState.fetchNullable(userStatePda);
      if (userStateData) {
        setUserState(userStateData as UserState);
        setUserNonce(userStateData.nonce.toNumber());
        console.log('User state loaded, nonce:', userStateData.nonce.toNumber());
      } else {
        console.log('User state not initialized');
        setUserNonce(0);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(`Failed to fetch data: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [program, collectionPda, userStatePda, connection]);

  // Initialize collection (only needs to be called once ever!)
  const initializeCollection = useCallback(async (
    name: string,
    symbol: string,
    baseUri: string
  ): Promise<string | null> => {
    if (!program || !address) {
      setError('Wallet not connected');
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

      console.log('Initializing collection...', {
        name,
        symbol,
        baseUri,
        authority: address,
        network: currentNetwork,
        chainId: caipNetworkId
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



      console.log('Collection initialized!', tx);

      // Refresh to load the new collection data
      await refreshData();

      return tx;
    } catch (err) {
      console.error('Error initializing collection:', (err as Error).message);
      setError(`Failed to initialize: ${err}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, [program, address, isCollectionInitialized, refreshData]);

  // Mint single NFT
  const mintNFT = useCallback(async (): Promise<MintedNFT | null> => {
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
        TOKEN_2022_PROGRAM_ID
      );

      console.log('Minting NFT...', {
        mint: mintKeypair.publicKey.toBase58(),
        user: userPublicKey.toBase58(),
      });

      // Build and send transaction
      const tx = await program.methods
        .mintNft()
        .accounts({
          mint: mintKeypair.publicKey,
          user: userPublicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([mintKeypair])
        .rpc();

      console.log('Mint transaction successful:', tx);

      // Refresh data to get updated state
      await refreshData();

      // Get the unique ID for this mint
      const collectionData = await program.account.collection.fetch(collectionPda!);
      const mintMapping = collectionData.mintToUniqueId.find(
        m => m.mint.toBase58() === mintKeypair.publicKey.toBase58()
      );

      return {
        mint: mintKeypair.publicKey,
        tokenAccount,
        tokenId: collectionData.totalSupply.toNumber(),
        uniqueId: mintMapping?.uniqueId || [],
        txSignature: tx,
      };
    } catch (err) {
      console.error('Error minting NFT:', err);
      setError(`Failed to mint NFT: ${(err as Error).message}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, [program, address, userStatePda, walletProvider, collectionPda, refreshData]);

  // Mint multiple NFTs
  const mintMultipleNFTs = useCallback(async (count: number): Promise<MintedNFT[] | null> => {
    const mintedNFTs: MintedNFT[] = [];

    for (let i = 0; i < count; i++) {
      const nft = await mintNFT();
      if (nft) {
        mintedNFTs.push(nft);
      } else {
        break; // Stop if minting fails
      }
    }

    return mintedNFTs.length > 0 ? mintedNFTs : null;
  }, [mintNFT]);

  // View functions
  const getNonce = useCallback(async (): Promise<number | null> => {
    if (!program || !userStatePda) return null;

    try {
      const nonce = await program.methods
        .getNonce()
        .accounts({
          userState: userStatePda,
        })
        .view();

      return nonce.toNumber();
    } catch (err) {
      console.error('Error getting nonce:', err);
      return null;
    }
  }, [program, userStatePda]);

  const getTotalSupply = useCallback(async (): Promise<number | null> => {
    if (!program || !collectionPda) return null;

    try {
      const totalSupply = await program.methods
        .totalSupply()
        .accounts({
          collection: collectionPda,
        })
        .view();

      return totalSupply.toNumber();
    } catch (err) {
      console.error('Error getting total supply:', err);
      return null;
    }
  }, [program, collectionPda]);

  const uniqueIdExists = useCallback(async (uniqueId: number[]): Promise<boolean> => {
    if (!program || !collectionPda) return false;

    try {
      const exists = await program.methods
        .uniqueIdExists(uniqueId)
        .accounts({
          collection: collectionPda,
        })
        .view();

      return exists;
    } catch (err) {
      console.error('Error checking unique ID:', err);
      return false;
    }
  }, [program, collectionPda]);

  const getTokenIdByUniqueId = useCallback(async (uniqueId: number[]): Promise<number | null> => {
    if (!program || !collectionPda) return null;

    try {
      const tokenId = await program.methods
        .getTokenIdByUniqueId(uniqueId)
        .accounts({
          collection: collectionPda,
        })
        .view();

      return tokenId.toNumber();
    } catch (err) {
      console.error('Error getting token ID:', err);
      return null;
    }
  }, [program, collectionPda]);

  const getUniqueIdByTokenId = useCallback(async (tokenId: number): Promise<number[] | null> => {
    if (!collection) return null;

    const mapping = collection.tokenIdToUniqueId.find(
      m => m.tokenId.toNumber() === tokenId
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

  return {
    // State
    program,
    collection,
    userState,
    totalSupply,
    userNonce,
    loading,
    error,
    isCollectionInitialized, // Renamed!
    isConnected: isConnected && isSolanaNetwork,
    walletAddress: address,

    // PDAs
    collectionPda,
    userStatePda,

    // Network info
    currentNetwork,
    programId: CONFIG.PROGRAM_ID,

    // Functions
    initializeCollection, // Added!
    mintNFT,
    mintMultipleNFTs,
    getNonce,
    getTotalSupply,
    uniqueIdExists,
    getTokenIdByUniqueId,
    getUniqueIdByTokenId,
    getUniqueIdByMint,
    refreshData,
  };
};