// stores/uniqueIdStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { Program } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import type { UniqueLow } from '@/types/unique_low';
import { useNetworkStore } from './networkStore';

const CONFIG = {
    PROGRAM_ID: '5XdsDEXPiHndfBkrvJKjsFZy3Zf95bUZLRZQvJ4W6Bpa',
    COLLECTION_SEED: Buffer.from("collection"),
    USER_STATE_SEED: Buffer.from("user_state"),
    // Hardcoded collection PDA from your config
    COLLECTION_PDA: new PublicKey("EoZ5NFigrZ7uqUUSH6ShDsYGMooe5ziTfgWvAbFmVTXt"),
};

export interface Collection {
    authority: PublicKey;
    name: string;
    symbol: string;
    baseUri: string;
    totalSupply: any; // BN from anchor, but we'll convert to number in store
    wormholeProgramId: PublicKey;
    uniqueIdToTokenId: Array<{ uniqueId: number[], tokenId: any }>; // tokenId is BN
    tokenIdToUniqueId: Array<{ tokenId: any, uniqueId: number[] }>; // tokenId is BN  
    mintToUniqueId: Array<{ mint: PublicKey, uniqueId: number[] }>;
}

export interface UserState {
    user: PublicKey;
    nonce: number;
}

export interface MintedNFT {
    mint: PublicKey;
    tokenAccount: PublicKey;
    tokenId: number;
    uniqueId: number[];
    txSignature: string;
}

export interface UniqueIdState {
    // Program state
    program: Program<UniqueLow> | null;
    isInitialized: boolean;
    
    // Collection data
    collection: Collection | null;
    userState: UserState | null;
    isCollectionInitialized: boolean;
    
    // NFT data
    userNFTs: MintedNFT[];
    totalSupply: number;
    userNonce: number;
    
    // UI state
    loading: boolean;
    error: string | null;
    
    // Network dependency tracking
    lastNetworkHash: string | null;
}

export interface UniqueIdStore extends UniqueIdState {
    // Program actions
    setProgram: (program: Program<UniqueLow> | null) => void;
    setIsInitialized: (initialized: boolean) => void;
    
    // Collection data actions
    setCollection: (collection: Collection | null) => void;
    setUserState: (userState: UserState | null) => void;
    setIsCollectionInitialized: (initialized: boolean) => void;
    
    // NFT data actions
    setUserNFTs: (nfts: MintedNFT[]) => void;
    addMintedNFT: (nft: MintedNFT) => void;
    setTotalSupply: (supply: number) => void;
    setUserNonce: (nonce: number) => void;
    
    // UI actions
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    
    // Network synchronization
    syncWithNetwork: () => void;
    reset: () => void;
    
    // Computed getters
    getNFTByMint: (mint: PublicKey) => MintedNFT | null;
    getNFTByTokenId: (tokenId: number) => MintedNFT | null;
    getUniqueIdByMint: (mint: PublicKey) => number[] | null;
    getTokenIdByUniqueId: (uniqueId: number[]) => number | null;
    hasNFTs: () => boolean;
    getCollectionPda: () => PublicKey;
}

const initialState: UniqueIdState = {
    program: null,
    isInitialized: false,
    collection: null,
    userState: null,
    isCollectionInitialized: false,
    userNFTs: [],
    totalSupply: 0,
    userNonce: 0,
    loading: false,
    error: null,
    lastNetworkHash: null,
};

