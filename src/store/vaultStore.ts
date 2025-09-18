import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { Program } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import type { SimpleVault } from '@/types/simple_vault';
import { useNetworkStore } from './networkStore';
import { BN } from '@coral-xyz/anchor';

const CONFIG = {
    PROGRAM_ID: '6szSVnHy2GrCi6y7aQxJfQG9WpVkTgdB6kDXixepvdoW',
    VAULT_SEED: Buffer.from("vault_v3"),
    USER_INFO_SEED: Buffer.from("user_info_v3"),
    USER_SHARES_SEED: Buffer.from("user_shares_v3"),
    COLLECTION_PDA: new PublicKey('EoZ5NFigrZ7uqUUSH6ShDsYGMooe5ziTfgWvAbFmVTXt'),
    VAULT_ASSET_MINT: new PublicKey("4kXBWAG92UZA1FPEQDN5bjePoFyQsbTnZ9rpxgRBbFYk"),
    VAULT_PDA: new PublicKey("DbCxNx4uvjK2wxvJbrd5DVJ6jVM8eJirYk8RbAL9Mvt1"),
    SHARE_MINT: new PublicKey("5CTdzZxPhqC4DWpTM5MFzwqCtHFmKQTsXE7VWUC6UxTG"),
    VAULT_TOKEN_ACCOUNT: new PublicKey("Ak7DxLGEauBkW769NSRvA9kVkc41SxJKK29mbeJu5gzE"),
};

export interface VaultData {
    owner: PublicKey;
    assetMint: PublicKey;
    shareMint: PublicKey;
    nftCollectionAddress: PublicKey;
    totalBorrowed: BN;
    borrowIndex: BN;   
    borrowRate: BN;    
    lastUpdateTime: BN; 
    reserveFactor: BN;  
    totalReserves: BN;  
    totalShares: BN;     
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
    
    // User position state (separated)
    selectedNFTPosition: UserPosition | null;
    allUserPositions: UserPosition[];
    userPositionLoading: boolean;
    
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
    
    // User position actions (separated)
    updateUserPositionForNFT: (nftMint: PublicKey, position: UserPosition | null) => void;
    setUserPositionLoading: (loading: boolean) => void;
    clearUserPositions: () => void;
    
    // UI actions
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    
    // Network synchronization (ONLY syncs network state, NO data loading)
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
    selectedNFTPosition: null,
    allUserPositions: [],
    userPositionLoading: false,
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
                // console.log('[VaultStore] === SET PROGRAM START ===');
                // console.log('[VaultStore] Setting program:', {
                //     hasProgram: !!program,
                //     programId: program ? CONFIG.PROGRAM_ID : null,
                //     previousProgram: !!state.program
                // });
                
                state.program = program;
                state.isInitialized = !!program;
                
