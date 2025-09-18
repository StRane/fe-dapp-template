import {  useEffect, useCallback, useRef } from 'react';
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
    // useEffect(() => {
    //     const unsubscribe = useNetworkStore.subscribe((state, prevState) => {
    //         if (state.currentNetwork !== prevState?.currentNetwork) {
    //             console.log('[useToken] Network changed - resetting loading flags');
    //             hasInitializedProgram.current = false;
    //             hasLoadedTokenData.current = false;
    //         }
    //     });
    //     return unsubscribe;
    // }, []);

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
                console.log('[useToken] Initializing program...');
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

                console.log('[useToken] Program initialized successfully:', {
                    programId: CONFIG.TOKEN_PROGRAM_ID.toBase58(),
                    mintAuthPda: derivedMintAuthPda.toBase58()
                });

                // Update store
                setProgram(newProgram);
                setMintAuthPda(derivedMintAuthPda);

            } catch (err) {
                console.error('[useToken] Program initialization failed:', err);
                setError(`Failed to initialize: ${(err as Error).message}`);
                hasInitializedProgram.current = false;
            } finally {
                setLoading(false);
            }
        };

        if (connection && address && walletProvider && isNetworkReady && isSolanaNetwork && !hasInitializedProgram.current) {
            console.log('[useToken] Starting program initialization...');
            initializeProgram();
        }

        console.log('[useToken] === PROGRAM INIT EFFECT END ===');
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
                console.log('[useToken] Loading token data...');
                hasLoadedTokenData.current = true;
                setLoading(true);

                // Get all user token accounts
                const userPublicKey = new PublicKey(address);
                const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                    userPublicKey,
                    { programId: TOKEN_PROGRAM_ID }
                );

                const results: UserToken[] = [];
                for (const { account, pubkey } of tokenAccounts.value) {
                    const parsedInfo = account.data.parsed.info;
                    const mintAddress = new PublicKey(parsedInfo.mint);
                    const balance = Number(parsedInfo.tokenAmount.uiAmount) || 0;
                    const decimals = Number(parsedInfo.tokenAmount.decimals);

                    // Only include tokens with balance and correct mint authority
                    if (balance > 0 && decimals > 0) {
                        try {
                            const mintInfo = await connection.getParsedAccountInfo(mintAddress);
                            const mintData = mintInfo.value?.data;

                            if (mintData && 'parsed' in mintData) {
                                const mintAuthority = mintData.parsed.info.mintAuthority
                                    ? new PublicKey(mintData.parsed.info.mintAuthority)
                                    : null;

                                // Filter by our program's mint authority
                                if (mintAuthority && mintAuthority.equals(mintAuthPda)) {
                                    results.push({
                                        mint: mintAddress,
                                        balance,
                                        account: pubkey,
                                        decimals
                                    });
                                }
                            }
                        } catch (err) {
                            console.warn('[useToken] Error checking mint authority for', mintAddress.toBase58(), err);
                        }
                    }
                }

                // Update store with results
                setUserTokens(results);
                console.log('[useToken] Token data loaded successfully:', results.length, 'tokens');

            } catch (err) {
                console.error('[useToken] Error loading token data:', err);
                setError(`Failed to load token data: ${(err as Error).message}`);
                hasLoadedTokenData.current = false;
            } finally {
                setLoading(false);
            }
        };

        if (program && address && connection && mintAuthPda && !hasLoadedTokenData.current && !loading) {
            console.log('[useToken] Starting token data loading...');
            loadTokenData();
        }

        console.log('[useToken] === TOKEN DATA LOADING EFFECT END ===');
    }, [program, address, connection, mintAuthPda, setUserTokens, setLoading, setError, loading]);

    // Action functions
    const refreshAllData = useCallback(() => {
        console.log('[useToken] === REFRESH ALL DATA START ===');
        if (program && address && connection && mintAuthPda) {
            hasLoadedTokenData.current = false;
            // The effect will automatically trigger
        }
        console.log('[useToken] === REFRESH ALL DATA END ===');
    }, [program, address, connection, mintAuthPda]);

    // Mint tokens - ACTION only, updates store automatically
    const mintTokens = useCallback(async (amount: BN, mintAddress?: PublicKey): Promise<string | null> => {
        console.log('[useToken] === MINT TOKENS START ===');
        
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

            console.log('[useToken] Minting tokens:', {
                amount: amount.toString(),
                mint: mintAddress.toBase58(),
                caller: userPublicKey.toBase58(),
            });

            const tx = await program.methods
                .mintTokens(amount)
                .accounts({
                    caller: userPublicKey,
                    mint: mintAddress,
                })
                .rpc();

            console.log('[useToken] Tokens minted successfully:', tx);

            // Refresh store data after successful mint
            refreshAllData();

            return tx;
        } catch (err) {
            console.error('[useToken] Error minting tokens:', err);
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
            console.error('[useToken] Error getting balance:', err);
            return 0;
        }
    }, [connection, address]);

    console.log('[useToken] === HOOK CALL END ===');

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

