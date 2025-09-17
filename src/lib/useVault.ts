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

    // Store actions
    refreshVaultData: () => void;
    refreshUserPosition: () => void;
    refreshAllData: () => void;
}

export const useVault = (): UseVaultReturn => {
    console.log('[useVault] === HOOK CALL START ===');

    // AppKit hooks (wallet info only)
    const { address, isConnected } = useAppKitAccount();
    const { caipNetwork } = useAppKitNetwork();
    const { walletProvider } = useAppKitProvider<AnchorWallet>('solana');

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
    const deposit = useCallback(async (amount: BN, assetMint: PublicKey, userNftMint: PublicKey): Promise<string | null> => {
        console.log('[useVault] === DEPOSIT START ===');
        console.log('[useVault] Deposit parameters:', {
            amount: amount.toString(),
            assetMint: assetMint.toBase58(),
            userNftMint: userNftMint.toBase58()
        });

        if (!program || !address || !connection) {
            const error = 'Missing program, address, or connection for deposit';
            console.error('[useVault] Deposit failed:', error);
            setError(error);
            return null;
        }

        try {
            setLoading(true);
            
            // TODO: Implement deposit transaction logic
            console.log('[useVault] Deposit transaction logic to be implemented');
            
            // After successful deposit, refresh data
            refreshAllData();
            
            console.log('[useVault] === DEPOSIT END (SUCCESS) ===');
            return 'deposit-tx-signature';
            
        } catch (err) {
            const error = `Deposit failed: ${(err as Error).message}`;
            console.error('[useVault] Deposit error:', err);
            setError(error);
            console.log('[useVault] === DEPOSIT END (ERROR) ===');
            return null;
        } finally {
            setLoading(false);
        }
    }, [program, address, connection, setError, setLoading, refreshAllData]);

    const withdraw = useCallback(async (shares: BN, assetMint: PublicKey, userNftMint: PublicKey): Promise<string | null> => {
        console.log('[useVault] === WITHDRAW START ===');
        console.log('[useVault] Withdraw parameters:', {
            shares: shares.toString(),
            assetMint: assetMint.toBase58(),
            userNftMint: userNftMint.toBase58()
        });

        if (!program || !address || !connection) {
            const error = 'Missing program, address, or connection for withdraw';
            console.error('[useVault] Withdraw failed:', error);
            setError(error);
            return null;
        }

        try {
            setLoading(true);
            
            // TODO: Implement withdraw transaction logic
            console.log('[useVault] Withdraw transaction logic to be implemented');
            
            // After successful withdraw, refresh data
            refreshAllData();
            
            console.log('[useVault] === WITHDRAW END (SUCCESS) ===');
            return 'withdraw-tx-signature';
            
        } catch (err) {
            const error = `Withdraw failed: ${(err as Error).message}`;
            console.error('[useVault] Withdraw error:', err);
            setError(error);
            console.log('[useVault] === WITHDRAW END (ERROR) ===');
            return null;
        } finally {
            setLoading(false);
        }
    }, [program, address, connection, setError, setLoading, refreshAllData]);

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

        // Actions only
        deposit,
        withdraw,
        refreshVaultData,
        refreshUserPosition,
        refreshAllData,
    };
};

// import { useState, useEffect, useCallback } from 'react';
// import { useAppKitAccount, useAppKitNetwork, useAppKitProvider } from '@reown/appkit/react';
// import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
// import {
//     PublicKey,
//     Commitment,
// } from '@solana/web3.js';
// import {
//     getAssociatedTokenAddressSync,
// } from '@solana/spl-token';
// import { AnchorWallet } from '@solana/wallet-adapter-react';

// import type { SimpleVault } from '@/types/simple_vault';
// import IDL from '@/idl/simple_vault.json';

// // Import stores
// import { useNetworkStore } from '@/store/networkStore';
// import { useVaultStore, type VaultData, type UserPosition } from '@/store/vaultStore';

// // Import selection context
// import { useTokenSelection, useNFTSelection } from '@/context/SelectionContext';

