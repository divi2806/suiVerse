import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Award, X, Loader2, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { mintModuleCompletionNFT, recordSuccessfulMint } from '@/services/nftService';
import { Button } from '@/components/ui/button';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { SuiClient } from '@mysten/sui.js/client';

// Initialize Sui client
const network = import.meta.env.VITE_SUI_NETWORK || 'testnet';
const suiClient = new SuiClient({
  url: network === 'mainnet' 
    ? 'https://fullnode.mainnet.sui.io:443'
    : `https://fullnode.${network}.sui.io:443`
});

interface ModuleCompletionPopupProps {
  isOpen: boolean;
  onClose: () => void;
  moduleId: number;
  moduleName: string;
  walletAddress: string;
  xpEarned: number;
  suiEarned: number;
}

const ModuleCompletionPopup: React.FC<ModuleCompletionPopupProps> = ({
  isOpen,
  onClose,
  moduleId,
  moduleName,
  walletAddress,
  xpEarned,
  suiEarned
}) => {
  const [isMinting, setIsMinting] = useState(false);
  const [mintingSuccess, setMintingSuccess] = useState(false);
  const [mintingError, setMintingError] = useState<string | null>(null);
  const [nftId, setNftId] = useState<string | null>(null);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  
  // Get current account from dapp-kit
  const currentAccount = useCurrentAccount();
  const signAndExecuteTransaction = useSignAndExecuteTransaction();
  
  // Check if wallet is connected
  const isWalletConnected = !!currentAccount;
  
  // Use the connected wallet address if available, otherwise use the provided walletAddress
  const activeWalletAddress = currentAccount?.address || walletAddress;

  // Generate NFT image URL using DiceBear
  const nftImageUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=module${moduleId}`;

  // Mint NFT automatically when popup opens
  useEffect(() => {
    if (isOpen && activeWalletAddress) {
      console.log(`Auto-minting NFT check: isOpen=${isOpen}, walletAddress=${activeWalletAddress}, isMinting=${isMinting}, mintingSuccess=${mintingSuccess}, mintingError=${mintingError ? 'true' : 'false'}`);
      
      // Always force a retry for test-wallet addresses or when address contains "test"
      const isTestWallet = activeWalletAddress === 'test-wallet' || activeWalletAddress.toLowerCase().includes('test');
      if (isTestWallet) {
        console.log(`Test wallet detected, forcing NFT minting regardless of state`);
        setIsMinting(false);
        setMintingSuccess(false);
        setMintingError(null);
        // Give a small delay to ensure state is updated
        setTimeout(() => {
          console.log('Forcing NFT minting for test wallet...');
          mintNFT();
        }, 100);
        return;
      }
      
      if (!isMinting && !mintingSuccess && !mintingError) {
        console.log(`Auto-minting NFT for module ${moduleId} to ${activeWalletAddress}`);
        mintNFT();
      } else {
        console.log(`Not auto-minting due to minting state: isMinting=${isMinting}, mintingSuccess=${mintingSuccess}, mintingError=${mintingError ? 'true' : 'false'}`);
      }
    } else {
      console.log(`Not auto-minting, conditions not met: isOpen=${isOpen}, walletAddress=${activeWalletAddress || 'undefined'}`);
    }
  }, [isOpen, activeWalletAddress]);

  // Handle NFT minting
  const mintNFT = async () => {
    try {
      setIsMinting(true);
      setMintingError(null);

      console.log(`Starting NFT minting process for module ${moduleId}`);
      console.log(`WalletAddress: "${activeWalletAddress}", moduleId: ${moduleId}, wallet connected: ${isWalletConnected}`);
      
      // Extra validation for wallet address
      if (!activeWalletAddress || activeWalletAddress === 'undefined' || activeWalletAddress === 'null') {
        console.error('Invalid wallet address detected:', activeWalletAddress);
        setMintingError('Invalid wallet address');
        setIsMinting(false);
        return;
      }
      
      // Special handling for test wallet
      const isTestWallet = activeWalletAddress === 'test-wallet' || activeWalletAddress.toLowerCase().includes('test');
      
      // If wallet isn't connected and NOT a test wallet, show error
      if (!isWalletConnected && !isTestWallet) {
        console.error('Wallet not connected');
        setMintingError('Wallet not connected. Please connect your wallet first.');
        setIsMinting(false);
        return;
      }
      
      // Special handling for test wallet
      if (isTestWallet) {
        console.log('Test wallet detected, simulating successful mint');
        // Simulate successful minting
        setTimeout(() => {
          setMintingSuccess(true);
          setNftId(`test-nft-${Date.now()}`);
          setTxDigest(`test-tx-${Date.now()}`);
          
          // Trigger confetti for successful minting
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { x: 0.5, y: 0.5 }
          });
        }, 2000);
        return;
      }
      
      // Get the transaction to sign
      const result = await mintModuleCompletionNFT(activeWalletAddress, moduleId);
      
      if (result.success && result.transaction) {
        console.log('Transaction created, requesting wallet signature...');
        
        try {
          // We need to convert the TransactionBlock to the format expected by @mysten/dapp-kit
          // First, build the transaction 
          const tx = result.transaction;
          
          // Set the sender address explicitly to avoid the "Missing transaction sender" error
          tx.setSender(activeWalletAddress);
          
          // Serialize and build the transaction the way dapp-kit expects it
          const builtTx = await tx.build({ client: suiClient });
          
          // Sign and execute transaction with the dapp-kit
          const response = await signAndExecuteTransaction.mutateAsync({
            // Pass the built transaction bytes as base64
            transaction: btoa(String.fromCharCode(...new Uint8Array(builtTx)))
          });
          
          console.log('Transaction executed successfully:', response);
          
          // Get transaction digest
          const txDigest = response.digest;
          
          // Record the successful mint in Firestore
          // Since objectChanges aren't available in signAndExecuteTransaction response,
          // we'll need to query for the created NFT later or pass null for now
          await recordSuccessfulMint(
            activeWalletAddress,
            moduleId,
            txDigest
          );
          
          // Update UI state
          setMintingSuccess(true);
          setTxDigest(txDigest);
          
          // Trigger confetti for successful minting
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { x: 0.5, y: 0.5 }
          });
        } catch (walletError) {
          console.error('Error during wallet signing:', walletError);
          setMintingError(walletError instanceof Error ? 
            `Wallet error: ${walletError.message}` : 
            'Error during wallet transaction'
          );
        }
      } else {
        console.error(`Failed to create minting transaction: ${result.message}`);
        setMintingError(result.message || 'Failed to create minting transaction');
      }
    } catch (error) {
      console.error('Error minting NFT:', error);
      setMintingError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsMinting(false);
    }
  };

  // Show NFT details on Sui Explorer
  const viewOnExplorer = () => {
    if (nftId) {
      const explorerUrl = network === 'mainnet'
        ? `https://suiscan.xyz/objects/${nftId}`
        : `https://suiscan.xyz/${network}/objects/${nftId}`;
      
      window.open(explorerUrl, '_blank');
    } else if (txDigest) {
      const explorerUrl = network === 'mainnet'
        ? `https://suiscan.xyz/${network}/tx/${txDigest}`
        : `https://suiscan.xyz/${network}/tx/${txDigest}`;
      
      window.open(explorerUrl, '_blank');
    }
  };

  // Trigger confetti when popup opens
  useEffect(() => {
    if (isOpen) {
      console.log('Module completion popup opened, triggering confetti');
      confetti({
        particleCount: 200,
        spread: 90,
        origin: { x: 0.5, y: 0.3 }
      });
    }
  }, [isOpen]);

  // Add global function for direct access
  useEffect(() => {
    const win = window as any;
    win.showDirectModuleCompletionPopup = (data: any) => {
      console.log('Direct popup function called with:', data);
      
      // Extract data or use defaults
      const popupData = {
        moduleId: data.moduleId || 1,
        moduleName: data.moduleName || 'Unknown Module',
        walletAddress: data.walletAddress || 'unknown',
        xpEarned: data.xpEarned || 0,
        suiEarned: data.suiEarned || 0
      };
      
      // Force the popup to open by updating state
      setIsMinting(false);
      setMintingSuccess(false);
      setMintingError(null);
      
      // Use setTimeout to ensure this runs after current execution cycle
      setTimeout(() => {
        console.log('Forcing popup to open with data:', popupData);
        // This line will directly open the popup without relying on other components
        document.dispatchEvent(new CustomEvent('forceModulePopup', { detail: popupData }));
      }, 10);
    };
    
    return () => {
      delete win.showDirectModuleCompletionPopup;
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gradient-to-br from-background/95 to-background/80 border border-primary/20 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl backdrop-blur-sm"
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 p-2 rounded-full">
              <Award className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-xl font-bold">Module Completed!</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-primary mb-1">{moduleName}</h3>
            <p className="text-muted-foreground">
              Congratulations on completing this module! You've earned:
            </p>
          </div>

          {/* Rewards */}
          <div className="grid grid-cols-2 gap-4 my-4">
            <div className="bg-background/50 rounded-lg p-3 text-center">
              <p className="text-sm text-muted-foreground">XP Earned</p>
              <p className="text-xl font-bold text-yellow-500">+{xpEarned}</p>
            </div>
            <div className="bg-background/50 rounded-lg p-3 text-center">
              <p className="text-sm text-muted-foreground">SUI Earned</p>
              <p className="text-xl font-bold text-blue-500">+{suiEarned}</p>
            </div>
          </div>

          {/* NFT Preview */}
          <div className="bg-black/20 rounded-lg p-4 flex flex-col items-center">
            <p className="text-sm text-center mb-3">
              {isMinting 
                ? "Minting your achievement NFT..." 
                : mintingSuccess 
                  ? "Your achievement NFT has been minted!" 
                  : mintingError 
                    ? "Failed to mint achievement NFT" 
                    : "Achievement NFT for module completion"}
            </p>
            <div className="w-32 h-32 mb-3 rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-secondary/20 p-1">
              <img
                src={nftImageUrl}
                alt={`Module ${moduleId} NFT`}
                className="w-full h-full object-cover rounded-md"
              />
            </div>
            
            {isMinting ? (
              <Button 
                disabled={true}
                className="w-full"
                variant="default"
              >
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Minting in progress...
              </Button>
            ) : mintingSuccess ? (
              <Button 
                onClick={viewOnExplorer}
                className="w-full"
                variant="outline"
              >
                <Check className="mr-2 h-4 w-4 text-green-500" />
                View on Explorer
              </Button>
            ) : (
              <Button 
                onClick={mintNFT} 
                disabled={isMinting || (!isWalletConnected && activeWalletAddress !== 'test-wallet')}
                className="w-full"
                variant="default"
              >
                {isWalletConnected ? 'Mint Achievement NFT' : 'Connect Wallet to Mint'}
              </Button>
            )}
            
            {mintingError && (
              <p className="text-red-500 text-sm mt-2">{mintingError}</p>
            )}
            
            {/* Force Mint button for admins and testing */}
            <Button 
              onClick={() => {
                // Reset state and force mint
                setIsMinting(false);
                setMintingSuccess(false);
                setMintingError(null);
                console.log('Force minting NFT initiated...');
                setTimeout(() => mintNFT(), 50);
              }}
              className="w-full mt-2 bg-yellow-600 hover:bg-yellow-700 text-white"
              variant="outline"
            >
              Force Mint NFT
            </Button>
          </div>

          <div className="text-center text-sm text-muted-foreground mt-4">
            <p>Continue your journey through the Sui universe!</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ModuleCompletionPopup; 