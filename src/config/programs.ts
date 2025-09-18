import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

// Validation helper
function requireEnv(key: string): string {
    const value = import.meta.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

function requirePublicKey(key: string): PublicKey {
    const value = requireEnv(key);
    try {
        return new PublicKey(value);
    } catch (err) {
        throw new Error(`Invalid PublicKey for ${key}: ${value}`);
    }
}

export const CONFIG = {
    // Program IDs
    VAULT_PROGRAM_ID: requirePublicKey('VITE_VAULT_PROGRAM_ID'),
    NFT_PROGRAM_ID: requirePublicKey('VITE_NFT_PROGRAM_ID'),
    TOKEN_PROGRAM_ID: requirePublicKey('VITE_TOKEN_PROGRAM_ID'),
    
    // Core addresses
    OWNER_ID: requirePublicKey('VITE_OWNER_PUBKEY'),
    VAULT_ASSET_MINT: requirePublicKey('VITE_VAULT_ASSET_MINT'),
    SHARE_MINT: requirePublicKey('VITE_SHARE_MINT'),
    COLLECTION_PDA: requirePublicKey('VITE_COLLECTION_PDA'),

    // Network
    // RPC_URL: requireEnv('VITE_RPC_URL'),
    // NETWORK: requireEnv('VITE_NETWORK'),
    VAULT_VERSION: requireEnv('VITE_VAULT_VERSION'),

    // Seeds (matching your constants.rs)
    SEEDS: {
        VAULT: Buffer.from("vault_" + requireEnv('VITE_VAULT_VERSION')),
        USER_INFO: Buffer.from("user_info_" + requireEnv('VITE_VAULT_VERSION')),
        USER_SHARES: Buffer.from("user_shares_" + requireEnv('VITE_VAULT_VERSION')),
        COLLECTION: Buffer.from("collection"),
        USER_STATE: Buffer.from("user_state"),
    }
} as const;

// Utility functions for deriving all PDAs and accounts
export class VaultUtils {
    
    // Core vault PDA
    static getVaultPDA(): [PublicKey, number] {
        return PublicKey.findProgramAddressSync(
            [CONFIG.SEEDS.VAULT, CONFIG.VAULT_ASSET_MINT.toBuffer(), CONFIG.OWNER_ID.toBuffer()],
            CONFIG.VAULT_PROGRAM_ID
        );
    }

    // Collection PDA (from NFT program)
    static getCollectionPDA(): [PublicKey, number] {
        return PublicKey.findProgramAddressSync(
            [CONFIG.SEEDS.COLLECTION],
            CONFIG.NFT_PROGRAM_ID
        );
    }

    // User shares PDA for a specific NFT
    static getUserSharesPDA(nftMint: PublicKey): [PublicKey, number] {
        return PublicKey.findProgramAddressSync(
            [CONFIG.SEEDS.USER_SHARES, nftMint.toBuffer()],
            CONFIG.VAULT_PROGRAM_ID
        );
    }

    // User info PDA
    static getUserInfoPDA(nftTokenAccount: PublicKey, shareTokenAccount: PublicKey): [PublicKey, number] {
        return PublicKey.findProgramAddressSync(
            [CONFIG.SEEDS.USER_INFO, nftTokenAccount.toBuffer(), shareTokenAccount.toBuffer()],
            CONFIG.VAULT_PROGRAM_ID
        );
    }

    // User state PDA (from NFT program)
    static getUserStatePDA(userPubkey: PublicKey): [PublicKey, number] {
        return PublicKey.findProgramAddressSync(
            [CONFIG.SEEDS.USER_STATE, userPubkey.toBuffer()],
            CONFIG.NFT_PROGRAM_ID
        );
    }

    // Associated token accounts
    static getVaultTokenAccount(): PublicKey {
        const [vaultPda] = this.getVaultPDA();
        return getAssociatedTokenAddressSync(
            CONFIG.VAULT_ASSET_MINT,
            vaultPda,
            true // allowOwnerOffCurve for PDA
        );
    }

    static getUserAssetTokenAccount(userPubkey: PublicKey): PublicKey {
        return getAssociatedTokenAddressSync(
            CONFIG.VAULT_ASSET_MINT,
            userPubkey
        );
    }

    static getUserNFTTokenAccount(userPubkey: PublicKey, nftMint: PublicKey): PublicKey {
        return getAssociatedTokenAddressSync(
            nftMint,
            userPubkey
        );
    }

    static getUserShareTokenAccount(userSharesPda: PublicKey): PublicKey {
        return getAssociatedTokenAddressSync(
            CONFIG.SHARE_MINT,
            userSharesPda,
            true // allowOwnerOffCurve for PDA
        );
    }

    // Convenience method to get all derived accounts for a user operation
    static getDerivedAccountsForUser(userPubkey: PublicKey, nftMint: PublicKey) {
        const [vaultPda, vaultBump] = this.getVaultPDA();
        const [collectionPda, collectionBump] = this.getCollectionPDA();
        const [userSharesPda, userSharesBump] = this.getUserSharesPDA(nftMint);
        
        const userNftTokenAccount = this.getUserNFTTokenAccount(userPubkey, nftMint);
        const userAssetTokenAccount = this.getUserAssetTokenAccount(userPubkey);
        const userShareTokenAccount = this.getUserShareTokenAccount(userSharesPda);
        const vaultTokenAccount = this.getVaultTokenAccount();
        
        const [userInfoPda, userInfoBump] = this.getUserInfoPDA(userNftTokenAccount, userShareTokenAccount);

        return {
            // PDAs with bumps
            vaultPda,
            vaultBump,
            collectionPda,
            collectionBump,
            userSharesPda,
            userSharesBump,
            userInfoPda,
            userInfoBump,
            
            // Token accounts
            userNftTokenAccount,
            userAssetTokenAccount,
            userShareTokenAccount,
            vaultTokenAccount,
        };
    }
}