// const CONFIG = {
//     PROGRAM_ID: '6szSVnHy2GrCi6y7aQxJfQG9WpVkTgdB6kDXixepvdoW',
//     VAULT_SEED: Buffer.from("vault_v3"),
//     USER_SHARES_SEED: Buffer.from("user_shares_v3"),
//     USER_INFO_SEED: Buffer.from("user_info_v3"),
//     // Updated with correct addresses from your successful deployment
//     COLLECTION_PDA: new PublicKey('EoZ5NFigrZ7uqUUSH6ShDsYGMooe5ziTfgWvAbFmVTXt'),
//     VAULT_ASSET_MINT: new PublicKey("4kXBWAG92UZA1FPEQDN5bjePoFyQsbTnZ9rpxgRBbFYk"), // ✅ Correct from deployment
//     VAULT_PDA: new PublicKey("DbCxNx4uvjK2wxvJbrd5DVJ6jVM8eJirYk8RbAL9Mvt1"), // ✅ Correct from transaction
//     SHARE_MINT: new PublicKey("5CTdzZxPhqC4DWpTM5MFzwqCtHFmKQTsXE7VWUC6UxTG"), // ✅ Correct from transaction
//     VAULT_TOKEN_ACCOUNT: new PublicKey("Ak7DxLGEauBkW769NSRvA9kVkc41SxJKK29mbeJu5gzE"), // ✅ Correct from transaction
// };

// export interface UseVaultReturn {
//     // Store state (read-only)
//     program: Program<SimpleVault> | null;
//     vault: VaultData | null;
//     userPositions: UserPosition[];
//     selectedNFT: PublicKey | null;
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

//     // Selection state (read-only)
//     selectedTokenMint: PublicKey | null;
//     selectedTokenAccount: PublicKey | null;
//     hasRequiredSelections: boolean;

//     // Computed values
//     programId: string;
//     vaultConfig: typeof CONFIG;

//     // Actions only (no direct data fetching in components)
//     deposit: (amount: BN, assetMint: PublicKey, userNftMint: PublicKey) => Promise<string | null>;
//     withdraw: (shares: BN, assetMint: PublicKey, userNftMint: PublicKey) => Promise<string | null>;

//     // Store actions
//     refreshAllData: () => void;
//     setSelectedVaultNFT: (nft: PublicKey | null) => void;
// }

// export const useVault = (): UseVaultReturn => {
//     console.log('[useVault] === HOOK CALL START ===');

//     // AppKit hooks (wallet info only)
//     const { address, isConnected } = useAppKitAccount();
//     const { caipNetwork } = useAppKitNetwork();
//     const { walletProvider } = useAppKitProvider<AnchorWallet>('solana');

//     // Network store (read-only)
//     const connection = useNetworkStore((state) => state.connection);
//     const currentNetwork = useNetworkStore((state) => state.currentNetwork);
//     const isSolanaNetwork = useNetworkStore((state) => state.isSolanaNetwork);
//     const isNetworkReady = useNetworkStore((state) => state.isReady);

//     // Vault store (read-only + actions)
//     const program = useVaultStore((state) => state.program);
//     const vault = useVaultStore((state) => state.vault);
//     const userPositions = useVaultStore((state) => state.userPositions);
//     const selectedNFT = useVaultStore((state) => state.selectedNFT);
//     const loading = useVaultStore((state) => state.loading);
//     const error = useVaultStore((state) => state.error);

//     const {
//         setProgram,
//         setVault,
//         setUserPositions,
//         setSelectedNFT,
//         setLoading,
//         setError,
//         syncWithNetwork,
//         addUserPosition,
//     } = useVaultStore();

//     // Selection context (read-only)
//     const { selectedTokenAccount, selectedTokenMint } = useTokenSelection();
//     const { selectedNFT: contextSelectedNFT } = useNFTSelection();

//     const programId = new PublicKey(CONFIG.PROGRAM_ID);

//     console.log('[useVault] Store state:', {
//         hasProgram: !!program,
//         hasVault: !!vault,
//         userPositionsCount: userPositions.length,
//         selectedVaultNFT: selectedNFT?.toBase58(),
//         loading,
//         hasError: !!error
//     });

//     console.log('[useVault] Selection context state:', {
//         selectedTokenMint: selectedTokenMint?.toBase58(),
//         selectedTokenAccount: selectedTokenAccount?.toBase58(),
//         contextSelectedNFT: contextSelectedNFT?.toBase58(),
//     });