// import { useState, useEffect, useCallback } from 'react';
// import { useAppKitAccount, useAppKitNetwork, useAppKitProvider } from '@reown/appkit/react';
// import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
// import {
//     PublicKey,
//     Commitment,
//     Keypair,
// } from '@solana/web3.js';
// import {
//     TOKEN_PROGRAM_ID,
//     getAssociatedTokenAddressSync,
//     getAccount,
//     TokenAccountNotFoundError,
//     TokenInvalidAccountOwnerError,
// } from '@solana/spl-token';
// import { AnchorWallet } from '@solana/wallet-adapter-react';

// import type { TestToken } from '@/types/test_token';
// import IDL from '@/idl/test_token.json';

// // Import stores
// import { useNetworkStore } from '@/store/networkStore';
// import { useTokenStore, type UserToken } from '@/store/tokenStore';

// const CONFIG = {
//     PROGRAM_ID: 'HY3dPfn3MJqLSbQm4jExye2H8KZag8AkD2AmBXgL2SKm',
//     MINT_AUTH_SEED: Buffer.from("mint_auth"),
// };

// export interface UseTokenReturn {
//     // Store state (read-only)
//     program: Program<TestToken> | null;
//     userTokens: UserToken[];
//     mintAuthPda: PublicKey | null;
//     loading: boolean;
//     error: string | null;
    
//     // Network state (read-only)
//     connection: any | null;
//     currentNetwork: string | null;
//     isSolanaNetwork: boolean;
//     isNetworkReady: boolean;

//     // AppKit state (read-only)
//     isConnected: boolean;
//     walletAddress: string | undefined;

//     // Actions only (no direct data fetching in components)
//     mintTokens: (amount: BN, mintAddress?: PublicKey) => Promise<string | null>;
//     getUserBalance: (mintAddress?: PublicKey) => Promise<number>;
    
//     // Store actions
//     refreshAllData: () => void;
// }

// export const useToken = (): UseTokenReturn => {
//     console.log('[useToken] === HOOK CALL START ===');
    
//     // AppKit hooks (wallet info only)
//     const { address, isConnected } = useAppKitAccount();
//     const { caipNetwork } = useAppKitNetwork();
//     const { walletProvider } = useAppKitProvider<AnchorWallet>('solana');

//     // Network store (read-only)
//     const connection = useNetworkStore((state) => state.connection);
//     const currentNetwork = useNetworkStore((state) => state.currentNetwork);
//     const isSolanaNetwork = useNetworkStore((state) => state.isSolanaNetwork);
//     const isNetworkReady = useNetworkStore((state) => state.isReady);
//     const { syncNetworkFromAppKit } = useNetworkStore();

//     // Token store (read-only + actions)
//     const program = useTokenStore((state) => state.program);
//     const userTokens = useTokenStore((state) => state.userTokens);
//     const mintAuthPda = useTokenStore((state) => state.mintAuthPda);
//     const loading = useTokenStore((state) => state.loading);
//     const error = useTokenStore((state) => state.error);
    
//     const {
//         setProgram,
//         setMintAuthPda,
//         setUserTokens,
//         setLoading,
//         setError,
//         syncWithNetwork,
//     } = useTokenStore();

//     const programId = new PublicKey(CONFIG.PROGRAM_ID);

//     console.log('[useToken] Store state:', {
//         hasProgram: !!program,
//         userTokensCount: userTokens.length,
//         hasMintAuthPda: !!mintAuthPda,
//         loading,
//         hasError: !!error
//     });

//     // NOTE: Network sync removed - handled centrally by the app or one hook only
//     // The store will sync when network changes through store subscriptions

//     // Store sync - trigger when network state changes
//     useEffect(() => {
//         console.log('[useToken] === STORE SYNC EFFECT START ===');
//         if (isConnected && isNetworkReady && address) {
//             console.log('[useToken] Triggering store sync');
//             syncWithNetwork();
//         }
//         console.log('[useToken] === STORE SYNC EFFECT END ===');
//     }, [isConnected, isNetworkReady, address, syncWithNetwork]);

