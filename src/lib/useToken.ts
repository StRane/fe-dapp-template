import { useState, useEffect, useCallback } from 'react';
import { useAppKitAccount, useAppKitNetwork, useAppKitProvider } from '@reown/appkit/react';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import {
    PublicKey,
    Connection,
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
import { AnchorWallet } from '@solana/wallet-adapter-react';

import type { TestToken } from '@/types/test_token'; // You'll need to generate this type
import IDL from '@/idl/test_token.json'; // You'll need to generate this IDL

// CONFIGURATION
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

// Types
export interface MintAuthorityPda {
    bump: number;
}

export interface TokenInfo {
    mint: PublicKey;
    mintAuthority: PublicKey;
    balance: number;
    decimals: number;
    supply: string;
}

export interface UseTokenReturn {
    // State
    program: Program<TestToken> | null;
    connection: Connection | null;
    loading: boolean;
    error: string | null;
    isConnected: boolean;
    walletAddress: string | undefined;

    // Token Info
    tokenInfo: TokenInfo | null;
    userTokenAccount: PublicKey | null;
    userBalance: number;
    
    // PDAs
    mintPda: PublicKey | null;
    mintAuthPda: PublicKey | null;

    // Network info
    currentNetwork: string | null;
    programId: string;

    // Functions
    initializeToken: () => Promise<{ mint: PublicKey; tx: string } | null>;
    mintTokens: (amount: BN, mintAddress?: PublicKey) => Promise<string | null>;
    getUserBalance: (mintAddress?: PublicKey) => Promise<number>;
    refreshTokenInfo: (mintAddress?: PublicKey) => Promise<void>;
    
    // Utility functions
    createUserTokenAccount: (mintAddress: PublicKey) => Promise<PublicKey | null>;
    getAllUserTokenAccounts: () => Promise<Array<{ 
        mint: PublicKey; 
        balance: number; 
        account: PublicKey; 
        mintAddress: PublicKey; 
        decimals: number; 
    }>>;
}

export const useToken = (): UseTokenReturn => {
    // AppKit hooks
    const { address, isConnected } = useAppKitAccount();
    const { caipNetwork, caipNetworkId } = useAppKitNetwork();
    const { walletProvider } = useAppKitProvider('solana');

    // State
    const [program, setProgram] = useState<Program<TestToken> | null>(null);
    const [connection, setConnection] = useState<Connection | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
    const [userTokenAccount, setUserTokenAccount] = useState<PublicKey | null>(null);
    const [userBalance, setUserBalance] = useState<number>(0);

    // PDAs
    const [mintPda, setMintPda] = useState<PublicKey | null>(null);
    const [mintAuthPda, setMintAuthPda] = useState<PublicKey | null>(null);

    // Program ID and network info
    const programId = new PublicKey(CONFIG.PROGRAM_ID);
    const isSolanaNetwork = caipNetworkId?.includes('solana') || false;
    const currentNetwork = caipNetwork?.name || null;

    // Setup connection
    useEffect(() => {
        if (isSolanaNetwork && currentNetwork) {
            const rpcUrl = CONFIG.RPC_ENDPOINTS[currentNetwork as keyof typeof CONFIG.RPC_ENDPOINTS]
                || CONFIG.RPC_ENDPOINTS['solana-testnet'];
            const newConnection = new Connection(rpcUrl, 'confirmed');
            setConnection(newConnection);
            console.log('Token hook connected to:', currentNetwork, rpcUrl);
        }
    }, [isSolanaNetwork, currentNetwork]);

    // Initialize program
    useEffect(() => {
        const initializeProgram = async () => {
            if (!isConnected || !address || !connection || !walletProvider || !isSolanaNetwork) {
                setProgram(null);
                return;
            }

            try {
                const anchorProvider = new AnchorProvider(
                    connection,
                    walletProvider as AnchorWallet,
                    { commitment: 'confirmed' as Commitment }
                );

                const program = new Program<TestToken>(
                    IDL as TestToken,
                    anchorProvider
                );
                setProgram(program);

                // Derive mint authority PDA
                const [mintAuthPda] = PublicKey.findProgramAddressSync(
                    [CONFIG.MINT_AUTH_SEED],
                    programId
                );
                setMintAuthPda(mintAuthPda);

                console.log('Token program initialized:', {
                    programId: programId.toBase58(),
                    mintAuthPda: mintAuthPda.toBase58(),
                    userAddress: address,
                });

            } catch (err) {
                console.error('Failed to initialize token program:', err);
                setError(`Failed to initialize: ${(err as Error).message}`);
            }
        };

        initializeProgram();
    }, [isConnected, address, connection, walletProvider, isSolanaNetwork]);

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

            console.log('Initializing new token...', {
                mint: mintKeypair.publicKey.toBase58(),
                mintAuth: mintAuthPda.toBase58(),
                payer: userPublicKey.toBase58(),
            });

            const tx = await program.methods
                .initialize()
                .accounts({
                    payer: userPublicKey,
                    mint: mintKeypair.publicKey,
                    // mintAuth: mintAuthPda, // Auto-derived by Anchor
                    // systemProgram: SystemProgram.programId,
                    // tokenProgram: TOKEN_PROGRAM_ID,
                    // rent: SYSVAR_RENT_PUBKEY,
                })
                .signers([mintKeypair])
                .rpc();

            console.log('✅ Token initialized:', tx);

            // Set this as the current mint
            setMintPda(mintKeypair.publicKey);
            
            // Refresh token info
            await refreshTokenInfo(mintKeypair.publicKey);

            return {
                mint: mintKeypair.publicKey,
                tx
            };
        } catch (err) {
            console.error('❌ Error initializing token:', err);
            setError(`Failed to initialize token: ${(err as Error).message}`);
            return null;
        } finally {
            setLoading(false);
        }
    }, [program, address, mintAuthPda]);

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
            
            // Get or create user's associated token account
            const recipientAccount = getAssociatedTokenAddressSync(
                targetMint,
                userPublicKey
            );

            console.log('Minting tokens...', {
                amount: amount.toString(),
                mint: targetMint.toBase58(),
                recipient: recipientAccount.toBase58(),
                caller: userPublicKey.toBase58(),
            });

            const tx = await program.methods
                .mintTokens(amount)
                .accounts({
                    caller: userPublicKey,
                    mint: targetMint,
                    // recipient: recipientAccount,
                    // mintAuth: mintAuthPda, // Auto-derived
                    // tokenProgram: TOKEN_PROGRAM_ID,
                    // associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    // systemProgram: SystemProgram.programId,
                })
                .rpc();

            console.log('✅ Tokens minted:', tx);

            // Refresh balances
            await refreshTokenInfo(targetMint);

            return tx;
        } catch (err) {
            console.error('❌ Error minting tokens:', err);
            setError(`Failed to mint tokens: ${(err as Error).message}`);
            return null;
        } finally {
            setLoading(false);
        }
    }, [program, address, mintAuthPda, mintPda]);

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
            console.error('Error getting balance:', err);
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
            console.log('Token account will be created automatically:', tokenAccount.toBase58());
            return tokenAccount;
        } catch (err) {
            console.error('Error with token account:', err);
            return null;
        }
    }, [connection, address]);

    //     getAllUserTokenAccounts: () => Promise<Array<{ 
    //     mint: PublicKey; 
    //     balance: number; 
    //     account: PublicKey; 
    //     mintAuthority: PublicKey | null; 
    //     decimals: number; 
    // }>>;

    // Get all user token accounts for this program's tokens
    const getAllUserTokenAccounts = useCallback(async (): Promise<Array<{ mint: PublicKey; balance: number; account: PublicKey; mintAddress:PublicKey; decimals: number }>> => {
        if (!connection || !address || !mintAuthPda) return [];

        try {
            const userPublicKey = new PublicKey(address);
            
            // Get all token accounts owned by user
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                userPublicKey,
                { programId: TOKEN_PROGRAM_ID }
            );

            const results = [];
            for (const { account, pubkey } of tokenAccounts.value) {
                const parsedInfo = account.data.parsed.info;
                const mintAddress = new PublicKey(parsedInfo.mint);
                const balance = Number(parsedInfo.tokenAmount.uiAmount) || 0;
                const decimals =Number(parsedInfo.tokenAmount.decimals);
                
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
                                    mintAddress,
                                    decimals
                                });
                            }
                        }
                    } catch (err) {
                        console.warn('Error checking mint authority for', mintAddress.toBase58(), err);
                        // Continue with next token
                    }
                }
            }

            console.log(results)

            return results;
        } catch (err) {
            console.error('Error getting user token accounts:', err);
            return [];
        }
    }, [connection, address, mintAuthPda]);

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
                
                setTokenInfo({
                    mint: targetMint,
                    mintAuthority: new PublicKey(parsed.mintAuthority),
                    balance: 0, // Will be updated below
                    decimals: parsed.decimals,
                    supply: parsed.supply,
                });
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
            console.error('Error refreshing token info:', err);
            setError(`Failed to refresh: ${(err as Error).message}`);
        } finally {
            setLoading(false);
        }
    }, [connection, mintPda, getUserBalance, address]);

    return {
        // State
        program,
        connection,
        loading,
        error,
        isConnected: isConnected && isSolanaNetwork,
        walletAddress: address,

        // Token Info
        tokenInfo,
        userTokenAccount,
        userBalance,

        // PDAs
        mintPda,
        mintAuthPda,

        // Network info
        currentNetwork,
        programId: CONFIG.PROGRAM_ID,

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