export const useUniqueIdStore = create<UniqueIdStore>()(
    devtools(
        immer((set, get) => ({
            ...initialState,

            // Program actions
            setProgram: (program) => set((state) => {
                console.log('[UniqueIdStore] === SET PROGRAM START ===');
                console.log('[UniqueIdStore] Setting program:', {
                    hasProgram: !!program,
                    programId: program ? CONFIG.PROGRAM_ID : null,
                    previousProgram: !!state.program
                });
                
                state.program = program;
                state.isInitialized = !!program;
                
                console.log('[UniqueIdStore] Program state updated:', {
                    hasProgram: !!state.program,
                    isInitialized: state.isInitialized
                });
                console.log('[UniqueIdStore] === SET PROGRAM END ===');
            }),

            setIsInitialized: (initialized) => set((state) => {
                console.log('[UniqueIdStore] Setting isInitialized:', {
                    from: state.isInitialized,
                    to: initialized
                });
                state.isInitialized = initialized;
            }),

            // Collection data actions
            setCollection: (collection) => set((state) => {
                console.log('[UniqueIdStore] === SET COLLECTION START ===');
                console.log('[UniqueIdStore] Setting collection:', {
                    hasCollection: !!collection,
                    collectionName: collection?.name,
                    totalSupply: collection?.totalSupply,
                    authority: collection?.authority.toBase58(),
                    previousCollection: !!state.collection
                });
                
                state.collection = collection;
                if (collection) {
                    state.totalSupply = collection.totalSupply;
                    state.isCollectionInitialized = true;
                    console.log('[UniqueIdStore] Collection data processed:', {
                        totalSupply: state.totalSupply,
                        isCollectionInitialized: state.isCollectionInitialized,
                        uniqueIdMappings: collection.uniqueIdToTokenId.length,
                        tokenIdMappings: collection.tokenIdToUniqueId.length,
                        mintMappings: collection.mintToUniqueId.length
                    });
                } else {
                    state.isCollectionInitialized = false;
                    console.log('[UniqueIdStore] Collection cleared, isCollectionInitialized set to false');
                }
                
                console.log('[UniqueIdStore] === SET COLLECTION END ===');
            }),

            setUserState: (userState) => set((state) => {
                console.log('[UniqueIdStore] === SET USER STATE START ===');
                console.log('[UniqueIdStore] Setting user state:', {
                    hasUserState: !!userState,
                    nonce: userState?.nonce,
                    previousUserState: !!state.userState,
                    previousNonce: state.userNonce
                });
                
                state.userState = userState;
                if (userState) {
                    state.userNonce = userState.nonce;
                    console.log('[UniqueIdStore] User nonce updated to:', state.userNonce);
                } else {
                    console.log('[UniqueIdStore] User state cleared, keeping existing nonce:', state.userNonce);
                }
                
                console.log('[UniqueIdStore] === SET USER STATE END ===');
            }),

            setIsCollectionInitialized: (initialized) => set((state) => {
                console.log('[UniqueIdStore] Setting isCollectionInitialized:', {
                    from: state.isCollectionInitialized,
                    to: initialized
                });
                state.isCollectionInitialized = initialized;
            }),

            // NFT data actions
            setUserNFTs: (nfts) => set((state) => {
                console.log('[UniqueIdStore] === SET USER NFTS START ===');
                console.log('[UniqueIdStore] Setting user NFTs:', {
                    nftCount: nfts.length,
                    previousCount: state.userNFTs.length,
                    nftMints: nfts.map(nft => nft.mint.toBase58())
                });
                
                state.userNFTs = nfts;
                
                console.log('[UniqueIdStore] User NFTs updated:', {
                    finalCount: state.userNFTs.length
                });
                console.log('[UniqueIdStore] === SET USER NFTS END ===');
            }),

            addMintedNFT: (nft) => set((state) => {
                console.log('[UniqueIdStore] === ADD MINTED NFT START ===');
                console.log('[UniqueIdStore] Adding minted NFT:', {
                    mint: nft.mint.toBase58(),
                    tokenId: nft.tokenId,
                    uniqueId: nft.uniqueId,
                    txSignature: nft.txSignature.slice(0, 8) + '...',
                    currentNFTCount: state.userNFTs.length
                });
                
                const existingIndex = state.userNFTs.findIndex(n => 
                    n.mint.toBase58() === nft.mint.toBase58()
                );
                
                if (existingIndex >= 0) {
                    console.log('[UniqueIdStore] Updating existing NFT at index:', existingIndex);
                    state.userNFTs[existingIndex] = nft;
                } else {
                    console.log('[UniqueIdStore] Adding new NFT to collection');
                    state.userNFTs.push(nft);
                }
                
                console.log('[UniqueIdStore] NFT collection updated:', {
                    finalCount: state.userNFTs.length,
                    wasUpdate: existingIndex >= 0
                });
                console.log('[UniqueIdStore] === ADD MINTED NFT END ===');
            }),

            setTotalSupply: (supply) => set((state) => {
                console.log('[UniqueIdStore] Setting total supply:', {
                    from: state.totalSupply,
                    to: supply
                });
                state.totalSupply = supply;
            }),

            setUserNonce: (nonce) => set((state) => {
                console.log('[UniqueIdStore] Setting user nonce:', {
                    from: state.userNonce,
                    to: nonce
                });
                state.userNonce = nonce;
            }),

            // UI actions
            setLoading: (loading) => set((state) => {
                console.log('[UniqueIdStore] Setting loading state:', {
                    from: state.loading,
                    to: loading
                });
                state.loading = loading;
            }),

            setError: (error) => set((state) => {
                console.log('[UniqueIdStore] === SET ERROR START ===');
                console.log('[UniqueIdStore] Setting error:', {
                    hasError: !!error,
                    error: error,
                    previousError: state.error
                });
                
                state.error = error;
                if (error) {
                    console.error('[UniqueIdStore] Error details:', error);
                }
                
                console.log('[UniqueIdStore] === SET ERROR END ===');
            }),

            // Network synchronization
            syncWithNetwork: () => set((state) => {
                console.log('[UniqueIdStore] === SYNC WITH NETWORK START ===');
                
                const networkState = useNetworkStore.getState();
                const networkHash = `${networkState.currentNetwork}-${networkState.isReady}-${!!networkState.connection}`;
                
                console.log('[UniqueIdStore] Network sync state check:', {
                    currentNetwork: networkState.currentNetwork,
                    isReady: networkState.isReady,
                    hasConnection: !!networkState.connection,
                    connectionRpc: networkState.connection?.rpcEndpoint,
                    isSolanaNetwork: networkState.isSolanaNetwork,
                    error: networkState.error
                });
                
                console.log('[UniqueIdStore] Hash comparison:', {
                    currentHash: state.lastNetworkHash,
                    newHash: networkHash,
                    hashChanged: state.lastNetworkHash !== networkHash
                });

                // Check if network state changed
                if (state.lastNetworkHash !== networkHash) {
                    console.log('[UniqueIdStore] Network hash changed, processing sync...');
                    state.lastNetworkHash = networkHash;

                    if (!networkState.isReady || !networkState.isSolanaNetwork) {
                        // Network not ready or not Solana - clear program state
                        console.log('[UniqueIdStore] Network not ready or not Solana, clearing state:', {
                            isReady: networkState.isReady,
                            isSolanaNetwork: networkState.isSolanaNetwork,
                            networkError: networkState.error
                        });
                        
                        const clearedState = {
                            program: null,
                            isInitialized: false,
                            collection: null,
                            userState: null,
                            isCollectionInitialized: false,
                            userNFTs: [],
                            totalSupply: 0,
                            userNonce: 0,
                            error: null
                        };
                        
                        Object.assign(state, clearedState);
                        console.log('[UniqueIdStore] State cleared due to network issues');
                    } else {
                        // Network is ready - clear error and prepare for program initialization
                        console.log('[UniqueIdStore] Network ready for program initialization:', {
                            network: networkState.currentNetwork,
                            rpc: networkState.connection?.rpcEndpoint
                        });
                        state.error = null;
                        // Note: Program initialization happens in the hook, not here
                    }
                } else {
                    console.log('[UniqueIdStore] Network hash unchanged, no sync needed');
                }
                
                console.log('[UniqueIdStore] Final sync state:', {
                    lastNetworkHash: state.lastNetworkHash,
                    hasProgram: !!state.program,
                    isInitialized: state.isInitialized,
                    isCollectionInitialized: state.isCollectionInitialized,
                    error: state.error
                });
                console.log('[UniqueIdStore] === SYNC WITH NETWORK END ===');
            }),

            reset: () => set((state) => {
                console.log('[UniqueIdStore] === RESET START ===');
                console.log('[UniqueIdStore] State BEFORE reset:', {
                    hasProgram: !!state.program,
                    hasCollection: !!state.collection,
                    isCollectionInitialized: state.isCollectionInitialized,
                    totalSupply: state.totalSupply,
                    userNFTCount: state.userNFTs.length,
                    userNonce: state.userNonce,
                    lastNetworkHash: state.lastNetworkHash
                });
                
                console.trace('[UniqueIdStore] Reset stack trace');
                Object.assign(state, initialState);
                
                console.log('[UniqueIdStore] State AFTER reset:', {
                    hasProgram: !!state.program,
                    hasCollection: !!state.collection,
                    isCollectionInitialized: state.isCollectionInitialized,
                    totalSupply: state.totalSupply,
                    userNFTCount: state.userNFTs.length,
                    lastNetworkHash: state.lastNetworkHash
                });
                console.log('[UniqueIdStore] === RESET END ===');
            }),

            // Computed getters
            getNFTByMint: (mint) => {
                const state = get();
                console.log('[UniqueIdStore] Getting NFT by mint:', {
                    mint: mint.toBase58(),
                    totalNFTs: state.userNFTs.length
                });
                
                const nft = state.userNFTs.find(nft => nft.mint.equals(mint)) || null;
                console.log('[UniqueIdStore] NFT by mint result:', {
                    found: !!nft,
                    tokenId: nft?.tokenId,
                    uniqueId: nft?.uniqueId
                });
                return nft;
            },

            getNFTByTokenId: (tokenId) => {
                const state = get();
                console.log('[UniqueIdStore] Getting NFT by token ID:', {
                    tokenId,
                    totalNFTs: state.userNFTs.length
                });
                
                const nft = state.userNFTs.find(nft => nft.tokenId === tokenId) || null;
                console.log('[UniqueIdStore] NFT by token ID result:', {
                    found: !!nft,
                    mint: nft?.mint.toBase58(),
                    uniqueId: nft?.uniqueId
                });
                return nft;
            },

            getUniqueIdByMint: (mint) => {
                const state = get();
                console.log('[UniqueIdStore] Getting unique ID by mint:', {
                    mint: mint.toBase58(),
                    hasCollection: !!state.collection,
                    mintMappings: state.collection?.mintToUniqueId.length || 0
                });
                
                if (!state.collection) {
                    console.log('[UniqueIdStore] No collection data available');
                    return null;
                }
                
                const mapping = state.collection.mintToUniqueId.find(
                    m => m.mint.toBase58() === mint.toBase58()
                );
                
                const result = mapping?.uniqueId || null;
                console.log('[UniqueIdStore] Unique ID by mint result:', {
                    found: !!mapping,
                    uniqueId: result
                });
                return result;
            },

            getTokenIdByUniqueId: (uniqueId) => {
                const state = get();
                console.log('[UniqueIdStore] Getting token ID by unique ID:', {
                    uniqueId,
                    hasCollection: !!state.collection,
                    uniqueIdMappings: state.collection?.uniqueIdToTokenId.length || 0
                });
                
                if (!state.collection) {
                    console.log('[UniqueIdStore] No collection data available');
                    return null;
                }
                
                const mapping = state.collection.uniqueIdToTokenId.find(
                    m => JSON.stringify(m.uniqueId) === JSON.stringify(uniqueId)
                );
                
                const result = mapping?.tokenId || null;
                console.log('[UniqueIdStore] Token ID by unique ID result:', {
                    found: !!mapping,
                    tokenId: result
                });
                return result;
            },

            hasNFTs: () => {
                const state = get();
                const hasNFTs = state.userNFTs.length > 0;
                console.log('[UniqueIdStore] Checking has NFTs:', {
                    count: state.userNFTs.length,
                    hasNFTs
                });
                return hasNFTs;
            },

            getCollectionPda: () => {
                console.log('[UniqueIdStore] Getting collection PDA:', CONFIG.COLLECTION_PDA.toBase58());
                return CONFIG.COLLECTION_PDA;
            },
        })),
        { name: 'uniqueid-store' }
    )
);

