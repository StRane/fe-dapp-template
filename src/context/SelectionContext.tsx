import React, { createContext, useContext, useState, ReactNode, useMemo, useCallback } from 'react';
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

  // Memoized handlers to prevent recreation on every render
  const handleSetSelectedTokenAccount = useCallback((account: PublicKey | null) => {
    console.log('[SelectionContext] Setting selected token account:', {
      from: selectedTokenAccount?.toBase58(),
      to: account?.toBase58()
    });
    setSelectedTokenAccount(account);
  }, [selectedTokenAccount]);

  const handleSetSelectedTokenMint = useCallback((mint: PublicKey | null) => {
    console.log('[SelectionContext] Setting selected token mint:', {
      from: selectedTokenMint?.toBase58(),
      to: mint?.toBase58()
    });
    setSelectedTokenMint(mint);
  }, [selectedTokenMint]);

  const handleSetSelectedNFT = useCallback((nft: PublicKey | null) => {
    console.log('[SelectionContext] Setting selected NFT:', {
      from: selectedNFT?.toBase58(),
      to: nft?.toBase58()
    });
    setSelectedNFT(nft);
  }, [selectedNFT]);

  // Operation management - memoized
  const startOperation = useCallback((type: SelectionState['operationType']) => {
    console.log('[SelectionContext] Starting operation:', {
      type,
      previousOperation: operationType,
      wasInProgress: operationInProgress
    });
    setOperationType(type);
    setOperationInProgress(true);
  }, [operationType, operationInProgress]);

  const endOperation = useCallback(() => {
    console.log('[SelectionContext] Ending operation:', {
      type: operationType,
      wasInProgress: operationInProgress
    });
    setOperationType(null);
    setOperationInProgress(false);
  }, [operationType, operationInProgress]);

  // Utility functions - memoized
  const clearAllSelections = useCallback(() => {
    console.log('[SelectionContext] Clearing all selections:', {
      hadTokenAccount: !!selectedTokenAccount,
      hadNFT: !!selectedNFT,
      hadTokenMint: !!selectedTokenMint
    });
    setSelectedTokenAccount(null);
    setSelectedNFT(null);
    setSelectedTokenMint(null);
    endOperation();
  }, [selectedTokenAccount, selectedNFT, selectedTokenMint, endOperation]);

  const hasValidSelection = useCallback((): boolean => {
    const hasSelection = !!(selectedTokenAccount || selectedNFT || selectedTokenMint);
    console.log('[SelectionContext] Checking valid selection:', {
      hasTokenAccount: !!selectedTokenAccount,
      hasNFT: !!selectedNFT,
      hasTokenMint: !!selectedTokenMint,
      hasValidSelection: hasSelection
    });
    return hasSelection;
  }, [selectedTokenAccount, selectedNFT, selectedTokenMint]);

  // Memoize the entire context value to prevent unnecessary re-renders
  const contextValue = useMemo<SelectionContextType>(() => ({
    // State
    selectedTokenAccount,
    selectedNFT,
    selectedTokenMint,
    operationInProgress,
    operationType,

    // Actions (already memoized above)
    setSelectedTokenAccount: handleSetSelectedTokenAccount,
    setSelectedTokenMint: handleSetSelectedTokenMint,
    setSelectedNFT: handleSetSelectedNFT,
    startOperation,
    endOperation,
    clearAllSelections,
    hasValidSelection,
  }), [
    selectedTokenAccount,
    selectedNFT,
    selectedTokenMint,
    operationInProgress,
    operationType,
    handleSetSelectedTokenAccount,
    handleSetSelectedTokenMint,
    handleSetSelectedNFT,
    startOperation,
    endOperation,
    clearAllSelections,
    hasValidSelection,
  ]);

  console.log('[SelectionContext] === PROVIDER RENDER END ===');

  return (
    <SelectionContext.Provider value={contextValue}>
      {children}
    </SelectionContext.Provider>
  );
};

// Custom hook for using selection context - memoized
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

// Utility hooks for specific selections - memoized
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

  // Memoize the returned object to prevent recreation
  return useMemo(() => ({
    selectedTokenAccount,
    selectedTokenMint,
    setSelectedTokenAccount,
    setSelectedTokenMint,
    hasTokenSelection: !!(selectedTokenAccount || selectedTokenMint)
  }), [selectedTokenAccount, selectedTokenMint, setSelectedTokenAccount, setSelectedTokenMint]);
};

export const useNFTSelection = () => {
  const { selectedNFT, setSelectedNFT } = useSelection();
  
  console.log('[SelectionContext] NFT selection hook called:', {
    hasSelectedNFT: !!selectedNFT
  });

  // Memoize the returned object to prevent recreation
  return useMemo(() => ({
    selectedNFT,
    setSelectedNFT,
    hasNFTSelection: !!selectedNFT
  }), [selectedNFT, setSelectedNFT]);
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

  // Memoize the returned object and isOperationType function
  return useMemo(() => ({
    operationInProgress,
    operationType,
    startOperation,
    endOperation,
    isOperationType: (type: SelectionState['operationType']) => operationType === type
  }), [operationInProgress, operationType, startOperation, endOperation]);
};