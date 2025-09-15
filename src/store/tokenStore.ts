import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { Program } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import type { TestToken } from '@/types/test_token';
import { useNetworkStore } from './networkStore';

// const CONFIG = {
//     PROGRAM_ID: 'HY3dPfn3MJqLSbQm4jExye2H8KZag8AkD2AmBXgL2SKm',
//     MINT_AUTH_SEED: Buffer.from("mint_auth"),
// };

export interface TokenInfo {
    mint: PublicKey;
    mintAuthority: PublicKey;
    balance: number;
    decimals: number;
    supply: string;
}

export interface UserToken {
    mint: PublicKey;
    balance: number;
    account: PublicKey;
    decimals: number;
}

export interface TokenState {
    // Program state
    program: Program<TestToken> | null;
    mintAuthPda: PublicKey | null;
    isInitialized: boolean;

    // Token data
    tokenInfo: TokenInfo | null;
    userTokens: UserToken[];
    selectedToken: PublicKey | null;

    // UI state
    loading: boolean;
    error: string | null;

    // Network dependency tracking
    lastNetworkHash: string | null;
}

export interface TokenStore extends TokenState {
    // Program actions
    setProgram: (program: Program<TestToken> | null) => void;
    setMintAuthPda: (mintAuthPda: PublicKey | null) => void;
    setIsInitialized: (initialized: boolean) => void;

    // Token data actions
    setTokenInfo: (tokenInfo: TokenInfo | null) => void;
    setUserTokens: (tokens: UserToken[]) => void;
    addUserToken: (token: UserToken) => void;
    updateUserTokenBalance: (mint: PublicKey, balance: number) => void;
    setSelectedToken: (token: PublicKey | null) => void;

    // UI actions
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;

    // Network synchronization
    syncWithNetwork: () => void;
    reset: () => void;

    // Computed getters
    getTokenByMint: (mint: PublicKey) => UserToken | null;
    getTotalTokensValue: () => number;
    hasTokens: () => boolean;
}

const initialState: TokenState = {
    program: null,
    mintAuthPda: null,
    isInitialized: false,
    tokenInfo: null,
    userTokens: [],
    selectedToken: null,
    loading: false,
    error: null,
    lastNetworkHash: null,
};

