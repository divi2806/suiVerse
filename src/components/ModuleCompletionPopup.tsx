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
  quizScore?: number;
}

const ModuleCompletionPopup: React.FC<ModuleCompletionPopupProps> = ({
  isOpen,
  onClose,
  moduleId,
  moduleName,
  walletAddress,
  xpEarned,
  suiEarned,
  quizScore
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

  // Display a normalized quiz score (capped at 100%)
  const normalizedQuizScore = typeof quizScore === 'number' 
    ? Math.min(quizScore, 100) 
    : quizScore || 0;

  // Trigger confetti when popup opens
  useEffect(() => {
    if (isOpen) {
      // Trigger confetti
      confetti({
        particleCount: 200,
        spread: 90,
        origin: { x: 0.5, y: 0.3 }
      });
      
      // Start NFT minting when popup opens if user has a wallet connected
      console.log(`[NFT] Popup opened for module ${moduleId}, wallet address: ${activeWalletAddress}`);
      
      // Reset state on each open
      setMintingSuccess(false);
      setMintingError(null);
      
      // Delay slightly to ensure popup is fully rendered
      setTimeout(() => {
        console.log(`[NFT] Starting mint process for module ${moduleId}`);
        setIsMinting(true);
        mintNFT();
      }, 500);
    }
  }, [isOpen, moduleId, activeWalletAddress]);

  // Handle NFT minting
  const mintNFT = async () => {
    try {
      setMintingError(null);

      console.log(`[NFT] Starting mint for module ${moduleId}, wallet: ${activeWalletAddress}`);
      
      // Extra validation for wallet address
      if (!activeWalletAddress || activeWalletAddress === 'undefined' || activeWalletAddress === 'null') {
        console.error(`[NFT] Invalid wallet address: ${activeWalletAddress}`);
        setMintingError('Invalid wallet address. Please connect your wallet.');
        setIsMinting(false);
        return;
      }
      
      // If wallet isn't connected, show error
      if (!isWalletConnected) {
        console.error(`[NFT] Wallet not connected`);
        setMintingError('Wallet not connected. Please connect your wallet first.');
        setIsMinting(false);
        return;
      }
      
      // Get the transaction to sign
      console.log(`[NFT] Requesting mint transaction for module ${moduleId}`);
      const result = await mintModuleCompletionNFT(activeWalletAddress, moduleId);
      
      if (result.success && result.transaction) {
        console.log(`[NFT] Transaction created successfully, preparing for wallet signing`);
        
        try {
          // We need to convert the TransactionBlock to the format expected by @mysten/dapp-kit
          // First, build the transaction 
          const tx = result.transaction;
          
          // Set the sender address explicitly to avoid the "Missing transaction sender" error
          tx.setSender(activeWalletAddress);
          
          // Build the transaction the way dapp-kit expects it
          const builtTx = await tx.build({ client: suiClient });
          console.log(`[NFT] Transaction built, requesting wallet signature`);
          
          // Sign and execute transaction with the dapp-kit
          const response = await signAndExecuteTransaction.mutateAsync({
            // Pass the built transaction bytes as base64
            transaction: btoa(String.fromCharCode(...new Uint8Array(builtTx)))
          });
          
          console.log(`[NFT] Transaction signed and executed successfully:`, response);
          
          // Get transaction digest
          const txDigest = response.digest;
          console.log(`[NFT] Transaction digest: ${txDigest}`);
          
          // Record the successful mint in Firestore
          await recordSuccessfulMint(
            activeWalletAddress,
            moduleId,
            txDigest
          );
          console.log(`[NFT] Mint recorded in database`);
          
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
          console.error(`[NFT] Wallet error during transaction:`, walletError);
          setMintingError(walletError instanceof Error ? 
            `Wallet error: ${walletError.message}` : 
            'Error during wallet transaction. Please try again.'
          );
        }
      } else {
        console.error(`[NFT] Failed to create transaction:`, result.message);
        
        // Check if this is a duplicate NFT error
        if (result.message && result.message.includes('already own')) {
          setMintingSuccess(true); // Still show success since user has the NFT
          setMintingError(`You already own this NFT. Check your inventory.`);
        } else {
          setMintingError(result.message || 'Failed to create minting transaction');
        }
      }
    } catch (error) {
      console.error(`[NFT] Unexpected error during minting:`, error);
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

  // Add global function for direct access
  useEffect(() => {
    const win = window as any;
    win.showDirectModuleCompletionPopup = (data: any) => {
      
      
      // Extract data or use defaults
      const popupData = {
        moduleId: data.moduleId || 1,
        moduleName: data.moduleName || 'Unknown Module',
        walletAddress: data.walletAddress || 'unknown',
        xpEarned: data.xpEarned || 0,
        suiEarned: data.suiEarned || 0,
        quizScore: data.quizScore || 0
      };
      
      // Force the popup to open by updating state
      setIsMinting(false);
      setMintingSuccess(false);
      setMintingError(null);
      
      // Use setTimeout to ensure this runs after current execution cycle
      setTimeout(() => {
        mintNFT();
      }, 300);
    };
    
    return () => {
      delete (window as any).showDirectModuleCompletionPopup;
    };
  }, []);

  if (!isOpen) return null;

  return (
    <motion.div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm overflow-y-auto py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div 
        className="relative max-w-md w-full bg-card/90 backdrop-blur-md p-6 rounded-xl border border-border shadow-xl mx-4 my-auto"
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0.4 }}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-muted transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
        
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
            <Award className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-1">Mission Complete!</h2>
          <p className="text-muted-foreground">You've completed {moduleName}</p>
        </div>
        
        <div className="module-summary text-center mb-6">
          <h3 className="text-xl font-semibold mb-2">Module Summary</h3>
          <div className="flex justify-center gap-8 mt-4">
            <div className="text-center">
              <span className="text-3xl font-bold text-primary">{xpEarned}</span>
              <p className="text-sm text-muted-foreground">XP Earned</p>
            </div>
            {quizScore !== undefined && (
              <div className="text-center">
                <span className="text-3xl font-bold text-pink-500">
                  {normalizedQuizScore}%
                </span>
                <p className="text-sm text-muted-foreground">Quiz Score</p>
              </div>
            )}
            <div className="text-center">
              <span className="text-3xl font-bold text-blue-400">{suiEarned}</span>
              <p className="text-sm text-muted-foreground">SUI Tokens</p>
            </div>
          </div>
        </div>
        
        <div className="border-t border-border/50 pt-6 mt-4">
          <h3 className="text-xl font-semibold mb-4 text-center">Achievement NFT</h3>
          
          <div className="bg-black/40 rounded-lg p-4 mb-4">
            <div className="aspect-square max-w-[180px] mx-auto relative mb-3 border-2 border-primary/50 rounded-lg overflow-hidden shadow-glow">
              <img 
                src={nftImageUrl} 
                alt="Module Completion NFT" 
                className="w-full h-full object-cover"
              />
              
              {/* Overlay for minting status */}
              {isMinting && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                    <p className="text-sm font-medium">Minting NFT...</p>
                  </div>
                </div>
              )}
              
              {mintingSuccess && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="p-2 rounded-full bg-green-500/20 mb-1">
                    <Check className="h-8 w-8 text-green-500" />
                  </div>
                </div>
              )}
            </div>
            
            <h4 className="text-lg font-semibold text-center mb-1">Module {moduleId} Master</h4>
            <p className="text-sm text-center text-muted-foreground mb-4">
              Awarded for completing {moduleName}
            </p>
            
            <div className="space-y-2">
              {mintingError && (
                <div className="bg-destructive/20 text-destructive text-sm p-3 rounded-md">
                  {mintingError}
                </div>
              )}
              
              {mintingSuccess && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={viewOnExplorer}
                >
                  View on Sui Explorer
                </Button>
              )}
              
              {isMinting && (
                <p className="text-xs text-center text-muted-foreground">
                  Please confirm the transaction in your wallet...
                </p>
              )}
            </div>
          </div>
        </div>
        
        <div className="mt-6 text-center">
          <Button onClick={onClose} className="w-full">
            Continue
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Your progress has been saved
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ModuleCompletionPopup; 