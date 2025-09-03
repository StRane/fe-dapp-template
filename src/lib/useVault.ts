import { useState, useEffect, useCallback } from 'react';
import { useAppKitAccount, useAppKitNetwork, useAppKitProvider } from '@reown/appkit/react';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import {
    PublicKey,
    Connection,
    Commitment,

} from '@solana/web3.js';
import {
    TOKEN_2022_PROGRAM_ID,
    getAssociatedTokenAddress,
} from '@solana/spl-token';
import { AnchorWallet } from '@solana/wallet-adapter-react';

import type { Vault } from '../types/vault'; // You'll need to generate this from your IDL
import IDL from '../idl/vault.json';

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

    // Seeds
    VAULT_SEED: Buffer.from("vault"),
    NFT_USER_INFO_SEED: Buffer.from("nft_user_info"),
    NFT_BORROW_INFO_SEED: Buffer.from("nft_borrow_info"),
    USER_INFO_SEED: Buffer.from("user_info"),
    BORROW_INFO_SEED: Buffer.from("borrow_info"),
};

// Types
export interface VaultData {
    authority: PublicKey;
    mint: PublicKey;
    tokenAccount: PublicKey;
    pool: PublicKey;
    totalBorrowed: BN;
    borrowIndex: BN;
    borrowRate: BN;
    lastUpdateTime: BN;
    reserveFactor: BN;
    totalReserves: BN;
    totalShares: BN;
    isPaused: boolean;
    bump: number;
}

export interface NFTUserInfo {
    vault: PublicKey;
    nftMint: PublicKey;
    owner: PublicKey;
    shares: BN;
    depositedAmount: BN;
    lastUpdate: BN;
}

export interface NFTBorrowInfo {
    vault: PublicKey;
    nftMint: PublicKey;
    user: PublicKey;
    borrowed: BN;
    borrowIndex: BN;
}

export interface NFTPosition {
    nftMint: PublicKey;
    shares: BN;
    assetValue: BN;
    depositedAmount: BN;
    lastUpdate: BN;
    borrowedAmount?: BN;
    collateralValue?: BN;
    maxBorrowAmount?: BN;
}

export interface UseVaultNFTReturn {
    // State
    program: Program<Vault> | null;
    vault: VaultData | null;
    nftPositions: Map<string, NFTPosition>;
    loading: boolean;
    error: string | null;
    isConnected: boolean;
    walletAddress: string | undefined;

    // Network info
    currentNetwork: string | null;
    programId: string;

    // NFT Functions
    depositWithNFT: (nftMint: PublicKey, amount: BN) => Promise<string | null>;
    withdrawWithNFT: (nftMint: PublicKey, shares: BN) => Promise<string | null>;
    borrowWithNFT: (nftMint: PublicKey, amount: BN, poolSigner: PublicKey) => Promise<string | null>;
    transferPosition: (sourceNFT: PublicKey, targetNFT: PublicKey) => Promise<string | null>;
    getNFTPosition: (nftMint: PublicKey) => Promise<NFTPosition | null>;

    // Regular Functions (non-NFT)
    deposit: (amount: BN) => Promise<string | null>;
    withdraw: (shares: BN) => Promise<string | null>;
    borrow: (amount: BN, poolSigner: PublicKey) => Promise<string | null>;
    repay: (amount: BN, poolSigner: PublicKey) => Promise<string | null>;

    // Admin Functions
    initializeVault: (mint: PublicKey, pool: PublicKey, reserveFactor: BN) => Promise<string | null>;
    pauseVault: () => Promise<string | null>;
    unpauseVault: () => Promise<string | null>;
    setReserveFactor: (newFactor: BN) => Promise<string | null>;
    withdrawReserves: (amount: BN) => Promise<string | null>;

    // Query Functions
    getTotalAssets: () => BN | null;
    getAvailableLiquidity: () => BN | null;
    getUserShares: () => Promise<BN | null>;
    getUserDebt: () => Promise<BN | null>;
    refreshData: () => Promise<void>;
    refreshNFTPosition: (nftMint: PublicKey) => Promise<void>;
}

