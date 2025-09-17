import { useState, useEffect, useCallback } from 'react';
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
    // Updated with correct addresses from your successful deployment
    COLLECTION_PDA: new PublicKey('EoZ5NFigrZ7uqUUSH6ShDsYGMooe5ziTfgWvAbFmVTXt'),
    VAULT_ASSET_MINT: new PublicKey("4kXBWAG92UZA1FPEQDN5bjePoFyQsbTnZ9rpxgRBbFYk"), // ✅ Correct from deployment
    VAULT_PDA: new PublicKey("DbCxNx4uvjK2wxvJbrd5DVJ6jVM8eJirYk8RbAL9Mvt1"), // ✅ Correct from transaction
    SHARE_MINT: new PublicKey("5CTdzZxPhqC4DWpTM5MFzwqCtHFmKQTsXE7VWUC6UxTG"), // ✅ Correct from transaction
    VAULT_TOKEN_ACCOUNT: new PublicKey("Ak7DxLGEauBkW769NSRvA9kVkc41SxJKK29mbeJu5gzE"), // ✅ Correct from transaction
};

export interface UseVaultReturn {
    // Store state (read-only)
    program: Program<SimpleVault> | null;
    vault: VaultData | null;
    userPositions: UserPosition[];
    selectedNFT: PublicKey | null;
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

    // Selection state (read-only)
    selectedTokenMint: PublicKey | null;
    selectedTokenAccount: PublicKey | null;
    hasRequiredSelections: boolean;

    // Computed values
    programId: string;
    vaultConfig: typeof CONFIG;

    // Actions only (no direct data fetching in components)
    deposit: (amount: BN, assetMint: PublicKey, userNftMint: PublicKey) => Promise<string | null>;
    withdraw: (shares: BN, assetMint: PublicKey, userNftMint: PublicKey) => Promise<string | null>;
    
    // Store actions
    refreshAllData: () => void;
    setSelectedVaultNFT: (nft: PublicKey | null) => void;
}