export const useTokenStore = create<TokenStore>()(
    devtools(
        immer((set, get) => ({
            ...initialState,

            // Program actions
            setProgram: (program) => set((state) => {
                state.program = program;
                state.isInitialized = !!program;
                console.log('[TokenStore] Program set:', !!program);
            }),

            setMintAuthPda: (mintAuthPda) => set((state) => {
                console.log('[TokenStore] setMintAuthPda called with:', {
                    mintAuthPda: mintAuthPda?.toBase58(),
                    currentValue: state.mintAuthPda?.toBase58()
                });
                state.mintAuthPda = mintAuthPda;
                console.log('[TokenStore] MintAuth PDA set to:', state.mintAuthPda?.toBase58());
            }),

            setIsInitialized: (initialized) => set((state) => {
                state.isInitialized = initialized;
            }),

            // Token data actions
            setTokenInfo: (tokenInfo) => set((state) => {
                state.tokenInfo = tokenInfo;
                console.log('[TokenStore] Token info updated:', tokenInfo?.mint.toBase58());
            }),

            setUserTokens: (tokens) => set((state) => {
                state.userTokens = tokens;
                console.log('[TokenStore] User tokens updated:', tokens.length, 'tokens');
            }),

            addUserToken: (token) => set((state) => {
                const existingIndex = state.userTokens.findIndex(t =>
                    t.mint.toBase58() === token.mint.toBase58()
                );

                if (existingIndex >= 0) {
                    // Update existing token
                    state.userTokens[existingIndex] = token;
                } else {
                    // Add new token
                    state.userTokens.push(token);
                }
                console.log('[TokenStore] Token added/updated:', token.mint.toBase58());
            }),

            updateUserTokenBalance: (mint, balance) => set((state) => {
                const token = state.userTokens.find(t => t.mint.equals(mint));
                if (token) {
                    token.balance = balance;
                    console.log('[TokenStore] Balance updated:', mint.toBase58(), balance);
                }
            }),

            setSelectedToken: (token) => set((state) => {
                state.selectedToken = token;
                console.log('[TokenStore] Selected token:', token?.toBase58());
            }),

            // UI actions
            setLoading: (loading) => set((state) => {
                state.loading = loading;
            }),

            setError: (error) => set((state) => {
                state.error = error;
                if (error) {
                    console.error('[TokenStore] Error set:', error);
                }
            }),

            // Network synchronization
            syncWithNetwork: () => set((state) => {
                const networkState = useNetworkStore.getState();
                const networkHash = `${networkState.currentNetwork}-${networkState.isReady}-${!!networkState.connection}`;

                console.log('[TokenStore] === TOKEN SYNC DEBUG START ===');
                console.log('[TokenStore] Network state:', {
                    currentNetwork: networkState.currentNetwork,
                    isReady: networkState.isReady,
                    hasConnection: !!networkState.connection,
                    isSolanaNetwork: networkState.isSolanaNetwork
                });
                console.log('[TokenStore] Hash comparison:', {
                    currentHash: state.lastNetworkHash,
                    newHash: networkHash,
                    hashChanged: state.lastNetworkHash !== networkHash
                });
                console.log('[TokenStore] === TOKEN SYNC DEBUG END ===');

                console.log('[TokenStore] Syncing with network:', {
                    currentHash: state.lastNetworkHash,
                    newHash: networkHash,
                    isReady: networkState.isReady
                });

                // Check if network state changed
                if (state.lastNetworkHash !== networkHash) {
                    state.lastNetworkHash = networkHash;

                    if (!networkState.isReady || !networkState.isSolanaNetwork) {
                        // Network not ready or not Solana - clear program state
                        console.log('[TokenStore] Network not ready, clearing program state');
                        state.program = null;
                        state.mintAuthPda = null;
                        state.isInitialized = false;
                        state.tokenInfo = null;
                        state.userTokens = [];
                        state.selectedToken = null;
                        state.error = null;
                    } else {
                        // Network is ready - clear error and prepare for program initialization
                        console.log('[TokenStore] Network ready for program initialization');
                        state.error = null;
                        // Note: Program initialization happens in the hook, not here
                    }
                }
            }),

            reset: () => set((state) => {
                console.log('[TokenStore] Resetting state');
                Object.assign(state, initialState);
            }),

            // Computed getters
            getTokenByMint: (mint) => {
                const state = get();
                return state.userTokens.find(token => token.mint.equals(mint)) || null;
            },

            getTotalTokensValue: () => {
                const state = get();
                return state.userTokens.reduce((total, token) => total + token.balance, 0);
            },

            hasTokens: () => {
                const state = get();
                return state.userTokens.length > 0;
            },
        })),
        { name: 'token-store' }
    )
);

// Auto-sync with network store changes
// useNetworkStore.subscribe(
//     () => {
//         console.log('[TokenStore] Network state changed, triggering sync');
//         useTokenStore.getState().syncWithNetwork();
//     }
// );

// Selectors
export const selectTokenState = (state: TokenStore) => ({
    program: state.program,
    mintAuthPda: state.mintAuthPda,
    isInitialized: state.isInitialized,
    loading: state.loading,
    error: state.error,
});

export const selectTokenData = (state: TokenStore) => ({
    tokenInfo: state.tokenInfo,
    userTokens: state.userTokens,
    selectedToken: state.selectedToken,
});

export const selectTokenProgram = (state: TokenStore) => state.program;
export const selectMintAuthPda = (state: TokenStore) => state.mintAuthPda;
export const selectUserTokens = (state: TokenStore) => state.userTokens;
export const selectTokenLoading = (state: TokenStore) => state.loading;
export const selectTokenError = (state: TokenStore) => state.error;