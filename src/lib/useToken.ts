import { useEffect, useCallback, useRef } from 'react';
import { useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import {
    PublicKey,
    Commitment,
} from '@solana/web3.js';
import {
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    getAccount,
    TokenAccountNotFoundError,
    TokenInvalidAccountOwnerError,
} from '@solana/spl-token';
import { AnchorWallet } from '@solana/wallet-adapter-react';

import type { TestToken } from '@/types/test_token';
import IDL from '@/idl/test_token.json';

// Import stores
import { useNetworkStore } from '@/store/networkStore';
import { useTokenStore, type UserToken } from '@/store/tokenStore';

// Import new config structure
import { CONFIG } from '@/config/programs';

export interface UseTokenReturn {
    // Store state (read-only)
    program: Program<TestToken> | null;
    userTokens: UserToken[];
    mintAuthPda: PublicKey | null;
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

    // Actions only (no direct data fetching in components)
    mintTokens: (amount: BN, mintAddress?: PublicKey) => Promise<string | null>;
    getUserBalance: (mintAddress?: PublicKey) => Promise<number>;

    // Store actions
    refreshAllData: () => void;
}

export const useToken = (): UseTokenReturn => {
    console.log('[useToken] === HOOK CALL START ===');

    // AppKit hooks (wallet info only)
    const { address, isConnected } = useAppKitAccount();
    const { walletProvider } = useAppKitProvider<AnchorWallet>('solana');

    // Network store (read-only)
    const { connection, currentNetwork, isSolanaNetwork, isReady: isNetworkReady } = useNetworkStore();

    // Token store (read-only + actions)
    const {
        program,
        userTokens,
        mintAuthPda,
        loading,
        error,
        setProgram,
        setMintAuthPda,
        setUserTokens,
        setLoading,
        setError,
    } = useTokenStore();

    // Loading guards to prevent concurrent operations
    const hasInitializedProgram = useRef(false);
    const hasLoadedTokenData = useRef(false);

    console.log('[useToken] Store state:', {
        hasProgram: !!program,
        userTokensCount: userTokens.length,
        hasMintAuthPda: !!mintAuthPda,
        loading,
        hasError: !!error
    });

    // Network change effect - resets loading flags only
    useEffect(() => {
        const unsubscribe = useNetworkStore.subscribe((state, prevState) => {
            if (state.currentNetwork !== prevState?.currentNetwork) {
                console.log('[useToken] Network changed - resetting loading flags');
                hasInitializedProgram.current = false;
                hasLoadedTokenData.current = false;
            }
        });
        return unsubscribe;
    }, []);

    // Program initialization effect - ONLY sets up program (no manual sync)
    useEffect(() => {
        console.log('[useToken] === PROGRAM INIT EFFECT START ===');

        const initializeProgram = async () => {
            if (hasInitializedProgram.current) {
                return;
            }

            if (!connection || !address || !walletProvider || !isNetworkReady || !isSolanaNetwork) {
                return;
            }

            try {
                // console.log('[useToken] Initializing program...');
                hasInitializedProgram.current = true;
                setLoading(true);
                setError(null);

                const anchorProvider = new AnchorProvider(
                    connection,
                    walletProvider as AnchorWallet,
                    { commitment: 'confirmed' as Commitment }
                );

                const newProgram = new Program<TestToken>(
                    IDL as TestToken,
                    anchorProvider
                );

                // Derive mint authority PDA
                const [derivedMintAuthPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from("mint_auth")],
                    CONFIG.TOKEN_PROGRAM_ID
                );

                // console.log('[useToken] Program initialized successfully:', {
                //     programId: CONFIG.TOKEN_PROGRAM_ID.toBase58(),
                //     mintAuthPda: derivedMintAuthPda.toBase58()
                // });

                // Update store
                setProgram(newProgram);
                setMintAuthPda(derivedMintAuthPda);

            } catch (err) {
                // console.error('[useToken] Program initialization failed:', err);
                setError(`Failed to initialize: ${(err as Error).message}`);
                hasInitializedProgram.current = false;
            } finally {
                setLoading(false);
            }
        };

        if (connection && address && walletProvider && isNetworkReady && isSolanaNetwork && !hasInitializedProgram.current) {
            // console.log('[useToken] Starting program initialization...');
            initializeProgram();
        }

        // console.log('[useToken] === PROGRAM INIT EFFECT END ===');
    }, [connection, address, walletProvider, isNetworkReady, isSolanaNetwork, setProgram, setMintAuthPda, setLoading, setError]);

    // Token data loading effect - ONLY loads data when program is ready
    useEffect(() => {
        console.log('[useToken] === TOKEN DATA LOADING EFFECT START ===');


        const loadTokenData = async () => {
            if (hasLoadedTokenData.current) {
                return;
            }

            if (!program || !address || !connection || !mintAuthPda) {
                return;
            }

            try {
                // console.log('[useToken] Loading token data...');
                hasLoadedTokenData.current = true;
                setLoading(true);

                // Get all user token accounts
                const userPublicKey = new PublicKey(address);
                const supportedMints = CONFIG.TEST_TOKEN_MINTS;

                const tokenAccountAddresses = supportedMints.map(mint =>
                    getAssociatedTokenAddressSync(mint, userPublicKey)
                );

                // Single batch call to get all parsed account info
                const parsedAccounts = await Promise.all(
                    tokenAccountAddresses.map(addr =>
                        connection.getParsedAccountInfo(addr).catch(() => null)
                    )
                );

                const results: UserToken[] = [];

                supportedMints.forEach((mint, i) => {
                    const parsedAccount = parsedAccounts[i];

                    if (parsedAccount?.value?.data && 'parsed' in parsedAccount.value.data) {
                        const tokenData = parsedAccount.value.data.parsed.info;
                        const balance = Number(tokenData.tokenAmount.uiAmount) || 0;
                        const decimals = Number(tokenData.tokenAmount.decimals);

                        if (balance > 0) {
                            results.push({
                                mint,
                                balance,
                                account: tokenAccountAddresses[i],
                                decimals
                            });
                        }
                    }
                });

                // Update store with results
                setUserTokens(results);
                // console.log('[useToken] Token data loaded successfully:', results.length, 'tokens');

            } catch (err) {
                // console.error('[useToken] Error loading token data:', err);
                setError(`Failed to load token data: ${(err as Error).message}`);
                hasLoadedTokenData.current = false;
            } finally {
                setLoading(false);
            }
        };

        if (program && address && connection && mintAuthPda && !hasLoadedTokenData.current && !loading) {
            // console.log('[useToken] Starting token data loading...');
            loadTokenData();
        }

        console.log('[useToken] === TOKEN DATA LOADING EFFECT END ===');
    }, [program, address, connection, mintAuthPda, setUserTokens, setLoading, setError]);
    // [program, address, connection, mintAuthPda, setUserTokens, setLoading, setError, loading]);
    // Action functions
    const refreshAllData = useCallback(() => {
        // console.log('[useToken] === REFRESH ALL DATA START ===');
        if (program && address && connection && mintAuthPda) {
            hasLoadedTokenData.current = false;
            // The effect will automatically trigger
        }
        // console.log('[useToken] === REFRESH ALL DATA END ===');
    }, [program, address, connection, mintAuthPda]);

    // Mint tokens - ACTION only, updates store automatically
    const mintTokens = useCallback(async (amount: BN, mintAddress?: PublicKey): Promise<string | null> => {
        // console.log('[useToken] === MINT TOKENS START ===');

        if (!program || !address || !mintAuthPda) {
            setError('Program not initialized');
            return null;
        }

        if (!mintAddress) {
            setError('No mint address provided');
            return null;
        }

        setLoading(true);
        setError(null);

        try {
            const userPublicKey = new PublicKey(address);

            // console.log('[useToken] Minting tokens:', {
            //     amount: amount.toString(),
            //     mint: mintAddress.toBase58(),
            //     caller: userPublicKey.toBase58(),
            // });

            const tx = await program.methods
                .mintTokens(amount)
                .accounts({
                    caller: userPublicKey,
                    mint: mintAddress,
                })
                .rpc();

            // console.log('[useToken] Tokens minted successfully:', tx);

            // Refresh store data after successful mint
            refreshAllData();

            return tx;
        } catch (err) {
            // console.error('[useToken] Error minting tokens:', err);
            setError(`Failed to mint tokens: ${(err as Error).message}`);
            return null;
        } finally {
            setLoading(false);
        }
    }, [program, address, mintAuthPda, refreshAllData, setLoading, setError]);

    // Get user balance - UTILITY function (doesn't update store)
    const getUserBalance = useCallback(async (mintAddress?: PublicKey): Promise<number> => {
        if (!connection || !address || !mintAddress) return 0;

        try {
            const userPublicKey = new PublicKey(address);
            const tokenAccount = getAssociatedTokenAddressSync(mintAddress, userPublicKey);
            const accountInfo = await getAccount(connection, tokenAccount);
            return Number(accountInfo.amount);
        } catch (err) {
            if (err instanceof TokenAccountNotFoundError || err instanceof TokenInvalidAccountOwnerError) {
                return 0;
            }
            // console.error('[useToken] Error getting balance:', err);
            return 0;
        }
    }, [connection, address]);

    // console.log('[useToken] === HOOK CALL END ===');

    return {
        // Store state (read-only)
        program,
        userTokens,
        mintAuthPda,
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

        // Actions only
        mintTokens,
        getUserBalance,
        refreshAllData,
    };
};