export const useVault = (): UseVaultReturn => {
    console.log('[useVault] === HOOK CALL START ===');
    
    // AppKit hooks (wallet info only)
    const { address, isConnected } = useAppKitAccount();
    const { caipNetwork } = useAppKitNetwork();
    const { walletProvider } = useAppKitProvider<AnchorWallet>('solana');

    // Network store (read-only)
    const connection = useNetworkStore((state) => state.connection);
    const currentNetwork = useNetworkStore((state) => state.currentNetwork);
    const isSolanaNetwork = useNetworkStore((state) => state.isSolanaNetwork);
    const isNetworkReady = useNetworkStore((state) => state.isReady);

    // Vault store (read-only + actions)
    const program = useVaultStore((state) => state.program);
    const vault = useVaultStore((state) => state.vault);
    const userPositions = useVaultStore((state) => state.userPositions);
    const selectedNFT = useVaultStore((state) => state.selectedNFT);
    const loading = useVaultStore((state) => state.loading);
    const error = useVaultStore((state) => state.error);

    const {
        setProgram,
        setVault,
        setUserPositions,
        setSelectedNFT,
        setLoading,
        setError,
        syncWithNetwork,
        addUserPosition,
    } = useVaultStore();

    // Selection context (read-only)
    const { selectedTokenAccount, selectedTokenMint } = useTokenSelection();
    const { selectedNFT: contextSelectedNFT } = useNFTSelection();

    const programId = new PublicKey(CONFIG.PROGRAM_ID);

    console.log('[useVault] Store state:', {
        hasProgram: !!program,
        hasVault: !!vault,
        userPositionsCount: userPositions.length,
        selectedVaultNFT: selectedNFT?.toBase58(),
        loading,
        hasError: !!error
    });

    console.log('[useVault] Selection context state:', {
        selectedTokenMint: selectedTokenMint?.toBase58(),
        selectedTokenAccount: selectedTokenAccount?.toBase58(),
        contextSelectedNFT: contextSelectedNFT?.toBase58(),
    });

    // Computed values
    const hasRequiredSelections = !!(selectedTokenMint && selectedTokenAccount && contextSelectedNFT);

    // Store sync - trigger when network state changes
    useEffect(() => {
        console.log('[useVault] === STORE SYNC EFFECT START ===');
        if (isConnected && isNetworkReady && address) {
            console.log('[useVault] Triggering store sync');
            syncWithNetwork();
        }
        console.log('[useVault] === STORE SYNC EFFECT END ===');
    }, [isConnected, isNetworkReady, address, syncWithNetwork]);

    // Program initialization - ONLY when store sync indicates it's needed
    useEffect(() => {
        const initializeProgram = async () => {
            console.log('[useVault] === PROGRAM INIT EFFECT START ===');
            console.log('[useVault] Program initialization check:', {
                isConnected,
                hasAddress: !!address,
                hasConnection: !!connection,
                hasWalletProvider: !!walletProvider,
                isNetworkReady,
                hasExistingProgram: !!program,
                connectionRpc: connection?.rpcEndpoint
            });

            if (!isConnected || !address || !connection || !walletProvider || !isNetworkReady) {
                console.log('[useVault] Program init conditions not met, clearing state');
                if (program) {
                    console.log('[useVault] Clearing existing program state');
                    setProgram(null);
                }
                console.log('[useVault] === PROGRAM INIT EFFECT END (early) ===');
                return;
            }

            // Don't reinitialize if program already exists, but DO reload data
            if (program) {
                console.log('[useVault] Program already initialized, but forcing data reload...');
                // Force data reload to get fresh debugging info
                setTimeout(() => {
                    loadAllVaultData();
                }, 100);
                console.log('[useVault] === PROGRAM INIT EFFECT END (existing) ===');
                return;
            }

            try {
                setLoading(true);
                setError(null);

                console.log('[useVault] Initializing program...');

                const anchorProvider = new AnchorProvider(
                    connection,
                    walletProvider as AnchorWallet,
                    { commitment: 'confirmed' as Commitment }
                );

                const newProgram = new Program<SimpleVault>(
                    IDL as SimpleVault,
                    anchorProvider
                );

                console.log('[useVault] Program created:', {
                    programId: CONFIG.PROGRAM_ID,
                    vaultPda: CONFIG.VAULT_PDA.toBase58()
                });

                // Update store
                setProgram(newProgram);

                console.log('[useVault] Program initialized successfully');

                // Trigger data loading AFTER program is set
                setTimeout(() => {
                    loadAllVaultData();
                }, 100);

            } catch (err) {
                console.error('[useVault] Failed to initialize program:', err);
                setError(`Failed to initialize: ${(err as Error).message}`);
            } finally {
                setLoading(false);
            }
            console.log('[useVault] === PROGRAM INIT EFFECT END ===');
        };

        initializeProgram();
    }, [
        isConnected,
        address,
        connection?.rpcEndpoint,
        walletProvider?.publicKey,
        isNetworkReady,
        currentNetwork,
        program
        // Removed loadAllVaultData dependency to avoid circular reference
    ]);

    // Load all vault data - INTERNAL function for store updates
    const loadAllVaultData = useCallback(async () => {
        console.log('[useVault] === LOAD ALL VAULT DATA START ===');
        
        // Get fresh values from store
        const currentConnection = useNetworkStore.getState().connection;
        const currentProgram = useVaultStore.getState().program;
        
        console.log('[useVault] Dependencies check:', {
            hasConnection: !!currentConnection,
            hasProgram: !!currentProgram,
            hasAddress: !!address,
            vaultPda: CONFIG.VAULT_PDA.toBase58()
        });
        
        if (!currentConnection || !currentProgram || !address) {
            console.log('[useVault] Missing dependencies for data loading');
            return;
        }

        try {
            setLoading(true);
            
            // First check if the account exists
            console.log('[useVault] Checking if vault account exists...');
            const accountInfo = await currentConnection.getAccountInfo(CONFIG.VAULT_PDA);
            
            console.log('[useVault] Account info:', {
                exists: !!accountInfo,
                dataLength: accountInfo?.data.length,
                owner: accountInfo?.owner.toBase58(),
                expectedProgramId: CONFIG.PROGRAM_ID
            });
            
            if (!accountInfo) {
                console.log('[useVault] Vault account does not exist at PDA:', CONFIG.VAULT_PDA.toBase58());
                setVault(null);
                setError('Vault account not found. Please check if the vault is properly initialized.');
                return;
            }
            
            if (accountInfo.owner.toBase58() !== CONFIG.PROGRAM_ID) {
                console.log('[useVault] Account owner mismatch:', {
                    actualOwner: accountInfo.owner.toBase58(),
                    expectedOwner: CONFIG.PROGRAM_ID
                });
                setVault(null);
                setError('Vault account has wrong owner. Check program ID.');
                return;
            }
            
            console.log('[useVault] Fetching vault data from:', CONFIG.VAULT_PDA.toBase58());
            
            // Try to fetch vault data
            const vaultData = await currentProgram.account.vault.fetchNullable(CONFIG.VAULT_PDA);
            if (vaultData) {
                console.log('[useVault] Vault data loaded successfully:', {
                    owner: vaultData.owner.toBase58(),
                    assetMint: vaultData.assetMint.toBase58(),
                    shareMint: vaultData.shareMint.toBase58(),
                    nftCollectionAddress: vaultData.nftCollectionAddress.toBase58(),
                    totalShares: vaultData.totalShares?.toString(),
                    totalBorrowed: vaultData.totalBorrowed?.toString(),
                    bump: vaultData.bump
                });
                setVault(vaultData as VaultData);
                setError(null); // Clear any previous errors
            } else {
                console.log('[useVault] Vault data is null (fetchNullable returned null)');
                setVault(null);
                setError('Vault data could not be deserialized. Check account structure.');
            }

            // TODO: Load user positions when we have the proper account structure
            // For now, we'll set empty array
            setUserPositions([]);

            console.log('[useVault] Vault data loading completed');

        } catch (err) {
            console.error('[useVault] Error loading vault data:', {
                error: err,
                message: (err as Error).message,
                stack: (err as Error).stack,
                vaultPda: CONFIG.VAULT_PDA.toBase58(),
                programId: CONFIG.PROGRAM_ID
            });
            
            // More specific error messages based on error type
            let errorMessage = `Failed to load vault data: ${(err as Error).message}`;
            
            if ((err as Error).message.includes('buffer length')) {
                errorMessage = 'Vault account structure mismatch. Please check if the vault program has been updated.';
            } else if ((err as Error).message.includes('Account does not exist')) {
                errorMessage = 'Vault account not found. Please initialize the vault first.';
            }
            
            setError(errorMessage);
            setVault(null);
        } finally {
            setLoading(false);
        }
        
        console.log('[useVault] === LOAD ALL VAULT DATA END ===');
    }, [address, setVault, setUserPositions, setLoading, setError]);

    // Deposit function - ACTION only, updates store automatically
    const deposit = useCallback(async (
        amount: BN,
        assetMint: PublicKey,
        userNftMint: PublicKey
    ): Promise<string | null> => {
        console.log('[useVault] === DEPOSIT START ===');
        
        if (!program || !address || !vault) {
            setError('Program not initialized or vault not loaded');
            return null;
        }

        if (!selectedTokenAccount) {
            setError('No token account selected');
            return null;
        }

        setLoading(true);
        setError(null);

        try {
            const userPublicKey = new PublicKey(address);

            // Derive user's NFT token account
            const userNftTokenAccount = getAssociatedTokenAddressSync(
                userNftMint,
                userPublicKey
            );

            console.log('[useVault] Deposit parameters:', {
                amount: amount.toString(),
                assetMint: assetMint.toBase58(),
                userNftMint: userNftMint.toBase58(),
                userNftTokenAccount: userNftTokenAccount.toBase58(),
                userAssetTokenAccount: selectedTokenAccount.toBase58(),
                vaultPda: CONFIG.VAULT_PDA.toBase58(),
                vaultTokenAccount: CONFIG.VAULT_TOKEN_ACCOUNT.toBase58()
            });

            const tx = await program.methods
                .deposit(amount)
                .accounts({
                    user: userPublicKey,
                    vault: CONFIG.VAULT_PDA,
                    nftCollection: CONFIG.COLLECTION_PDA,
                    userNftToken: userNftTokenAccount,
                    userNftMint: userNftMint,
                    assetMint: assetMint,
                    // userAssetToken: selectedTokenAccount,
                    vaultTokenAccount: CONFIG.VAULT_TOKEN_ACCOUNT,
                    shareMint: CONFIG.SHARE_MINT,
                })
                .rpc();

            console.log('[useVault] Deposit successful:', tx);

            // Refresh store data after successful deposit
            await loadAllVaultData();

            // Add user position to store (simplified version)
            const newPosition: UserPosition = {
                user: userPublicKey,
                nftMint: userNftMint,
                depositAmount: amount.toNumber(),
                shareAmount: amount.toNumber(), // Simplified 1:1 ratio
                timestamp: Date.now(),
            };
            addUserPosition(newPosition);

            return tx;
        } catch (err) {
            console.error('[useVault] Error depositing:', err);
            setError(`Failed to deposit: ${(err as Error).message}`);
            return null;
        } finally {
            setLoading(false);
        }
    }, [program, address, vault, selectedTokenAccount, loadAllVaultData, addUserPosition, setLoading, setError]);

    // Withdraw function - ACTION only, updates store automatically
    const withdraw = useCallback(async (
        shares: BN,
        assetMint: PublicKey,
        userNftMint: PublicKey
    ): Promise<string | null> => {
        console.log('[useVault] === WITHDRAW START ===');
        
        if (!program || !address || !vault) {
            setError('Program not initialized or vault not loaded');
            return null;
        }

        if (!selectedTokenAccount) {
            setError('No token account selected');
            return null;
        }

        setLoading(true);
        setError(null);

        try {
            const userPublicKey = new PublicKey(address);

            // Derive user's NFT token account
            const userNftTokenAccount = getAssociatedTokenAddressSync(
                userNftMint,
                userPublicKey
            );

            console.log('[useVault] Withdraw parameters:', {
                shares: shares.toString(),
                assetMint: assetMint.toBase58(),
                userNftMint: userNftMint.toBase58(),
                userNftTokenAccount: userNftTokenAccount.toBase58(),
                userAssetTokenAccount: selectedTokenAccount.toBase58()
            });

            const tx = await program.methods
                .withdraw(shares)
                .accounts({
                    user: userPublicKey,
                    vault: CONFIG.VAULT_PDA,
                    nftCollection: CONFIG.COLLECTION_PDA,
                    userNftToken: userNftTokenAccount,
                    userNftMint: userNftMint,
                    assetMint: assetMint,
                    // userAssetToken: selectedTokenAccount,
                    vaultTokenAccount: CONFIG.VAULT_TOKEN_ACCOUNT,
                    shareMint: CONFIG.SHARE_MINT,
                })
                .rpc();

            console.log('[useVault] Withdraw successful:', tx);

            // Refresh store data after successful withdraw
            await loadAllVaultData();

            return tx;
        } catch (err) {
            console.error('[useVault] Error withdrawing:', err);
            setError(`Failed to withdraw: ${(err as Error).message}`);
            return null;
        } finally {
            setLoading(false);
        }
    }, [program, address, vault, selectedTokenAccount, loadAllVaultData, setLoading, setError]);

    // Program initialization - ONLY when store sync indicates it's needed
    useEffect(() => {
        const initializeProgram = async () => {
            // console.log('[useVault] === PROGRAM INIT EFFECT START ===');
            // console.log('[useVault] Program initialization check:', {
            //     isConnected,
            //     hasAddress: !!address,
            //     hasConnection: !!connection,
            //     hasWalletProvider: !!walletProvider,
            //     isNetworkReady,
            //     hasExistingProgram: !!program,
            //     connectionRpc: connection?.rpcEndpoint
            // });

            if (!isConnected || !address || !connection || !walletProvider || !isNetworkReady) {
                console.log('[useVault] Program init conditions not met, clearing state');
                if (program) {
                    console.log('[useVault] Clearing existing program state');
                    setProgram(null);
                }
                console.log('[useVault] === PROGRAM INIT EFFECT END (early) ===');
                return;
            }

            // Don't reinitialize if program already exists
            if (program) {
                console.log('[useVault] Program already initialized, skipping');
                console.log('[useVault] === PROGRAM INIT EFFECT END (existing) ===');
                return;
            }

            try {
                setLoading(true);
                setError(null);

                console.log('[useVault] Initializing program...');

                const anchorProvider = new AnchorProvider(
                    connection,
                    walletProvider as AnchorWallet,
                    { commitment: 'confirmed' as Commitment }
                );

                const newProgram = new Program<SimpleVault>(
                    IDL as SimpleVault,
                    anchorProvider
                );

                console.log('[useVault] Program created:', {
                    programId: CONFIG.PROGRAM_ID,
                    vaultPda: CONFIG.VAULT_PDA.toBase58()
                });

                // Update store
                setProgram(newProgram);

                console.log('[useVault] Program initialized successfully');

            } catch (err) {
                console.error('[useVault] Failed to initialize program:', err);
                setError(`Failed to initialize: ${(err as Error).message}`);
            } finally {
                setLoading(false);
            }
            console.log('[useVault] === PROGRAM INIT EFFECT END ===');
        };

        initializeProgram();
    }, [
        isConnected,
        address,
        connection?.rpcEndpoint,
        walletProvider?.publicKey,
        isNetworkReady,
        currentNetwork,
        program
    ]);

    // Separate effect for data loading to avoid circular dependencies
    useEffect(() => {
        if (program && address && connection && !loading) {
            console.log('[useVault] === DATA LOAD TRIGGER ===');
            console.log('[useVault] Conditions met for data loading, triggering...');
            setTimeout(() => {
                loadAllVaultData();
            }, 100);
        }
    }, [program, address, connection?.rpcEndpoint]);

    // Manual refresh - PUBLIC action for components
    const refreshAllData = useCallback(() => {
        console.log('[useVault] Manual refresh triggered');
        if (program) {
            // Clear any existing error first
            setError(null);
            loadAllVaultData();
        } else {
            console.log('[useVault] No program available for refresh');
        }
    }, [program, setError]);

    // Set selected NFT for vault operations
    const setSelectedVaultNFT = useCallback((nft: PublicKey | null) => {
        console.log('[useVault] Setting selected vault NFT:', nft?.toBase58());
        setSelectedNFT(nft);
    }, [setSelectedNFT]);

    console.log('[useVault] === HOOK CALL END ===');

    return {
        // Store state (read-only)
        program,
        vault,
        userPositions,
        selectedNFT,
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

        // Selection state (read-only)
        selectedTokenMint,
        selectedTokenAccount,
        hasRequiredSelections,

        // Computed values
        programId: CONFIG.PROGRAM_ID,
        vaultConfig: CONFIG,

        // Actions only
        deposit,
        withdraw,
        refreshAllData,
        setSelectedVaultNFT,
    };
};
// import { useState, useEffect, useCallback } from 'react';
// import { useAppKitAccount, useAppKitNetwork, useAppKitProvider } from '@reown/appkit/react';
// import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
// import {
//     PublicKey,
//     Connection,
//     Commitment,
//     // Transaction,
//     // Signer,
//     // SendTransactionError,
//     // SystemProgram
// } from '@solana/web3.js';
// import {