// Auto-sync with network store changes
console.log('[UniqueIdStore] Setting up network store subscription');
useNetworkStore.subscribe(
    (state, prevState) => {
        console.log('[UniqueIdStore] === NETWORK STORE SUBSCRIPTION TRIGGER ===');
        console.log('[UniqueIdStore] Network state change detected:', {
            currentNetwork: state.currentNetwork,
            previousNetwork: prevState?.currentNetwork,
            isReady: state.isReady,
            previousReady: prevState?.isReady,
            hasConnection: !!state.connection,
            previousConnection: !!prevState?.connection,
            isSolanaNetwork: state.isSolanaNetwork,
            previousSolanaNetwork: prevState?.isSolanaNetwork
        });
        
        console.log('[UniqueIdStore] Triggering sync with network...');
        useUniqueIdStore.getState().syncWithNetwork();
        console.log('[UniqueIdStore] === NETWORK STORE SUBSCRIPTION END ===');
    }
);

// Selectors
export const selectUniqueIdState = (state: UniqueIdStore) => ({
    program: state.program,
    isInitialized: state.isInitialized,
    isCollectionInitialized: state.isCollectionInitialized,
    loading: state.loading,
    error: state.error,
});

export const selectCollectionData = (state: UniqueIdStore) => ({
    collection: state.collection,
    userState: state.userState,
    totalSupply: state.totalSupply,
    userNonce: state.userNonce,
});

