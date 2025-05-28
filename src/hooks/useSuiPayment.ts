import { useSuiClient, useCurrentAccount, useSuiClientQuery, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useState } from 'react';
import { Transaction } from '@mysten/sui/transactions';
import { toast } from '@/components/ui/use-toast';

// The receiver wallet address for mystery box payments
const PAYMENT_RECEIVER_ADDRESS = '0x1a0653c5c65355eef0069f431f18ef8f829125e1ed20db0bfd054b4d338553ef';

// Define payment amounts in Sui - these match the costs of different box types
export const PAYMENT_AMOUNTS = {
  common: 0.05, // 0.05 SUI
  rare: 0.15,   // 0.15 SUI
  epic: 0.25,   // 0.25 SUI
  legendary: 0.3 // 0.3 SUI
};

export function useSuiPayment() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  // Get account balance
  const { data: balance } = useSuiClientQuery(
    'getBalance',
    {
      owner: currentAccount?.address || '',
    },
    {
      enabled: !!currentAccount,
    }
  );

  // Helper to convert SUI to MIST (the smallest unit)
  const suiToMist = (amount: number): bigint => {
    return BigInt(Math.floor(amount * 1_000_000_000));
  };

  // Check if user has enough balance
  const hasEnoughBalance = (amount: number): boolean => {
    if (!balance) return false;
    const requiredMist = suiToMist(amount);
    return BigInt(balance.totalBalance) >= requiredMist;
  };

  // Pay for a mystery box
  const payForMysteryBox = async (boxType: 'common' | 'rare' | 'epic' | 'legendary'): Promise<{
    success: boolean;
    txDigest?: string;
  }> => {
    if (!currentAccount) {
      setError('No wallet connected');
      return { success: false };
    }

    const amount = PAYMENT_AMOUNTS[boxType];
    
    if (!hasEnoughBalance(amount)) {
      setError(`Insufficient balance. You need at least ${amount} SUI.`);
      toast({
        title: "Insufficient Balance",
        description: `You need at least ${amount} SUI to purchase this box.`,
        variant: "destructive"
      });
      return { success: false };
    }

    try {
      setIsLoading(true);
      setError(null);

      // Create a transaction block
      const tx = new Transaction();
      
      // Convert amount to MIST (SUI * 10^9)
      const amountMist = Number(suiToMist(amount));
      
      // Add a transfer operation to the transaction
      // Create a new coin with the specified amount from the gas coin
      const [coin] = tx.splitCoins(tx.gas, [amountMist]);
      
      // Transfer that coin to the payment receiver
      tx.transferObjects([coin], PAYMENT_RECEIVER_ADDRESS);

      // Execute the transaction using dapp-kit hook
      return new Promise((resolve) => {
        signAndExecuteTransaction(
          {
            transaction: tx,
          },
          {
            onSuccess: (result) => {
              setTxDigest(result.digest);
              setIsPaid(true);
              
              toast({
                title: "Payment Successful",
                description: `You've successfully paid ${amount} SUI for the ${boxType} box!`,
              });
              
              resolve({ 
                success: true,
                txDigest: result.digest
              });
            },
            onError: (error) => {
              
              setError('Error processing payment');
              toast({
                title: "Payment Error",
                description: "Error processing your payment. Please try again.",
                variant: "destructive"
              });
              resolve({ success: false });
            },
            onSettled: () => {
              setIsLoading(false);
            }
          }
        );
      });
    } catch (error) {
      
      setError('Error processing payment');
      toast({
        title: "Payment Error",
        description: "Error processing your payment. Please try again.",
        variant: "destructive"
      });
      setIsLoading(false);
      return { success: false };
    }
  };

  // Pay a custom amount for cosmetic items
  const payForCosmetic = async (amount: number, itemName: string): Promise<{
    success: boolean;
    txDigest?: string;
  }> => {
    if (!currentAccount) {
      setError('No wallet connected');
      return { success: false };
    }
    
    if (!hasEnoughBalance(amount)) {
      setError(`Insufficient balance. You need at least ${amount} SUI.`);
      toast({
        title: "Insufficient Balance",
        description: `You need at least ${amount} SUI to purchase this item.`,
        variant: "destructive"
      });
      return { success: false };
    }

    try {
      setIsLoading(true);
      setError(null);

      // Create a transaction block
      const tx = new Transaction();
      
      // Convert amount to MIST (SUI * 10^9)
      const amountMist = Number(suiToMist(amount));
      
      // Split coins and transfer
      const [coin] = tx.splitCoins(tx.gas, [amountMist]);
      tx.transferObjects([coin], PAYMENT_RECEIVER_ADDRESS);

      // Execute the transaction using dapp-kit hook
      return new Promise((resolve) => {
        signAndExecuteTransaction(
          {
            transaction: tx,
          },
          {
            onSuccess: (result) => {
              setTxDigest(result.digest);
              setIsPaid(true);
              
              toast({
                title: "Payment Successful",
                description: `You've successfully paid ${amount} SUI for the ${itemName}!`,
              });
              
              resolve({ 
                success: true,
                txDigest: result.digest
              });
            },
            onError: (error) => {
              
              setError('Error processing payment');
              toast({
                title: "Payment Error",
                description: "Error processing your payment. Please try again.",
                variant: "destructive"
              });
              resolve({ success: false });
            },
            onSettled: () => {
              setIsLoading(false);
            }
          }
        );
      });
    } catch (error) {
      
      setError('Error processing payment');
      toast({
        title: "Payment Error",
        description: "Error processing your payment. Please try again.",
        variant: "destructive"
      });
      setIsLoading(false);
      return { success: false };
    }
  };

  return {
    payForMysteryBox,
    payForCosmetic,
    isLoading,
    error,
    txDigest,
    isPaid,
    hasEnoughBalance,
    resetPaymentState: () => {
      setIsPaid(false);
      setTxDigest(null);
      setError(null);
    }
  };
} 