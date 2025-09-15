import React, { createContext, useContext, useState, ReactNode } from 'react';
import { PublicKey } from '@solana/web3.js';

interface SelectionState {
  // Selected assets across programs
  selectedTokenAccount: PublicKey | null;
  selectedNFT: PublicKey | null;
  selectedTokenMint: PublicKey | null;
  
  // Additional context for operations
  operationInProgress: boolean;
  operationType: 'deposit' | 'withdraw' | 'mint' | 'transfer' | null;
}

interface SelectionContextType extends SelectionState {
  // Token selection actions
  setSelectedTokenAccount: (account: PublicKey | null) => void;
  setSelectedTokenMint: (mint: PublicKey | null) => void;
  
  // NFT selection actions
  setSelectedNFT: (nft: PublicKey | null) => void;
  
  // Operation management
  startOperation: (type: SelectionState['operationType']) => void;
  endOperation: () => void;
  
  // Utility actions
  clearAllSelections: () => void;
  hasValidSelection: () => boolean;
}

const SelectionContext = createContext<SelectionContextType | undefined>(undefined);

interface SelectionProviderProps {
  children: ReactNode;
}

export const SelectionProvider: React.FC<SelectionProviderProps> = ({ children }) => {
  console.log('[SelectionContext] === PROVIDER RENDER START ===');
  
  // Selection state
  const [selectedTokenAccount, setSelectedTokenAccount] = useState<PublicKey | null>(null);
  const [selectedNFT, setSelectedNFT] = useState<PublicKey | null>(null);
  const [selectedTokenMint, setSelectedTokenMint] = useState<PublicKey | null>(null);
  
  // Operation state
  const [operationInProgress, setOperationInProgress] = useState<boolean>(false);
  const [operationType, setOperationType] = useState<SelectionState['operationType']>(null);

  console.log('[SelectionContext] Current state:', {
    selectedTokenAccount: selectedTokenAccount?.toBase58(),
    selectedNFT: selectedNFT?.toBase58(),
    selectedTokenMint: selectedTokenMint?.toBase58(),
    operationInProgress,
    operationType
  });

  // Token selection handlers
  const handleSetSelectedTokenAccount = (account: PublicKey | null) => {
    console.log('[SelectionContext] Setting selected token account:', {
      from: selectedTokenAccount?.toBase58(),
      to: account?.toBase58()
    });
    setSelectedTokenAccount(account);
  };

  const handleSetSelectedTokenMint = (mint: PublicKey | null) => {
    console.log('[SelectionContext] Setting selected token mint:', {
      from: selectedTokenMint?.toBase58(),
      to: mint?.toBase58()
    });
    setSelectedTokenMint(mint);
  };

  // NFT selection handlers
  const handleSetSelectedNFT = (nft: PublicKey | null) => {
    console.log('[SelectionContext] Setting selected NFT:', {
      from: selectedNFT?.toBase58(),
      to: nft?.toBase58()
    });
    setSelectedNFT(nft);
  };

  // Operation management
  const startOperation = (type: SelectionState['operationType']) => {
    console.log('[SelectionContext] Starting operation:', {
      type,
      previousOperation: operationType,
      wasInProgress: operationInProgress
    });
    setOperationType(type);
    setOperationInProgress(true);
  };

  const endOperation = () => {
    console.log('[SelectionContext] Ending operation:', {
      type: operationType,
      wasInProgress: operationInProgress
    });
    setOperationType(null);
    setOperationInProgress(false);
  };

  // Utility functions
  const clearAllSelections = () => {
    console.log('[SelectionContext] Clearing all selections:', {
      hadTokenAccount: !!selectedTokenAccount,
      hadNFT: !!selectedNFT,
      hadTokenMint: !!selectedTokenMint
    });
    setSelectedTokenAccount(null);
    setSelectedNFT(null);
    setSelectedTokenMint(null);
    endOperation();
  };

  const hasValidSelection = (): boolean => {
    const hasSelection = !!(selectedTokenAccount || selectedNFT || selectedTokenMint);
    console.log('[SelectionContext] Checking valid selection:', {
      hasTokenAccount: !!selectedTokenAccount,
      hasNFT: !!selectedNFT,
      hasTokenMint: !!selectedTokenMint,
      hasValidSelection: hasSelection
    });
    return hasSelection;
  };

  const contextValue: SelectionContextType = {
    // State
    selectedTokenAccount,
    selectedNFT,
    selectedTokenMint,
    operationInProgress,
    operationType,

    // Actions
    setSelectedTokenAccount: handleSetSelectedTokenAccount,
    setSelectedTokenMint: handleSetSelectedTokenMint,
    setSelectedNFT: handleSetSelectedNFT,
    startOperation,
    endOperation,
    clearAllSelections,
    hasValidSelection,
  };

  console.log('[SelectionContext] === PROVIDER RENDER END ===');

  return (
    <SelectionContext.Provider value={contextValue}>
      {children}
    </SelectionContext.Provider>
  );
};

// Custom hook for using selection context
export const useSelection = (): SelectionContextType => {
  console.log('[SelectionContext] === USE SELECTION HOOK CALL ===');
  
  const context = useContext(SelectionContext);
  
  if (context === undefined) {
    const error = 'useSelection must be used within a SelectionProvider';
    console.error('[SelectionContext] Hook usage error:', error);
    throw new Error(error);
  }

  console.log('[SelectionContext] Hook returning context:', {
    hasSelectedTokenAccount: !!context.selectedTokenAccount,
    hasSelectedNFT: !!context.selectedNFT,
    hasSelectedTokenMint: !!context.selectedTokenMint,
    operationInProgress: context.operationInProgress,
    operationType: context.operationType
  });

  return context;
};

// Utility hooks for specific selections
export const useTokenSelection = () => {
  const { 
    selectedTokenAccount, 
    selectedTokenMint, 
    setSelectedTokenAccount, 
    setSelectedTokenMint 
  } = useSelection();
  
  console.log('[SelectionContext] Token selection hook called:', {
    hasTokenAccount: !!selectedTokenAccount,
    hasTokenMint: !!selectedTokenMint
  });

  return {
    selectedTokenAccount,
    selectedTokenMint,
    setSelectedTokenAccount,
    setSelectedTokenMint,
    hasTokenSelection: !!(selectedTokenAccount || selectedTokenMint)
  };
};

export const useNFTSelection = () => {
  const { selectedNFT, setSelectedNFT } = useSelection();
  
  console.log('[SelectionContext] NFT selection hook called:', {
    hasSelectedNFT: !!selectedNFT
  });

  return {
    selectedNFT,
    setSelectedNFT,
    hasNFTSelection: !!selectedNFT
  };
};

export const useOperationState = () => {
  const { 
    operationInProgress, 
    operationType, 
    startOperation, 
    endOperation 
  } = useSelection();
  
  console.log('[SelectionContext] Operation state hook called:', {
    operationInProgress,
    operationType
  });

  return {
    operationInProgress,
    operationType,
    startOperation,
    endOperation,
    isOperationType: (type: SelectionState['operationType']) => operationType === type
  };
};