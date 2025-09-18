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

interface PDAValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    derivedAccounts: {
        userNftToken: string;
        userSharePda: string;
        userShareToken: string;
        nftInfo: string;
    };
    bumps: {
        userShareBump: number;
        nftInfoBump: number;
    };
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
        // console.log('[useVault] === NETWORK CHANGE EFFECT START ===');
        const unsubscribe = useNetworkStore.subscribe((state, prevState) => {
            if (state.currentNetwork !== prevState?.currentNetwork) {
                // console.log('[useVault] Network changed - resetting loading flags');
                hasInitializedProgram.current = false;
                hasLoadedVaultData.current = false;
                isLoadingUserPosition.current = false;
                clearUserPositions();
            }
        });
        // console.log('[useVault] === NETWORK CHANGE EFFECT END ===');
        return unsubscribe;
    }, [clearUserPositions]);

    // Program initialization effect - ONLY sets up program
    useEffect(() => {
        console.log('[useVault] === PROGRAM INIT EFFECT START ===');
        // console.log('[useVault] Program initialization check:', {
        //     isConnected,
        //     hasAddress: !!address,
        //     hasConnection: !!connection,
        //     hasWalletProvider: !!walletProvider,
        //     isNetworkReady,
        //     isSolanaNetwork,
        //     hasInitialized: hasInitializedProgram.current,
        //     hasProgram: !!program
        // });

        const initializeProgram = async () => {
            if (hasInitializedProgram.current) {
                // console.log('[useVault] Program already initialized, skipping');
                return;
            }

            if (!connection || !address || !walletProvider || !isNetworkReady || !isSolanaNetwork) {
                // console.log('[useVault] Missing requirements for program initialization');
                return;
            }

            try {
                // console.log('[useVault] Initializing program...');
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

                // console.log('[useVault] Program created successfully');
                setProgram(programInstance);

            } catch (err) {
                // console.error('[useVault] Program initialization failed:', err);
                setError(`Program initialization failed: ${(err as Error).message}`);
                hasInitializedProgram.current = false;
            }
        };

        if (connection && address && walletProvider && isNetworkReady && isSolanaNetwork && !hasInitializedProgram.current) {
            // console.log('[useVault] Starting program initialization...');
            initializeProgram();
        }

        // console.log('[useVault] === PROGRAM INIT EFFECT END ===');
    }, [connection, address, walletProvider, isNetworkReady, isSolanaNetwork, setProgram, setError]);

    // Vault data loading effect - ONLY loads vault data when program is ready
    useEffect(() => {
        // console.log('[useVault] === VAULT DATA LOADING EFFECT START ===');

        const loadVaultData = async () => {
            if (hasLoadedVaultData.current) {
                // console.log('[useVault] Vault data already loaded, skipping');
                return;
            }

            if (!program || !address || !connection) {
                // console.log('[useVault] Missing requirements for vault data loading');
                return;
            }

            try {
                // console.log('[useVault] Loading vault data...');
                hasLoadedVaultData.current = true;
                setLoading(true);

                // console.log('[useVault] Checking if vault account exists...');
                const vaultAccount = await program.account.vault.fetchNullable(CONFIG.VAULT_PDA);

                if (vaultAccount) {
                    // console.log('[useVault] Vault account found:', {
                    //     owner: vaultAccount.owner.toBase58(),
                    //     assetMint: vaultAccount.assetMint.toBase58(),
                    //     totalShares: vaultAccount.totalShares.toString(),
                    //     totalBorrowed: vaultAccount.totalBorrowed.toString()
                    // });

                    setVault(vaultAccount);
                } else {
                    // console.log('[useVault] No vault account found');
                    setVault(null);
                }

            } catch (err) {
                // console.error('[useVault] Error loading vault data:', err);
                setError(`Failed to load vault data: ${(err as Error).message}`);
                hasLoadedVaultData.current = false;
            } finally {
                setLoading(false);
            }
        };

        if (program && address && connection && !hasLoadedVaultData.current && !loading) {
            // console.log('[useVault] Starting vault data loading...');
            loadVaultData();
        }

        // console.log('[useVault] === VAULT DATA LOADING EFFECT END ===');
    }, [program, address, connection, setVault, setLoading, setError, loading]);

    // User position loading effect - ONLY loads when NFT selection changes
    useEffect(() => {
        // console.log('[useVault] === USER POSITION LOADING EFFECT START ===');

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
                // console.log('[useVault] Loading position for selected NFT:', nftMint.toBase58());
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
                    // console.log('[useVault] Found position for selected NFT:', {
                    //     nftMint: nftMint.toBase58(),
                    //     shares: userInfo.shares.toString(),
                    //     lastUpdate: userInfo.lastUpdate
                    // });

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
                    // console.log('[useVault] No position found for selected NFT');
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
            // console.log('[useVault] Starting user position loading for NFT:', selectedNFT.toBase58());
            loadUserPosition(selectedNFT);
        } else if (!selectedNFT) {
            console.log('[useVault] No NFT selected - clearing user positions');
            clearUserPositions();
        }

        // console.log('[useVault] === USER POSITION LOADING EFFECT END ===');
    }, [selectedNFT, vault, program, address, connection, updateUserPositionForNFT, setUserPositionLoading, clearUserPositions]);

    // Action functions
    const refreshVaultData = useCallback(() => {
        // console.log('[useVault] === REFRESH VAULT DATA START ===');
        if (program && address && connection) {
            hasLoadedVaultData.current = false;
            // The effect will automatically trigger
        }
        // console.log('[useVault] === REFRESH VAULT DATA END ===');
    }, [program, address, connection]);

    const refreshUserPosition = useCallback(() => {
        // console.log('[useVault] === REFRESH USER POSITION START ===');
        if (selectedNFT && vault && program && address && connection) {
            isLoadingUserPosition.current = false;
            // The effect will automatically trigger
        }
        // console.log('[useVault] === REFRESH USER POSITION END ===');
    }, [selectedNFT, vault, program, address, connection]);

    const refreshAllData = useCallback(() => {
        // console.log('[useVault] === REFRESH ALL DATA START ===');
        hasLoadedVaultData.current = false;
        isLoadingUserPosition.current = false;
        // The effects will automatically trigger
        // console.log('[useVault] === REFRESH ALL DATA END ===');
    }, []);

    // Transaction functions
    const validatePDADerivations = useCallback(async (
        userWallet: PublicKey,
        userNftMint: PublicKey,
        programId: PublicKey
    ): Promise<PDAValidationResult> => {
        console.log('[PDAValidation] === VALIDATING PDA DERIVATIONS ===');

        const errors: string[] = [];
        const warnings: string[] = [];

        // Derive all accounts step by step
        const userNftToken = getAssociatedTokenAddressSync(userNftMint, userWallet);

        const [userSharePda, userShareBump] = PublicKey.findProgramAddressSync(
            [CONFIG.USER_SHARES_SEED, userNftMint.toBuffer()],
            programId
        );

        const userShareToken = getAssociatedTokenAddressSync(
            CONFIG.SHARE_MINT,
            userSharePda,
            true
        );

        const [nftInfo, nftInfoBump] = PublicKey.findProgramAddressSync(
            [
                CONFIG.USER_INFO_SEED,
                userNftToken.toBuffer(),
                userShareToken.toBuffer()
            ],
            programId
        );

        // Validate seeds match contract expectations
        console.log('[PDAValidation] Validating seeds against contract:');

        // Check USER_SHARES_SEED
        if (!CONFIG.USER_SHARES_SEED.equals(Buffer.from("user_shares_v3"))) {
            errors.push(`USER_SHARES_SEED mismatch. Expected: "user_shares_v3", Got: "${CONFIG.USER_SHARES_SEED.toString()}"`);
        }

        // Check USER_INFO_SEED  
        if (!CONFIG.USER_INFO_SEED.equals(Buffer.from("user_info_v3"))) {
            errors.push(`USER_INFO_SEED mismatch. Expected: "user_info_v3", Got: "${CONFIG.USER_INFO_SEED.toString()}"`);
        }

        // Validate against working test derivations (from vault_full.ts)
        console.log('[PDAValidation] Cross-checking with test patterns...');

        // In your test, you derive like this:
        // [user1Data.sharePda] = PublicKey.findProgramAddressSync(
        //     [Buffer.from("user_shares_v3"), user1Data.firstMint.toBuffer()],
        //     vaultProgram.programId
        // );

        // Let's validate our derivation matches
        try {
            const [testStyleSharePda] = PublicKey.findProgramAddressSync(
                [Buffer.from("user_shares_v3"), userNftMint.toBuffer()],
                programId
            );

            if (!testStyleSharePda.equals(userSharePda)) {
                errors.push(`Share PDA derivation mismatch with test pattern`);
            } else {
                console.log('[PDAValidation] ✅ Share PDA matches test pattern');
            }
        } catch (err) {
            errors.push(`Failed to derive test-style share PDA: ${(err as Error).message}`);
        }

        // Validate account existence
        if (connection) {
            try {
                const nftTokenInfo = await connection.getAccountInfo(userNftToken);
                if (!nftTokenInfo) {
                    errors.push('User NFT token account does not exist');
                }

                const shareTokenInfo = await connection.getAccountInfo(userShareToken);
                if (!shareTokenInfo) {
                    warnings.push('User share token account does not exist (may be created during deposit)');
                }

                const userInfoData = await connection.getAccountInfo(nftInfo);
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
                userNftToken: userNftToken.toBase58(),
                userSharePda: userSharePda.toBase58(),
                userShareToken: userShareToken.toBase58(),
                nftInfo: nftInfo.toBase58(),
            },
            bumps: {
                userShareBump,
                nftInfoBump
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
    }, [connection]);

    const deposit = useCallback(async (
        amount: BN,
        assetMint: PublicKey,
        userNftMint: PublicKey
    ): Promise<string | null> => {
        console.log('[useVault] === DEPOSIT DEBUG START ===');
        console.log('[useVault] Input Parameters:', {
            amount: amount.toString(),
            assetMint: assetMint.toBase58(),
            userNftMint: userNftMint.toBase58(),
            selectedTokenAccount: selectedTokenAccount?.toBase58(),
            programId: program?.programId.toBase58()
        });

        if (!program || !address || !connection) {
            const error = 'Missing program, address, or connection for deposit';
            console.error('[useVault] Deposit failed:', error);
            return null;
        }

        try {
            setTransactionState({
                status: TransactionStatus.BUILDING,
                signature: null,
                error: null,
                message: 'Building transaction and deriving accounts...'
            });

            const userWallet = new PublicKey(address);

            // ===== ACCOUNT DERIVATION WITH DEBUG =====
            console.log('[useVault] === ACCOUNT DERIVATION DEBUG ===');

            // 1. User Asset Token Account (from context)
            const userAssetToken = selectedTokenAccount;
            console.log('[useVault] 1. User Asset Token:', {
                account: userAssetToken?.toBase58(),
                source: 'from_selection_context'
            });

            // 2. User NFT Token Account (derived)
            const userNftToken = getAssociatedTokenAddressSync(userNftMint, userWallet);
            console.log('[useVault] 2. User NFT Token:', {
                account: userNftToken.toBase58(),
                derivedFrom: {
                    mint: userNftMint.toBase58(),
                    owner: userWallet.toBase58()
                }
            });

            // 3. User Share PDA (derived)
            const [userSharePda, userShareBump] = PublicKey.findProgramAddressSync(
                [Buffer.from("user_shares_v3"), userNftMint.toBuffer()],
                program.programId
            );
            console.log('[useVault] 3. User Share PDA:', {
                account: userSharePda.toBase58(),
                bump: userShareBump,
                derivedFrom: {
                    seeds: ['user_shares_v3', userNftMint.toBase58()],
                    programId: program.programId.toBase58()
                }
            });

            // 4. User Share Token Account (ATA of PDA)
            const userShareToken = getAssociatedTokenAddressSync(
                CONFIG.SHARE_MINT,
                userSharePda,
                true // allowOwnerOffCurve for PDA
            );
            console.log('[useVault] 4. User Share Token Account:', {
                account: userShareToken.toBase58(),
                derivedFrom: {
                    mint: CONFIG.SHARE_MINT.toBase58(),
                    owner: userSharePda.toBase58(),
                    allowOwnerOffCurve: true
                }
            });

            // 5. NFT User Info PDA (derived)
            const [nftInfo, nftInfoBump] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("user_info_v3"),
                    userNftToken.toBuffer(),
                    userShareToken.toBuffer()
                ],
                program.programId
            );
            console.log('[useVault] 5. NFT User Info PDA:', {
                account: nftInfo.toBase58(),
                bump: nftInfoBump,
                derivedFrom: {
                    seeds: [
                        'user_info_v3',
                        userNftToken.toBase58(),
                        userShareToken.toBase58()
                    ],
                    programId: program.programId.toBase58()
                }
            });

            // ===== ACCOUNT EXISTENCE CHECKS =====
            console.log('[useVault] === ACCOUNT EXISTENCE CHECKS ===');

            // Check if user asset token exists and has balance
            try {
                const userAssetInfo = await connection.getTokenAccountBalance(userAssetToken!);
                console.log('[useVault] User Asset Token Info:', {
                    exists: true,
                    balance: userAssetInfo.value.uiAmount,
                    rawBalance: userAssetInfo.value.amount
                });
            } catch (err) {
                console.error('[useVault] User Asset Token Error:', err);
            }

            // Check if user NFT token exists
            try {
                const userNftInfo = await connection.getTokenAccountBalance(userNftToken);
                console.log('[useVault] User NFT Token Info:', {
                    exists: true,
                    balance: userNftInfo.value.uiAmount,
                    rawBalance: userNftInfo.value.amount
                });
            } catch (err) {
                console.error('[useVault] User NFT Token Error:', err);
            }

            // Check if share PDA exists
            try {
                const sharePdaInfo = await connection.getAccountInfo(userSharePda);
                console.log('[useVault] Share PDA Info:', {
                    exists: !!sharePdaInfo,
                    owner: sharePdaInfo?.owner.toBase58(),
                    lamports: sharePdaInfo?.lamports
                });
            } catch (err) {
                console.error('[useVault] Share PDA Error:', err);
            }

            // Check if share token account exists
            try {
                const shareTokenInfo = await connection.getTokenAccountBalance(userShareToken);
                console.log('[useVault] Share Token Account Info:', {
                    exists: true,
                    balance: shareTokenInfo.value.uiAmount,
                    rawBalance: shareTokenInfo.value.amount
                });
            } catch (err) {
                console.log('[useVault] Share Token Account does not exist yet (expected for first deposit)');
            }

            // Check if user info PDA exists
            try {
                const userInfoAccount = await program.account.userInfo.fetchNullable(nftInfo);
                console.log('[useVault] User Info PDA:', {
                    exists: !!userInfoAccount,
                    shares: userInfoAccount?.shares.toString(),
                    lastUpdate: userInfoAccount?.lastUpdate
                });
            } catch (err) {
                console.log('[useVault] User Info PDA does not exist yet (expected for first deposit)');
            }

            // ===== FINAL ACCOUNT SUMMARY =====
            console.log('[useVault] === FINAL ACCOUNT SUMMARY FOR DEPOSIT ===');
            const accountSummary = {
                user: userWallet.toBase58(),
                vault: CONFIG.VAULT_PDA.toBase58(),
                nftCollection: CONFIG.COLLECTION_PDA.toBase58(),
                userNftToken: userNftToken.toBase58(),
                userNftMint: userNftMint.toBase58(),
                assetMint: assetMint.toBase58(),
                userAssetToken: userAssetToken?.toBase58() || 'MISSING',
                vaultTokenAccount: CONFIG.VAULT_TOKEN_ACCOUNT.toBase58(),
                shareMint: CONFIG.SHARE_MINT.toBase58(),
                userSharePda: userSharePda.toBase58(),
                userShareToken: userShareToken.toBase58(),
                nftInfo: nftInfo.toBase58(),

                // Bumps for debugging
                userShareBump,
                nftInfoBump
            };

            console.table(accountSummary);

            // ===== EXECUTE TRANSACTION =====
            setTransactionState({
                status: TransactionStatus.SIGNING,
                signature: null,
                error: null,
                message: 'Please sign the transaction in your wallet...'
            });
            const validation = await validatePDADerivations(userWallet, userNftMint, program.programId);

            if (!validation.isValid) {
                console.error('[useVault] PDA validation failed:', validation.errors);
                throw new Error(`PDA validation failed: ${validation.errors.join(', ')}`);
            }
            if (validation.warnings.length > 0) {
                console.warn('[useVault] PDA validation warnings:', validation.warnings);
            }



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

            console.log('[useVault] Deposit transaction sent:', tx);

            // ... rest of transaction confirmation logic

            return tx;

        } catch (err) {
            console.error('[useVault] === DEPOSIT ERROR DEBUG ===');
            console.error('[useVault] Full error object:', err);

            // Get detailed logs
            if ((err as any).getLogs) {
                try {
                    const logs = await (err as any).getLogs();
                    console.error('[useVault] Transaction logs:', logs);
                } catch (logErr) {
                    console.error('[useVault] Could not get logs:', logErr);
                }
            }

            // Check simulation details
            if ((err as any).simulationResponse) {
                console.error('[useVault] Simulation response:', (err as any).simulationResponse);
            }

            // Check if it's an anchor program error
            if ((err as any).error) {
                console.error('[useVault] Anchor program error:', (err as any).error);
            }

            // Log instruction errors if available
            if ((err as any).logs && Array.isArray((err as any).logs)) {
                console.error('[useVault] Instruction logs:');
                (err as any).logs.forEach((log: string, index: number) => {
                    console.error(`  [${index}] ${log}`);
                });
            }

            return null;
        }
    }, [program, address, connection, selectedTokenAccount]);


    const withdraw = useCallback(async (
        shares: BN,
        assetMint: PublicKey,
        userNftMint: PublicKey
    ): Promise<string | null> => {
        console.log('[useVault] === WITHDRAW DEBUG START ===');
        console.log('[useVault] Input Parameters:', {
            shares: shares.toString(),
            assetMint: assetMint.toBase58(),
            userNftMint: userNftMint.toBase58(),
            selectedTokenAccount: selectedTokenAccount?.toBase58(),
            programId: program?.programId.toBase58()
        });

        if (!program || !address || !connection) {
            const error = 'Missing program, address, or connection for withdraw';
            console.error('[useVault] Withdraw failed:', error);
            return null;
        }

        try {
            setTransactionState({
                status: TransactionStatus.BUILDING,
                signature: null,
                error: null,
                message: 'Building withdraw transaction and deriving accounts...'
            });

            const userWallet = new PublicKey(address);

            // ===== ACCOUNT DERIVATION WITH DEBUG (Same as deposit) =====
            console.log('[useVault] === WITHDRAW ACCOUNT DERIVATION DEBUG ===');

            // 1. User Asset Token Account (from context)
            const userAssetToken = selectedTokenAccount;
            console.log('[useVault] 1. User Asset Token:', {
                account: userAssetToken?.toBase58(),
                source: 'from_selection_context'
            });

            // 2. User NFT Token Account (derived - MUST match deposit)
            const userNftToken = getAssociatedTokenAddressSync(userNftMint, userWallet);
            console.log('[useVault] 2. User NFT Token:', {
                account: userNftToken.toBase58(),
                derivedFrom: {
                    mint: userNftMint.toBase58(),
                    owner: userWallet.toBase58()
                }
            });

            // 3. User Share PDA (derived - MUST match deposit)
            const [userSharePda, userShareBump] = PublicKey.findProgramAddressSync(
                [CONFIG.USER_SHARES_SEED, userNftMint.toBuffer()],
                program.programId
            );
            console.log('[useVault] 3. User Share PDA:', {
                account: userSharePda.toBase58(),
                bump: userShareBump,
                derivedFrom: {
                    seeds: ['user_shares_v3', userNftMint.toBase58()],
                    programId: program.programId.toBase58()
                }
            });

            // 4. User Share Token Account (ATA of PDA - MUST match deposit)
            const userShareToken = getAssociatedTokenAddressSync(
                CONFIG.SHARE_MINT,
                userSharePda,
                true // allowOwnerOffCurve for PDA
            );
            console.log('[useVault] 4. User Share Token Account:', {
                account: userShareToken.toBase58(),
                derivedFrom: {
                    mint: CONFIG.SHARE_MINT.toBase58(),
                    owner: userSharePda.toBase58(),
                    allowOwnerOffCurve: true
                }
            });

            // 5. NFT User Info PDA (derived - MUST match deposit)
            const [nftInfo, nftInfoBump] = PublicKey.findProgramAddressSync(
                [
                    CONFIG.USER_INFO_SEED,
                    userNftToken.toBuffer(),
                    userShareToken.toBuffer()
                ],
                program.programId
            );
            console.log('[useVault] 5. NFT User Info PDA:', {
                account: nftInfo.toBase58(),
                bump: nftInfoBump,
                derivedFrom: {
                    seeds: [
                        'user_info_v3',
                        userNftToken.toBase58(),
                        userShareToken.toBase58()
                    ],
                    programId: program.programId.toBase58()
                }
            });

            // ===== CRITICAL WITHDRAW ACCOUNT VALIDATION =====
            console.log('[useVault] === CRITICAL WITHDRAW VALIDATION ===');

            // Check share token account exists and has balance
            let shareTokenBalance;
            try {
                const shareTokenInfo = await connection.getTokenAccountBalance(userShareToken);
                shareTokenBalance = new BN(shareTokenInfo.value.amount);
                console.log('[useVault] Share Token Validation:', {
                    exists: true,
                    balance: shareTokenInfo.value.uiAmount,
                    rawBalance: shareTokenInfo.value.amount,
                    requestedShares: shares.toString(),
                    hasEnoughShares: shareTokenBalance.gte(shares)
                });

                if (shareTokenBalance.lt(shares)) {
                    throw new Error(`Insufficient shares. Available: ${shareTokenBalance.toString()}, Requested: ${shares.toString()}`);
                }
            } catch (err) {
                console.error('[useVault] Share Token Validation Failed:', err);
                throw new Error(`Cannot validate share balance: ${(err as Error).message}`);
            }

            // Check user info PDA exists
            let userInfoData;
            try {
                userInfoData = await program.account.userInfo.fetch(nftInfo);
                console.log('[useVault] User Info Validation:', {
                    exists: true,
                    shares: userInfoData.shares.toString(),
                    vault: userInfoData.vault.toBase58(),
                    nftMint: userInfoData.nftMint.toBase58(),
                    owner: userInfoData.owner.toBase58(),
                    lastUpdate: userInfoData.lastUpdate
                });
            } catch (err) {
                console.error('[useVault] User Info Validation Failed:', err);
                throw new Error(`User info not found: ${(err as Error).message}`);
            }

            // Validate share token account authority
            try {
                const shareTokenAccount = await connection.getParsedAccountInfo(userShareToken);
                if (shareTokenAccount.value?.data && 'parsed' in shareTokenAccount.value.data) {
                    const tokenData = shareTokenAccount.value.data.parsed.info;
                    console.log('[useVault] Share Token Account Authority Check:', {
                        owner: tokenData.owner,
                        expectedOwner: userSharePda.toBase58(),
                        ownerMatches: tokenData.owner === userSharePda.toBase58(),
                        mint: tokenData.mint,
                        expectedMint: CONFIG.SHARE_MINT.toBase58(),
                        mintMatches: tokenData.mint === CONFIG.SHARE_MINT.toBase58()
                    });

                    if (tokenData.owner !== userSharePda.toBase58()) {
                        throw new Error(`Share token account owner mismatch. Expected: ${userSharePda.toBase58()}, Got: ${tokenData.owner}`);
                    }
                }
            } catch (err) {
                console.error('[useVault] Share Token Authority Check Failed:', err);
                throw err;
            }

            // ===== FINAL ACCOUNT SUMMARY FOR WITHDRAW =====
            console.log('[useVault] === FINAL ACCOUNT SUMMARY FOR WITHDRAW ===');
            const withdrawAccountSummary = {
                user: userWallet.toBase58(),
                vault: CONFIG.VAULT_PDA.toBase58(),
                nftCollection: CONFIG.COLLECTION_PDA.toBase58(),
                userNftToken: userNftToken.toBase58(),
                userNftMint: userNftMint.toBase58(),
                assetMint: assetMint.toBase58(),
                userAssetToken: userAssetToken?.toBase58() || 'MISSING',
                vaultTokenAccount: CONFIG.VAULT_TOKEN_ACCOUNT.toBase58(),
                shareMint: CONFIG.SHARE_MINT.toBase58(),
                userSharePda: userSharePda.toBase58(),
                userShareToken: userShareToken.toBase58(),
                nftInfo: nftInfo.toBase58(),

                // Validation results
                shareBalance: shareTokenBalance?.toString(),
                requestedShares: shares.toString(),
                userInfoShares: userInfoData?.shares.toString(),

                // Bumps
                userShareBump,
                nftInfoBump
            };

            console.table(withdrawAccountSummary);

            // ===== EXECUTE WITHDRAW TRANSACTION =====
            setTransactionState({
                status: TransactionStatus.SIGNING,
                signature: null,
                error: null,
                message: 'Please sign the withdraw transaction in your wallet...'
            });

            console.log('[useVault] Executing withdraw transaction with accounts:', {
                user: userWallet.toBase58(),
                vault: CONFIG.VAULT_PDA.toBase58(),
                nftCollection: CONFIG.COLLECTION_PDA.toBase58(),
                userNftToken: userNftToken.toBase58(),
                userNftMint: userNftMint.toBase58(),
                assetMint: assetMint.toBase58(),
                vaultTokenAccount: CONFIG.VAULT_TOKEN_ACCOUNT.toBase58(),
                shareMint: CONFIG.SHARE_MINT.toBase58(),
            });

            const validation = await validatePDADerivations(userWallet, userNftMint, program.programId);

            if (!validation.isValid) {
                console.error('[useVault] PDA validation failed:', validation.errors);
                throw new Error(`PDA validation failed: ${validation.errors.join(', ')}`);
            }

            if (validation.warnings.length > 0) {
                console.warn('[useVault] PDA validation warnings:', validation.warnings);
            }

            // const test = new BN(1);

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

            console.log('[useVault] Withdraw transaction sent successfully:', tx);

            // ... rest of transaction confirmation logic

            return tx;

        } catch (err) {
            console.error('[useVault] === WITHDRAW ERROR DEBUG ===');
            console.error('[useVault] Error details:', {
                name: (err as Error).name,
                message: (err as Error).message,
                code: (err as any).code,
                logs: (err as any).logs,
                programError: (err as any).programError,
                stack: (err as Error).stack
            });

            // Log anchor program errors specifically
            if ((err as any).programError) {
                console.error('[useVault] Program Error Details:', (err as any).programError);
            }

            // Log transaction simulation if available
            if ((err as any).simulationResponse) {
                console.error('[useVault] Simulation Response:', (err as any).simulationResponse);
            }

            // Log instruction logs if available
            if ((err as any).logs) {
                console.error('[useVault] Transaction Logs:');
                (err as any).logs.forEach((log: string, index: number) => {
                    console.error(`  [${index}] ${log}`);
                });
            }

            return null;
        }
    }, [program, address, connection, selectedTokenAccount]);






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
