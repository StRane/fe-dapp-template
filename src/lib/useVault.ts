import { useState, useEffect, useCallback } from 'react';
import { useAppKitAccount, useAppKitNetwork, useAppKitProvider } from '@reown/appkit/react';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import {
    PublicKey,
    Connection,
    Commitment,
    // Transaction,
    // Signer,
    // SendTransactionError,
    // SystemProgram
} from '@solana/web3.js';
import {

    getAssociatedTokenAddressSync,

} from '@solana/spl-token';
import { AnchorWallet } from '@solana/wallet-adapter-react';

import type { SimpleVault } from '@/types/simple_vault';
import IDL from '@/idl/simple_vault.json';

// CONFIGURATION
const CONFIG = {
    PROGRAM_ID: 'B2iJWvv6hwMvVkdKm1ovTzSr52neJU9k8AQyQHVBtFRM', // Your vault program ID

    RPC_ENDPOINTS: {
        'solana-testnet': 'https://api.testnet.solana.com',
        'solana-devnet': 'https://api.devnet.solana.com',
        'solana-mainnet': 'https://api.mainnet-beta.solana.com',
        'solana-localnet': 'http://localhost:8899',
        'Solana Local': 'http://localhost:8899',
    },

    // NFT Collection related
    collectionPda: new PublicKey('EoZ5NFigrZ7uqUUSH6ShDsYGMooe5ziTfgWvAbFmVTXt'),
    // let collectionBump: number;
    //let nftMint: PublicKey;
    //let user1NftTokenAccount: PublicKey;

    // Asset token (what users deposit)
    assetMint: new PublicKey("7Uc3xCQxiPqMHVXPrzcgUw8rrKQ7vCu5HUXL4TVRntDS"),
    user1AssetTokenAccount: new PublicKey("GrxrVYtnx23B5oTeCiEmnoSXHJ3JTE5QpqUndxUseJDa"),


    // Vault related
    vaultPda: new PublicKey("Cs6Vz6BNq6HHViusWzVzK9cg1u5cCvdW3nSvDCCZJd4m"),
    // let vaultBump: number;
    shareMint: new PublicKey("Ggbz1DvG6sh5FwTCFUqc85M6RYVduivGu3BhyxVHqpP1"),
    // let vaultTokenAccount: PublicKey;
    // let user1ShareTokenAccount: PublicKey;

    // Seeds
    VAULT_SEED: Buffer.from("vault"),
    // NFT_USER_INFO_SEED: Buffer.from("nft_user_info"),
    // NFT_BORROW_INFO_SEED: Buffer.from("nft_borrow_info"),
    USER_INFO_SEED: Buffer.from("user_info"),
    BORROW_INFO_SEED: Buffer.from("borrow_info"),
    VAULT_ASSET_MINT: new PublicKey("7Uc3xCQxiPqMHVXPrzcgUw8rrKQ7vCu5HUXL4TVRntDS"),
};

// Types
export interface VaultData {
    owner: PublicKey;
    assetMint: PublicKey;
    shareMint: PublicKey;
    nftCollectionAddress: PublicKey;
    bump: number;
}



export interface UseVaultNFTReturn {
    // State
    program: Program<SimpleVault> | null;
    vault: VaultData | null;
    loading: boolean;
    error: string | null;
    isConnected: boolean;
    walletAddress: string | undefined;

    // Network info
    currentNetwork: string | null;
    programId: string;

    // NFT Functions

    // Regular Functions (non-NFT)
    deposit: (amount: BN) => Promise<string | null>;

    // Admin Functions
    // initializeVault?: (mint: PublicKey, pool: PublicKey, reserveFactor: BN) => Promise<string | null>;
    // pauseVault: () => Promise<string | null>;
    // unpauseVault: () => Promise<string | null>;
    // setReserveFactor: (newFactor: BN) => Promise<string | null>;
    // withdrawReserves: (amount: BN) => Promise<string | null>;

    // Query Functions
    // getVaultInfo?: () => Promise<VaultData | null>;
    refreshData: () => Promise<void>;