                // console.log('[VaultStore] Program state updated:', {
                //     hasProgram: !!state.program,
                //     isInitialized: state.isInitialized
                // });
                // console.log('[VaultStore] === SET PROGRAM END ===');
            }),

            setIsInitialized: (initialized) => set((state) => {
                // console.log('[VaultStore] Setting isInitialized:', {
                //     from: state.isInitialized,
                //     to: initialized
                // });
                state.isInitialized = initialized;
            }),

            // Vault data actions
            setVault: (vault) => set((state) => {
                // console.log('[VaultStore] === SET VAULT START ===');
                // console.log('[VaultStore] Setting vault:', {
                //     hasVault: !!vault,
                //     vaultOwner: vault?.owner.toBase58(),
                //     assetMint: vault?.assetMint.toBase58(),
                //     shareMint: vault?.shareMint.toBase58(),
                //     totalShares: vault?.totalShares,
                //     previousVault: !!state.vault
                // });
                
                state.vault = vault;
                
                // console.log('[VaultStore] Vault data updated:', {
                //     hasVault: !!state.vault
                // });
                // console.log('[VaultStore] === SET VAULT END ===');
            }),

            // User position actions (separated)
            updateUserPositionForNFT: (nftMint, position) => set((state) => {
                // console.log('[VaultStore] === UPDATE USER POSITION START ===');
                // console.log('[VaultStore] Updating position for NFT:', {
                //     nftMint: nftMint.toBase58(),
                //     hasPosition: !!position,
                //     shareAmount: position?.shareAmount,
                //     depositAmount: position?.depositAmount
                // });

                if (position) {
                    state.selectedNFTPosition = position;
                    
                    // Update allUserPositions array
                    const index = state.allUserPositions.findIndex(p => 
                        p.nftMint.equals(nftMint)
                    );
                    if (index >= 0) {
                        state.allUserPositions[index] = position;
                    } else {
                        state.allUserPositions.push(position);
                    }
                } else {
                    state.selectedNFTPosition = null;
                    state.allUserPositions = state.allUserPositions.filter(p => 
                        !p.nftMint.equals(nftMint)
                    );
                }

                console.log('[VaultStore] User position updated:', {
                    hasSelectedPosition: !!state.selectedNFTPosition,
                    totalPositions: state.allUserPositions.length
                });
                console.log('[VaultStore] === UPDATE USER POSITION END ===');
            }),

            setUserPositionLoading: (loading) => set((state) => {
                console.log('[VaultStore] Setting user position loading:', {
                    from: state.userPositionLoading,
                    to: loading
                });
                state.userPositionLoading = loading;
            }),

            clearUserPositions: () => set((state) => {
                console.log('[VaultStore] === CLEAR USER POSITIONS START ===');
                state.selectedNFTPosition = null;
                state.allUserPositions = [];
                state.userPositionLoading = false;
                console.log('[VaultStore] === CLEAR USER POSITIONS END ===');
            }),

            // UI actions
            setLoading: (loading) => set((state) => {
                console.log('[VaultStore] Setting loading state:', {
                    from: state.loading,
                    to: loading
                });
                state.loading = loading;
            }),

            setError: (error) => set((state) => {
                console.log('[VaultStore] === SET ERROR START ===');
                console.log('[VaultStore] Setting error:', {
                    hasError: !!error,
                    error: error,
                    previousError: state.error
                });
                
                state.error = error;
                if (error) {
                    console.error('[VaultStore] Error details:', error);
                }
                
                console.log('[VaultStore] === SET ERROR END ===');
            }),

            // Network synchronization (ONLY syncs network state, NO data loading)
            syncWithNetwork: () => set((state) => {
                // console.log('[VaultStore] === SYNC WITH NETWORK START ===');
                
                const networkState = useNetworkStore.getState();
                const networkHash = `${networkState.currentNetwork}-${networkState.isReady}-${!!networkState.connection}`;
                
                // console.log('[VaultStore] Network sync state check:', {
                //     currentNetwork: networkState.currentNetwork,
                //     isReady: networkState.isReady,
                //     hasConnection: !!networkState.connection,
                //     previousHash: state.lastNetworkHash,
                //     newHash: networkHash
                // });
                
                // Only update hash and reset data if network actually changed
                if (state.lastNetworkHash !== networkHash) {
                    // console.log('[VaultStore] Network changed - resetting data');
                    
                    state.lastNetworkHash = networkHash;
                    
                    // Reset data when network changes, but DON'T trigger loading
                    state.vault = null;
                    state.program = null;
                    state.selectedNFTPosition = null;
                    state.allUserPositions = [];
                    state.userPositionLoading = false;
                    state.loading = false;
                    state.error = null;
                    
                    // console.log('[VaultStore] Data reset completed');
                } else {
                    // console.log('[VaultStore] Network unchanged - no reset needed');
                }
                
                // console.log('[VaultStore] === SYNC WITH NETWORK END ===');
            }),

            reset: () => set((state) => {
                console.log('[VaultStore] === RESET START ===');
                Object.assign(state, initialState);
                console.log('[VaultStore] === RESET END ===');
            }),

            // Computed getters
            getPositionByNFT: (nftMint) => {
                const state = get();
                const position = state.allUserPositions.find(p => p.nftMint.equals(nftMint));
                console.log('[VaultStore] Getting position by NFT:', {
                    nftMint: nftMint.toBase58(),
                    hasPosition: !!position,
                    depositAmount: position?.depositAmount,
                    shareAmount: position?.shareAmount
                });
                return position || null;
            },

            getTotalDeposited: () => {
                const state = get();
                const total = state.allUserPositions.reduce((total, position) => total + position.depositAmount, 0);
                console.log('[VaultStore] Total deposited calculated:', {
                    positionCount: state.allUserPositions.length,
                    totalDeposited: total
                });
                return total;
            },

            getTotalShares: () => {
                const state = get();
                const total = state.allUserPositions.reduce((total, position) => total + position.shareAmount, 0);
                console.log('[VaultStore] Total shares calculated:', {
                    positionCount: state.allUserPositions.length,
                    totalShares: total
                });
                return total;
            },

            hasPositions: () => {
                const state = get();
                const hasPositions = state.allUserPositions.length > 0;
                console.log('[VaultStore] Checking has positions:', {
                    count: state.allUserPositions.length,
                    hasPositions
                });
                return hasPositions;
            },

            getVaultConfig: () => {
                console.log('[VaultStore] Getting vault config:', {
                    programId: CONFIG.PROGRAM_ID,
                    vaultPda: CONFIG.VAULT_PDA.toBase58(),
                    assetMint: CONFIG.VAULT_ASSET_MINT.toBase58()
                });
                return CONFIG;
            },
        })),
        { name: 'vault-store' }
    )
);