//     getAssociatedTokenAddressSync,

// } from '@solana/spl-token';
// import { AnchorWallet } from '@solana/wallet-adapter-react';

// import type { SimpleVault } from '@/types/simple_vault';
// import IDL from '@/idl/simple_vault.json';

// // CONFIGURATION
// const CONFIG = {
//     PROGRAM_ID: '6szSVnHy2GrCi6y7aQxJfQG9WpVkTgdB6kDXixepvdoW', // Your vault program ID

//     RPC_ENDPOINTS: {
//         'solana-testnet': 'https://api.testnet.solana.com',
//         'solana-devnet': 'https://api.devnet.solana.com',
//         'solana-mainnet': 'https://api.mainnet-beta.solana.com',
//         'solana-localnet': 'http://localhost:8899',
//         'Solana Local': 'http://localhost:8899',
//     },

//     // NFT Collection related
//     collectionPda: new PublicKey('EoZ5NFigrZ7uqUUSH6ShDsYGMooe5ziTfgWvAbFmVTXt'),
//     USER_INFO_SEED: Buffer.from("user_info"),
//     BORROW_INFO_SEED: Buffer.from("borrow_info"),
//     VAULT_ASSET_MINT: new PublicKey("4kXBWAG92UZA1FPEQDN5bjePoFyQsbTnZ9rpxgRBbFYk"),
//     // let collectionBump: number;
//     //let nftMint: PublicKey;
//     //let user1NftTokenAccount: PublicKey;

