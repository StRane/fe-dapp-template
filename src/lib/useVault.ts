import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import {
    PublicKey,
    Commitment,
} from '@solana/web3.js';
import { AnchorWallet } from '@solana/wallet-adapter-react';

import type { SimpleVault } from '@/types/simple_vault';
import IDL from '@/idl/simple_vault.json';

// Import stores
import { useNetworkStore } from '@/store/networkStore';
import { useVaultStore, type VaultData, type UserPosition } from '@/store/vaultStore';

// Import selection context
import { useTokenSelection, useNFTSelection } from '@/context/SelectionContext';

// Import new config structure
import { CONFIG, VaultUtils } from '@/config/programs';

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
    transactionState: TransactionState;
    
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

interface PDAValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    derivedAccounts: {
        userNftToken: string;
        userSharePda: string;
        userShareToken: string;
        nftInfo: string;
        vaultPda: string;
        vaultTokenAccount: string;
    };
    bumps: {
        vaultBump: number;
        userShareBump: number;
        nftInfoBump: number;
    };
}

export const useVault = (): UseVaultReturn => {
    console.log('[useVault] === HOOK CALL START ===');

    // AppKit hooks (wallet info only)
    const { address, isConnected } = useAppKitAccount();
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

    // Loading guards to prevent concurrent operations
    const hasInitializedProgram = useRef(false);
    const hasLoadedVaultData = useRef(false);
    const isLoadingUserPosition = useRef(false);

    // Derived state
    const hasRequiredSelections = !!(selectedTokenMint && selectedTokenAccount && selectedNFT);

    // Network change effect - resets loading flags only
    useEffect(() => {
        const unsubscribe = useNetworkStore.subscribe((state, prevState) => {
            if (state.currentNetwork !== prevState?.currentNetwork) {
                hasInitializedProgram.current = false;
                hasLoadedVaultData.current = false;
                isLoadingUserPosition.current = false;
                clearUserPositions();
            }
        });
        return unsubscribe;
    }, [clearUserPositions]);

    // Program initialization effect - ONLY sets up program
    useEffect(() => {
        console.log('[useVault] === PROGRAM INIT EFFECT START ===');

        const initializeProgram = async () => {
            if (hasInitializedProgram.current) {
                return;
            }

            if (!connection || !address || !walletProvider || !isNetworkReady || !isSolanaNetwork) {
                return;
            }

            try {
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

                setProgram(programInstance);

            } catch (err) {
                setError(`Program initialization failed: ${(err as Error).message}`);
                hasInitializedProgram.current = false;
            }
        };

        if (connection && address && walletProvider && isNetworkReady && isSolanaNetwork && !hasInitializedProgram.current) {
            initializeProgram();
        }

    }, [connection, address, walletProvider, isNetworkReady, isSolanaNetwork, setProgram, setError]);

    // Vault data loading effect - ONLY loads vault data when program is ready
    useEffect(() => {
        const loadVaultData = async () => {
            if (hasLoadedVaultData.current) {
                return;
            }

            if (!program || !address || !connection) {
                return;
            }

            try {
                hasLoadedVaultData.current = true;
                setLoading(true);

                // Use derived vault PDA instead of hardcoded
               
                const [vaultPda] = VaultUtils.getVaultPDA();

                console.log('[useVault] Loading vault data from derived PDA:', vaultPda.toBase58());
                const vaultAccount = await program.account.vault.fetchNullable(vaultPda);

                if (vaultAccount) {
                    setVault(vaultAccount);
                } else {
                    setVault(null);
                }

            } catch (err) {
                setError(`Failed to load vault data: ${(err as Error).message}`);
                hasLoadedVaultData.current = false;
            } finally {
                setLoading(false);
            }
        };

        if (program && address && connection && !hasLoadedVaultData.current && !loading) {
            loadVaultData();
        }

    }, [program, address, connection, setVault, setLoading, setError, loading]);

    // User position loading effect - ONLY loads when NFT selection changes
    useEffect(() => {
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
                isLoadingUserPosition.current = true;
                setUserPositionLoading(true);

                const userPublicKey = new PublicKey(address);
                
                // Use derived accounts from VaultUtils
                const derivedAccounts = VaultUtils.getDerivedAccountsForUser(userPublicKey, nftMint);

                console.log('[useVault] Derived accounts for user position:', {
                    userInfoPda: derivedAccounts.userInfoPda.toBase58(),
                    userShareTokenAccount: derivedAccounts.userShareTokenAccount.toBase58(),
                    userNftTokenAccount: derivedAccounts.userNftTokenAccount.toBase58()
                });

                // Fetch the UserInfo account using derived PDA
                const userInfo = await program.account.userInfo.fetchNullable(derivedAccounts.userInfoPda);

                if (userInfo) {
                    // Calculate deposit amount based on current vault state
                    let depositAmount = Number(userInfo.shares);
                    if (vault.totalShares > 0) {
                        try {
                            const totalAssets = await connection.getTokenAccountBalance(
                                derivedAccounts.vaultTokenAccount
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
            loadUserPosition(selectedNFT);
        } else if (!selectedNFT) {
            console.log('[useVault] No NFT selected - clearing user positions');
            clearUserPositions();
        }

    }, [selectedNFT, vault, program, address, connection, updateUserPositionForNFT, setUserPositionLoading, clearUserPositions]);

    // Action functions
    const refreshVaultData = useCallback(() => {
        if (program && address && connection) {
            hasLoadedVaultData.current = false;
            // The effect will automatically trigger
        }
    }, [program, address, connection]);

    const refreshUserPosition = useCallback(() => {
        if (selectedNFT && vault && program && address && connection) {
            isLoadingUserPosition.current = false;
            // The effect will automatically trigger
        }
    }, [selectedNFT, vault, program, address, connection]);

    const refreshAllData = useCallback(() => {
        hasLoadedVaultData.current = false;
        isLoadingUserPosition.current = false;
        // The effects will automatically trigger
    }, []);

    // PDA Validation helper
    const validatePDADerivations = useCallback(async (
        userWallet: PublicKey,
        userNftMint: PublicKey
    ): Promise<PDAValidationResult> => {
        console.log('[PDAValidation] === VALIDATING PDA DERIVATIONS ===');

        const errors: string[] = [];
        const warnings: string[] = [];

        if (!program) {
            errors.push('Program not initialized');
            return {
                isValid: false,
                errors,
                warnings,
                derivedAccounts: {} as any,
                bumps: {} as any
            };
        }

        try {
            // Use VaultUtils to get all derived accounts
            const derivedAccounts = VaultUtils.getDerivedAccountsForUser(userWallet, userNftMint);

            console.log('[PDAValidation] Derived accounts:', {
                vaultPda: derivedAccounts.vaultPda.toBase58(),
                userNftTokenAccount: derivedAccounts.userNftTokenAccount.toBase58(),
                userSharePda: derivedAccounts.userSharesPda.toBase58(),
                userShareTokenAccount: derivedAccounts.userShareTokenAccount.toBase58(),
                userInfoPda: derivedAccounts.userInfoPda.toBase58(),
                vaultTokenAccount: derivedAccounts.vaultTokenAccount.toBase58()
            });

            // Validate account existence if connection is available
            if (connection) {
                try {
                    const nftTokenInfo = await connection.getAccountInfo(derivedAccounts.userNftTokenAccount);
                    if (!nftTokenInfo) {
                        errors.push('User NFT token account does not exist');
                    }

                    const shareTokenInfo = await connection.getAccountInfo(derivedAccounts.userShareTokenAccount);
                    if (!shareTokenInfo) {
                        warnings.push('User share token account does not exist (may be created during deposit)');
                    }

                    const userInfoData = await connection.getAccountInfo(derivedAccounts.userInfoPda);
                    if (!userInfoData) {
                        warnings.push('User info PDA does not exist (may be created during deposit)');
                    }

                } catch (err) {
                    warnings.push(`Account existence check failed: ${(err as Error).message}`);
                }
            }

            const result: PDAValidationResult = {
                isValid: errors.length === 0,
                errors,
                warnings,
                derivedAccounts: {
                    userNftToken: derivedAccounts.userNftTokenAccount.toBase58(),
                    userSharePda: derivedAccounts.userSharesPda.toBase58(),
                    userShareToken: derivedAccounts.userShareTokenAccount.toBase58(),
                    nftInfo: derivedAccounts.userInfoPda.toBase58(),
                    vaultPda: derivedAccounts.vaultPda.toBase58(),
                    vaultTokenAccount: derivedAccounts.vaultTokenAccount.toBase58(),
                },
                bumps: {
                    vaultBump: derivedAccounts.vaultBump,
                    userShareBump: derivedAccounts.userSharesBump,
                    nftInfoBump: derivedAccounts.userInfoBump
                }
            };

            console.log('[PDAValidation] === VALIDATION RESULT ===');
            console.table(result.derivedAccounts);

            if (result.errors.length > 0) {
                console.error('[PDAValidation] ERRORS:');
                result.errors.forEach(error => console.error(`  ❌ ${error}`));
            }

            if (result.warnings.length > 0) {
                console.warn('[PDAValidation] WARNINGS:');
                result.warnings.forEach(warning => console.warn(`  ⚠️ ${warning}`));
            }

            if (result.isValid) {
                console.log('[PDAValidation] ✅ All PDA derivations are valid');
            }

            return result;

        } catch (err) {
            errors.push(`PDA derivation failed: ${(err as Error).message}`);
            return {
                isValid: false,
                errors,
                warnings,
                derivedAccounts: {} as any,
                bumps: {} as any
            };
        }
    }, [connection, program]);

    // Transaction functions using new config structure
    const deposit = useCallback(async (
        amount: BN,
        assetMint: PublicKey,
        userNftMint: PublicKey
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

            // Use VaultUtils to derive all accounts - no more hardcoded values!
            const accounts = VaultUtils.getDerivedAccountsForUser(userWallet, userNftMint);

            console.log('[useVault] Derived accounts for deposit:', {
                vaultPda: accounts.vaultPda.toBase58(),
                collectionPda: accounts.collectionPda.toBase58(),
                userNftTokenAccount: accounts.userNftTokenAccount.toBase58(),
                userAssetTokenAccount: accounts.userAssetTokenAccount.toBase58(),
                userSharesPda: accounts.userSharesPda.toBase58(),
                userShareTokenAccount: accounts.userShareTokenAccount.toBase58(),
                userInfoPda: accounts.userInfoPda.toBase58(),
                vaultTokenAccount: accounts.vaultTokenAccount.toBase58()
            });

            // Validate PDA derivations
            const validation = await validatePDADerivations(userWallet, userNftMint);

            if (!validation.isValid) {
                console.error('[useVault] PDA validation failed:', validation.errors);
                throw new Error(`PDA validation failed: ${validation.errors.join(', ')}`);
            }

            if (validation.warnings.length > 0) {
                console.warn('[useVault] PDA validation warnings:', validation.warnings);
            }

            // Update state to signing
            setTransactionState({
                status: TransactionStatus.SIGNING,
                signature: null,
                error: null,
                message: 'Please sign the transaction in your wallet...'
            });

            console.log('[useVault] Executing deposit transaction...');

            // Execute transaction with derived accounts
            const tx = await program.methods
                .deposit(amount)
                .accounts({
                    user: userWallet,
                    vault: accounts.vaultPda,
                    nftCollection: accounts.collectionPda,
                    userNftToken: accounts.userNftTokenAccount,
                    userNftMint: userNftMint,
                    assetMint: assetMint,
                    vaultTokenAccount: accounts.vaultTokenAccount,
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
    }, [program, address, connection, selectedTokenAccount, setLoading, refreshAllData, validatePDADerivations]);

    const withdraw = useCallback(async (
        shares: BN,
        assetMint: PublicKey,
        userNftMint: PublicKey
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

            // Use VaultUtils to derive all accounts - same as deposit!
            const accounts = VaultUtils.getDerivedAccountsForUser(userWallet, userNftMint);

            console.log('[useVault] Derived accounts for withdraw:', {
                vaultPda: accounts.vaultPda.toBase58(),
                collectionPda: accounts.collectionPda.toBase58(),
                userNftTokenAccount: accounts.userNftTokenAccount.toBase58(),
                userAssetTokenAccount: accounts.userAssetTokenAccount.toBase58(),
                userSharesPda: accounts.userSharesPda.toBase58(),
                userShareTokenAccount: accounts.userShareTokenAccount.toBase58(),
                userInfoPda: accounts.userInfoPda.toBase58(),
                vaultTokenAccount: accounts.vaultTokenAccount.toBase58()
            });

            // Validate PDA derivations
            const validation = await validatePDADerivations(userWallet, userNftMint);

            if (!validation.isValid) {
                console.error('[useVault] PDA validation failed:', validation.errors);
                throw new Error(`PDA validation failed: ${validation.errors.join(', ')}`);
            }

            if (validation.warnings.length > 0) {
                console.warn('[useVault] PDA validation warnings:', validation.warnings);
            }

            // Validate user has enough shares
            try {
                const shareTokenInfo = await connection.getTokenAccountBalance(accounts.userShareTokenAccount);
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

            // Execute withdraw transaction with derived accounts
            const tx = await program.methods
                .withdraw(shares)
                .accounts({
                    user: userWallet,
                    vault: accounts.vaultPda,
                    nftCollection: accounts.collectionPda,
                    userNftToken: accounts.userNftTokenAccount,
                    userNftMint: userNftMint,
                    assetMint: assetMint,
                    vaultTokenAccount: accounts.vaultTokenAccount,
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

            // Wait for confirmation
            await connection.confirmTransaction(tx, 'confirmed');

            console.log('[useVault] Withdraw transaction confirmed!');

            // Update state to success
            setTransactionState({
                status: TransactionStatus.SUCCESS,
                signature: tx,
                error: null,
                message: 'Withdraw completed successfully!'
            });

            // Refresh data after success
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
    }, [program, address, connection, selectedTokenAccount, setError, setLoading, refreshAllData, validatePDADerivations]);

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
        programId: CONFIG.VAULT_PROGRAM_ID.toBase58(),
        vaultConfig: CONFIG,
        transactionState,

        // Actions only
        deposit,
        withdraw,
        refreshVaultData,
        refreshUserPosition,
        refreshAllData,
    };
};