export const selectNFTData = (state: UniqueIdStore) => ({
    userNFTs: state.userNFTs,
});

export const selectUniqueIdProgram = (state: UniqueIdStore) => state.program;
export const selectCollection = (state: UniqueIdStore) => state.collection;
export const selectUserNFTs = (state: UniqueIdStore) => state.userNFTs;
export const selectUniqueIdLoading = (state: UniqueIdStore) => state.loading;
export const selectUniqueIdError = (state: UniqueIdStore) => state.error;
export const selectCollectionPda = () => CONFIG.COLLECTION_PDA;

// // stores/uniqueIdStore.ts
// import { create } from 'zustand';
// import { devtools } from 'zustand/middleware';
// import { immer } from 'zustand/middleware/immer';
// import { Program } from '@coral-xyz/anchor';
// import { PublicKey } from '@solana/web3.js';
// import type { UniqueLow } from '@/types/unique_low';
// import { useNetworkStore } from './networkStore';

// const CONFIG = {
//     PROGRAM_ID: '5XdsDEXPiHndfBkrvJKjsFZy3Zf95bUZLRZQvJ4W6Bpa',
//     COLLECTION_SEED: Buffer.from("collection"),
//     USER_STATE_SEED: Buffer.from("user_state"),
//     // Hardcoded collection PDA from your config
//     COLLECTION_PDA: new PublicKey("EoZ5NFigrZ7uqUUSH6ShDsYGMooe5ziTfgWvAbFmVTXt"),
// };

