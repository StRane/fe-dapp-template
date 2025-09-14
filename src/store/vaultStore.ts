// stores/vaultStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { Program } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import type { SimpleVault } from '@/types/simple_vault';
import { useNetworkStore } from './networkStore';

const CONFIG = {
    PROGRAM_ID: 'B2iJWvv6hwMvVkdKm1ovTzSr52neJU9k8AQyQHVBtFRM',
    VAULT_SEED: Buffer.from("vault"),
    USER_INFO_SEED: Buffer.from("user_info"),
    BORROW_INFO_SEED: Buffer.from("borrow_info"),
    // Hardcoded addresses from your config
    COLLECTION_PDA: new PublicKey('EoZ5NFigrZ7uqUUSH6ShDsYGMooe5ziTfgWvAbFmVTXt'),
    VAULT_ASSET_MINT: new PublicKey("7Uc3xCQxiPqMHVXPrzcgUw8rrKQ7vCu5HUXL4TVRntDS"),
    VAULT_PDA: new PublicKey("Cs6Vz6BNq6HHViusWzVzK9cg1u5cCvdW3nSvDCCZJd4m"),
    SHARE_MINT: new PublicKey("Ggbz1DvG6sh5FwTCFUqc85M6RYVduivGu3BhyxVHqpP1"),
};

export interface VaultData {
    owner: PublicKey;
    assetMint: PublicKey;
    shareMint: PublicKey;
    nftCollectionAddress: PublicKey;
    bump: number;
}

export interface UserPosition {
    user: PublicKey;
    nftMint: PublicKey;
    depositAmount: number;
    shareAmount: number;
    timestamp: number;
}

export interface VaultState {
    // Program state
    program: Program<SimpleVault> | null;
    isInitialized: boolean;
    
    // Vault data
    vault: VaultData | null;
    userPositions: UserPosition[];
    selectedNFT: PublicKey | null;
    
    // UI state
    loading: boolean;
    error: string | null;
    
    // Network dependency tracking
    lastNetworkHash: string | null;
}

export interface VaultStore extends VaultState {
    // Program actions
    setProgram: (program: Program<SimpleVault> | null) => void;
    setIsInitialized: (initialized: boolean) => void;
    
    // Vault data actions
    setVault: (vault: VaultData | null) => void;
    setUserPositions: (positions: UserPosition[]) => void;
    addUserPosition: (position: UserPosition) => void;
    updateUserPosition: (nftMint: PublicKey, updates: Partial<UserPosition>) => void;
    removeUserPosition: (nftMint: PublicKey) => void;
    setSelectedNFT: (nft: PublicKey | null) => void;
    
    // UI actions
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    
    // Network synchronization
    syncWithNetwork: () => void;
    reset: () => void;
    
    // Computed getters
    getPositionByNFT: (nftMint: PublicKey) => UserPosition | null;
    getTotalDeposited: () => number;
    getTotalShares: () => number;
    hasPositions: () => boolean;
    getVaultConfig: () => typeof CONFIG;
}

const initialState: VaultState = {
    program: null,
    isInitialized: false,
    vault: null,
    userPositions: [],
    selectedNFT: null,
    loading: false,
    error: null,
    lastNetworkHash: null,
};