// Auto-sync with network store changes (ONLY network sync, NO data loading)
console.log('[VaultStore] Setting up network store subscription');
useNetworkStore.subscribe(
    (state, prevState) => {
        console.log('[VaultStore] === NETWORK STORE SUBSCRIPTION TRIGGER ===');
        console.log('[VaultStore] Network state change detected:', {
            currentNetwork: state.currentNetwork,
            previousNetwork: prevState?.currentNetwork,
            isReady: state.isReady,
            previousReady: prevState?.isReady,
            hasConnection: !!state.connection,
            previousConnection: !!prevState?.connection,
            isSolanaNetwork: state.isSolanaNetwork,
            previousSolanaNetwork: prevState?.isSolanaNetwork
        });
        
        console.log('[VaultStore] Triggering network sync only...');
        useVaultStore.getState().syncWithNetwork(); // ONLY syncs network state
        console.log('[VaultStore] === NETWORK STORE SUBSCRIPTION END ===');
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
    selectedNFTPosition: state.selectedNFTPosition,
    allUserPositions: state.allUserPositions,
    userPositionLoading: state.userPositionLoading,
});

export const selectVaultProgram = (state: VaultStore) => state.program;
export const selectVault = (state: VaultStore) => state.vault;
export const selectUserPositions = (state: VaultStore) => state.allUserPositions;
export const selectSelectedNFTPosition = (state: VaultStore) => state.selectedNFTPosition;
export const selectVaultLoading = (state: VaultStore) => state.loading;
export const selectUserPositionLoading = (state: VaultStore) => state.userPositionLoading;
export const selectVaultError = (state: VaultStore) => state.error;
export const selectVaultConfig = () => CONFIG;

// import { devtools } from 'zustand/middleware';
// import { immer } from 'zustand/middleware/immer';
// import { Program } from '@coral-xyz/anchor';
// import { PublicKey } from '@solana/web3.js';
// import type { SimpleVault } from '@/types/simple_vault';
// import { useNetworkStore } from './networkStore';
// import { BN } from '@coral-xyz/anchor';

