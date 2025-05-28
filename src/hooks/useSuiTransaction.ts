import { useSuiClient } from '@mysten/dapp-kit';
import { useState } from 'react';

export function useSuiTransaction() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  
  const suiClient = useSuiClient();

  // Get transaction details if we have a digest
  const getTransactionDetails = async (digest: string) => {
    if (!digest) return null;
    try {
      setIsLoading(true);
      const result = await suiClient.getTransactionBlock({
        digest,
        options: {
          showEffects: true,
          showInput: true,
        },
      });
      setIsLoading(false);
      return result;
    } catch (error) {
      
      setError('Error fetching transaction details');
      setIsLoading(false);
      return null;
    }
  };

  return {
    getTransactionDetails,
    isLoading,
    error,
    txDigest,
  };
} 