//     // Asset token (what users deposit)
//     // user1AssetTokenAccount: new PublicKey("GrxrVYtnx23B5oTeCiEmnoSXHJ3JTE5QpqUndxUseJDa"),


//     // Vault related
//     vaultPda: new PublicKey("J9CqYMdTx7E2g3MzPkbpLcXULNYMo93fbPqC6k1vvZhS"),
//     // let vaultBump: number;
//     shareMint: new PublicKey("9GE5d2zxagYxnzZ2EzVunmQgurh8vxg7TEWfYmLuu4L4"),
//     // let vaultTokenAccount: PublicKey;
//     // let user1ShareTokenAccount: PublicKey;

//     // Seeds
//     VAULT_SEED: Buffer.from("vault"),
//     // NFT_USER_INFO_SEED: Buffer.from("nft_user_info"),
//     // NFT_BORROW_INFO_SEED: Buffer.from("nft_borrow_info"),
    
// };

// // Types
// export interface VaultData {
//     owner: PublicKey;
//     assetMint: PublicKey;
//     shareMint: PublicKey;
//     nftCollectionAddress: PublicKey;
//     bump: number;
// }



// export interface UseVaultNFTReturn {
//     // State
//     program: Program<SimpleVault> | null;
//     vault: VaultData | null;
//     loading: boolean;
//     error: string | null;
//     isConnected: boolean;
//     walletAddress: string | undefined;