// const CONFIG = {
//     PROGRAM_ID: '6szSVnHy2GrCi6y7aQxJfQG9WpVkTgdB6kDXixepvdoW',
//     VAULT_SEED: Buffer.from("vault_v3"),
//     USER_INFO_SEED: Buffer.from("user_info_v3"),
//     USER_SHARES_SEED: Buffer.from("user_shares_v3"),
//     // Updated with correct addresses from your transaction
//     COLLECTION_PDA: new PublicKey('EoZ5NFigrZ7uqUUSH6ShDsYGMooe5ziTfgWvAbFmVTXt'),
//     VAULT_ASSET_MINT: new PublicKey("4kXBWAG92UZA1FPEQDN5bjePoFyQsbTnZ9rpxgRBbFYk"),
//     VAULT_PDA: new PublicKey("DbCxNx4uvjK2wxvJbrd5DVJ6jVM8eJirYk8RbAL9Mvt1"),
//     SHARE_MINT: new PublicKey("5CTdzZxPhqC4DWpTM5MFzwqCtHFmKQTsXE7VWUC6UxTG"),
//     VAULT_TOKEN_ACCOUNT: new PublicKey("Ak7DxLGEauBkW769NSRvA9kVkc41SxJKK29mbeJu5gzE"),
// };

// export interface VaultData {
//     owner: PublicKey;
//     assetMint: PublicKey;
//     shareMint: PublicKey;
//     nftCollectionAddress: PublicKey;
//     totalBorrowed: BN;
//     borrowIndex: BN;   
//     borrowRate: BN;    
//     lastUpdateTime: BN; 
//     reserveFactor: BN;  
//     totalReserves: BN;  
//     totalShares: BN;     
//     bump: number;        // u8
// }

// export interface UserPosition {
//     user: PublicKey;
//     nftMint: PublicKey;
//     depositAmount: number;
//     shareAmount: number;
//     timestamp: number;
// }

// export interface VaultState {
//     // Program state
//     program: Program<SimpleVault> | null;
//     isInitialized: boolean;
    
//     // Vault data
//     vault: VaultData | null;
//     userPositions: UserPosition[];
//     selectedNFT: PublicKey | null;
    
//     // UI state
//     loading: boolean;
//     error: string | null;
    
//     // Network dependency tracking
//     lastNetworkHash: string | null;
// }

// export interface VaultStore extends VaultState {
//     // Program actions
//     setProgram: (program: Program<SimpleVault> | null) => void;
//     setIsInitialized: (initialized: boolean) => void;
    
//     // Vault data actions
//     setVault: (vault: VaultData | null) => void;
//     setUserPositions: (positions: UserPosition[]) => void;
//     addUserPosition: (position: UserPosition) => void;
//     updateUserPosition: (nftMint: PublicKey, updates: Partial<UserPosition>) => void;
//     removeUserPosition: (nftMint: PublicKey) => void;
//     setSelectedNFT: (nft: PublicKey | null) => void;
    
//     // UI actions
//     setLoading: (loading: boolean) => void;
//     setError: (error: string | null) => void;
    
//     // Network synchronization (NEW - like tokenStore/uniqueIdStore)
//     syncWithNetwork: () => void;
//     reset: () => void;
    
//     // Computed getters
//     getPositionByNFT: (nftMint: PublicKey) => UserPosition | null;
//     getTotalDeposited: () => number;
//     getTotalShares: () => number;
//     hasPositions: () => boolean;
//     getVaultConfig: () => typeof CONFIG;
// }

// const initialState: VaultState = {
//     program: null,
//     isInitialized: false,
//     vault: null,
//     userPositions: [],
//     selectedNFT: null,
//     loading: false,
//     error: null,
//     lastNetworkHash: null,
// };

// export const useVaultStore = create<VaultStore>()(
//     devtools(
//         immer((set, get) => ({
//             ...initialState,

//             // Program actions
//             setProgram: (program) => set((state) => {
//                 console.log('[VaultStore] === SET PROGRAM START ===');
//                 console.log('[VaultStore] Setting program:', {
//                     hasProgram: !!program,
//                     programId: program ? CONFIG.PROGRAM_ID : null,
//                     previousProgram: !!state.program
//                 });
                
//                 state.program = program;
//                 state.isInitialized = !!program;
                
//                 console.log('[VaultStore] Program state updated:', {
//                     hasProgram: !!state.program,
//                     isInitialized: state.isInitialized
//                 });
//                 console.log('[VaultStore] === SET PROGRAM END ===');
//             }),