//     // Computed values
//     const hasRequiredSelections = !!(selectedTokenMint && selectedTokenAccount && contextSelectedNFT);

//     // Store sync - trigger when network state changes
//     useEffect(() => {
//         console.log('[useVault] === STORE SYNC EFFECT START ===');
//         if (isConnected && isNetworkReady && address) {
//             console.log('[useVault] Triggering store sync');
//             syncWithNetwork();
//         }
//         console.log('[useVault] === STORE SYNC EFFECT END ===');
//     }, [isConnected, isNetworkReady, address, syncWithNetwork]);

//     // Program initialization - ONLY when store sync indicates it's needed
//     useEffect(() => {
//         const initializeProgram = async () => {
//             console.log('[useVault] === PROGRAM INIT EFFECT START ===');
//             console.log('[useVault] Program initialization check:', {
//                 isConnected,
//                 hasAddress: !!address,
//                 hasConnection: !!connection,
//                 hasWalletProvider: !!walletProvider,
//                 isNetworkReady,
//                 hasExistingProgram: !!program,
//                 connectionRpc: connection?.rpcEndpoint
//             });

//             if (!isConnected || !address || !connection || !walletProvider || !isNetworkReady) {
//                 console.log('[useVault] Program init conditions not met, clearing state');
//                 if (program) {
//                     console.log('[useVault] Clearing existing program state');
//                     setProgram(null);
//                 }
//                 console.log('[useVault] === PROGRAM INIT EFFECT END (early) ===');
//                 return;
//             }

//             // Don't reinitialize if program already exists, but DO reload data
//             if (program) {
//                 console.log('[useVault] Program already initialized, but forcing data reload...');
//                 // Force data reload to get fresh debugging info
//                 setTimeout(() => {
//                     loadAllVaultData();
//                 }, 100);
//                 console.log('[useVault] === PROGRAM INIT EFFECT END (existing) ===');
//                 return;
//             }

//             try {
//                 setLoading(true);
//                 setError(null);

//                 console.log('[useVault] Initializing program...');

//                 const anchorProvider = new AnchorProvider(
//                     connection,
//                     walletProvider as AnchorWallet,
//                     { commitment: 'confirmed' as Commitment }
//                 );

//                 const newProgram = new Program<SimpleVault>(
//                     IDL as SimpleVault,
//                     anchorProvider
//                 );

//                 console.log('[useVault] Program created:', {
//                     programId: CONFIG.PROGRAM_ID,
//                     vaultPda: CONFIG.VAULT_PDA.toBase58()
//                 });

//                 // Update store
//                 setProgram(newProgram);

//                 console.log('[useVault] Program initialized successfully');

//                 // Trigger data loading AFTER program is set
//                 setTimeout(() => {
//                     loadAllVaultData();
//                 }, 100);

//             } catch (err) {
//                 console.error('[useVault] Failed to initialize program:', err);
//                 setError(`Failed to initialize: ${(err as Error).message}`);
//             } finally {
//                 setLoading(false);
//             }
//             console.log('[useVault] === PROGRAM INIT EFFECT END ===');
//         };

//         initializeProgram();
//     }, [
//         isConnected,
//         address,
//         connection?.rpcEndpoint,
//         walletProvider?.publicKey,
//         isNetworkReady,
//         currentNetwork,
//         program
//         // Removed loadAllVaultData dependency to avoid circular reference
//     ]);

//     // Load all vault data - INTERNAL function for store updates
//     const loadAllVaultData = useCallback(async () => {
//         console.log('[useVault] === LOAD ALL VAULT DATA START ===');

//         // Get fresh values from store
//         const currentConnection = useNetworkStore.getState().connection;
//         const currentProgram = useVaultStore.getState().program;

//         console.log('[useVault] Dependencies check:', {
//             hasConnection: !!currentConnection,
//             hasProgram: !!currentProgram,
//             hasAddress: !!address,
//             vaultPda: CONFIG.VAULT_PDA.toBase58()
//         });

//         if (!currentConnection || !currentProgram || !address) {
//             console.log('[useVault] Missing dependencies for data loading');
//             return;
//         }