//     // Network info
//     currentNetwork: string | null;
//     programId: string;

//     // NFT Functions

//     // Regular Functions (non-NFT)
//     deposit: (amount: BN) => Promise<string | null>;

//     // Admin Functions
//     // initializeVault?: (mint: PublicKey, pool: PublicKey, reserveFactor: BN) => Promise<string | null>;
//     // pauseVault: () => Promise<string | null>;
//     // unpauseVault: () => Promise<string | null>;
//     // setReserveFactor: (newFactor: BN) => Promise<string | null>;
//     // withdrawReserves: (amount: BN) => Promise<string | null>;

//     // Query Functions
//     // getVaultInfo?: () => Promise<VaultData | null>;
//     refreshData: () => Promise<void>;

//     // Hardcoded values for easy access
//     assetMint: PublicKey;
//     vaultPda: PublicKey;
//     shareMint: PublicKey;
//     nftCollection: PublicKey;
// }

// export const useVault = (): UseVaultNFTReturn => {
//     // AppKit hooks
//     const { address, isConnected } = useAppKitAccount();
//     const { caipNetwork, caipNetworkId } = useAppKitNetwork();
//     const { walletProvider } = useAppKitProvider('solana');

//     // State

//     const [connection, setConnection] = useState<Connection | null>(null);
//     const [program, setProgram] = useState<Program<SimpleVault> | null>(null);
//     const [vault, setVault] = useState<VaultData | null>(null);

