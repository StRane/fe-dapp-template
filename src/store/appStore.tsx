import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { useAppKitAccount, useAppKitNetwork, useAppKitProvider } from '@reown/appkit/react';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import {
    PublicKey,
    Connection,
    Commitment,
    Keypair,
} from '@solana/web3.js';

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

// Types for each program state
export interface UniqueIdState {
  program: Program | null;
  collection: any | null; // Your Collection type
  userNFTs: any[]; // Your NFT types
  totalSupply: number;
  userNonce: number;
  isCollectionInitialized: boolean;
  loading: boolean;
  error: string | null;
}

export interface VaultState {
  program: Program | null;
  vault: any | null; // Your VaultData type
  userPositions: any[]; // Your vault positions
  selectedNFT: PublicKey | null;
  loading: boolean;
  error: string | null;
}

export interface TokenState {
  program: Program | null;
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

export interface WalletState {
  isConnected: boolean;
  walletAddress: string | null;
  currentNetwork: string | null;
  balance: number;
}

export interface AppStore {
  // Global state
  initialized: boolean;
  globalLoading: boolean;
  globalError: string | null;
  
  // Wallet & Network
  wallet: WalletState;
  
  // Program states
  uniqueId: UniqueIdState;
  vault: VaultState;
  token: TokenState;
  
  // Connection
  connection: Connection | null;
  
  // Global Actions
  setInitialized: (initialized: boolean) => void;
  setGlobalLoading: (loading: boolean) => void;
  setGlobalError: (error: string | null) => void;
  reset: () => void;
  
  // Wallet Actions  
  setWalletConnection: (connected: boolean, address: string | null, network: string | null) => void;
  updateWalletBalance: (balance: number) => void;
  
  // Connection Actions
  setConnection: (connection: Connection | null) => void;
  
  // Unique ID Actions
  setUniqueIdProgram: (program: Program | null) => void;
  setUniqueIdCollection: (collection: any) => void;
  setUniqueIdNFTs: (nfts: any[]) => void;
  setUniqueIdStats: (totalSupply: number, userNonce: number, isInitialized: boolean) => void;
  setUniqueIdLoading: (loading: boolean) => void;
  setUniqueIdError: (error: string | null) => void;
  updateUniqueIdState: (updates: Partial<Omit<UniqueIdState, 'loading' | 'error'>>) => void;
  
  // Vault Actions
  setVaultProgram: (program: Program | null) => void;
  setVaultData: (vault: any) => void;
  setVaultPositions: (positions: any[]) => void;
  setSelectedNFT: (nft: PublicKey | null) => void;
  setVaultLoading: (loading: boolean) => void;
  setVaultError: (error: string | null) => void;
  updateVaultState: (updates: Partial<Omit<VaultState, 'loading' | 'error'>>) => void;
  
  // Token Actions
  setTokenProgram: (program: Program | null) => void;
  setTokenMintAuth: (mintAuthPda: PublicKey | null) => void;
  setTokenInfo: (tokenInfo: any) => void;
  setUserTokens: (tokens: Array<{ mint: PublicKey; balance: number; account: PublicKey; decimals: number }>) => void;
  setSelectedToken: (token: PublicKey | null) => void;
  setTokenLoading: (loading: boolean) => void;
  setTokenError: (error: string | null) => void;
  updateTokenState: (updates: Partial<Omit<TokenState, 'loading' | 'error'>>) => void;
  
  // Computed getters
  isAnyLoading: () => boolean;
  hasAnyError: () => boolean;
  getAllErrors: () => string[];
  isFullyConnected: () => boolean;
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

const initialWalletState: WalletState = {
  isConnected: false,
  walletAddress: null,
  currentNetwork: null,
  balance: 0,
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
        
        wallet: initialWalletState,
        uniqueId: initialUniqueIdState,
        vault: initialVaultState,
        token: initialTokenState,
        connection: null,
        
        // Global Actions
        setInitialized: (initialized) => set({ initialized }),
        
        setGlobalLoading: (loading) => set({ globalLoading: loading }),
        
        setGlobalError: (error) => set({ globalError: error }),
        
        reset: () => set((state) => {
          state.initialized = false;
          state.globalLoading = false;
          state.globalError = null;
          state.wallet = initialWalletState;
          state.uniqueId = initialUniqueIdState;
          state.vault = initialVaultState;
          state.token = initialTokenState;
          state.connection = null;
        }),
        
        // Wallet Actions
        setWalletConnection: (connected, address, network) => set((state) => {
          state.wallet.isConnected = connected;
          state.wallet.walletAddress = address;
          state.wallet.currentNetwork = network;
          
          // Reset program states when wallet disconnects
          if (!connected) {
            state.uniqueId = initialUniqueIdState;
            state.vault = initialVaultState;
            state.token = initialTokenState;
          }
        }),
        
        updateWalletBalance: (balance) => set((state) => {
          state.wallet.balance = balance;
        }),
        
        // Connection Actions
        setConnection: (connection) => set({ connection }),
        
        // Unique ID Actions
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
        
        // Vault Actions
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
        
        // Token Actions
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
        
        // Computed getters
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
        
        isFullyConnected: () => {
          const state = get();
          return state.wallet.isConnected && 
                 !!state.wallet.walletAddress && 
                 !!state.connection;
        },
      })),
      {
        name: 'app-store', // localStorage key
        partialize: (state) => ({
          // Only persist wallet state
          wallet: {
            currentNetwork: state.wallet.currentNetwork,
          },
        }),
      }
    ),
    {
      name: 'app-store', // DevTools name
    }
  )
);

// Selectors for better performance (optional)
export const selectWallet = (state: AppStore) => state.wallet;
export const selectUniqueId = (state: AppStore) => state.uniqueId;
export const selectVault = (state: AppStore) => state.vault;
export const selectToken = (state: AppStore) => state.token;
export const selectIsLoading = (state: AppStore) => state.isAnyLoading();
export const selectErrors = (state: AppStore) => state.getAllErrors();