    // Hardcoded values for easy access
    assetMint: PublicKey;
    vaultPda: PublicKey;
    shareMint: PublicKey;
    nftCollection: PublicKey;
}

export const useVault = (): UseVaultNFTReturn => {
    // AppKit hooks
    const { address, isConnected } = useAppKitAccount();
    const { caipNetwork, caipNetworkId } = useAppKitNetwork();
    const { walletProvider } = useAppKitProvider('solana');

    // State

    const [connection, setConnection] = useState<Connection | null>(null);
    const [program, setProgram] = useState<Program<SimpleVault> | null>(null);
    const [vault, setVault] = useState<VaultData | null>(null);

    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // PDAs
    const [vaultPda, setVaultPda] = useState<PublicKey | null>(null);

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
            console.log('Connected to:', currentNetwork, rpcUrl);
        }
    }, [isSolanaNetwork, currentNetwork]);

    // Initialize program

    useEffect(() => {
        const initializeProgram = async () => {
            console.log("[initializeProgram] triggered with deps:", {
                isConnected,
                address,
                hasConnection: !!connection,
                hasWalletProvider: !!walletProvider,
                isSolanaNetwork,
                vaultMint: CONFIG.VAULT_ASSET_MINT.toBase58(),
            });

            if (!isConnected || !address || !connection || !walletProvider || !isSolanaNetwork) {
                console.log("[initializeProgram] missing dependencies → clearing program");
                setProgram(null);
                return;
            }

            try {
                const anchorProvider = new AnchorProvider(
                    connection,
                    walletProvider as AnchorWallet,
                    { commitment: 'confirmed' as Commitment }
                );

                // anchorProvider.wallet.payer?.secretKey

                const program = new Program<SimpleVault>(
                    IDL as SimpleVault,
                    anchorProvider
                );
                setProgram(program);

                console.log("[initializeProgram] Program created");

                // Derive vault PDA if mint is provided

                console.log("[initializeProgram] Deriving PDA for mint:", CONFIG.VAULT_ASSET_MINT.toBase58());

                // const [vaultPda] = PublicKey.findProgramAddressSync(
                //     [CONFIG.VAULT_SEED, CONFIG.VAULT_ASSET_MINT.toBuffer()],
                //     programId
                // );
                setVaultPda(CONFIG.vaultPda);

                console.log("[initializeProgram] PDA derived:", CONFIG.vaultPda.toBase58());

                // Load vault data
                const vaultData = await program.account.vault.fetchNullable(CONFIG.vaultPda);
                console.log("[initializeProgram] Vault data fetched:", vaultData);

                if (vaultData) {
                    setVault(vaultData as VaultData);
                }


                console.log("[initializeProgram] Initialization finished ✅");
            } catch (err) {
                console.error("[initializeProgram] Failed to initialize:", err);
                setError(`Failed to initialize: ${(err as Error).message}`);
            }
        };

        initializeProgram();
        // }, [isConnected, address, walletProvider, isSolanaNetwork, vaultMint]);
    }, [isConnected, address, isSolanaNetwork, walletProvider]);
    // Initialize Vault


    // Regular deposit (non-NFT)
    const deposit = useCallback(async (amount: BN): Promise<string | null> => {
        if (!program || !address || !vaultPda || !vault) {
            setError('Wallet not connected or vault not loaded');
            return null;
        }

        setLoading(true);
        setError(null);

        try {
            const userPublicKey = new PublicKey(address);

            // --- NFT Info (from your deploy script logs)
            const nftMint = new PublicKey("4xZMLJQp6MQegkGbZFWZfzDmugLX8Ke5kCk3dbCnwKdf");
            const userNftTokenAccount = getAssociatedTokenAddressSync(
                nftMint,
                userPublicKey
            );

            // --- User's Asset Token Account (you created already at deploy)
            // const userAssetToken = getAssociatedTokenAddressSync(
            //   CONFIG.assetMint,
            //   userPublicKey
            // );

            // --- Vault Token Account (PDA ATA)
            // const [vaultTokenAccount] = PublicKey.findProgramAddressSync(
            //     [
            //         vaultPda.toBuffer(),
            //         Buffer.from([
            //             6, 221, 246, 225, 215, 101, 161, 147,
            //             217, 203, 225, 70, 206, 235, 121, 172,
            //             28, 180, 133, 237, 95, 91, 55, 145,
            //             58, 140, 245, 133, 126, 255, 0, 169
            //         ]),
            //         CONFIG.assetMint.toBuffer(),
            //     ],
            //     program.programId
            // );

            const vaultTokenAccount = new PublicKey("EHsxdtLzoZvQVj9dyh3sPocwF5R3nT7gdRM2wzpXTnga")

            // --- User's Share Token Account (ATA)
            // const userShareToken = getAssociatedTokenAddressSync(
            //   CONFIG.shareMint,
            //   userPublicKey
            // );
            const collPda = CONFIG.collectionPda;
            const assetMint = CONFIG.assetMint;
            const shareMint = CONFIG.shareMint

            const depositTxParams = {
                userPubKey :userPublicKey.toString(),
                vaultPda : vaultPda.toString(),
                collPda : collPda.toString(),
                userNftTokenAccount: userNftTokenAccount.toString(),
                nftMint: nftMint.toString(),
                assetMint: assetMint.toString(),
                vaultTokenAccount: vaultTokenAccount.toString(),
                shareMint: shareMint.toString()
            }

            console.log(depositTxParams)

            // Send tx
            const tx = await program.methods
                .deposit(amount)
                .accounts({
                    user: userPublicKey,
                    vault: vaultPda,
                    nftCollection: CONFIG.collectionPda,
                    userNftToken: userNftTokenAccount,
                    userNftMint: nftMint,
                    assetMint: CONFIG.assetMint,
                    vaultTokenAccount,
                    shareMint: CONFIG.shareMint,
                })
                .rpc();

            console.log('✅ Deposit successful:', tx);
            await refreshData();
            return tx;
        } catch (err) {
            console.error('❌ Error depositing:', err);
            setError(`Failed to deposit: ${(err as Error).message}`);
            return null;
        } finally {
            setLoading(false);
        }
    }, [program, address, vaultPda, vault]);


    // const setReserveFactor = useCallback(async (newFactor: BN): Promise<string | null> => {
    //     if (!program || !address || !vaultPda) {
    //         setError('Wallet not connected');
    //         return null;
    //     }

    //     try {
    //         const tx = await program.methods
    //             .setReserveFactor(newFactor)
    //             .accounts({
    //                 vault: vaultPda,
    //                 authority: new PublicKey(address),
    //             })
    //             .rpc();

    //         await refreshData();
    //         return tx;
    //     } catch (err) {
    //         setError(`Failed to set reserve factor: ${(err as Error).message}`);
    //         return null;
    //     }
    // }, [program, address, vaultPda]);



    // Refresh vault data
    const refreshData = useCallback(async () => {
        if (!program || !vaultPda) return;

        setLoading(true);
        setError(null);

        try {
            const vaultData = await program.account.vault.fetchNullable(vaultPda);
            if (vaultData) {
                setVault(vaultData as VaultData);
                console.log('Vault data refreshed');
            }
        } catch (err) {
            console.error('Error refreshing data:', err);
            setError(`Failed to refresh: ${(err as Error).message}`);
        } finally {
            setLoading(false);
        }
    }, [program, vaultPda]);


    return {
        // State
        program,
        vault,

        loading,
        error,
        isConnected: isConnected && isSolanaNetwork,
        walletAddress: address,

        // Network info
        currentNetwork,
        programId: CONFIG.PROGRAM_ID,



        // Regular Functions
        deposit,
        // withdraw,
        // borrow,
        // repay,

        // Admin Functions
        // initializeVault,
        // pauseVault,
        // unpauseVault,
        // setReserveFactor,
        // withdrawReserves,

        // Query Functions


        // Hardcoded values for easy access
        assetMint: CONFIG.assetMint,
        vaultPda: vaultPda ?? CONFIG.vaultPda,
        shareMint: CONFIG.shareMint,
        nftCollection: CONFIG.collectionPda,

        refreshData,

    };
};