//     const [loading, setLoading] = useState<boolean>(false);
//     const [error, setError] = useState<string | null>(null);

//     // PDAs
//     const [vaultPda, setVaultPda] = useState<PublicKey | null>(null);

//     // const programId = new PublicKey(CONFIG.PROGRAM_ID);
//     const isSolanaNetwork = caipNetworkId?.includes('solana') || false;
//     const currentNetwork = caipNetwork?.name || null;

//     // Setup connection
//     useEffect(() => {
//         if (isSolanaNetwork && currentNetwork) {
//             const rpcUrl = CONFIG.RPC_ENDPOINTS[currentNetwork as keyof typeof CONFIG.RPC_ENDPOINTS]
//                 || CONFIG.RPC_ENDPOINTS['solana-testnet'];
//             const newConnection = new Connection(rpcUrl, 'confirmed');
//             setConnection(newConnection);
//             console.log('Connected to:', currentNetwork, rpcUrl);
//         }
//     }, [isSolanaNetwork, currentNetwork]);

//     // Initialize program

//     useEffect(() => {
//         const initializeProgram = async () => {
//             console.log("[initializeProgram] triggered with deps:", {
//                 isConnected,
//                 address,
//                 hasConnection: !!connection,
//                 hasWalletProvider: !!walletProvider,
//                 isSolanaNetwork,
//                 vaultMint: CONFIG.VAULT_ASSET_MINT.toBase58(),
//             });