// export interface Collection {
//     authority: PublicKey;
//     name: string;
//     symbol: string;
//     baseUri: string;
//     totalSupply: number;
//     wormholeProgramId: PublicKey;
//     uniqueIdToTokenId: Array<{ uniqueId: number[], tokenId: number }>;
//     tokenIdToUniqueId: Array<{ tokenId: number, uniqueId: number[] }>;
//     mintToUniqueId: Array<{ mint: PublicKey, uniqueId: number[] }>;
// }

// export interface UserState {
//     user: PublicKey;
//     nonce: number;
// }

// export interface MintedNFT {
//     mint: PublicKey;
//     tokenAccount: PublicKey;
//     tokenId: number;
//     uniqueId: number[];
//     txSignature: string;
// }

// export interface UniqueIdState {
//     // Program state
//     program: Program<UniqueLow> | null;
//     isInitialized: boolean;
    
//     // Collection data
//     collection: Collection | null;
//     userState: UserState | null;
//     isCollectionInitialized: boolean;
    
//     // NFT data
//     userNFTs: MintedNFT[];
//     totalSupply: number;
//     userNonce: number;
    
//     // UI state
//     loading: boolean;
//     error: string | null;
    
//     // Network dependency tracking
//     lastNetworkHash: string | null;
// }