//         try {
//             setLoading(true);

//             // First check if the account exists
//             console.log('[useVault] Checking if vault account exists...');
//             const accountInfo = await currentConnection.getAccountInfo(CONFIG.VAULT_PDA);

//             console.log('[useVault] Account info:', {
//                 exists: !!accountInfo,
//                 dataLength: accountInfo?.data.length,
//                 owner: accountInfo?.owner.toBase58(),
//                 expectedProgramId: CONFIG.PROGRAM_ID
//             });

//             if (!accountInfo) {
//                 console.log('[useVault] Vault account does not exist at PDA:', CONFIG.VAULT_PDA.toBase58());
//                 setVault(null);
//                 setError('Vault account not found. Please check if the vault is properly initialized.');
//                 return;
//             }

//             if (accountInfo.owner.toBase58() !== CONFIG.PROGRAM_ID) {
//                 console.log('[useVault] Account owner mismatch:', {
//                     actualOwner: accountInfo.owner.toBase58(),
//                     expectedOwner: CONFIG.PROGRAM_ID
//                 });
//                 setVault(null);
//                 setError('Vault account has wrong owner. Check program ID.');
//                 return;
//             }

//             console.log('[useVault] Fetching vault data from:', CONFIG.VAULT_PDA.toBase58());

//             // Try to fetch vault data
//             const vaultData = await currentProgram.account.vault.fetchNullable(CONFIG.VAULT_PDA);
//             if (vaultData) {
//                 // console.log('[useVault] Vault data loaded successfully:', {
//                 //     owner: vaultData.owner.toBase58(),
//                 //     assetMint: vaultData.assetMint.toBase58(),
//                 //     shareMint: vaultData.shareMint.toBase58(),
//                 //     nftCollectionAddress: vaultData.nftCollectionAddress.toBase58(),
//                 //     totalShares: vaultData.totalShares?.toNumber(),
//                 //     totalBorrowed: vaultData.totalBorrowed?.toNumber(),
//                 //     bump: vaultData.bump
//                 // });

//                 setVault(vaultData as VaultData);
//                 setError(null); // Clear any previous errors
//             } else {
//                 console.log('[useVault] Vault data is null (fetchNullable returned null)');
//                 setVault(null);
//                 setError('Vault data could not be deserialized. Check account structure.');
//             }

//             // TODO: Load user positions when we have the proper account structure
//             // For now, we'll set empty array
//             if (vaultData && address && contextSelectedNFT) {
//                 console.log('[useVault] Loading position for selected NFT:', contextSelectedNFT.toBase58());

//                 try {
//                     const userPublicKey = new PublicKey(address);

//                     // Derive user's NFT token account
//                     const userNftTokenAccount = getAssociatedTokenAddressSync(
//                         contextSelectedNFT,
//                         userPublicKey
//                     );

//                     // Derive user share PDA for this NFT
//                     const [userSharePda] = PublicKey.findProgramAddressSync(
//                         [CONFIG.USER_SHARES_SEED, contextSelectedNFT.toBuffer()],
//                         new PublicKey(CONFIG.PROGRAM_ID)
//                     );

//                     // Derive user's share token account
//                     const userShareTokenAccount = getAssociatedTokenAddressSync(
//                         CONFIG.SHARE_MINT,
//                         userSharePda,
//                         true
//                     );

//                     // Derive the UserInfo PDA
//                     const [userInfoPda] = PublicKey.findProgramAddressSync(
//                         [
//                             CONFIG.USER_INFO_SEED,
//                             userNftTokenAccount.toBuffer(),
//                             userShareTokenAccount.toBuffer()
//                         ],
//                         new PublicKey(CONFIG.PROGRAM_ID)
//                     );

//                     // Fetch the UserInfo account
//                     const userInfo = await currentProgram.account.userInfo.fetchNullable(userInfoPda);

//                     if (userInfo) {
//                         console.log('[useVault] Found position for selected NFT:', {
//                             nftMint: contextSelectedNFT.toBase58(),
//                             shares: userInfo.shares.toString(),
//                             lastUpdate: userInfo.lastUpdate
//                         });