//             if (!isConnected || !address || !connection || !walletProvider || !isSolanaNetwork) {
//                 console.log("[initializeProgram] missing dependencies → clearing program");
//                 setProgram(null);
//                 return;
//             }

//             try {
//                 const anchorProvider = new AnchorProvider(
//                     connection,
//                     walletProvider as AnchorWallet,
//                     { commitment: 'confirmed' as Commitment }
//                 );

//                 // anchorProvider.wallet.payer?.secretKey

//                 const program = new Program<SimpleVault>(
//                     IDL as SimpleVault,
//                     anchorProvider
//                 );
//                 setProgram(program);

//                 console.log("[initializeProgram] Program created");

//                 // Derive vault PDA if mint is provided

//                 console.log("[initializeProgram] Deriving PDA for mint:", CONFIG.VAULT_ASSET_MINT.toBase58());

//                 // const [vaultPda] = PublicKey.findProgramAddressSync(
//                 //     [CONFIG.VAULT_SEED, CONFIG.VAULT_ASSET_MINT.toBuffer()],
//                 //     programId
//                 // );
//                 setVaultPda(CONFIG.vaultPda);

//                 console.log("[initializeProgram] PDA derived:", CONFIG.vaultPda.toBase58());

//                 // Load vault data
//                 const vaultData = await program.account.vault.fetchNullable(CONFIG.vaultPda);
//                 console.log("[initializeProgram] Vault data fetched:", vaultData);

//                 if (vaultData) {
//                     setVault(vaultData as VaultData);
//                 }


//                 console.log("[initializeProgram] Initialization finished ✅");
//             } catch (err) {
//                 console.error("[initializeProgram] Failed to initialize:", err);
//                 setError(`Failed to initialize: ${(err as Error).message}`);
//             }
//         };

//         initializeProgram();
//         // }, [isConnected, address, walletProvider, isSolanaNetwork, vaultMint]);
//     }, [isConnected, address, isSolanaNetwork, walletProvider]);
//     // Initialize Vault


//     // Regular deposit (non-NFT)
//     const deposit = useCallback(async (amount: BN): Promise<string | null> => {
//         if (!program || !address || !vaultPda || !vault) {
//             setError('Wallet not connected or vault not loaded');
//             return null;
//         }

//         setLoading(true);
//         setError(null);

//         try {
//             const userPublicKey = new PublicKey(address);

//             // --- NFT Info (from your deploy script logs)
//             const nftMint = new PublicKey("4xZMLJQp6MQegkGbZFWZfzDmugLX8Ke5kCk3dbCnwKdf");
//             const userNftTokenAccount = getAssociatedTokenAddressSync(
//                 nftMint,
//                 userPublicKey
//             );