// export interface UniqueIdStore extends UniqueIdState {
//     // Program actions
//     setProgram: (program: Program<UniqueLow> | null) => void;
//     setIsInitialized: (initialized: boolean) => void;
    
//     // Collection data actions
//     setCollection: (collection: Collection | null) => void;
//     setUserState: (userState: UserState | null) => void;
//     setIsCollectionInitialized: (initialized: boolean) => void;
    
//     // NFT data actions
//     setUserNFTs: (nfts: MintedNFT[]) => void;
//     addMintedNFT: (nft: MintedNFT) => void;
//     setTotalSupply: (supply: number) => void;
//     setUserNonce: (nonce: number) => void;
    
//     // UI actions
//     setLoading: (loading: boolean) => void;
//     setError: (error: string | null) => void;
    
//     // Network synchronization
//     syncWithNetwork: () => void;
//     reset: () => void;
    
//     // Computed getters
//     getNFTByMint: (mint: PublicKey) => MintedNFT | null;
//     getNFTByTokenId: (tokenId: number) => MintedNFT | null;
//     getUniqueIdByMint: (mint: PublicKey) => number[] | null;
//     getTokenIdByUniqueId: (uniqueId: number[]) => number | null;
//     hasNFTs: () => boolean;
//     getCollectionPda: () => PublicKey;
// }

// const initialState: UniqueIdState = {
//     program: null,
//     isInitialized: false,
//     collection: null,
//     userState: null,
//     isCollectionInitialized: false,
//     userNFTs: [],
//     totalSupply: 0,
//     userNonce: 0,
//     loading: false,
//     error: null,
//     lastNetworkHash: null,
// };

// export const useUniqueIdStore = create<UniqueIdStore>()(
//     devtools(
//         immer((set, get) => ({
//             ...initialState,

//             // Program actions
//             setProgram: (program) => set((state) => {
//                 state.program = program;
//                 state.isInitialized = !!program;
//                 console.log('[UniqueIdStore] Program set:', !!program);
//             }),

//             setIsInitialized: (initialized) => set((state) => {
//                 state.isInitialized = initialized;
//             }),

//             // Collection data actions
//             setCollection: (collection) => set((state) => {
//                 state.collection = collection;
//                 if (collection) {
//                     state.totalSupply = collection.totalSupply;
//                     state.isCollectionInitialized = true;
//                 }
//                 console.log('[UniqueIdStore] Collection updated:', collection?.name);
//             }),

//             setUserState: (userState) => set((state) => {
//                 state.userState = userState;
//                 if (userState) {
//                     state.userNonce = userState.nonce;
//                 }
//                 console.log('[UniqueIdStore] User state updated, nonce:', userState?.nonce);
//             }),

//             setIsCollectionInitialized: (initialized) => set((state) => {
//                 state.isCollectionInitialized = initialized;
//             }),

//             // NFT data actions
//             setUserNFTs: (nfts) => set((state) => {
//                 state.userNFTs = nfts;
//                 console.log('[UniqueIdStore] User NFTs updated:', nfts.length, 'NFTs');
//             }),

//             addMintedNFT: (nft) => set((state) => {
//                 const existingIndex = state.userNFTs.findIndex(n => 
//                     n.mint.toBase58() === nft.mint.toBase58()
//                 );
                
//                 if (existingIndex >= 0) {
//                     // Update existing NFT
//                     state.userNFTs[existingIndex] = nft;
//                 } else {
//                     // Add new NFT
//                     state.userNFTs.push(nft);
//                 }
//                 console.log('[UniqueIdStore] NFT added/updated:', nft.mint.toBase58());
//             }),

//             setTotalSupply: (supply) => set((state) => {
//                 state.totalSupply = supply;
//             }),

//             setUserNonce: (nonce) => set((state) => {
//                 state.userNonce = nonce;
//             }),

//             // UI actions
//             setLoading: (loading) => set((state) => {
//                 state.loading = loading;
//             }),

//             setError: (error) => set((state) => {
//                 state.error = error;
//                 if (error) {
//                     console.error('[UniqueIdStore] Error set:', error);
//                 }
//             }),

