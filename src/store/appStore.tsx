import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { Program } from '@coral-xyz/anchor';
import {
    PublicKey,
    Connection,
} from '@solana/web3.js';
import type { TestToken } from '@/types/test_token';
import type { UniqueLow } from '../types/unique_low';
import type { SimpleVault } from '@/types/simple_vault';

const CONFIG = {
    // Your test token program ID
    PROGRAM_ID: 'HY3dPfn3MJqLSbQm4jExye2H8KZag8AkD2AmBXgL2SKm', // From your lib.rs

    RPC_ENDPOINTS: {
        'solana-testnet': 'https://api.testnet.solana.com',
        'solana-devnet': 'https://api.devnet.solana.com',
        'solana-mainnet': 'https://api.mainnet-beta.solana.com',
        'solana-localnet': 'http://localhost:8899',
        'Solana Local': 'http://localhost:8899',
    },

    // Seeds
    MINT_AUTH_SEED: Buffer.from("mint_auth"),
};

// Types for each program state (keep these unchanged)
export interface UniqueIdState {
  program: Program<UniqueLow> | null;
  collection: any | null; // Your Collection type
  userNFTs: any[]; // Your NFT types
  totalSupply: number;
  userNonce: number;
  isCollectionInitialized: boolean;
  loading: boolean;
  error: string | null;
}

export interface VaultState {
  program: Program<SimpleVault> | null;
  vault: any | null; // Your VaultData type
  userPositions: any[]; // Your vault positions
  selectedNFT: PublicKey | null;
  loading: boolean;
  error: string | null;
}

export interface TokenState {
  program: Program<TestToken> | null;
  mintAuthPda: PublicKey | null;
  tokenInfo: any | null; // Your TokenInfo type
  userTokens: Array<{
    mint: PublicKey;
    balance: number;
    account: PublicKey;
    decimals: number;
  }>;
  selectedToken: PublicKey | null;
  loading: boolean;
  error: string | null;
}

// Simplified - only connection and network
export interface NetworkState {
  currentNetwork: string | null;
  connection: Connection | null;
  isSolanaNetwork: boolean;
}

export interface AppStore {
  // Global state
  initialized: boolean;
  globalLoading: boolean;
  globalError: string | null;
  
  // Network & Connection (only these for external state)
  network: NetworkState;
  
  // Program states (keep these)
  uniqueId: UniqueIdState;
  vault: VaultState;
  token: TokenState;
  
  // Global Actions
  setInitialized: (initialized: boolean) => void;
  setGlobalLoading: (loading: boolean) => void;
  setGlobalError: (error: string | null) => void;
  reset: () => void;
  
  // Network & Connection Actions
  setCurrentNetwork: (network: string | null) => void;
  setConnection: (connection: Connection | null) => void;
  setIsSolanaNetwork: (isSolana: boolean) => void;
  syncNetworkFromAppKit: (networkName: string | null, caipNetworkId: string | null) => void;
  updateNetworkState: (updates: Partial<NetworkState>) => void;
  
  // Unique ID Actions (keep all existing)
  setUniqueIdProgram: (program: Program<UniqueLow> | null) => void;
  setUniqueIdCollection: (collection: any) => void;
  setUniqueIdNFTs: (nfts: any[]) => void;
  setUniqueIdStats: (totalSupply: number, userNonce: number, isInitialized: boolean) => void;
  setUniqueIdLoading: (loading: boolean) => void;
  setUniqueIdError: (error: string | null) => void;
  updateUniqueIdState: (updates: Partial<Omit<UniqueIdState, 'loading' | 'error'>>) => void;
  
  // Vault Actions (keep all existing)
  setVaultProgram: (program: Program<SimpleVault> | null) => void;
  setVaultData: (vault: any) => void;
  setVaultPositions: (positions: any[]) => void;
  setSelectedNFT: (nft: PublicKey | null) => void;
  setVaultLoading: (loading: boolean) => void;
  setVaultError: (error: string | null) => void;
  updateVaultState: (updates: Partial<Omit<VaultState, 'loading' | 'error'>>) => void;
  