//                         // Calculate deposit amount based on current vault state
//                         let depositAmount = Number(userInfo.shares);
//                         if (vaultData.totalShares > 0) {
//                             try {
//                                 const totalAssets = await currentConnection.getTokenAccountBalance(
//                                     CONFIG.VAULT_TOKEN_ACCOUNT
//                                 );
//                                 const vaultBalance = Number(totalAssets.value.uiAmount || 0);

//                                 if (vaultBalance > 0) {
//                                     depositAmount = (Number(userInfo.shares) * vaultBalance) / Number(vaultData.totalShares);
//                                 }
//                             } catch (err) {
//                                 console.warn('[useVault] Could not fetch vault balance for calculation:', err);
//                             }
//                         }

//                         const currentPosition: UserPosition = {
//                             user: userPublicKey,
//                             nftMint: contextSelectedNFT,
//                             depositAmount,
//                             shareAmount: Number(userInfo.shares),
//                             timestamp: userInfo.lastUpdate * 1000
//                         };

//                         setUserPositions([currentPosition]);
//                     } else {
//                         console.log('[useVault] No position found for selected NFT');
//                         setUserPositions([]);
//                     }

//                 } catch (err) {
//                     console.error('[useVault] Error loading position for selected NFT:', err);
//                     setUserPositions([]);
//                 }
//             } else {
//                 console.log('[useVault] No vault data, address, or selected NFT - clearing positions');
//                 setUserPositions([]);
//             }

//             console.log('[useVault] Vault data loading completed');

//         } catch (err) {
//             console.error('[useVault] Error loading vault data:', {
//                 error: err,
//                 message: (err as Error).message,
//                 stack: (err as Error).stack,
//                 vaultPda: CONFIG.VAULT_PDA.toBase58(),
//                 programId: CONFIG.PROGRAM_ID
//             });

//             // More specific error messages based on error type
//             let errorMessage = `Failed to load vault data: ${(err as Error).message}`;

//             if ((err as Error).message.includes('buffer length')) {
//                 errorMessage = 'Vault account structure mismatch. Please check if the vault program has been updated.';
//             } else if ((err as Error).message.includes('Account does not exist')) {
//                 errorMessage = 'Vault account not found. Please initialize the vault first.';
//             }

//             setError(errorMessage);
//             setVault(null);
//         } finally {
//             setLoading(false);
//         }

//         console.log('[useVault] === LOAD ALL VAULT DATA END ===');
//     }, [address, setVault, setUserPositions, setLoading, setError]);

//     // Deposit function - ACTION only, updates store automatically
//     const deposit = useCallback(async (
//         amount: BN,
//         assetMint: PublicKey,
//         userNftMint: PublicKey
//     ): Promise<string | null> => {
//         console.log('[useVault] === DEPOSIT START ===');

//         if (!program || !address || !vault) {
//             setError('Program not initialized or vault not loaded');
//             return null;
//         }

//         if (!selectedTokenAccount) {
//             setError('No token account selected');
//             return null;
//         }

//         setLoading(true);
//         setError(null);

//         try {
//             const userPublicKey = new PublicKey(address);

//             // Derive user's NFT token account
//             const userNftTokenAccount = getAssociatedTokenAddressSync(
//                 userNftMint,
//                 userPublicKey
//             );

//             console.log('[useVault] Deposit parameters:', {
//                 amount: amount.toString(),
//                 assetMint: assetMint.toBase58(),
//                 userNftMint: userNftMint.toBase58(),
//                 userNftTokenAccount: userNftTokenAccount.toBase58(),
//                 userAssetTokenAccount: selectedTokenAccount.toBase58(),
//                 vaultPda: CONFIG.VAULT_PDA.toBase58(),
//                 vaultTokenAccount: CONFIG.VAULT_TOKEN_ACCOUNT.toBase58()
//             });

//             const tx = await program.methods
//                 .deposit(amount)
//                 .accounts({
//                     user: userPublicKey,
//                     vault: CONFIG.VAULT_PDA,
//                     nftCollection: CONFIG.COLLECTION_PDA,
//                     userNftToken: userNftTokenAccount,
//                     userNftMint: userNftMint,
//                     assetMint: assetMint,
//                     // userAssetToken: selectedTokenAccount,
//                     vaultTokenAccount: CONFIG.VAULT_TOKEN_ACCOUNT,
//                     shareMint: CONFIG.SHARE_MINT,
//                 })
//                 .rpc();

