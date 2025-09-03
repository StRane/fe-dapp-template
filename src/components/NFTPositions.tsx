import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useVaultNFT, NFTPosition } from '@/lib/useVault';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

interface NFTPositionCardProps {
  position: NFTPosition;
  onDeposit: (nftMint: PublicKey, amount: BN) => Promise<void>;
  onWithdraw: (nftMint: PublicKey, shares: BN) => Promise<void>;
}

const NFTPositionCard: React.FC<NFTPositionCardProps> = ({ position, onDeposit, onWithdraw }) => {
  const [depositAmount, setDepositAmount] = useState<string>('0');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('0');

  return (
    <Card className="w-full max-w-md mb-4">
      <CardHeader>
        <CardTitle>{position.nftMint.toBase58().slice(0, 6)}...{position.nftMint.toBase58().slice(-4)}</CardTitle>
        <CardDescription>Shares: {position.shares.toString()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div>Asset Value: {position.assetValue.toString()}</div>
        <div>Deposited: {position.depositedAmount.toString()}</div>
        {position.borrowedAmount && <div>Borrowed: {position.borrowedAmount.toString()}</div>}

        <div className="flex gap-2 mt-2">
          <div className="flex flex-col">
            <Label htmlFor="deposit">Deposit Amount</Label>
            <Input
              id="deposit"
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
            />
          </div>
          <Button
            onClick={() => onDeposit(position.nftMint, new BN(depositAmount))}
          >
            Deposit
          </Button>
        </div>

        <div className="flex gap-2 mt-2">
          <div className="flex flex-col">
            <Label htmlFor="withdraw">Withdraw Shares</Label>
            <Input
              id="withdraw"
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
            />
          </div>
          <Button
            variant="destructive"
            onClick={() => onWithdraw(position.nftMint, new BN(withdrawAmount))}
          >
            Withdraw
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export const NFTPositionsList: React.FC<{ vaultMint?: PublicKey }> = ({ vaultMint }) => {
  const vaultHook = useVaultNFT(vaultMint);
  const [positions, setPositions] = useState<NFTPosition[]>([]);

  useEffect(() => {
    const fetchPositions = async () => {
      const nfts: NFTPosition[] = [];
      for (const [, pos] of vaultHook.nftPositions) {
        nfts.push(pos);
      }
      setPositions(nfts);
    };

    fetchPositions();
  }, [vaultHook.nftPositions]);

  const handleDeposit = async (nftMint: PublicKey, amount: BN) => {
    await vaultHook.depositWithNFT(nftMint, amount);
    await vaultHook.refreshNFTPosition(nftMint);
  };

  const handleWithdraw = async (nftMint: PublicKey, shares: BN) => {
    await vaultHook.withdrawWithNFT(nftMint, shares);
    await vaultHook.refreshNFTPosition(nftMint);
  };

  if (!vaultHook.isConnected) {
    return <div>Please connect your wallet.</div>;
  }

  if (vaultHook.loading) {
    return <div>Loading NFT positions...</div>;
  }

  if (positions.length === 0) {
    return <div>No NFT positions found.</div>;
  }

  return (
    <div className="flex flex-col">
      {positions.map((pos) => (
        <NFTPositionCard
          key={pos.nftMint.toBase58()}
          position={pos}
          onDeposit={handleDeposit}
          onWithdraw={handleWithdraw}
        />
      ))}
    </div>
  );
};