  // Token Actions (keep all existing)
  setTokenProgram: (program: Program<TestToken> | null) => void;
  setTokenMintAuth: (mintAuthPda: PublicKey | null) => void;
  setTokenInfo: (tokenInfo: any) => void;
  setUserTokens: (tokens: Array<{ mint: PublicKey; balance: number; account: PublicKey; decimals: number }>) => void;
  setSelectedToken: (token: PublicKey | null) => void;
  setTokenLoading: (loading: boolean) => void;
  setTokenError: (error: string | null) => void;
  updateTokenState: (updates: Partial<Omit<TokenState, 'loading' | 'error'>>) => void;
  
  // Computed getters (updated)
  isAnyLoading: () => boolean;
  hasAnyError: () => boolean;
  getAllErrors: () => string[];
  isNetworkReady: () => boolean;
}

// Initial states
const initialUniqueIdState: UniqueIdState = {
  program: null,
  collection: null,
  userNFTs: [],
  totalSupply: 0,
  userNonce: 0,
  isCollectionInitialized: false,
  loading: false,
  error: null,
};

const initialVaultState: VaultState = {
  program: null,
  vault: null,
  userPositions: [],
  selectedNFT: null,
  loading: false,
  error: null,
};

const initialTokenState: TokenState = {
  program: null,
  mintAuthPda: null,
  tokenInfo: null,
  userTokens: [],
  selectedToken: null,
  loading: false,
  error: null,
};

const initialNetworkState: NetworkState = {
  currentNetwork: null,
  connection: null,
  isSolanaNetwork: false,
};