//     // Program initialization - ONLY when store sync indicates it's needed
//     useEffect(() => {
//         const initializeProgram = async () => {
//             console.log('[useToken] === PROGRAM INIT EFFECT START ===');
//             console.log('[useToken] Program initialization check:', {
//                 isConnected,
//                 hasAddress: !!address,
//                 hasConnection: !!connection,
//                 hasWalletProvider: !!walletProvider,
//                 isNetworkReady,
//                 hasExistingProgram: !!program,
//                 connectionRpc: connection?.rpcEndpoint
//             });

//             if (!isConnected || !address || !connection || !walletProvider || !isNetworkReady) {
//                 console.log('[useToken] Program init conditions not met, clearing state');
//                 if (program) {
//                     console.log('[useToken] Clearing existing program state');
//                     setProgram(null);
//                     setMintAuthPda(null);
//                 }
//                 console.log('[useToken] === PROGRAM INIT EFFECT END (early) ===');
//                 return;
//             }

//             // Don't reinitialize if program already exists
//             if (program && mintAuthPda) {
//                 console.log('[useToken] Program already initialized, skipping');
//                 console.log('[useToken] === PROGRAM INIT EFFECT END (existing) ===');
//                 return;
//             }

//             try {
//                 setLoading(true);
//                 setError(null);

//                 console.log('[useToken] Initializing program...');

//                 const anchorProvider = new AnchorProvider(
//                     connection,
//                     walletProvider as AnchorWallet,
//                     { commitment: 'confirmed' as Commitment }
//                 );

//                 const newProgram = new Program<TestToken>(
//                     IDL as TestToken,
//                     anchorProvider
//                 );

//                 // Derive mint authority PDA
//                 const [mintAuthPda] = PublicKey.findProgramAddressSync(
//                     [CONFIG.MINT_AUTH_SEED],
//                     programId
//                 );

//                 console.log('[useToken] Derived PDA:', {
//                     mintAuthPda: mintAuthPda.toBase58(),
//                     programId: programId.toBase58()
//                 });

//                 // Update store
//                 setProgram(newProgram);
//                 setMintAuthPda(mintAuthPda);

//                 console.log('[useToken] Program initialized successfully');

//                 // Trigger data loading AFTER program is set
//                 await loadAllTokenData();

//             } catch (err) {
//                 console.error('[useToken] Failed to initialize program:', err);
//                 setError(`Failed to initialize: ${(err as Error).message}`);
//             } finally {
//                 setLoading(false);
//             }
//             console.log('[useToken] === PROGRAM INIT EFFECT END ===');
//         };

//         initializeProgram();
//     }, [
//         isConnected,
//         address,
//         connection?.rpcEndpoint,
//         walletProvider?.publicKey,
//         isNetworkReady,
//         currentNetwork,
//         program,
//         mintAuthPda
//     ]);

//     // Load all token data - INTERNAL function for store updates
//     const loadAllTokenData = useCallback(async () => {
//         console.log('[useToken] === LOAD ALL TOKEN DATA START ===');
        
//         // Get fresh values from store
//         const currentConnection = useNetworkStore.getState().connection;
//         const currentMintAuthPda = useTokenStore.getState().mintAuthPda;
        
//         console.log('[useToken] Dependencies check:', {
//             hasConnection: !!currentConnection,
//             hasAddress: !!address,
//             hasMintAuthPda: !!currentMintAuthPda
//         });
        
//         if (!currentConnection || !address || !currentMintAuthPda) {
//             console.log('[useToken] Missing dependencies for data loading');
//             return;
//         }

//         try {
//             setLoading(true);
            
//             // Get all user token accounts
//             const userPublicKey = new PublicKey(address);
//             const tokenAccounts = await currentConnection.getParsedTokenAccountsByOwner(
//                 userPublicKey,
//                 { programId: TOKEN_PROGRAM_ID }
//             );

//             const results: UserToken[] = [];
//             for (const { account, pubkey } of tokenAccounts.value) {
//                 const parsedInfo = account.data.parsed.info;
//                 const mintAddress = new PublicKey(parsedInfo.mint);
//                 const balance = Number(parsedInfo.tokenAmount.uiAmount) || 0;
//                 const decimals = Number(parsedInfo.tokenAmount.decimals);

