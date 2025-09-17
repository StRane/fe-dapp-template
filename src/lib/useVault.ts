import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppKitAccount, useAppKitNetwork, useAppKitProvider } from '@reown/appkit/react';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import {
    PublicKey,
    Commitment,
} from '@solana/web3.js';
import {
    getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { AnchorWallet } from '@solana/wallet-adapter-react';

import type { SimpleVault } from '@/types/simple_vault';
import IDL from '@/idl/simple_vault.json';

// Import stores
import { useNetworkStore } from '@/store/networkStore';
import { useVaultStore, type VaultData, type UserPosition } from '@/store/vaultStore';

// Import selection context
import { useTokenSelection, useNFTSelection } from '@/context/SelectionContext';

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

export interface UseVaultReturn {
    // Store state (read-only)
    program: Program<SimpleVault> | null;
    vault: VaultData | null;
    selectedNFTPosition: UserPosition | null;
    allUserPositions: UserPosition[];
    loading: boolean;
    userPositionLoading: boolean;
    error: string | null;

    // Network state (read-only)
    connection: any | null;
    currentNetwork: string | null;
    isSolanaNetwork: boolean;
    isNetworkReady: boolean;

    // AppKit state (read-only)
    isConnected: boolean;
    walletAddress: string | undefined;

    // Selection state (read-only)
    selectedTokenMint: PublicKey | null;
    selectedTokenAccount: PublicKey | null;
    selectedNFT: PublicKey | null;
    hasRequiredSelections: boolean;

    // Computed values
    programId: string;
    vaultConfig: typeof CONFIG;

    // Actions only (no direct data fetching in components)
    deposit: (amount: BN, assetMint: PublicKey, userNftMint: PublicKey) => Promise<string | null>;
    withdraw: (shares: BN, assetMint: PublicKey, userNftMint: PublicKey) => Promise<string | null>;
    transactionState: () => TransactionState
    // Store actions
    refreshVaultData: () => void;
    refreshUserPosition: () => void;
    refreshAllData: () => void;
}

export enum TransactionStatus {
    IDLE = 'idle',
    BUILDING = 'building',
    SIGNING = 'signing',
    CONFIRMING = 'confirming',
    SUCCESS = 'success',
    FAILED = 'failed'
}

export interface TransactionState {
    status: TransactionStatus;
    signature: string | null;
    error: string | null;
    message: string;
}

export const useVault = (): UseVaultReturn => {
    console.log('[useVault] === HOOK CALL START ===');

    // AppKit hooks (wallet info only)
    const { address, isConnected } = useAppKitAccount();
    const { caipNetwork } = useAppKitNetwork();
    const { walletProvider } = useAppKitProvider<AnchorWallet>('solana');
    const [transactionState, setTransactionState] = useState<TransactionState>({
        status: TransactionStatus.IDLE,
        signature: null,
        error: null,
        message: ''
    });

    // Network store (read-only)
    const { connection, currentNetwork, isSolanaNetwork, isReady: isNetworkReady } = useNetworkStore();

    // Vault store (read-only)
    const {
        program,
        vault,
        selectedNFTPosition,
        allUserPositions,
        loading,
        userPositionLoading,
        error,
        setProgram,
        setVault,
        updateUserPositionForNFT,
        setUserPositionLoading,
        clearUserPositions,
        setLoading,
        setError,
        getVaultConfig
    } = useVaultStore();

    // Selection context (read-only)
    const {
        selectedTokenAccount,
        selectedTokenMint,
    } = useTokenSelection();

    const { selectedNFT } = useNFTSelection();

    console.log('[useVault] Store state:', {
        hasProgram: !!program,
        hasVault: !!vault,
        userPositionsCount: allUserPositions.length,
        selectedVaultNFT: selectedNFTPosition?.nftMint?.toBase58(),
        loading,
        userPositionLoading
    });

    console.log('[useVault] Selection context state:', {
        selectedTokenMint: selectedTokenMint?.toBase58(),
        selectedTokenAccount: selectedTokenAccount?.toBase58(),
        contextSelectedNFT: selectedNFT?.toBase58()
    });

    // Loading guards to prevent concurrent operations
    const hasInitializedProgram = useRef(false);
    const hasLoadedVaultData = useRef(false);
    const isLoadingUserPosition = useRef(false);

    // Derived state
    const hasRequiredSelections = !!(selectedTokenMint && selectedTokenAccount && selectedNFT);

    // Network change effect - resets loading flags only
    useEffect(() => {
        console.log('[useVault] === NETWORK CHANGE EFFECT START ===');
        const unsubscribe = useNetworkStore.subscribe((state, prevState) => {
            if (state.currentNetwork !== prevState?.currentNetwork) {
                console.log('[useVault] Network changed - resetting loading flags');
                hasInitializedProgram.current = false;
                hasLoadedVaultData.current = false;
                isLoadingUserPosition.current = false;
                clearUserPositions();
            }
        });
        console.log('[useVault] === NETWORK CHANGE EFFECT END ===');
        return unsubscribe;
    }, [clearUserPositions]);

    // Program initialization effect - ONLY sets up program
    useEffect(() => {
        console.log('[useVault] === PROGRAM INIT EFFECT START ===');
        console.log('[useVault] Program initialization check:', {
            isConnected,
            hasAddress: !!address,
            hasConnection: !!connection,
            hasWalletProvider: !!walletProvider,
            isNetworkReady,
            isSolanaNetwork,
            hasInitialized: hasInitializedProgram.current,
            hasProgram: !!program
        });

        const initializeProgram = async () => {
            if (hasInitializedProgram.current) {
                console.log('[useVault] Program already initialized, skipping');
                return;
            }

            if (!connection || !address || !walletProvider || !isNetworkReady || !isSolanaNetwork) {
                console.log('[useVault] Missing requirements for program initialization');
                return;
            }

            try {
                console.log('[useVault] Initializing program...');
                hasInitializedProgram.current = true;

                const provider = new AnchorProvider(
                    connection,
                    walletProvider,
                    {
                        preflightCommitment: 'processed' as Commitment,
                        commitment: 'processed' as Commitment
                    }
                );

                const programInstance = new Program<SimpleVault>(
                    IDL as SimpleVault,
                    provider
                );

                console.log('[useVault] Program created successfully');
                setProgram(programInstance);

            } catch (err) {
                console.error('[useVault] Program initialization failed:', err);
                setError(`Program initialization failed: ${(err as Error).message}`);
                hasInitializedProgram.current = false;
            }
        };

        if (connection && address && walletProvider && isNetworkReady && isSolanaNetwork && !hasInitializedProgram.current) {
            console.log('[useVault] Starting program initialization...');
            initializeProgram();
        }

        console.log('[useVault] === PROGRAM INIT EFFECT END ===');
    }, [connection, address, walletProvider, isNetworkReady, isSolanaNetwork, setProgram, setError]);

    // Vault data loading effect - ONLY loads vault data when program is ready
    useEffect(() => {
        console.log('[useVault] === VAULT DATA LOADING EFFECT START ===');

        const loadVaultData = async () => {
            if (hasLoadedVaultData.current) {
                console.log('[useVault] Vault data already loaded, skipping');
                return;
            }

            if (!program || !address || !connection) {
                console.log('[useVault] Missing requirements for vault data loading');
                return;
            }

            try {
                console.log('[useVault] Loading vault data...');
                hasLoadedVaultData.current = true;
                setLoading(true);

                console.log('[useVault] Checking if vault account exists...');
                const vaultAccount = await program.account.vault.fetchNullable(CONFIG.VAULT_PDA);

                if (vaultAccount) {
                    console.log('[useVault] Vault account found:', {
                        owner: vaultAccount.owner.toBase58(),
                        assetMint: vaultAccount.assetMint.toBase58(),
                        totalShares: vaultAccount.totalShares.toString(),
                        totalBorrowed: vaultAccount.totalBorrowed.toString()
                    });

                    setVault(vaultAccount);
                } else {
                    console.log('[useVault] No vault account found');
                    setVault(null);
                }

            } catch (err) {
                console.error('[useVault] Error loading vault data:', err);
                setError(`Failed to load vault data: ${(err as Error).message}`);
                hasLoadedVaultData.current = false;
            } finally {
                setLoading(false);
            }
        };

        if (program && address && connection && !hasLoadedVaultData.current && !loading) {
            console.log('[useVault] Starting vault data loading...');
            loadVaultData();
        }

        console.log('[useVault] === VAULT DATA LOADING EFFECT END ===');
    }, [program, address, connection, setVault, setLoading, setError, loading]);

    // User position loading effect - ONLY loads when NFT selection changes
    useEffect(() => {
        console.log('[useVault] === USER POSITION LOADING EFFECT START ===');

        const loadUserPosition = async (nftMint: PublicKey) => {
            if (isLoadingUserPosition.current) {
                console.log('[useVault] User position loading already in progress, skipping');
                return;
            }

            if (!vault || !address || !program || !connection) {
                console.log('[useVault] Missing requirements for user position loading');
                return;
            }

            try {
                console.log('[useVault] Loading position for selected NFT:', nftMint.toBase58());
                isLoadingUserPosition.current = true;
                setUserPositionLoading(true);

                const userPublicKey = new PublicKey(address);

                // Derive user's NFT token account
                const userNftTokenAccount = getAssociatedTokenAddressSync(
                    nftMint,
                    userPublicKey
                );

                // Derive user share PDA for this NFT
                const [userSharePda] = PublicKey.findProgramAddressSync(
                    [CONFIG.USER_SHARES_SEED, nftMint.toBuffer()],
                    new PublicKey(CONFIG.PROGRAM_ID)
                );

                // Derive user's share token account
                const userShareTokenAccount = getAssociatedTokenAddressSync(
                    CONFIG.SHARE_MINT,
                    userSharePda,
                    true
                );

                // Derive the UserInfo PDA
                const [userInfoPda] = PublicKey.findProgramAddressSync(
                    [
                        CONFIG.USER_INFO_SEED,
                        userNftTokenAccount.toBuffer(),
                        userShareTokenAccount.toBuffer()
                    ],
                    new PublicKey(CONFIG.PROGRAM_ID)
                );

                // Fetch the UserInfo account
                const userInfo = await program.account.userInfo.fetchNullable(userInfoPda);

                if (userInfo) {
                    console.log('[useVault] Found position for selected NFT:', {
                        nftMint: nftMint.toBase58(),
                        shares: userInfo.shares.toString(),
                        lastUpdate: userInfo.lastUpdate
                    });

                    // Calculate deposit amount based on current vault state
                    let depositAmount = Number(userInfo.shares);
                    if (vault.totalShares > 0) {
                        try {
                            const totalAssets = await connection.getTokenAccountBalance(
                                CONFIG.VAULT_TOKEN_ACCOUNT
                            );
                            const vaultBalance = Number(totalAssets.value.uiAmount || 0);

                            if (vaultBalance > 0) {
                                depositAmount = (Number(userInfo.shares) * vaultBalance) / Number(vault.totalShares);
                            }
                        } catch (err) {
                            console.warn('[useVault] Could not fetch vault balance for calculation:', err);
                        }
                    }

                    const currentPosition: UserPosition = {
                        user: userPublicKey,
                        nftMint: nftMint,
                        depositAmount,
                        shareAmount: Number(userInfo.shares),
                        timestamp: userInfo.lastUpdate * 1000
                    };

                    updateUserPositionForNFT(nftMint, currentPosition);
                } else {
                    console.log('[useVault] No position found for selected NFT');
                    updateUserPositionForNFT(nftMint, null);
                }

            } catch (err) {
                console.error('[useVault] Error loading position for selected NFT:', err);
                updateUserPositionForNFT(nftMint, null);
            } finally {
                isLoadingUserPosition.current = false;
                setUserPositionLoading(false);
            }
        };

        if (selectedNFT && vault && program && address && connection && !userPositionLoading) {
            console.log('[useVault] Starting user position loading for NFT:', selectedNFT.toBase58());
            loadUserPosition(selectedNFT);
        } else if (!selectedNFT) {
            console.log('[useVault] No NFT selected - clearing user positions');
            clearUserPositions();
        }

        console.log('[useVault] === USER POSITION LOADING EFFECT END ===');
    }, [selectedNFT, vault, program, address, connection, updateUserPositionForNFT, setUserPositionLoading, clearUserPositions]);

    // Action functions
    const refreshVaultData = useCallback(() => {
        console.log('[useVault] === REFRESH VAULT DATA START ===');
        if (program && address && connection) {
            hasLoadedVaultData.current = false;
            // The effect will automatically trigger
        }
        console.log('[useVault] === REFRESH VAULT DATA END ===');
    }, [program, address, connection]);

    const refreshUserPosition = useCallback(() => {
        console.log('[useVault] === REFRESH USER POSITION START ===');
        if (selectedNFT && vault && program && address && connection) {
            isLoadingUserPosition.current = false;
            // The effect will automatically trigger
        }
        console.log('[useVault] === REFRESH USER POSITION END ===');
    }, [selectedNFT, vault, program, address, connection]);

    const refreshAllData = useCallback(() => {
        console.log('[useVault] === REFRESH ALL DATA START ===');
        hasLoadedVaultData.current = false;
        isLoadingUserPosition.current = false;
        // The effects will automatically trigger
        console.log('[useVault] === REFRESH ALL DATA END ===');
    }, []);

    // Transaction functions

    const deposit = useCallback(async (
        amount: BN,
        assetMint: PublicKey,    // From context: selectedTokenMint 
        userNftMint: PublicKey   // From context: selectedNFT
    ): Promise<string | null> => {
        console.log('[useVault] === DEPOSIT START ===');
        console.log('[useVault] Deposit parameters:', {
            amount: amount.toString(),
            assetMint: assetMint.toBase58(),
            userNftMint: userNftMint.toBase58()
        });

        if (!program || !address || !connection) {
            const error = 'Missing program, address, or connection for deposit';
            console.error('[useVault] Deposit failed:', error);

            setTransactionState({
                status: TransactionStatus.FAILED,
                signature: null,
                error: 'Connection error',
                message: 'Wallet not connected or program not loaded'
            });

            return null;
        }

        try {
            // Reset state and start building
            setTransactionState({
                status: TransactionStatus.BUILDING,
                signature: null,
                error: null,
                message: 'Building transaction and deriving accounts...'
            });

            setLoading(true);

            const userWallet = new PublicKey(address);

            // You already have this from context - no derivation needed!
            const userAssetToken = selectedTokenAccount; // Direct from context

            // Only derive the NFT token account
            const userNftToken = getAssociatedTokenAddressSync(userNftMint, userWallet);

            // Derive user share PDA (seeds: ["user_shares_v3", nft_mint])
            const [userSharePda] = PublicKey.findProgramAddressSync(
                [Buffer.from("user_shares_v3"), userNftMint.toBuffer()],
                program.programId
            );

            // Derive user share token account (ATA of userSharePda + share_mint)
            const userShareToken = getAssociatedTokenAddressSync(
                CONFIG.SHARE_MINT,
                userSharePda,
                true // allowOwnerOffCurve for PDA
            );

            // Derive NFT user info PDA (seeds: ["user_info_v3", nft_token, share_token])
            const [nftInfo] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("user_info_v3"),
                    userNftToken.toBuffer(),
                    userShareToken.toBuffer()
                ],
                program.programId
            );

            console.log('[useVault] Derived accounts:', {
                userAssetToken: userAssetToken?.toBase58(),
                userNftToken: userNftToken.toBase58(),
                userSharePda: userSharePda.toBase58(),
                userShareToken: userShareToken.toBase58(),
                nftInfo: nftInfo.toBase58()
            });

            // Update state to signing
            setTransactionState({
                status: TransactionStatus.SIGNING,
                signature: null,
                error: null,
                message: 'Please sign the transaction in your wallet...'
            });

            console.log('[useVault] Executing deposit transaction...');

            // Execute transaction
            const tx = await program.methods
                .deposit(amount)
                .accounts({
                    user: userWallet,
                    vault: CONFIG.VAULT_PDA,
                    nftCollection: CONFIG.COLLECTION_PDA,
                    userNftToken: userNftToken,
                    userNftMint: userNftMint,
                    assetMint: assetMint,

                    vaultTokenAccount: CONFIG.VAULT_TOKEN_ACCOUNT,
                    shareMint: CONFIG.SHARE_MINT,


                })
                .rpc();

            // Update state to confirming
            setTransactionState({
                status: TransactionStatus.CONFIRMING,
                signature: tx,
                error: null,
                message: 'Transaction sent, waiting for network confirmation...'
            });

            console.log('[useVault] Transaction sent:', tx);

            // Wait for confirmation
            try {
                const confirmation = await connection.confirmTransaction(tx, 'confirmed');

                if (confirmation.value.err) {
                    throw new Error(`Transaction failed during confirmation: ${confirmation.value.err}`);
                }

                // Success state
                setTransactionState({
                    status: TransactionStatus.SUCCESS,
                    signature: tx,
                    error: null,
                    message: 'Deposit successful! Transaction confirmed on network.'
                });

                console.log('[useVault] Transaction confirmed successfully');

                // Schedule data refresh and final success message
                setTimeout(() => {
                    refreshAllData();
                    setTransactionState({
                        status: TransactionStatus.SUCCESS,
                        signature: tx,
                        error: null,
                        message: 'Balances updated successfully!'
                    });

                    // Reset to idle after showing success
                    setTimeout(() => {
                        setTransactionState({
                            status: TransactionStatus.IDLE,
                            signature: null,
                            error: null,
                            message: ''
                        });
                    }, 3000);
                }, 1000);

                console.log('[useVault] === DEPOSIT END (SUCCESS) ===');
                return tx;

            } catch (confirmError) {
                console.error('[useVault] Transaction confirmation failed:', confirmError);

                setTransactionState({
                    status: TransactionStatus.FAILED,
                    signature: tx,
                    error: `Confirmation failed: ${(confirmError as Error).message}`,
                    message: 'Transaction was sent but network confirmation failed. Check the transaction status manually.'
                });

                // Reset to idle after showing error
                setTimeout(() => {
                    setTransactionState({
                        status: TransactionStatus.IDLE,
                        signature: null,
                        error: null,
                        message: ''
                    });
                }, 5000);

                return null;
            }

        } catch (err) {
            console.error('[useVault] Deposit error:', err);

            let errorMessage = 'Transaction failed';
            let userMessage = 'An unexpected error occurred';

            if (err instanceof Error) {
                if (err.message.includes('User rejected') || err.message.includes('rejected')) {
                    errorMessage = 'Transaction cancelled';
                    userMessage = 'Transaction was cancelled by user';
                } else if (err.message.includes('already been processed')) {
                    errorMessage = 'Duplicate transaction';
                    userMessage = 'This transaction has already been processed';
                } else if (err.message.includes('insufficient funds')) {
                    errorMessage = 'Insufficient funds';
                    userMessage = 'Insufficient funds to complete the transaction';
                } else if (err.message.includes('overflow')) {
                    errorMessage = 'Amount too large';
                    userMessage = 'Transaction amount causes mathematical overflow. Try a smaller amount.';
                } else {
                    errorMessage = err.message;
                    userMessage = `Transaction failed: ${err.message}`;
                }
            }

            setTransactionState({
                status: TransactionStatus.FAILED,
                signature: null,
                error: errorMessage,
                message: userMessage
            });

            // Reset to idle after showing error
            setTimeout(() => {
                setTransactionState({
                    status: TransactionStatus.IDLE,
                    signature: null,
                    error: null,
                    message: ''
                });
            }, 5000);

            console.log('[useVault] === DEPOSIT END (ERROR) ===');
            return null;
        } finally {
            setLoading(false);
        }
    }, [program, address, connection, selectedTokenAccount, setLoading, refreshAllData]);




    const withdraw = useCallback(async (
        shares: BN,
        assetMint: PublicKey,    // From context: selectedTokenMint 
        userNftMint: PublicKey   // From context: selectedNFT
    ): Promise<string | null> => {
        console.log('[useVault] === WITHDRAW START ===');
        console.log('[useVault] Withdraw parameters:', {
            shares: shares.toString(),
            assetMint: assetMint.toBase58(),
            userNftMint: userNftMint.toBase58()
        });

        if (!program || !address || !connection) {
            const error = 'Missing program, address, or connection for withdraw';
            console.error('[useVault] Withdraw failed:', error);

            setTransactionState({
                status: TransactionStatus.FAILED,
                signature: null,
                error: 'Connection error',
                message: 'Wallet not connected or program not loaded'
            });

            return null;
        }

        try {
            // Reset state and start building
            setTransactionState({
                status: TransactionStatus.BUILDING,
                signature: null,
                error: null,
                message: 'Building withdraw transaction and deriving accounts...'
            });

            setLoading(true);

            const userWallet = new PublicKey(address);

            // ===== ACCOUNT DERIVATIONS (Same as deposit) =====

            // User's asset token account (from context)
            const userAssetToken = selectedTokenAccount;
            if (!userAssetToken) {
                throw new Error('User asset token account not found in context');
            }

            // User's NFT token account (derived)
            const userNftToken = getAssociatedTokenAddressSync(userNftMint, userWallet);

            // Derive user share PDA (seeds: ["user_shares_v3", nft_mint])
            const [userSharePda] = PublicKey.findProgramAddressSync(
                [CONFIG.USER_SHARES_SEED, userNftMint.toBuffer()],
                program.programId
            );

            // Derive user share token account (ATA of userSharePda + share_mint)
            const userShareToken = getAssociatedTokenAddressSync(
                CONFIG.SHARE_MINT,
                userSharePda,
                true // allowOwnerOffCurve for PDA
            );

            // Derive NFT user info PDA (seeds: ["user_info_v3", nft_token, share_token])
            const [nftInfo] = PublicKey.findProgramAddressSync(
                [
                    CONFIG.USER_INFO_SEED,
                    userNftToken.toBuffer(),
                    userShareToken.toBuffer()
                ],
                program.programId
            );

            console.log('[useVault] Derived accounts for withdraw:', {
                userAssetToken: userAssetToken.toBase58(),
                userNftToken: userNftToken.toBase58(),
                userSharePda: userSharePda.toBase58(),
                userShareToken: userShareToken.toBase58(),
                nftInfo: nftInfo.toBase58()
            });

            // ===== VALIDATION: Check if user has enough shares =====
            try {
                const userShareTokenAccount = await connection.getAccountInfo(userShareToken);
                if (!userShareTokenAccount) {
                    throw new Error('User has no share tokens to withdraw');
                }

                // Parse token account to get balance
                const shareTokenInfo = await connection.getTokenAccountBalance(userShareToken);
                const availableShares = new BN(shareTokenInfo.value.amount);

                console.log('[useVault] Share balance check:', {
                    requestedShares: shares.toString(),
                    availableShares: availableShares.toString()
                });

                if (availableShares.lt(shares)) {
                    throw new Error(`Insufficient shares. Available: ${availableShares.toString()}, Requested: ${shares.toString()}`);
                }
            } catch (err) {
                throw new Error(`Cannot validate share balance: ${(err as Error).message}`);
            }

            // Update state to signing
            setTransactionState({
                status: TransactionStatus.SIGNING,
                signature: null,
                error: null,
                message: 'Please sign the withdraw transaction in your wallet...'
            });

            console.log('[useVault] Executing withdraw transaction...');

            // ===== EXECUTE WITHDRAW TRANSACTION =====
            const tx = await program.methods
                .withdraw(shares)
                .accounts({
                    user: userWallet,
                    vault: CONFIG.VAULT_PDA,
                    nftCollection: CONFIG.COLLECTION_PDA,
                    userNftToken: userNftToken,
                    userNftMint: userNftMint,
                    assetMint: assetMint,
                    vaultTokenAccount: CONFIG.VAULT_TOKEN_ACCOUNT,
                    shareMint: CONFIG.SHARE_MINT,
                })
                .rpc();

            console.log('[useVault] Withdraw transaction sent:', tx);

            // Update state to confirming
            setTransactionState({
                status: TransactionStatus.CONFIRMING,
                signature: tx,
                error: null,
                message: 'Transaction sent! Waiting for confirmation...'
            });

            // ===== WAIT FOR CONFIRMATION =====
            console.log('[useVault] Waiting for transaction confirmation...');
            await connection.confirmTransaction(tx, 'confirmed');

            console.log('[useVault] Withdraw transaction confirmed!');

            // Update state to success
            setTransactionState({
                status: TransactionStatus.SUCCESS,
                signature: tx,
                error: null,
                message: 'Withdraw completed successfully!'
            });

            // ===== REFRESH DATA AFTER SUCCESS =====
            console.log('[useVault] Refreshing data after successful withdraw...');
            refreshAllData();

            console.log('[useVault] === WITHDRAW END (SUCCESS) ===');
            return tx;

        } catch (err) {
            const error = `Withdraw failed: ${(err as Error).message}`;
            console.error('[useVault] Withdraw error:', err);

            setTransactionState({
                status: TransactionStatus.FAILED,
                signature: null,
                error: error,
                message: 'Withdraw transaction failed'
            });

            setError(error);
            console.log('[useVault] === WITHDRAW END (ERROR) ===');
            return null;
        } finally {
            setLoading(false);
        }
    }, [program, address, connection, selectedTokenAccount, setError, setLoading, setTransactionState, refreshAllData]);

    console.log('[useVault] === HOOK CALL END ===');

    return {
        // Store state (read-only)
        program,
        vault,
        selectedNFTPosition,
        allUserPositions,
        loading,
        userPositionLoading,
        error,

        // Network state (read-only)
        connection,
        currentNetwork,
        isSolanaNetwork,
        isNetworkReady,

        // AppKit state (read-only)
        isConnected,
        walletAddress: address,

        // Selection state (read-only)
        selectedTokenMint,
        selectedTokenAccount,
        selectedNFT,
        hasRequiredSelections,

        // Computed values
        programId: CONFIG.PROGRAM_ID,
        vaultConfig: getVaultConfig(),
        transactionState,

        // Actions only
        deposit,
        withdraw,
        refreshVaultData,
        refreshUserPosition,
        refreshAllData,
    };
};