// Create the store
export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        initialized: false,
        globalLoading: false,
        globalError: null,
        
        network: initialNetworkState,
        uniqueId: initialUniqueIdState,
        vault: initialVaultState,
        token: initialTokenState,
        
        // Global Actions
        setInitialized: (initialized) => set({ initialized }),
        
        setGlobalLoading: (loading) => set({ globalLoading: loading }),
        
        setGlobalError: (error) => set({ globalError: error }),
        
        reset: () => set((state) => {
          state.initialized = false;
          state.globalLoading = false;
          state.globalError = null;
          state.network = initialNetworkState;
          state.uniqueId = initialUniqueIdState;
          state.vault = initialVaultState;
          state.token = initialTokenState;
        }),
        
        // Network & Connection Actions
        setCurrentNetwork: (network) => set((state) => {
          state.network.currentNetwork = network;
          
          // Clear connection when network changes (will be set by setConnection)
          if (network === null) {
            state.network.connection = null;
          }
        }),
        
        setConnection: (connection) => set((state) => {
          state.network.connection = connection;
        }),
        
        setIsSolanaNetwork: (isSolana) => set((state) => {
          state.network.isSolanaNetwork = isSolana;
        }),

        // New centralized method to sync network from AppKit
        syncNetworkFromAppKit: (networkName, caipNetworkId) => set((state) => {
          const isSolanaNetwork = caipNetworkId?.includes('solana') || false;
          
          console.log('Syncing network to store:', { networkName, caipNetworkId, isSolanaNetwork });
          
          // Update network detection
          state.network.isSolanaNetwork = isSolanaNetwork;
          
          if (isSolanaNetwork && networkName) {
            // Only update if network actually changed to avoid unnecessary connection recreation
            if (state.network.currentNetwork !== networkName) {
              state.network.currentNetwork = networkName;
              
              // Create new connection
              const rpcUrl = CONFIG.RPC_ENDPOINTS[networkName as keyof typeof CONFIG.RPC_ENDPOINTS]
                || CONFIG.RPC_ENDPOINTS['solana-testnet'];
              const newConnection = new Connection(rpcUrl, 'confirmed');
              state.network.connection = newConnection;
              
              console.log('Network connection updated in store:', networkName, rpcUrl);
            }
          } else {
            // Not on Solana network - clear everything
            state.network.currentNetwork = null;
            state.network.connection = null;
            
            // Also clear all program states when leaving Solana
            state.uniqueId = initialUniqueIdState;
            state.vault = initialVaultState;
            state.token = initialTokenState;
          }
        }),
        
        updateNetworkState: (updates) => set((state) => {
          Object.assign(state.network, updates);
        }),
        
        // Unique ID Actions (keep all existing)
        setUniqueIdProgram: (program) => set((state) => {
          state.uniqueId.program = program;
        }),
        
        setUniqueIdCollection: (collection) => set((state) => {
          state.uniqueId.collection = collection;
        }),
        
        setUniqueIdNFTs: (nfts) => set((state) => {
          state.uniqueId.userNFTs = nfts;
        }),
        
        setUniqueIdStats: (totalSupply, userNonce, isInitialized) => set((state) => {
          state.uniqueId.totalSupply = totalSupply;
          state.uniqueId.userNonce = userNonce;
          state.uniqueId.isCollectionInitialized = isInitialized;
        }),
        
        setUniqueIdLoading: (loading) => set((state) => {
          state.uniqueId.loading = loading;
        }),
        
        setUniqueIdError: (error) => set((state) => {
          state.uniqueId.error = error;
        }),
        
        updateUniqueIdState: (updates) => set((state) => {
          Object.assign(state.uniqueId, updates);
        }),
        
        // Vault Actions (keep all existing)
        setVaultProgram: (program) => set((state) => {
          state.vault.program = program;
        }),
        
        setVaultData: (vault) => set((state) => {
          state.vault.vault = vault;
        }),
        
        setVaultPositions: (positions) => set((state) => {
          state.vault.userPositions = positions;
        }),
        
        setSelectedNFT: (nft) => set((state) => {
          state.vault.selectedNFT = nft;
        }),
        
        setVaultLoading: (loading) => set((state) => {
          state.vault.loading = loading;
        }),
        
        setVaultError: (error) => set((state) => {
          state.vault.error = error;
        }),
        
        updateVaultState: (updates) => set((state) => {
          Object.assign(state.vault, updates);
        }),
        
        // Token Actions (keep all existing)
        setTokenProgram: (program) => set((state) => {
          state.token.program = program;
        }),
        
        setTokenMintAuth: (mintAuthPda) => set((state) => {
          state.token.mintAuthPda = mintAuthPda;
        }),
        
        setTokenInfo: (tokenInfo) => set((state) => {
          state.token.tokenInfo = tokenInfo;
        }),
        
        setUserTokens: (tokens) => set((state) => {
          state.token.userTokens = tokens;
        }),
        
        setSelectedToken: (token) => set((state) => {
          state.token.selectedToken = token;
        }),
        
        setTokenLoading: (loading) => set((state) => {
          state.token.loading = loading;
        }),
        
        setTokenError: (error) => set((state) => {
          state.token.error = error;
        }),
        
        updateTokenState: (updates) => set((state) => {
          Object.assign(state.token, updates);
        }),
        
        // Computed getters (updated)
        isAnyLoading: () => {
          const state = get();
          return state.globalLoading || 
                 state.uniqueId.loading || 
                 state.vault.loading || 
                 state.token.loading;
        },
        
        hasAnyError: () => {
          const state = get();
          return !!(state.globalError || 
                   state.uniqueId.error || 
                   state.vault.error || 
                   state.token.error);
        },
        
        getAllErrors: () => {
          const state = get();
          return [
            state.globalError,
            state.uniqueId.error,
            state.vault.error,
            state.token.error,
          ].filter(Boolean) as string[];
        },
        
        isNetworkReady: () => {
          const state = get();
          return !!(state.network.currentNetwork && state.network.connection && state.network.isSolanaNetwork);
        },
      })),
      {
        name: 'app-store', // localStorage key
        partialize: (state) => ({
          // Only persist network preference
          network: {
            currentNetwork: state.network.currentNetwork,
            // Don't persist connection object or isSolanaNetwork
          },
        }),
      }
    ),
    {
      name: 'app-store', // DevTools name
    }
  )
);

// Updated selectors
export const selectNetwork = (state: AppStore) => state.network;
export const selectConnection = (state: AppStore) => state.network.connection;
export const selectCurrentNetwork = (state: AppStore) => state.network.currentNetwork;
export const selectIsSolanaNetwork = (state: AppStore) => state.network.isSolanaNetwork;
export const selectUniqueId = (state: AppStore) => state.uniqueId;
export const selectVault = (state: AppStore) => state.vault;
export const selectToken = (state: AppStore) => state.token;
export const selectIsLoading = (state: AppStore) => state.isAnyLoading();
export const selectErrors = (state: AppStore) => state.getAllErrors();
export const selectIsNetworkReady = (state: AppStore) => state.isNetworkReady();