//             setIsInitialized: (initialized) => set((state) => {
//                 console.log('[VaultStore] Setting isInitialized:', {
//                     from: state.isInitialized,
//                     to: initialized
//                 });
//                 state.isInitialized = initialized;
//             }),

//             // Vault data actions
//             setVault: (vault) => set((state) => {
//                 console.log('[VaultStore] === SET VAULT START ===');
//                 console.log('[VaultStore] Setting vault:', {
//                     hasVault: !!vault,
//                     vaultOwner: vault?.owner.toBase58(),
//                     assetMint: vault?.assetMint.toBase58(),
//                     shareMint: vault?.shareMint.toBase58(),
//                     totalShares: vault?.totalShares,
//                     previousVault: !!state.vault
//                 });
                
//                 state.vault = vault;
                
//                 console.log('[VaultStore] Vault data updated:', {
//                     hasVault: !!state.vault
//                 });
//                 console.log('[VaultStore] === SET VAULT END ===');
//             }),

//             setUserPositions: (positions) => set((state) => {
//                 console.log('[VaultStore] === SET USER POSITIONS START ===');
//                 console.log('[VaultStore] Setting user positions:', {
//                     positionCount: positions.length,
//                     previousCount: state.userPositions.length,
//                     positions: positions.map(p => ({
//                         nftMint: p.nftMint.toBase58(),
//                         depositAmount: p.depositAmount,
//                         shareAmount: p.shareAmount
//                     }))
//                 });
                
//                 state.userPositions = positions;
                
//                 console.log('[VaultStore] User positions updated:', {
//                     finalCount: state.userPositions.length
//                 });
//                 console.log('[VaultStore] === SET USER POSITIONS END ===');
//             }),

//             addUserPosition: (position) => set((state) => {
//                 console.log('[VaultStore] === ADD USER POSITION START ===');
//                 console.log('[VaultStore] Adding position:', {
//                     nftMint: position.nftMint.toBase58(),
//                     depositAmount: position.depositAmount,
//                     shareAmount: position.shareAmount,
//                     currentPositionCount: state.userPositions.length
//                 });
                
//                 const existingIndex = state.userPositions.findIndex(p => 
//                     p.nftMint.toBase58() === position.nftMint.toBase58()
//                 );
                
//                 if (existingIndex >= 0) {
//                     console.log('[VaultStore] Updating existing position at index:', existingIndex);
//                     state.userPositions[existingIndex] = position;
//                 } else {
//                     console.log('[VaultStore] Adding new position');
//                     state.userPositions.push(position);
//                 }
                
//                 console.log('[VaultStore] Position collection updated:', {
//                     finalCount: state.userPositions.length,
//                     wasUpdate: existingIndex >= 0
//                 });
//                 console.log('[VaultStore] === ADD USER POSITION END ===');
//             }),

//             updateUserPosition: (nftMint, updates) => set((state) => {
//                 console.log('[VaultStore] Updating position for NFT:', {
//                     nftMint: nftMint.toBase58(),
//                     updates
//                 });
                
//                 const position = state.userPositions.find(p => p.nftMint.equals(nftMint));
//                 if (position) {
//                     Object.assign(position, updates);
//                     console.log('[VaultStore] Position updated successfully');
//                 } else {
//                     console.log('[VaultStore] Position not found for update');
//                 }
//             }),

//             removeUserPosition: (nftMint) => set((state) => {
//                 console.log('[VaultStore] Removing position for NFT:', nftMint.toBase58());
                
//                 const index = state.userPositions.findIndex(p => p.nftMint.equals(nftMint));
//                 if (index >= 0) {
//                     state.userPositions.splice(index, 1);
//                     console.log('[VaultStore] Position removed successfully');
//                 } else {
//                     console.log('[VaultStore] Position not found for removal');
//                 }
//             }),

//             setSelectedNFT: (nft) => set((state) => {
//                 console.log('[VaultStore] Setting selected NFT:', {
//                     from: state.selectedNFT?.toBase58(),
//                     to: nft?.toBase58()
//                 });
//                 state.selectedNFT = nft;
//             }),

