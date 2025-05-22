import { useCurrentAccount, useSuiClientQuery } from '@mysten/dapp-kit';
import { useState } from 'react';
import { useSuiTransaction } from '@/hooks/useSuiTransaction';
import { Button } from './ui/button';

export function SuiWalletInfo() {
  const currentAccount = useCurrentAccount();
  const [selectedTxDigest, setSelectedTxDigest] = useState<string | null>(null);
  const [txDetails, setTxDetails] = useState<any>(null);
  const { getTransactionDetails, isLoading } = useSuiTransaction();

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

  // Get account objects
  const { data: objects } = useSuiClientQuery(
    'getOwnedObjects',
    {
      owner: currentAccount?.address || '',
      options: { showContent: true },
      limit: 5,
    },
    {
      enabled: !!currentAccount,
    }
  );

  // Get recent transactions
  const { data: transactions } = useSuiClientQuery(
    'queryTransactionBlocks', 
    {
      filter: {
        FromAddress: currentAccount?.address,
      },
      limit: 5,
    },
    {
      enabled: !!currentAccount,
    }
  );

  if (!currentAccount) {
    return (
      <div className="galaxy-card p-4 text-center">
        <p>Connect your wallet to view your Sui assets</p>
      </div>
    );
  }

  const handleViewTransaction = async (digest: string) => {
    setSelectedTxDigest(digest);
    const details = await getTransactionDetails(digest);
    setTxDetails(details);
  };

  return (
    <div className="galaxy-card p-6 space-y-4">
      <h3 className="text-xl font-bold">Sui Wallet Information</h3>
      
      <div>
        <p className="text-sm text-foreground/70">Connected Address:</p>
        <p className="font-mono text-sm break-all">{currentAccount.address}</p>
      </div>
      
      {balance && (
        <div>
          <p className="text-sm text-foreground/70">Balance:</p>
          <p className="font-medium">{parseInt(balance.totalBalance) / 1000000000} SUI</p>
        </div>
      )}
      
      <div className="border-t border-border pt-4">
        <h4 className="font-medium mb-2">Your Objects (First 5)</h4>
        <div className="max-h-40 overflow-y-auto">
          {objects?.data?.map((obj, i) => (
            <div key={i} className="text-xs p-2 border border-border rounded-md mb-2 bg-background">
              <p className="font-mono">{obj.data?.objectId}</p>
              <p className="text-foreground/70">{obj.data?.type?.split('::').pop()}</p>
            </div>
          ))}
          {(!objects?.data || objects.data.length === 0) && (
            <p className="text-sm text-foreground/70">No objects found</p>
          )}
        </div>
      </div>
      
      <div className="border-t border-border pt-4">
        <h4 className="font-medium mb-2">Recent Transactions</h4>
        <div className="max-h-40 overflow-y-auto">
          {transactions?.data?.map((tx, i) => (
            <div key={i} className="text-xs p-2 border border-border rounded-md mb-2 bg-background">
              <p className="font-mono">{tx.digest.slice(0, 10)}...</p>
              <Button 
                variant="link" 
                className="text-xs p-0 h-auto" 
                onClick={() => handleViewTransaction(tx.digest)}
              >
                View Details
              </Button>
            </div>
          ))}
          {(!transactions?.data || transactions.data.length === 0) && (
            <p className="text-sm text-foreground/70">No recent transactions</p>
          )}
        </div>
      </div>
      
      {txDetails && (
        <div className="border-t border-border pt-4">
          <h4 className="font-medium mb-2">Transaction Details</h4>
          <div className="text-xs p-2 border border-border rounded-md bg-background max-h-60 overflow-y-auto">
            <pre className="whitespace-pre-wrap break-all">
              {JSON.stringify(txDetails, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default SuiWalletInfo; 