export const useVaultStore = create<VaultStore>()(
    devtools(
        immer((set, get) => ({
            ...initialState,

            // Program actions
            setProgram: (program) => set((state) => {
                state.program = program;
                state.isInitialized = !!program;
                console.log('[VaultStore] Program set:', !!program);
            }),

            setIsInitialized: (initialized) => set((state) => {
                state.isInitialized = initialized;
            }),

            // Vault data actions
            setVault: (vault) => set((state) => {
                state.vault = vault;
                console.log('[VaultStore] Vault data updated:', vault?.owner.toBase58());
            }),

            setUserPositions: (positions) => set((state) => {
                state.userPositions = positions;
                console.log('[VaultStore] User positions updated:', positions.length, 'positions');
            }),

            addUserPosition: (position) => set((state) => {
                const existingIndex = state.userPositions.findIndex(p => 
                    p.nftMint.toBase58() === position.nftMint.toBase58()
                );
                
                if (existingIndex >= 0) {
                    // Update existing position
                    state.userPositions[existingIndex] = position;
                } else {
                    // Add new position
                    state.userPositions.push(position);
                }
                console.log('[VaultStore] Position added/updated:', position.nftMint.toBase58());
            }),

            updateUserPosition: (nftMint, updates) => set((state) => {
                const position = state.userPositions.find(p => p.nftMint.equals(nftMint));
                if (position) {
                    Object.assign(position, updates);
                    console.log('[VaultStore] Position updated:', nftMint.toBase58(), updates);
                }
            }),

            removeUserPosition: (nftMint) => set((state) => {
                const index = state.userPositions.findIndex(p => p.nftMint.equals(nftMint));
                if (index >= 0) {
                    state.userPositions.splice(index, 1);
                    console.log('[VaultStore] Position removed:', nftMint.toBase58());
                }
            }),

            setSelectedNFT: (nft) => set((state) => {
                state.selectedNFT = nft;
                console.log('[VaultStore] Selected NFT:', nft?.toBase58());
            }),

            // UI actions
            setLoading: (loading) => set((state) => {
                state.loading = loading;
            }),

            setError: (error) => set((state) => {
                state.error = error;
                if (error) {
                    console.error('[VaultStore] Error set:', error);
                }
            }),

            // Network synchronization
            syncWithNetwork: () => set((state) => {
                const networkState = useNetworkStore.getState();
                const networkHash = `${networkState.currentNetwork}-${networkState.isReady}-${!!networkState.connection}`;
                
                console.log('[VaultStore] Syncing with network:', {
                    currentHash: state.lastNetworkHash,
                    newHash: networkHash,
                    isReady: networkState.isReady
                });

                // Check if network state changed
                if (state.lastNetworkHash !== networkHash) {
                    state.lastNetworkHash = networkHash;

                    if (!networkState.isReady || !networkState.isSolanaNetwork) {
                        // Network not ready or not Solana - clear program state
                        console.log('[VaultStore] Network not ready, clearing program state');
                        state.program = null;
                        state.isInitialized = false;
                        state.vault = null;
                        state.userPositions = [];
                        state.selectedNFT = null;
                        state.error = null;
                    } else {
                        // Network is ready - clear error and prepare for program initialization
                        console.log('[VaultStore] Network ready for program initialization');
                        state.error = null;
                        // Note: Program initialization happens in the hook, not here
                    }
                }
            }),

            reset: () => set((state) => {
                console.log('[VaultStore] Resetting state');
                Object.assign(state, initialState);
            }),

            // Computed getters
            getPositionByNFT: (nftMint) => {
                const state = get();
                return state.userPositions.find(position => position.nftMint.equals(nftMint)) || null;
            },

            getTotalDeposited: () => {
                const state = get();
                return state.userPositions.reduce((total, position) => total + position.depositAmount, 0);
            },

            getTotalShares: () => {
                const state = get();
                return state.userPositions.reduce((total, position) => total + position.shareAmount, 0);
            },

            hasPositions: () => {
                const state = get();
                return state.userPositions.length > 0;
            },

            getVaultConfig: () => CONFIG,
        })),
        { name: 'vault-store' }
    )
);

// Auto-sync with network store changes
useNetworkStore.subscribe(
    () => {
        console.log('[VaultStore] Network state changed, triggering sync');
        useVaultStore.getState().syncWithNetwork();
    }
);

// Selectors
export const selectVaultState = (state: VaultStore) => ({
    program: state.program,
    isInitialized: state.isInitialized,
    loading: state.loading,
    error: state.error,
});

export const selectVaultData = (state: VaultStore) => ({
    vault: state.vault,
    userPositions: state.userPositions,
    selectedNFT: state.selectedNFT,
});

export const selectVaultProgram = (state: VaultStore) => state.program;
export const selectUserPositions = (state: VaultStore) => state.userPositions;
export const selectSelectedNFT = (state: VaultStore) => state.selectedNFT;
export const selectVaultLoading = (state: VaultStore) => state.loading;
export const selectVaultError = (state: VaultStore) => state.error;
export const selectVaultConfig = () => CONFIG;