//                 // Only include tokens with balance and correct mint authority
//                 if (balance > 0 && decimals > 0) {
//                     try {
//                         const mintInfo = await currentConnection.getParsedAccountInfo(mintAddress);
//                         const mintData = mintInfo.value?.data;

//                         if (mintData && 'parsed' in mintData) {
//                             const mintAuthority = mintData.parsed.info.mintAuthority
//                                 ? new PublicKey(mintData.parsed.info.mintAuthority)
//                                 : null;

//                             // Filter by our program's mint authority
//                             if (mintAuthority && mintAuthority.equals(currentMintAuthPda)) {
//                                 results.push({
//                                     mint: mintAddress,
//                                     balance,
//                                     account: pubkey,
//                                     decimals
//                                 });
//                             }
//                         }
//                     } catch (err) {
//                         console.warn('[useToken] Error checking mint authority for', mintAddress.toBase58(), err);
//                     }
//                 }
//             }

//             // Update store with results
//             setUserTokens(results);
//             console.log('[useToken] Token data loaded successfully:', results.length, 'tokens');

//         } catch (err) {
//             console.error('[useToken] Error loading token data:', err);
//             setError(`Failed to load token data: ${(err as Error).message}`);
//         } finally {
//             setLoading(false);
//         }
        
//         console.log('[useToken] === LOAD ALL TOKEN DATA END ===');
//     }, [address, setUserTokens, setLoading, setError]); // Remove stale dependencies

//     // Mint tokens - ACTION only, updates store automatically
//     const mintTokens = useCallback(async (amount: BN, mintAddress?: PublicKey): Promise<string | null> => {
//         console.log('[useToken] === MINT TOKENS START ===');
        
//         if (!program || !address || !mintAuthPda) {
//             setError('Program not initialized');
//             return null;
//         }

//         if (!mintAddress) {
//             setError('No mint address provided');
//             return null;
//         }

//         setLoading(true);
//         setError(null);

//         try {
//             const userPublicKey = new PublicKey(address);

//             console.log('[useToken] Minting tokens:', {
//                 amount: amount.toString(),
//                 mint: mintAddress.toBase58(),
//                 caller: userPublicKey.toBase58(),
//             });

//             const tx = await program.methods
//                 .mintTokens(amount)
//                 .accounts({
//                     caller: userPublicKey,
//                     mint: mintAddress,
//                 })
//                 .rpc();

//             console.log('[useToken] Tokens minted successfully:', tx);

//             // Refresh store data after successful mint
//             await loadAllTokenData();

//             return tx;
//         } catch (err) {
//             console.error('[useToken] Error minting tokens:', err);
//             setError(`Failed to mint tokens: ${(err as Error).message}`);
//             return null;
//         } finally {
//             setLoading(false);
//         }
//     }, [program, address, mintAuthPda, loadAllTokenData, setLoading, setError]);

//     // Get user balance - UTILITY function (doesn't update store)
//     const getUserBalance = useCallback(async (mintAddress?: PublicKey): Promise<number> => {
//         if (!connection || !address || !mintAddress) return 0;

//         try {
//             const userPublicKey = new PublicKey(address);
//             const tokenAccount = getAssociatedTokenAddressSync(mintAddress, userPublicKey);
//             const accountInfo = await getAccount(connection, tokenAccount);
//             return Number(accountInfo.amount);
//         } catch (err) {
//             if (err instanceof TokenAccountNotFoundError || err instanceof TokenInvalidAccountOwnerError) {
//                 return 0;
//             }
//             console.error('[useToken] Error getting balance:', err);
//             return 0;
//         }
//     }, [connection, address]);

//     // Manual refresh - PUBLIC action for components
//     const refreshAllData = useCallback(() => {
//         console.log('[useToken] Manual refresh triggered');
//         if (program && mintAuthPda) {
//             loadAllTokenData();
//         }
//     }, [program, mintAuthPda, loadAllTokenData]);

//     console.log('[useToken] === HOOK CALL END ===');

//     return {
//         // Store state (read-only)
//         program,
//         userTokens,
//         mintAuthPda,
//         loading,
//         error,
        
//         // Network state (read-only)
//         connection,
//         currentNetwork,
//         isSolanaNetwork,
//         isNetworkReady,

//         // AppKit state (read-only)
//         isConnected: isConnected && isSolanaNetwork,
//         walletAddress: address,

//         // Actions only
//         mintTokens,
//         getUserBalance,
//         refreshAllData,
//     };
// };