export const useVault = (vaultMint?: PublicKey): UseVaultNFTReturn => {
    // AppKit hooks
    const { address, isConnected } = useAppKitAccount();
    const { caipNetwork, caipNetworkId } = useAppKitNetwork();
    const { walletProvider } = useAppKitProvider('solana');

    // State
    const [connection, setConnection] = useState<Connection | null>(null);
    const [program, setProgram] = useState<Program<Vault> | null>(null);
    const [vault, setVault] = useState<VaultData | null>(null);
    const [nftPositions, setNftPositions] = useState<Map<string, NFTPosition>>(new Map());
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
                vaultMint: vaultMint?.toBase58(),
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

                const program = new Program<Vault>(
                    IDL as Vault,
                    anchorProvider
                );
                setProgram(program);

                console.log("[initializeProgram] Program created");

                // Derive vault PDA if mint is provided
                if (vaultMint) {
                    console.log("[initializeProgram] Deriving PDA for mint:", vaultMint.toBase58());

                    const [vaultPda] = PublicKey.findProgramAddressSync(
                        [CONFIG.VAULT_SEED, vaultMint.toBuffer()],
                        programId
                    );
                    setVaultPda(vaultPda);

                    console.log("[initializeProgram] PDA derived:", vaultPda.toBase58());

                    // Load vault data
                    const vaultData = await program.account.vault.fetchNullable(vaultPda);
                    console.log("[initializeProgram] Vault data fetched:", vaultData);

                    if (vaultData) {
                        setVault(vaultData as VaultData);
                    }
                }

                console.log("[initializeProgram] Initialization finished ✅");
            } catch (err) {
                console.error("[initializeProgram] Failed to initialize:", err);
                setError(`Failed to initialize: ${(err as Error).message}`);
            }
        };

        initializeProgram();
    // }, [isConnected, address, walletProvider, isSolanaNetwork, vaultMint]);
    },[isConnected, address,isSolanaNetwork,walletProvider]);
    // Initialize Vault
    const initializeVault = useCallback(async (
        mint: PublicKey,
        pool: PublicKey,
        
        reserveFactor: BN
    ): Promise<string | null> => {
        if (!program || !address) {
            setError('Wallet not connected');
            return null;
        }

        setLoading(true);
        setError(null);

        try {
            const userPublicKey = new PublicKey(address);
            //   const [vaultPda] = PublicKey.findProgramAddressSync(
            //     [CONFIG.VAULT_SEED, mint.toBuffer()],
            //     programId
            //   );

            //   const vaultTokenAccount = await getAssociatedTokenAddress(
            //     mint,
            //     vaultPda,
            //     true
            //   );
        console.log('I am at the correct place');
            const tx = await program.methods
                .initializeVault(reserveFactor)
                .accounts({
                    authority: userPublicKey,
                    mint: mint,
                    pool: userPublicKey,
                    // vaultTokenAccount: vaultTokenAccount,
                })
                .rpc();

            console.log('Vault initialized:', tx);
            await refreshData();
            return tx;
        } catch (err) {
            console.error('Error initializing vault:', err);
            setError(`Failed to initialize: ${(err as Error).message}`);
            return null;
        } finally {
            setLoading(false);
        }
    }, [program, address]);

    // Deposit with NFT
    const depositWithNFT = useCallback(async (
        nftMint: PublicKey,
        amount: BN
    ): Promise<string | null> => {
        if (!program || !address || !vaultPda || !vault) {
            setError('Wallet not connected or vault not loaded');
            return null;
        }

        setLoading(true);
        setError(null);

        try {
            const userPublicKey = new PublicKey(address);

            // Get NFT token account
            const nftTokenAccount = await getAssociatedTokenAddress(
                nftMint,
                userPublicKey,
                false,
                TOKEN_2022_PROGRAM_ID // Assuming NFTs use Token-2022
            );

            //   // Get user's vault token account
            //   const userTokenAccount = await getAssociatedTokenAddress(
            //     vault.mint,
            //     userPublicKey
            //   );

            //   // Derive NFT user info PDA
            //   const [nftUserInfoPda] = PublicKey.findProgramAddressSync(
            //     [CONFIG.NFT_USER_INFO_SEED, vaultPda.toBuffer(), nftMint.toBuffer()],
            //     programId
            //   );

            const tx = await program.methods
                .depositWithNft(amount)
                .accounts({
                    user: userPublicKey,
                    nftMint: nftMint,
                    nftTokenAccount: nftTokenAccount,
                    tokenAccount: vault.tokenAccount,
                })
                .rpc();

            console.log('NFT deposit successful:', tx);
            await refreshNFTPosition(nftMint);
            return tx;
        } catch (err) {
            console.error('Error depositing with NFT:', err);
            setError(`Failed to deposit: ${(err as Error).message}`);
            return null;
        } finally {
            setLoading(false);
        }
    }, [program, address, vaultPda, vault]);

    // Withdraw with NFT
    const withdrawWithNFT = useCallback(async (
        nftMint: PublicKey,
        shares: BN
    ): Promise<string | null> => {
        if (!program || !address || !vaultPda || !vault) {
            setError('Wallet not connected or vault not loaded');
            return null;
        }

        setLoading(true);
        setError(null);

        try {
            const userPublicKey = new PublicKey(address);

            const nftTokenAccount = await getAssociatedTokenAddress(
                nftMint,
                userPublicKey,
                false,
                TOKEN_2022_PROGRAM_ID
            );

            const tx = await program.methods
                .withdrawWithNft(shares)
                .accounts({
                    user: userPublicKey,
                    nftMint: nftMint,
                    nftTokenAccount: nftTokenAccount,
                    tokenAccount: vault.tokenAccount,
                })
                .rpc();

            console.log('NFT withdrawal successful:', tx);
            await refreshNFTPosition(nftMint);
            return tx;
        } catch (err) {
            console.error('Error withdrawing with NFT:', err);
            setError(`Failed to withdraw: ${(err as Error).message}`);
            return null;
        } finally {
            setLoading(false);
        }
    }, [program, address, vaultPda, vault]);

    // Borrow with NFT
    const borrowWithNFT = useCallback(async (
        nftMint: PublicKey,
        amount: BN,
        poolSigner: PublicKey
    ): Promise<string | null> => {
        if (!program || !address || !vaultPda || !vault) {
            setError('Wallet not connected or vault not loaded');
            return null;
        }

        setLoading(true);
        setError(null);

        try {
            const userPublicKey = new PublicKey(address);

            const nftTokenAccount = await getAssociatedTokenAddress(
                nftMint,
                userPublicKey,
                false,
                TOKEN_2022_PROGRAM_ID
            );

            //   const userTokenAccount = await getAssociatedTokenAddress(
            //     vault.mint,
            //     userPublicKey
            //   );

            //   const [nftUserInfoPda] = PublicKey.findProgramAddressSync(
            //     [CONFIG.NFT_USER_INFO_SEED, vaultPda.toBuffer(), nftMint.toBuffer()],
            //     programId
            //   );

            //   const [nftBorrowInfoPda] = PublicKey.findProgramAddressSync(
            //     [CONFIG.NFT_BORROW_INFO_SEED, vaultPda.toBuffer(), nftMint.toBuffer()],
            //     programId
            //   );

            const tx = await program.methods
                .borrowWithNft(amount)
                .accounts({
                    user: userPublicKey,
                    pool: poolSigner,
                    nftMint: nftMint,
                    nftTokenAccount: nftTokenAccount,
                    tokenAccount: vault.tokenAccount,
                })
                .rpc();

            console.log('NFT borrow successful:', tx);
            await refreshNFTPosition(nftMint);
            return tx;
        } catch (err) {
            console.error('Error borrowing with NFT:', err);
            setError(`Failed to borrow: ${(err as Error).message}`);
            return null;
        } finally {
            setLoading(false);
        }
    }, [program, address, vaultPda, vault]);


    // Transfer position between NFTs
    const transferPosition = useCallback(async (
        sourceNFT: PublicKey,
        targetNFT: PublicKey
    ): Promise<string | null> => {
        if (!program || !address || !vaultPda) {
            setError('Wallet not connected or vault not loaded');
            return null;
        }

        setLoading(true);
        setError(null);

        try {
            const userPublicKey = new PublicKey(address);

            const sourceNftTokenAccount = await getAssociatedTokenAddress(
                sourceNFT,
                userPublicKey,
                false,
                TOKEN_2022_PROGRAM_ID
            );

            const targetNftTokenAccount = await getAssociatedTokenAddress(
                targetNFT,
                userPublicKey,
                false,
                TOKEN_2022_PROGRAM_ID
            );

            //   const [sourceNftUserInfo] = PublicKey.findProgramAddressSync(
            //     [CONFIG.NFT_USER_INFO_SEED, vaultPda.toBuffer(), sourceNFT.toBuffer()],
            //     programId
            //   );

            //   const [targetNftUserInfo] = PublicKey.findProgramAddressSync(
            //     [CONFIG.NFT_USER_INFO_SEED, vaultPda.toBuffer(), targetNFT.toBuffer()],
            //     programId
            //   );

            const tx = await program.methods
                .transferPositionToNft()
                .accounts({
                    user: userPublicKey,
                    vault: vaultPda,
                    sourceNftMint: sourceNFT,
                    sourceNftTokenAccount: sourceNftTokenAccount,
                    targetNftMint: targetNFT,
                    targetNftTokenAccount: targetNftTokenAccount,
                })
                .rpc();

            console.log('Position transferred:', tx);
            await refreshNFTPosition(sourceNFT);
            await refreshNFTPosition(targetNFT);
            return tx;
        } catch (err) {
            console.error('Error transferring position:', err);
            setError(`Failed to transfer: ${(err as Error).message}`);
            return null;
        } finally {
            setLoading(false);
        }
    }, [program, address, vaultPda]);

    // Get NFT Position
    const getNFTPosition = useCallback(async (
        nftMint: PublicKey
    ): Promise<NFTPosition | null> => {
        if (!program || !vaultPda || !vault) return null;

        try {
            //   const [nftUserInfoPda] = PublicKey.findProgramAddressSync(
            //     [CONFIG.NFT_USER_INFO_SEED, vaultPda.toBuffer(), nftMint.toBuffer()],
            //     programId
            //   );

            const position = await program.methods
                .getNftPosition()
                .accounts({
                    vault: vaultPda,
                    nftMint: nftMint,
                    tokenAccount: vault.tokenAccount,
                })
                .view();

            return {
                nftMint: position.nftMint,
                shares: position.shares,
                assetValue: position.assetValue,
                depositedAmount: position.depositedAmount,
                lastUpdate: position.lastUpdate,
            };
        } catch (err) {
            console.error('Error getting NFT position:', err);
            return null;
        }
    }, [program, vaultPda, vault]);

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

            const tx = await program.methods
                .deposit(amount)
                .accounts({
                    user: userPublicKey,
                    tokenAccount: vault.tokenAccount,
                })
                .rpc();

            console.log('Deposit successful:', tx);
            await refreshData();
            return tx;
        } catch (err) {
            console.error('Error depositing:', err);
            setError(`Failed to deposit: ${(err as Error).message}`);
            return null;
        } finally {
            setLoading(false);
        }
    }, [program, address, vaultPda, vault]);

    // Regular withdraw
    const withdraw = useCallback(async (shares: BN): Promise<string | null> => {
        if (!program || !address || !vaultPda || !vault) {
            setError('Wallet not connected or vault not loaded');
            return null;
        }

        setLoading(true);
        setError(null);

        try {
            const userPublicKey = new PublicKey(address);
            const tx = await program.methods
                .withdraw(shares)
                .accounts({
                    user: userPublicKey,

                    tokenAccount: vault.tokenAccount,

                })
                .rpc();

            console.log('Withdrawal successful:', tx);
            await refreshData();
            return tx;
        } catch (err) {
            console.error('Error withdrawing:', err);
            setError(`Failed to withdraw: ${(err as Error).message}`);
            return null;
        } finally {
            setLoading(false);
        }
    }, [program, address, vaultPda, vault]);

    // Regular borrow
    const borrow = useCallback(async (
        amount: BN,
        poolSigner: PublicKey
    ): Promise<string | null> => {
        if (!program || !address || !vaultPda || !vault) {
            setError('Wallet not connected or vault not loaded');
            return null;
        }

        setLoading(true);
        setError(null);

        try {
            const userPublicKey = new PublicKey(address);
            //   const userTokenAccount = await getAssociatedTokenAddress(
            //     vault.mint,
            //     userPublicKey
            //   );

            //   const [userBorrowPda] = PublicKey.findProgramAddressSync(
            //     [CONFIG.BORROW_INFO_SEED, vaultPda.toBuffer(), userPublicKey.toBuffer()],
            //     programId
            //   );

            const tx = await program.methods
                .borrow(amount)
                .accounts({
                    user: userPublicKey,
                    pool: poolSigner,

                    tokenAccount: vault.tokenAccount,

                })
                .rpc();

            console.log('Borrow successful:', tx);
            await refreshData();
            return tx;
        } catch (err) {
            console.error('Error borrowing:', err);
            setError(`Failed to borrow: ${(err as Error).message}`);
            return null;
        } finally {
            setLoading(false);
        }
    }, [program, address, vaultPda, vault]);

    // Regular repay
    const repay = useCallback(async (
        amount: BN,
        poolSigner: PublicKey
    ): Promise<string | null> => {
        if (!program || !address || !vaultPda || !vault) {
            setError('Wallet not connected or vault not loaded');
            return null;
        }

        setLoading(true);
        setError(null);

        try {
            const userPublicKey = new PublicKey(address);
            //   const userTokenAccount = await getAssociatedTokenAddress(
            //     vault.mint,
            //     userPublicKey
            //   );

            //   const [userBorrowPda] = PublicKey.findProgramAddressSync(
            //     [CONFIG.BORROW_INFO_SEED, vaultPda.toBuffer(), userPublicKey.toBuffer()],
            //     programId
            //   );

            const tx = await program.methods
                .repay(amount)
                .accounts({
                    user: userPublicKey,
                    pool: poolSigner,

                    tokenAccount: vault.tokenAccount,

                })
                .rpc();

            console.log('Repay successful:', tx);
            await refreshData();
            return tx;
        } catch (err) {
            console.error('Error repaying:', err);
            setError(`Failed to repay: ${(err as Error).message}`);
            return null;
        } finally {
            setLoading(false);
        }
    }, [program, address, vaultPda, vault]);

    // Admin functions
    const pauseVault = useCallback(async (): Promise<string | null> => {
        if (!program || !address || !vaultPda) {
            setError('Wallet not connected');
            return null;
        }

        try {
            const tx = await program.methods
                .pauseVault()
                .accounts({
                    vault: vaultPda,
                    authority: new PublicKey(address),
                })
                .rpc();

            await refreshData();
            return tx;
        } catch (err) {
            setError(`Failed to pause: ${(err as Error).message}`);
            return null;
        }
    }, [program, address, vaultPda]);

    const unpauseVault = useCallback(async (): Promise<string | null> => {
        if (!program || !address || !vaultPda) {
            setError('Wallet not connected');
            return null;
        }

        try {
            const tx = await program.methods
                .unpauseVault()
                .accounts({
                    vault: vaultPda,
                    authority: new PublicKey(address),
                })
                .rpc();

            await refreshData();
            return tx;
        } catch (err) {
            setError(`Failed to unpause: ${(err as Error).message}`);
            return null;
        }
    }, [program, address, vaultPda]);

    const setReserveFactor = useCallback(async (newFactor: BN): Promise<string | null> => {
        if (!program || !address || !vaultPda) {
            setError('Wallet not connected');
            return null;
        }

        try {
            const tx = await program.methods
                .setReserveFactor(newFactor)
                .accounts({
                    vault: vaultPda,
                    authority: new PublicKey(address),
                })
                .rpc();

            await refreshData();
            return tx;
        } catch (err) {
            setError(`Failed to set reserve factor: ${(err as Error).message}`);
            return null;
        }
    }, [program, address, vaultPda]);

    const withdrawReserves = useCallback(async (amount: BN): Promise<string | null> => {
        if (!program || !address || !vaultPda || !vault) {
            setError('Wallet not connected or vault not loaded');
            return null;
        }

        try {
            //   const authorityTokenAccount = await getAssociatedTokenAddress(
            //     vault.mint,
            //     new PublicKey(address)
            //   );

            const tx = await program.methods
                .withdrawReserves(amount)
                .accounts({
                    tokenAccount: vault.tokenAccount,
                })
                .rpc();

            await refreshData();
            return tx;
        } catch (err) {
            setError(`Failed to withdraw reserves: ${(err as Error).message}`);
            return null;
        }
    }, [program, address, vaultPda, vault]);

    // Query functions
    const getTotalAssets = useCallback((): BN | null => {
        if (!vault || !connection) return null;

        // This would need to call a view function or calculate from vault state
        // For now, returning a placeholder
        return vault.totalShares;
    }, [vault, connection]);

    const getAvailableLiquidity = useCallback((): BN | null => {
        if (!vault) return null;

        // Available liquidity = token balance - reserves
        // This would need the actual token balance from the vault's token account
        return null;
    }, [vault]);

    const getUserShares = useCallback(async (): Promise<BN | null> => {
        if (!program || !address || !vaultPda) return null;

        try {
            const userPublicKey = new PublicKey(address);
            const [userInfoPda] = PublicKey.findProgramAddressSync(
                [CONFIG.USER_INFO_SEED, vaultPda.toBuffer(), userPublicKey.toBuffer()],
                programId
            );

            const userInfo = await program.account.userInfo.fetchNullable(userInfoPda);
            return userInfo ? userInfo.shares : new BN(0);
        } catch (err) {
            console.error('Error fetching user shares:', err);
            return null;
        }
    }, [program, address, vaultPda]);

    const getUserDebt = useCallback(async (): Promise<BN | null> => {
        if (!program || !address || !vaultPda) return null;

        try {
            const userPublicKey = new PublicKey(address);
            const [borrowInfoPda] = PublicKey.findProgramAddressSync(
                [CONFIG.BORROW_INFO_SEED, vaultPda.toBuffer(), userPublicKey.toBuffer()],
                programId
            );

            const borrowInfo = await program.account.borrowInfo.fetchNullable(borrowInfoPda);
            if (!borrowInfo || !vault) return new BN(0);

            // Calculate current debt with interest
            const currentDebt = borrowInfo.borrowed
                .mul(vault.borrowIndex)
                .div(borrowInfo.borrowIndex);

            return currentDebt;
        } catch (err) {
            console.error('Error fetching user debt:', err);
            return null;
        }
    }, [program, address, vaultPda, vault]);

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

    // Refresh specific NFT position
    const refreshNFTPosition = useCallback(async (nftMint: PublicKey) => {
        if (!program || !vaultPda || !vault) return;

        try {
            const [nftUserInfoPda] = PublicKey.findProgramAddressSync(
                [CONFIG.NFT_USER_INFO_SEED, vaultPda.toBuffer(), nftMint.toBuffer()],
                programId
            );

            const [nftBorrowInfoPda] = PublicKey.findProgramAddressSync(
                [CONFIG.NFT_BORROW_INFO_SEED, vaultPda.toBuffer(), nftMint.toBuffer()],
                programId
            );

            // Fetch NFT user info
            const nftUserInfo = await program.account.nftUserInfo.fetchNullable(nftUserInfoPda);
            const nftBorrowInfo = await program.account.nftBorrowInfo.fetchNullable(nftBorrowInfoPda);

            if (nftUserInfo) {
                // Calculate asset value
                const totalAssets = vault.totalShares.gt(new BN(0))
                    ? vault.totalShares // Simplified - would need actual calculation
                    : new BN(0);

                const assetValue = vault.totalShares.gt(new BN(0))
                    ? nftUserInfo.shares.mul(totalAssets).div(vault.totalShares)
                    : new BN(0);

                // Calculate borrowed amount if exists
                let borrowedAmount = new BN(0);
                if (nftBorrowInfo && nftBorrowInfo.borrowed.gt(new BN(0))) {
                    borrowedAmount = nftBorrowInfo.borrowed
                        .mul(vault.borrowIndex)
                        .div(nftBorrowInfo.borrowIndex);
                }

                const position: NFTPosition = {
                    nftMint: nftMint,
                    shares: nftUserInfo.shares,
                    assetValue: assetValue,
                    depositedAmount: nftUserInfo.depositedAmount,
                    lastUpdate: nftUserInfo.lastUpdate,
                    borrowedAmount: borrowedAmount,
                    collateralValue: assetValue,
                    maxBorrowAmount: assetValue.div(new BN(2)), // 50% LTV
                };

                setNftPositions(prev => {
                    const newMap = new Map(prev);
                    newMap.set(nftMint.toBase58(), position);
                    return newMap;
                });

                console.log('NFT position refreshed:', nftMint.toBase58());
            }
        } catch (err) {
            console.error('Error refreshing NFT position:', err);
        }
    }, [program, vaultPda, vault]);

    return {
        // State
        program,
        vault,
        nftPositions,
        loading,
        error,
        isConnected: isConnected && isSolanaNetwork,
        walletAddress: address,

        // Network info
        currentNetwork,
        programId: CONFIG.PROGRAM_ID,

        // NFT Functions
        depositWithNFT,
        withdrawWithNFT,
        borrowWithNFT,
        transferPosition,
        getNFTPosition,

        // Regular Functions
        deposit,
        withdraw,
        borrow,
        repay,

        // Admin Functions
        initializeVault,
        pauseVault,
        unpauseVault,
        setReserveFactor,
        withdrawReserves,

        // Query Functions
        getTotalAssets,
        getAvailableLiquidity,
        getUserShares,
        getUserDebt,
        refreshData,
        refreshNFTPosition,
    };
};