//             // Network synchronization
//             syncWithNetwork: () => set((state) => {
//                 const networkState = useNetworkStore.getState();
//                 const networkHash = `${networkState.currentNetwork}-${networkState.isReady}-${!!networkState.connection}`;
                
//                 console.log('[UniqueIdStore] Syncing with network:', {
//                     currentHash: state.lastNetworkHash,
//                     newHash: networkHash,
//                     isReady: networkState.isReady
//                 });

//                 // Check if network state changed
//                 if (state.lastNetworkHash !== networkHash) {
//                     state.lastNetworkHash = networkHash;

//                     if (!networkState.isReady || !networkState.isSolanaNetwork) {
//                         // Network not ready or not Solana - clear program state
//                         console.log('[UniqueIdStore] Network not ready, clearing program state');
//                         state.program = null;
//                         state.isInitialized = false;
//                         state.collection = null;
//                         state.userState = null;
//                         state.isCollectionInitialized = false;
//                         state.userNFTs = [];
//                         state.totalSupply = 0;
//                         state.userNonce = 0;
//                         state.error = null;
//                     } else {
//                         // Network is ready - clear error and prepare for program initialization
//                         console.log('[UniqueIdStore] Network ready for program initialization');
//                         state.error = null;
//                         // Note: Program initialization happens in the hook, not here
//                     }
//                 }
//             }),

//             reset: () => set((state) => {
//                 console.log('[UniqueIdStore] Resetting state');
//                 Object.assign(state, initialState);
//             }),

//             // Computed getters
//             getNFTByMint: (mint) => {
//                 const state = get();
//                 return state.userNFTs.find(nft => nft.mint.equals(mint)) || null;
//             },

//             getNFTByTokenId: (tokenId) => {
//                 const state = get();
//                 return state.userNFTs.find(nft => nft.tokenId === tokenId) || null;
//             },

//             getUniqueIdByMint: (mint) => {
//                 const state = get();
//                 if (!state.collection) return null;
                
//                 const mapping = state.collection.mintToUniqueId.find(
//                     m => m.mint.toBase58() === mint.toBase58()
//                 );
//                 return mapping?.uniqueId || null;
//             },

//             getTokenIdByUniqueId: (uniqueId) => {
//                 const state = get();
//                 if (!state.collection) return null;
                
//                 const mapping = state.collection.uniqueIdToTokenId.find(
//                     m => JSON.stringify(m.uniqueId) === JSON.stringify(uniqueId)
//                 );
//                 return mapping?.tokenId || null;
//             },

//             hasNFTs: () => {
//                 const state = get();
//                 return state.userNFTs.length > 0;
//             },

//             getCollectionPda: () => CONFIG.COLLECTION_PDA,
//         })),
//         { name: 'uniqueid-store' }
//     )
// );

// // Auto-sync with network store changes
// useNetworkStore.subscribe(
//     () => {
//         console.log('[UniqueIdStore] Network state changed, triggering sync');
//         useUniqueIdStore.getState().syncWithNetwork();
//     }
// );

// // Selectors
// export const selectUniqueIdState = (state: UniqueIdStore) => ({
//     program: state.program,
//     isInitialized: state.isInitialized,
//     isCollectionInitialized: state.isCollectionInitialized,
//     loading: state.loading,
//     error: state.error,
// });

// export const selectCollectionData = (state: UniqueIdStore) => ({
//     collection: state.collection,
//     userState: state.userState,
//     totalSupply: state.totalSupply,
//     userNonce: state.userNonce,
// });

// export const selectNFTData = (state: UniqueIdStore) => ({
//     userNFTs: state.userNFTs,
// });

// export const selectUniqueIdProgram = (state: UniqueIdStore) => state.program;
// export const selectCollection = (state: UniqueIdStore) => state.collection;
// export const selectUserNFTs = (state: UniqueIdStore) => state.userNFTs;
// export const selectUniqueIdLoading = (state: UniqueIdStore) => state.loading;
// export const selectUniqueIdError = (state: UniqueIdStore) => state.error;
// export const selectCollectionPda = () => CONFIG.COLLECTION_PDA;