//             // UI actions
//             setLoading: (loading) => set((state) => {
//                 console.log('[VaultStore] Setting loading state:', {
//                     from: state.loading,
//                     to: loading
//                 });
//                 state.loading = loading;
//             }),

//             setError: (error) => set((state) => {
//                 console.log('[VaultStore] === SET ERROR START ===');
//                 console.log('[VaultStore] Setting error:', {
//                     hasError: !!error,
//                     error: error,
//                     previousError: state.error
//                 });
                
//                 state.error = error;
//                 if (error) {
//                     console.error('[VaultStore] Error details:', error);
//                 }
                
//                 console.log('[VaultStore] === SET ERROR END ===');
//             }),

//             // Network synchronization (NEW - like tokenStore/uniqueIdStore)
//             syncWithNetwork: () => set((state) => {
//                 console.log('[VaultStore] === SYNC WITH NETWORK START ===');
                
//                 const networkState = useNetworkStore.getState();
//                 const networkHash = `${networkState.currentNetwork}-${networkState.isReady}-${!!networkState.connection}`;
                
//                 console.log('[VaultStore] Network sync state check:', {
//                     currentNetwork: networkState.currentNetwork,
//                     isReady: networkState.isReady,
//                     hasConnection: !!networkState.connection,
//                     connectionRpc: networkState.connection?.rpcEndpoint,
//                     isSolanaNetwork: networkState.isSolanaNetwork,
//                     error: networkState.error
//                 });
                
//                 console.log('[VaultStore] Hash comparison:', {
//                     currentHash: state.lastNetworkHash,
//                     newHash: networkHash,
//                     hashChanged: state.lastNetworkHash !== networkHash
//                 });

//                 // Check if network state changed
//                 if (state.lastNetworkHash !== networkHash) {
//                     console.log('[VaultStore] Network hash changed, processing sync...');
//                     state.lastNetworkHash = networkHash;

//                     if (!networkState.isReady || !networkState.isSolanaNetwork) {
//                         // Network not ready or not Solana - clear program state
//                         console.log('[VaultStore] Network not ready or not Solana, clearing state:', {
//                             isReady: networkState.isReady,
//                             isSolanaNetwork: networkState.isSolanaNetwork,
//                             networkError: networkState.error
//                         });
                        
//                         const clearedState = {
//                             program: null,
//                             isInitialized: false,
//                             vault: null,
//                             userPositions: [],
//                             selectedNFT: null,
//                             error: null
//                         };
                        
//                         Object.assign(state, clearedState);
//                         console.log('[VaultStore] State cleared due to network issues');
//                     } else {
//                         // Network is ready - clear error and prepare for program initialization
//                         console.log('[VaultStore] Network ready for program initialization:', {
//                             network: networkState.currentNetwork,
//                             rpc: networkState.connection?.rpcEndpoint
//                         });
//                         state.error = null;
//                         // Note: Program initialization happens in the hook, not here
//                     }
//                 } else {
//                     console.log('[VaultStore] Network hash unchanged, no sync needed');
//                 }
                
//                 console.log('[VaultStore] Final sync state:', {
//                     lastNetworkHash: state.lastNetworkHash,
//                     hasProgram: !!state.program,
//                     isInitialized: state.isInitialized,
//                     hasVault: !!state.vault,
//                     error: state.error
//                 });
//                 console.log('[VaultStore] === SYNC WITH NETWORK END ===');
//             }),

//             reset: () => set((state) => {
//                 console.log('[VaultStore] === RESET START ===');
//                 console.log('[VaultStore] State BEFORE reset:', {
//                     hasProgram: !!state.program,
//                     hasVault: !!state.vault,
//                     userPositionCount: state.userPositions.length,
//                     selectedNFT: state.selectedNFT?.toBase58(),
//                     lastNetworkHash: state.lastNetworkHash
//                 });
                
//                 console.trace('[VaultStore] Reset stack trace');
//                 Object.assign(state, initialState);
                