//             console.log('[useVault] Deposit successful:', tx);

//             // Refresh store data after successful deposit
//             await loadAllVaultData();

//             // Add user position to store (simplified version)
//             const newPosition: UserPosition = {
//                 user: userPublicKey,
//                 nftMint: userNftMint,
//                 depositAmount: amount.toNumber(),
//                 shareAmount: amount.toNumber(), // Simplified 1:1 ratio
//                 timestamp: Date.now(),
//             };
//             addUserPosition(newPosition);

//             return tx;
//         } catch (err) {
//             console.error('[useVault] Error depositing:', err);
//             setError(`Failed to deposit: ${(err as Error).message}`);
//             return null;
//         } finally {
//             setLoading(false);
//         }
//     }, [program, address, vault, selectedTokenAccount, loadAllVaultData, addUserPosition, setLoading, setError]);

//     // Withdraw function - ACTION only, updates store automatically
//     const withdraw = useCallback(async (
//         shares: BN,
//         assetMint: PublicKey,
//         userNftMint: PublicKey
//     ): Promise<string | null> => {
//         console.log('[useVault] === WITHDRAW START ===');

//         if (!program || !address || !vault) {
//             setError('Program not initialized or vault not loaded');
//             return null;
//         }

//         if (!selectedTokenAccount) {
//             setError('No token account selected');
//             return null;
//         }

//         setLoading(true);
//         setError(null);

//         try {
//             const userPublicKey = new PublicKey(address);

//             // Derive user's NFT token account
//             const userNftTokenAccount = getAssociatedTokenAddressSync(
//                 userNftMint,
//                 userPublicKey
//             );

//             console.log('[useVault] Withdraw parameters:', {
//                 shares: shares.toString(),
//                 assetMint: assetMint.toBase58(),
//                 userNftMint: userNftMint.toBase58(),
//                 userNftTokenAccount: userNftTokenAccount.toBase58(),
//                 userAssetTokenAccount: selectedTokenAccount.toBase58()
//             });

//             const tx = await program.methods
//                 .withdraw(shares)
//                 .accounts({
//                     user: userPublicKey,
//                     vault: CONFIG.VAULT_PDA,
//                     nftCollection: CONFIG.COLLECTION_PDA,
//                     userNftToken: userNftTokenAccount,
//                     userNftMint: userNftMint,
//                     assetMint: assetMint,
//                     // userAssetToken: selectedTokenAccount,
//                     vaultTokenAccount: CONFIG.VAULT_TOKEN_ACCOUNT,
//                     shareMint: CONFIG.SHARE_MINT,
//                 })
//                 .rpc();

//             console.log('[useVault] Withdraw successful:', tx);

//             // Refresh store data after successful withdraw
//             await loadAllVaultData();

//             return tx;
//         } catch (err) {
//             console.error('[useVault] Error withdrawing:', err);
//             setError(`Failed to withdraw: ${(err as Error).message}`);
//             return null;
//         } finally {
//             setLoading(false);
//         }
//     }, [program, address, vault, selectedTokenAccount, loadAllVaultData, setLoading, setError]);

//     // Program initialization - ONLY when store sync indicates it's needed
//     useEffect(() => {
//         const initializeProgram = async () => {
//             // console.log('[useVault] === PROGRAM INIT EFFECT START ===');
//             // console.log('[useVault] Program initialization check:', {
//             //     isConnected,
//             //     hasAddress: !!address,
//             //     hasConnection: !!connection,
//             //     hasWalletProvider: !!walletProvider,
//             //     isNetworkReady,
//             //     hasExistingProgram: !!program,
//             //     connectionRpc: connection?.rpcEndpoint
//             // });

//             if (!isConnected || !address || !connection || !walletProvider || !isNetworkReady) {
//                 console.log('[useVault] Program init conditions not met, clearing state');
//                 if (program) {
//                     console.log('[useVault] Clearing existing program state');
//                     setProgram(null);
//                 }
//                 console.log('[useVault] === PROGRAM INIT EFFECT END (early) ===');
//                 return;
//             }