//             const vaultTokenAccount = new PublicKey("CrNtyVfm6ubsP8ntGJ1PuHfYi1CxrLe25un949F9NuDi")

//             // --- User's Share Token Account (ATA)
//             // const userShareToken = getAssociatedTokenAddressSync(
//             //   CONFIG.shareMint,
//             //   userPublicKey
//             // );
//             const collPda = CONFIG.collectionPda;
//             const assetMint = CONFIG.VAULT_ASSET_MINT;
//             const shareMint = CONFIG.shareMint

//             const depositTxParams = {
//                 userPubKey :userPublicKey.toString(),
//                 vaultPda : vaultPda.toString(),
//                 collPda : collPda.toString(),
//                 userNftTokenAccount: userNftTokenAccount.toString(),
//                 nftMint: nftMint.toString(),
//                 assetMint: assetMint.toString(),
//                 vaultTokenAccount: vaultTokenAccount.toString(),
//                 shareMint: shareMint.toString()
//             }

//             console.log(depositTxParams)

//             // Send tx
//             const tx = await program.methods
//                 .deposit(amount)
//                 .accounts({
//                     user: userPublicKey,
//                     vault: vaultPda,
//                     nftCollection: CONFIG.collectionPda,
//                     userNftToken: userNftTokenAccount,
//                     userNftMint: nftMint,
//                     assetMint: CONFIG.VAULT_ASSET_MINT,
//                     vaultTokenAccount,
//                     shareMint: CONFIG.shareMint,
//                 })
//                 .rpc();

//             console.log('✅ Deposit successful:', tx);
//             await refreshData();
//             return tx;
//         } catch (err) {
//             console.error('❌ Error depositing:', err);
//             setError(`Failed to deposit: ${(err as Error).message}`);
//             return null;
//         } finally {
//             setLoading(false);
//         }
//     }, [program, address, vaultPda, vault]);


//     // const setReserveFactor = useCallback(async (newFactor: BN): Promise<string | null> => {
//     //     if (!program || !address || !vaultPda) {
//     //         setError('Wallet not connected');
//     //         return null;
//     //     }

//     //     try {
//     //         const tx = await program.methods
//     //             .setReserveFactor(newFactor)
//     //             .accounts({
//     //                 vault: vaultPda,
//     //                 authority: new PublicKey(address),
//     //             })
//     //             .rpc();

//     //         await refreshData();
//     //         return tx;
//     //     } catch (err) {
//     //         setError(`Failed to set reserve factor: ${(err as Error).message}`);
//     //         return null;
//     //     }
//     // }, [program, address, vaultPda]);



//     // Refresh vault data
//     const refreshData = useCallback(async () => {
//         if (!program || !vaultPda) return;

//         setLoading(true);
//         setError(null);

//         try {
//             const vaultData = await program.account.vault.fetchNullable(vaultPda);
//             if (vaultData) {
//                 setVault(vaultData as VaultData);
//                 console.log('Vault data refreshed');
//             }
//         } catch (err) {
//             console.error('Error refreshing data:', err);
//             setError(`Failed to refresh: ${(err as Error).message}`);
//         } finally {
//             setLoading(false);
//         }
//     }, [program, vaultPda]);


//     return {
//         // State
//         program,
//         vault,

//         loading,
//         error,
//         isConnected: isConnected && isSolanaNetwork,
//         walletAddress: address,

//         // Network info
//         currentNetwork,
//         programId: CONFIG.PROGRAM_ID,



//         // Regular Functions
//         deposit,
//         // withdraw,
//         // borrow,
//         // repay,

//         // Admin Functions
//         // initializeVault,
//         // pauseVault,
//         // unpauseVault,
//         // setReserveFactor,
//         // withdrawReserves,

//         // Query Functions


//         // Hardcoded values for easy access
//         assetMint: CONFIG.VAULT_ASSET_MINT,
//         vaultPda: vaultPda ?? CONFIG.vaultPda,
//         shareMint: CONFIG.shareMint,
//         nftCollection: CONFIG.collectionPda,

//         refreshData,

//     };
// };