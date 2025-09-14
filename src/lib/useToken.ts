import { useState, useEffect, useCallback } from 'react';
import { useAppKitAccount, useAppKitNetwork, useAppKitProvider } from '@reown/appkit/react';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import {
    PublicKey,
    Commitment,
    Keypair,
} from '@solana/web3.js';
import {
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    getAccount,
    TokenAccountNotFoundError,
    TokenInvalidAccountOwnerError,
} from '@solana/spl-token';
import { AnchorWallet, Wallet } from '@solana/wallet-adapter-react';

import type { TestToken } from '@/types/test_token';
import IDL from '@/idl/test_token.json';

// Import separated stores
import {
    useNetworkStore,
    selectConnection,
    selectCurrentNetwork,
    selectIsSolanaNetwork,
    selectIsNetworkReady
} from '@/store/networkStore';

import {
    useTokenStore,
    selectTokenState,
    selectTokenData,
    selectTokenProgram,
    selectMintAuthPda,
    type TokenInfo,
    type UserToken
} from '@/store/tokenStore';

const CONFIG = {
    PROGRAM_ID: 'HY3dPfn3MJqLSbQm4jExye2H8KZag8AkD2AmBXgL2SKm',
    MINT_AUTH_SEED: Buffer.from("mint_auth"),
};

export interface UseTokenReturn {
    // Network state from network store
    connection: any | null;
    currentNetwork: string | null;
    isSolanaNetwork: boolean;
    isNetworkReady: boolean;

    // Token state from token store
    program: Program<TestToken> | null;
    tokenInfo: TokenInfo | null;
    userTokens: UserToken[];
    selectedToken: PublicKey | null;
    mintAuthPda: PublicKey | null;
    loading: boolean;
    error: string | null;

    // AppKit state
    isConnected: boolean;
    walletAddress: string | undefined;

    // Local state (specific to this hook)
    userTokenAccount: PublicKey | null;
    userBalance: number;
    mintPda: PublicKey | null;

    // Functions
    // initializeToken: () => Promise<{ mint: PublicKey; tx: string } | null>;
    mintTokens: (amount: BN, mintAddress?: PublicKey) => Promise<string | null>;
    getUserBalance: (mintAddress?: PublicKey) => Promise<number>;
    refreshTokenInfo: (mintAddress?: PublicKey) => Promise<void>;

    // Utility functions
    createUserTokenAccount: (mintAddress: PublicKey) => Promise<PublicKey | null>;
    getAllUserTokenAccounts: () => Promise<UserToken[]>;
}