//             // Don't reinitialize if program already exists
//             if (program) {
//                 console.log('[useVault] Program already initialized, skipping');
//                 console.log('[useVault] === PROGRAM INIT EFFECT END (existing) ===');
//                 return;
//             }

//             try {
//                 setLoading(true);
//                 setError(null);

//                 console.log('[useVault] Initializing program...');

//                 const anchorProvider = new AnchorProvider(
//                     connection,
//                     walletProvider as AnchorWallet,
//                     { commitment: 'confirmed' as Commitment }
//                 );

//                 const newProgram = new Program<SimpleVault>(
//                     IDL as SimpleVault,
//                     anchorProvider
//                 );

//                 console.log('[useVault] Program created:', {
//                     programId: CONFIG.PROGRAM_ID,
//                     vaultPda: CONFIG.VAULT_PDA.toBase58()
//                 });

//                 // Update store
//                 setProgram(newProgram);

//                 console.log('[useVault] Program initialized successfully');

//             } catch (err) {
//                 console.error('[useVault] Failed to initialize program:', err);
//                 setError(`Failed to initialize: ${(err as Error).message}`);
//             } finally {
//                 setLoading(false);
//             }
//             console.log('[useVault] === PROGRAM INIT EFFECT END ===');
//         };

//         initializeProgram();
//     }, [
//         isConnected,
//         address,
//         connection?.rpcEndpoint,
//         walletProvider?.publicKey,
//         isNetworkReady,
//         currentNetwork,
//         program
//     ]);

//     // Separate effect for data loading to avoid circular dependencies
//     useEffect(() => {
//         if (program && address && connection && !loading) {
//             console.log('[useVault] === DATA LOAD TRIGGER ===');
//             console.log('[useVault] Conditions met for data loading, triggering...');
//             setTimeout(() => {
//                 loadAllVaultData();
//             }, 100);
//         }
//     }, [program, address, connection?.rpcEndpoint]);

//     // Manual refresh - PUBLIC action for components
//     const refreshAllData = useCallback(() => {
//         console.log('[useVault] Manual refresh triggered');
//         if (program) {
//             // Clear any existing error first
//             setError(null);
//             loadAllVaultData();
//         } else {
//             console.log('[useVault] No program available for refresh');
//         }
//     }, [program, setError]);

//     // Set selected NFT for vault operations
//     const setSelectedVaultNFT = useCallback((nft: PublicKey | null) => {
//         console.log('[useVault] Setting selected vault NFT:', nft?.toBase58());
//         setSelectedNFT(nft);
//     }, [setSelectedNFT]);

//     const convertVaultDataToSafe = (rawVaultData: any): VaultData => {
//         return {
//             owner: rawVaultData.owner,
//             assetMint: rawVaultData.assetMint,
//             shareMint: rawVaultData.shareMint,
//             nftCollectionAddress: rawVaultData.nftCollectionAddress,

//             // Convert all BN objects to strings for safe React rendering
//             totalBorrowed: rawVaultData.totalBorrowed.toString(),
//             borrowIndex: rawVaultData.borrowIndex.toString(),
//             borrowRate: rawVaultData.borrowRate.toString(),
//             lastUpdateTime: rawVaultData.lastUpdateTime.toString(),
//             reserveFactor: rawVaultData.reserveFactor.toString(),
//             totalReserves: rawVaultData.totalReserves.toString(),
//             totalShares: rawVaultData.totalShares.toString(),

//             bump: rawVaultData.bump // number is already safe
//         };
//     };

//     console.log('[useVault] === HOOK CALL END ===');

//     return {
//         // Store state (read-only)
//         program,
//         vault,
//         userPositions,
//         selectedNFT,
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

//         // Selection state (read-only)
//         selectedTokenMint,
//         selectedTokenAccount,
//         hasRequiredSelections,

//         // Computed values
//         programId: CONFIG.PROGRAM_ID,
//         vaultConfig: CONFIG,

//         // Actions only
//         deposit,
//         withdraw,
//         refreshAllData,
//         setSelectedVaultNFT,
//     };
// };