//                 console.log('[VaultStore] State AFTER reset:', {
//                     hasProgram: !!state.program,
//                     hasVault: !!state.vault,
//                     userPositionCount: state.userPositions.length,
//                     lastNetworkHash: state.lastNetworkHash
//                 });
//                 console.log('[VaultStore] === RESET END ===');
//             }),

//             // Computed getters
//             getPositionByNFT: (nftMint) => {
//                 const state = get();
//                 console.log('[VaultStore] Getting position by NFT:', {
//                     nftMint: nftMint.toBase58(),
//                     totalPositions: state.userPositions.length
//                 });
                
//                 const position = state.userPositions.find(position => position.nftMint.equals(nftMint)) || null;
//                 console.log('[VaultStore] Position by NFT result:', {
//                     found: !!position,
//                     depositAmount: position?.depositAmount,
//                     shareAmount: position?.shareAmount
//                 });
//                 return position;
//             },

//             getTotalDeposited: () => {
//                 const state = get();
//                 const total = state.userPositions.reduce((total, position) => total + position.depositAmount, 0);
//                 console.log('[VaultStore] Total deposited calculated:', {
//                     positionCount: state.userPositions.length,
//                     totalDeposited: total
//                 });
//                 return total;
//             },

//             getTotalShares: () => {
//                 const state = get();
//                 const total = state.userPositions.reduce((total, position) => total + position.shareAmount, 0);
//                 console.log('[VaultStore] Total shares calculated:', {
//                     positionCount: state.userPositions.length,
//                     totalShares: total
//                 });
//                 return total;
//             },

//             hasPositions: () => {
//                 const state = get();
//                 const hasPositions = state.userPositions.length > 0;
//                 console.log('[VaultStore] Checking has positions:', {
//                     count: state.userPositions.length,
//                     hasPositions
//                 });
//                 return hasPositions;
//             },

//             getVaultConfig: () => {
//                 console.log('[VaultStore] Getting vault config:', {
//                     programId: CONFIG.PROGRAM_ID,
//                     vaultPda: CONFIG.VAULT_PDA.toBase58(),
//                     assetMint: CONFIG.VAULT_ASSET_MINT.toBase58()
//                 });
//                 return CONFIG;
//             },
//         })),
//         { name: 'vault-store' }
//     )
// );

// // Auto-sync with network store changes (NEW - like uniqueIdStore)
// console.log('[VaultStore] Setting up network store subscription');
// useNetworkStore.subscribe(
//     (state, prevState) => {
//         console.log('[VaultStore] === NETWORK STORE SUBSCRIPTION TRIGGER ===');
//         console.log('[VaultStore] Network state change detected:', {
//             currentNetwork: state.currentNetwork,
//             previousNetwork: prevState?.currentNetwork,
//             isReady: state.isReady,
//             previousReady: prevState?.isReady,
//             hasConnection: !!state.connection,
//             previousConnection: !!prevState?.connection,
//             isSolanaNetwork: state.isSolanaNetwork,
//             previousSolanaNetwork: prevState?.isSolanaNetwork
//         });
        
//         console.log('[VaultStore] Triggering sync with network...');
//         useVaultStore.getState().syncWithNetwork();
//         console.log('[VaultStore] === NETWORK STORE SUBSCRIPTION END ===');
//     }
// );

// // Selectors (updated to match token/uniqueId pattern)
// export const selectVaultState = (state: VaultStore) => ({
//     program: state.program,
//     isInitialized: state.isInitialized,
//     loading: state.loading,
//     error: state.error,
// });

// export const selectVaultData = (state: VaultStore) => ({
//     vault: state.vault,
//     userPositions: state.userPositions,
//     selectedNFT: state.selectedNFT,
// });

// export const selectVaultProgram = (state: VaultStore) => state.program;
// export const selectVault = (state: VaultStore) => state.vault;
// export const selectUserPositions = (state: VaultStore) => state.userPositions;
// export const selectSelectedNFT = (state: VaultStore) => state.selectedNFT;
// export const selectVaultLoading = (state: VaultStore) => state.loading;
// export const selectVaultError = (state: VaultStore) => state.error;
// export const selectVaultConfig = () => CONFIG;