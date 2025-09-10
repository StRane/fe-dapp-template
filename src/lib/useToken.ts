import { useState, useEffect, useCallback } from 'react';
import { useAppKitAccount, useAppKitNetwork, useAppKitProvider } from '@reown/appkit/react';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import {
  PublicKey,
  Connection,
  Commitment
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import { AnchorWallet } from '@solana/wallet-adapter-react';

// You'll need to generate this IDL after building your test_token program
// Run: anchor build && anchor idl parse --file target/idl/test_token.json
import type { TestToken } from '../types/test_token';
import IDL from '../idl/test_token.json';

// CONFIGURATION - Update with your deployed program
const CONFIG = {
  // Your deployed test_token program ID
  TEST_TOKEN_ID: 'HY3dPfn3MJqLSbQm4jExye2H8KZag8AkD2AmBXgL2SKm', // <-- CHANGE THIS to your deployed address

  // RPC endpoints for different networks
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
  decimals: number;
  mintAuthority: PublicKey;
  supply: BN;
  isInitialized: boolean;
}

export interface MintResult {
  mint: PublicKey;
  recipientTokenAccount: PublicKey;
  amount: BN;
  txSignature: string;
}

export interface UseTestTokenReturn {
  // State
  program: Program<TestToken> | null;
  mintAuthorityPda: PublicKey | null;
  tokenMint: PublicKey | null;
  tokenInfo: TokenInfo | null;
  userTokenBalance: BN | null;
  loading: boolean;
  error: string | null;
  isTokenInitialized: boolean;
  isConnected: boolean;
  walletAddress: string | undefined;

  // Network info
  currentNetwork: string | null;
  programId: string;

  // Functions
  initializeToken: () => Promise<string | null>;
  mintTokens: (amount: BN) => Promise<MintResult | null>;
  getUserTokenBalance: () => Promise<BN | null>;
  getTokenInfo: () => Promise<TokenInfo | null>;
  refreshData: () => Promise<void>;
}

export const useTestToken = (): UseTestTokenReturn => {
  // AppKit hooks
  const { address, isConnected } = useAppKitAccount();
  const { caipNetwork, caipNetworkId } = useAppKitNetwork();
  const { walletProvider } = useAppKitProvider('solana');

  // State
  const [program, setProgram] = useState<Program<TestToken> | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [mintAuthorityPda, setMintAuthorityPda] = useState<PublicKey | null>(null);
  const [tokenMint, setTokenMint] = useState<PublicKey | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [userTokenBalance, setUserTokenBalance] = useState<BN | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isTokenInitialized, setIsTokenInitialized] = useState<boolean>(false);

  // Program ID
  const testTokenProgramId = new PublicKey(CONFIG.TEST_TOKEN_ID);

  // Check if we're on Solana network
  const isSolanaNetwork = caipNetworkId?.includes('solana') || false;
  const currentNetwork = caipNetwork?.name || null;

  // Setup connection based on network
  useEffect(() => {
    if (isSolanaNetwork && currentNetwork) {
      const rpcUrl = CONFIG.RPC_ENDPOINTS[currentNetwork as keyof typeof CONFIG.RPC_ENDPOINTS] || CONFIG.RPC_ENDPOINTS['solana-testnet'];
      const newConnection = new Connection(rpcUrl, 'confirmed');
      setConnection(newConnection);
      console.log('Connected to Solana network:', currentNetwork, rpcUrl);
    }
  }, [isSolanaNetwork, currentNetwork]);

  // Initialize program when wallet and connection are ready
  useEffect(() => {
    const initializeProgram = async () => {
      if (!isConnected || !address || !connection || !walletProvider || !isSolanaNetwork) {
        setProgram(null);
        return;
      }

      try {
        // Create a custom provider using AppKit's wallet provider
        const anchorProvider = new AnchorProvider(
          connection,
          walletProvider as AnchorWallet,
          { commitment: 'confirmed' as Commitment }
        );

        // Initialize program
        const program = new Program<TestToken>(
          IDL as TestToken,
          anchorProvider
        );
        setProgram(program);

        // Derive PDAs
        const [mintAuthPda] = PublicKey.findProgramAddressSync(
          [CONFIG.MINT_AUTH_SEED],
          testTokenProgramId
        );
        setMintAuthorityPda(mintAuthPda);

        console.log('Test Token Program initialized:', {
          programId: testTokenProgramId.toBase58(),
          mintAuthorityPda: mintAuthPda.toBase58(),
          userAddress: address,
          chainId: caipNetworkId,
        });

        // Load initial data
        await refreshData();
      } catch (err) {
        console.error('Failed to initialize program:', err);
        setError(`Failed to initialize: ${(err as Error).message}`);
      }
    };

    initializeProgram();
  }, [isConnected, address, connection, walletProvider, isSolanaNetwork]);

  // Refresh all data
  const refreshData = useCallback(async () => {
    if (!mintAuthorityPda || !connection || !program) return;

    setLoading(true);
    setError(null);

    try {
      // Check if mint authority PDA exists
      const mintAuthInfo = await program.account.mintAuthorityPda.fetchNullable(mintAuthorityPda);
      
      if (mintAuthInfo) {
        setIsTokenInitialized(true);
        console.log('Token mint authority initialized, bump:', mintAuthInfo.bump);

        // Try to get token info if we can find the mint
        const tokenInfoData = await getTokenInfo();
        if (tokenInfoData) {
          setTokenInfo(tokenInfoData);
          setTokenMint(tokenInfoData.mint);
        }

        // Get user token balance if connected
        if (address) {
          const balance = await getUserTokenBalance();
          setUserTokenBalance(balance);
        }
      } else {
        setIsTokenInitialized(false);
        console.log('Token not initialized yet - need to call initializeToken()');
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(`Failed to fetch data: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [program, mintAuthorityPda, connection, address]);

  // Initialize token (only needs to be called once ever!)
  const initializeToken = useCallback(async (): Promise<string | null> => {
    if (!program || !address || !mintAuthorityPda) {
      setError('Wallet not connected or program not initialized');
      return null;
    }

    if (isTokenInitialized) {
      setError('Token already initialized');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Initializing token...', {
        authority: address,
        network: currentNetwork,
        chainId: caipNetworkId
      });

      // We need to find or create accounts for the initialization
      // The program will create the mint and mint authority PDA
      const accounts = await program.methods
        .initialize()
        .accounts({
          payer: new PublicKey(address),
          // mint and mintAuth will be derived by Anchor
        })
        .rpc({
          commitment: 'confirmed',
          skipPreflight: false,
        });

      console.log('Token initialized!', accounts);

      // Refresh to load the new token data
      await refreshData();

      return accounts;
    } catch (err) {
      console.error('Error initializing token:', err);
      setError(`Failed to initialize token: ${(err as Error).message}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, [program, address, mintAuthorityPda, isTokenInitialized, refreshData, currentNetwork, caipNetworkId]);

  // Mint tokens to user
  const mintTokens = useCallback(async (amount: BN): Promise<MintResult | null> => {
    if (!program || !address || !mintAuthorityPda) {
      setError('Wallet not connected or program not initialized');
      return null;
    }

    if (!isTokenInitialized || !tokenMint) {
      setError('Token not initialized yet');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const userPublicKey = new PublicKey(address);

      // Get user's associated token account
      const recipientTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        userPublicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      console.log('Minting tokens...', {
        amount: amount.toString(),
        mint: tokenMint.toBase58(),
        recipient: recipientTokenAccount.toBase58(),
        user: userPublicKey.toBase58(),
      });

      // Build and send transaction
      const tx = await program.methods
        .mintTokens(amount)
        .accounts({
          caller: userPublicKey,
          mint: tokenMint,
        })
        .rpc({
          commitment: 'confirmed',
        });

      console.log('Mint tokens transaction successful:', tx);

      // Refresh data to get updated balances
      await refreshData();

      return {
        mint: tokenMint,
        recipientTokenAccount,
        amount,
        txSignature: tx,
      };
    } catch (err) {
      console.error('Error minting tokens:', err);
      setError(`Failed to mint tokens: ${(err as Error).message}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, [program, address, mintAuthorityPda, isTokenInitialized, tokenMint, refreshData]);

  // Get user's token balance
  const getUserTokenBalance = useCallback(async (): Promise<BN | null> => {
    if (!connection || !address || !tokenMint) return null;

    try {
      const userPublicKey = new PublicKey(address);
      const tokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        userPublicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const accountInfo = await connection.getTokenAccountBalance(tokenAccount);
      return new BN(accountInfo.value.amount);
    } catch (err) {
      // Account might not exist yet
      console.log('Token account does not exist or error fetching balance:', err);
      return new BN(0);
    }
  }, [connection, address, tokenMint]);

  // Get token info
  const getTokenInfo = useCallback(async (): Promise<TokenInfo | null> => {
    if (!connection || !program) return null;

    try {
      // We need to find the mint account created by the program
      // Since we don't store it directly, we might need to scan or use a different approach
      // For now, let's try to get it from the program's accounts
      
      // This is a simplified approach - in practice, you might want to store the mint address
      // or query it differently based on your program's structure
      const programAccounts = await connection.getProgramAccounts(testTokenProgramId);
      
      // Find the mint account (this is a basic implementation)
      // You might need to adjust this based on how your program creates accounts
      for (const account of programAccounts) {
        try {
          const accountInfo = await connection.getAccountInfo(account.pubkey);
          if (accountInfo && accountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
            // This might be a mint account
            const parsedAccount = await connection.getParsedAccountInfo(account.pubkey);
            if (parsedAccount.value?.data && 'parsed' in parsedAccount.value.data) {
              const parsed = parsedAccount.value.data.parsed;
              if (parsed.type === 'mint') {
                const mintInfo = parsed.info;
                if (mintInfo.mintAuthority === mintAuthorityPda?.toBase58()) {
                  return {
                    mint: account.pubkey,
                    decimals: mintInfo.decimals,
                    mintAuthority: new PublicKey(mintInfo.mintAuthority),
                    supply: new BN(mintInfo.supply),
                    isInitialized: mintInfo.isInitialized,
                  };
                }
              }
            }
          }
        } catch (err) {
          console.log(err)
          continue;
        }
      }

      return null;
    } catch (err) {
      console.error('Error getting token info:', err);
      return null;
    }
  }, [connection, program, testTokenProgramId, mintAuthorityPda]);

  return {
    // State
    program,
    mintAuthorityPda,
    tokenMint,
    tokenInfo,
    userTokenBalance,
    loading,
    error,
    isTokenInitialized,
    isConnected: isConnected && isSolanaNetwork,
    walletAddress: address,

    // Network info
    currentNetwork,
    programId: CONFIG.TEST_TOKEN_ID,

    // Functions
    initializeToken,
    mintTokens,
    getUserTokenBalance,
    getTokenInfo,
    refreshData,
  };
};