export const useToken = (): UseTokenReturn => {
    // AppKit hooks (wallet info only)
    const { address, isConnected } = useAppKitAccount();
    // const { caipNetwork, caipNetworkId } = useAppKitNetwork();
    const { walletProvider } = useAppKitProvider<AnchorWallet>('solana');

    // Network store (shared across all programs)
    // const connection = useNetworkStore(selectConnection);
    // const currentNetwork = useNetworkStore(selectCurrentNetwork);
    // const isSolanaNetwork = useNetworkStore(selectIsSolanaNetwork);
    // const isNetworkReady = useNetworkStore(selectIsNetworkReady);
    const connection = useNetworkStore((state) => state.connection);
    const currentNetwork = useNetworkStore((state) => state.currentNetwork);
    const isSolanaNetwork = useNetworkStore((state) => state.isSolanaNetwork);
    const isNetworkReady = useNetworkStore((state) => state.isReady);
    // const { syncNetworkFromAppKit, reset: resetNetwork } = useNetworkStore();

    // Token store (program-specific)
    // const tokenState = useTokenStore(selectTokenState);
    const program = useTokenStore((state) => state.program);
    const mintAuthPda = useTokenStore((state) => state.mintAuthPda);
    const loading = useTokenStore((state) => state.loading);
    const error = useTokenStore((state) => state.error);
    // const tokenData = useTokenStore(selectTokenData);
    const tokenInfo = useTokenStore((state) => state.tokenInfo);
    const userTokens = useTokenStore((state) => state.userTokens);
    const selectedToken = useTokenStore((state) => state.selectedToken);
    const {
        setProgram,
        setMintAuthPda,
        setTokenInfo,
        setUserTokens,
        setLoading,
        setError,
        
    } = useTokenStore();

    // Local state (specific to this hook)
    const [userTokenAccount, setUserTokenAccount] = useState<PublicKey | null>(null);
    const [userBalance, setUserBalance] = useState<number>(0);
    const [mintPda, setMintPda] = useState<PublicKey | null>(null);

    const programId = new PublicKey(CONFIG.PROGRAM_ID);

    // Note: Network sync happens in the component, not here
    // This prevents duplicate sync calls that cause infinite loops

    // Reset stores when wallet disconnects
    // useEffect(() => {
    //     if (!isConnected) {
    //         resetNetwork();
    //         // resetToken();
    //     }
    // }, [isConnected, resetNetwork, resetToken]);

    // Initialize program when network is ready
    useEffect(() => {
        const initializeProgram = async () => {
            console.log('[useToken] Program initialization check:', {
                isConnected,
                address: !!address,
                hasConnection: !!connection,
                hasWalletProvider: !!walletProvider,
                isNetworkReady,
                hasExistingProgram: !!program,
            });
            // console.log('[useToken] Connection check')
            // console.log(connection);


            if (!isConnected || !address || !connection || !walletProvider || !isNetworkReady) {
                // Clear program state if conditions not met
                console.log("[useToken] Not connected")
                if (program) {
                    console.log('[useToken] Clearing program - conditions not met');
                    setProgram(null);
                    setMintAuthPda(null);
                }
                return;
            }

            // Don't reinitialize if program already exists for this network
            if (program && mintAuthPda) {
                console.log('[useToken] Program already initialized, skipping');
                return;
            }

            try {
                setLoading(true);
                setError(null);

                console.log('[useToken] Initializing program...');

                const anchorProvider = new AnchorProvider(
                    connection,
                    walletProvider as AnchorWallet,
                    { commitment: 'confirmed' as Commitment }
                );

                const program = new Program<TestToken>(
                    IDL as TestToken,
                    anchorProvider
                );

                // Derive mint authority PDA
                const [mintAuthPda] = PublicKey.findProgramAddressSync(
                    [CONFIG.MINT_AUTH_SEED],
                    programId
                );

                console.log('[useToken] Derived PDA:', {
                    mintAuthPda: mintAuthPda.toBase58(),
                    seed: CONFIG.MINT_AUTH_SEED,
                    programId: programId.toBase58()
                });

                // Update token store
                setProgram(program);
                setMintAuthPda(mintAuthPda);

                console.log('[useToken] Program initialized successfully:', {
                    programId: programId.toBase58(),
                    mintAuthPda: mintAuthPda.toBase58(),
                    userAddress: address,
                    network: currentNetwork,
                });

            } catch (err) {
                console.error('[useToken] Failed to initialize program:', err);
                setError(`Failed to initialize: ${(err as Error).message}`);
            } finally {
                setLoading(false);
            }
        };

        initializeProgram();
    }, [
        isConnected,
        address,
        connection?.rpcEndpoint, // Use stable property instead of connection object
        walletProvider?.publicKey, // Use stable property instead of walletProvider object
        isNetworkReady,
        currentNetwork,
        program, // This is fine - checking if program exists
    ]);

    // Initialize new token (create mint + mint authority)
    const initializeToken = useCallback(async (): Promise<{ mint: PublicKey; tx: string } | null> => {
        if (!program || !address || !mintAuthPda) {
            setError('Program not initialized');
            return null;
        }

        setLoading(true);
        setError(null);

        try {
            const mintKeypair = Keypair.generate();
            const userPublicKey = new PublicKey(address);

            console.log('[useToken] Initializing new token...', {
                mint: mintKeypair.publicKey.toBase58(),
                mintAuth: mintAuthPda.toBase58(),
                payer: userPublicKey.toBase58(),
            });

            const tx = await program.methods
                .initialize()
                .accounts({
                    payer: userPublicKey,
                    mint: mintKeypair.publicKey,
                })
                .signers([mintKeypair])
                .rpc();

            console.log('[useToken] ✅ Token initialized:', tx);

            // Set this as the current mint (local state)
            setMintPda(mintKeypair.publicKey);

            // Refresh token info
            await refreshTokenInfo(mintKeypair.publicKey);

            return {
                mint: mintKeypair.publicKey,
                tx
            };
        } catch (err) {
            console.error('[useToken] ❌ Error initializing token:', err);
            setError(`Failed to initialize token: ${(err as Error).message}`);
            return null;
        } finally {
            setLoading(false);
        }
    }, [program, address, mintAuthPda, setLoading, setError]);

    // Mint tokens to user
    const mintTokens = useCallback(async (amount: BN, mintAddress?: PublicKey): Promise<string | null> => {
        if (!program || !address || !mintAuthPda) {
            setError('Program not initialized');
            return null;
        }

        const targetMint = mintAddress || mintPda;
        if (!targetMint) {
            setError('No mint address provided');
            return null;
        }

        setLoading(true);
        setError(null);

        try {
            const userPublicKey = new PublicKey(address);

            console.log('[useToken] Minting tokens...', {
                amount: amount.toString(),
                mint: targetMint.toBase58(),
                caller: userPublicKey.toBase58(),
            });

            const tx = await program.methods
                .mintTokens(amount)
                .accounts({
                    caller: userPublicKey,
                    mint: targetMint,
                })
                .rpc();

            console.log('[useToken] ✅ Tokens minted:', tx);

            // Refresh balances
            await refreshTokenInfo(targetMint);

            return tx;
        } catch (err) {
            console.error('[useToken] ❌ Error minting tokens:', err);
            setError(`Failed to mint tokens: ${(err as Error).message}`);
            return null;
        } finally {
            setLoading(false);
        }
    }, [program, address, mintAuthPda, mintPda, setLoading, setError]);

    // Get user's token balance
    const getUserBalance = useCallback(async (mintAddress?: PublicKey): Promise<number> => {
        if (!connection || !address) return 0;

        const targetMint = mintAddress || mintPda;
        if (!targetMint) return 0;

        try {
            const userPublicKey = new PublicKey(address);
            const tokenAccount = getAssociatedTokenAddressSync(targetMint, userPublicKey);

            const accountInfo = await getAccount(connection, tokenAccount);
            return Number(accountInfo.amount);
        } catch (err) {
            if (err instanceof TokenAccountNotFoundError || err instanceof TokenInvalidAccountOwnerError) {
                return 0; // Account doesn't exist yet
            }
            console.error('[useToken] Error getting balance:', err);
            return 0;
        }
    }, [connection, address, mintPda]);

    // Create user token account if it doesn't exist
    const createUserTokenAccount = useCallback(async (mintAddress: PublicKey): Promise<PublicKey | null> => {
        if (!connection || !address) return null;

        try {
            const userPublicKey = new PublicKey(address);
            const tokenAccount = getAssociatedTokenAddressSync(mintAddress, userPublicKey);

            // Check if account exists
            try {
                await getAccount(connection, tokenAccount);
                return tokenAccount; // Already exists
            } catch (err) {
                if (!(err instanceof TokenAccountNotFoundError)) {
                    throw err;
                }
            }

            // Account doesn't exist - it will be created automatically by the mint instruction
            console.log('[useToken] Token account will be created automatically:', tokenAccount.toBase58());
            return tokenAccount;
        } catch (err) {
            console.error('[useToken] Error with token account:', err);
            return null;
        }
    }, [connection, address]);

    // Get all user token accounts for this program's tokens
    const getAllUserTokenAccounts = useCallback(async (): Promise<UserToken[]> => {
        console.log('[useToken] State BEFORE fetching accounts:', {
            currentConnection: connection,
            currentAddress: address,
            currentMintAuthPda: mintAuthPda,

        });
        if (!connection || !address || !mintAuthPda) {
            // console.log("messed up")
            return []
        };

        try {
            const userPublicKey = new PublicKey(address);

            // Get all token accounts owned by user
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

                // Only include accounts with balance and decimals > 0 (fungible tokens, not NFTs)
                if (balance > 0 && decimals > 0) {
                    try {
                        // Get mint info to check mint authority
                        const mintInfo = await connection.getParsedAccountInfo(mintAddress);
                        const mintData = mintInfo.value?.data;

                        if (mintData && 'parsed' in mintData) {
                            const mintAuthority = mintData.parsed.info.mintAuthority
                                ? new PublicKey(mintData.parsed.info.mintAuthority)
                                : null;

                            // Filter by mint authority (your program's PDA)
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
                        // Continue with next token
                    }
                }
            }

            // Update token store with results
            setUserTokens(results);
            console.log('[useToken] User token accounts updated:', results.length);

            return results;
        } catch (err) {
            console.error('[useToken] Error getting user token accounts:', err);
            return [];
        }
    }, [connection, address, mintAuthPda, setUserTokens]);

    // Refresh token info
    const refreshTokenInfo = useCallback(async (mintAddress?: PublicKey) => {
        if (!connection) return;

        const targetMint = mintAddress || mintPda;
        if (!targetMint) return;

        setLoading(true);
        try {
            // Get mint info
            const mintInfo = await connection.getParsedAccountInfo(targetMint);
            const mintData = mintInfo.value?.data;

            if (mintData && 'parsed' in mintData) {
                const parsed = mintData.parsed.info;

                const tokenInfo: TokenInfo = {
                    mint: targetMint,
                    mintAuthority: new PublicKey(parsed.mintAuthority),
                    balance: 0, // Will be updated below
                    decimals: parsed.decimals,
                    supply: parsed.supply,
                };

                // Update token store
                setTokenInfo(tokenInfo);
            }

            // Get user balance
            const balance = await getUserBalance(targetMint);
            setUserBalance(balance);

            // Set user token account
            if (address) {
                const userTokenAccount = getAssociatedTokenAddressSync(
                    targetMint,
                    new PublicKey(address)
                );
                setUserTokenAccount(userTokenAccount);
            }

        } catch (err) {
            console.error('[useToken] Error refreshing token info:', err);
            setError(`Failed to refresh: ${(err as Error).message}`);
        } finally {
            setLoading(false);
        }
    }, [connection, mintPda, getUserBalance, address, setTokenInfo, setLoading, setError]);

    return {
        // Network state from network store
        connection,
        currentNetwork,
        isSolanaNetwork,
        isNetworkReady,

        // Token state from token store
        program: program,
        tokenInfo: tokenInfo,
        userTokens: userTokens,
        selectedToken: selectedToken,
        mintAuthPda: mintAuthPda,
        loading: loading,
        error: error,

        // AppKit state
        isConnected: isConnected && isSolanaNetwork,
        walletAddress: address,

        // Local state
        userTokenAccount,
        userBalance,
        mintPda,

        // Functions
        initializeToken,
        mintTokens,
        getUserBalance,
        refreshTokenInfo,

        // Utility functions
        createUserTokenAccount,
        getAllUserTokenAccounts,
    };
};