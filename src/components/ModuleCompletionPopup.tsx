import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Award, X, Loader2, Check, ChevronDown, ChevronUp, Star, Coins, Trophy } from 'lucide-react';
import confetti from 'canvas-confetti';
import { mintModuleCompletionNFT, recordSuccessfulMint, hasModuleNFT } from '@/services/nftService';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { defaultNetwork } from '@/lib/sui-config';
import logger from '@/utils/logger';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { SuiClient } from '@mysten/sui.js/client';
import { useNavigate } from 'react-router-dom';
import { XP_REWARDS } from '@/constants/xpRewards';
import { 
  Achievement, 
  ACHIEVEMENTS, 
  checkAchievements, 
  unlockAchievement 
} from '@/services/achievementsService';

// Initialize Sui client
const network = import.meta.env.VITE_SUI_NETWORK || defaultNetwork;
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
  correctAnswers?: number;
  totalQuestions?: number;
  onReturnToMap?: () => void;
}

const ModuleCompletionPopup: React.FC<ModuleCompletionPopupProps> = ({
  isOpen,
  onClose,
  moduleId,
  moduleName,
  walletAddress,
  xpEarned,
  suiEarned,
  quizScore,
  correctAnswers,
  totalQuestions,
  onReturnToMap
}) => {
  // State for NFT minting
  const [isMinting, setIsMinting] = useState(false);
  const [mintingSuccess, setMintingSuccess] = useState(false);
  const [mintingError, setMintingError] = useState<string | null>(null);
  const [nftId, setNftId] = useState<string | null>(null);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [hasCheckedExistingNFT, setHasCheckedExistingNFT] = useState(false);
  
  // Achievement states
  const [unlockedAchievements, setUnlockedAchievements] = useState<Achievement[]>([]);
  const [isCheckingAchievements, setIsCheckingAchievements] = useState(false);
  
  // Ref to track minting state across renders
  const isMintingRef = useRef(false);
  
  // Get current account from dapp-kit
  const currentAccount = useCurrentAccount();
  const signAndExecuteTransaction = useSignAndExecuteTransaction();
  const navigate = useNavigate();
  
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

  // Toast hook for notifications
  const { toast } = useToast();

  const [isProcessingContinue, setIsProcessingContinue] = useState(false);
  const [isProcessingReturn, setIsProcessingReturn] = useState(false);
  const [showXpBreakdown, setShowXpBreakdown] = useState(false);

  // Calculate estimated XP breakdown (for display purposes)
  const xpBreakdown = {
    base: XP_REWARDS.COMPLETE_MODULE,
    quiz: quizScore ? Math.floor(quizScore * 0.5) : 0, // Up to 50 XP for 100% quiz score
    flashcards: Math.min(15 * 2, 30), // Estimate 15 flashcards at 2 XP each, max 30
    challenges: 20, // Estimate 1 challenge at 20 XP
    total: xpEarned
  };

  // Check for achievements related to module completion
  useEffect(() => {
    const checkModuleAchievements = async () => {
      if (!isOpen || !activeWalletAddress || isCheckingAchievements) return;
      
      try {
        setIsCheckingAchievements(true);
        
        // Check if this is the first module completion
        if (moduleId === 1) {
          const firstModuleResult = await unlockAchievement(activeWalletAddress, 'first_module');
          if (firstModuleResult.success && !firstModuleResult.alreadyUnlocked && firstModuleResult.achievement) {
            setUnlockedAchievements(prev => [...prev, firstModuleResult.achievement]);
          }
        }
        
        // Check for general module completion achievements
        const newAchievements = await checkAchievements(activeWalletAddress);
        if (newAchievements.length > 0) {
          setUnlockedAchievements(prev => [...prev, ...newAchievements]);
        }
        
        // Check for perfect quiz achievement if applicable
        if (quizScore === 100) {
          const perfectQuizAchievement = ACHIEVEMENTS.find(a => a.id === 'perfect_quiz');
          if (perfectQuizAchievement) {
            const result = await unlockAchievement(activeWalletAddress, 'perfect_quiz');
            if (result.success && !result.alreadyUnlocked && result.achievement) {
              setUnlockedAchievements(prev => [...prev, result.achievement]);
            }
          }
        }
        
        setIsCheckingAchievements(false);
      } catch (error) {
        logger.error('[Achievements] Error checking achievements:', error);
        setIsCheckingAchievements(false);
      }
    };
    
    checkModuleAchievements();
  }, [isOpen, activeWalletAddress, moduleId, quizScore]);

  // Define mintNFT with useCallback to avoid dependency issues
  const mintNFT = useCallback(async () => {
    try {
      // Don't proceed if already minting
      if (isMintingRef.current) {
        logger.log('[NFT] Minting already in progress, skipping duplicate request');
        return;
      }
      
      // Set minting state
      setIsMinting(true);
      isMintingRef.current = true;
      setMintingError(null);

      logger.log(`[NFT] Starting mint for module ${moduleId}, wallet: ${activeWalletAddress}`);
      
      // Extra validation for wallet address
      if (!activeWalletAddress || activeWalletAddress === 'undefined' || activeWalletAddress === 'null' || activeWalletAddress === 'test-wallet') {
        logger.error(`[NFT] Invalid wallet address: ${activeWalletAddress}`);
        setMintingError('Invalid wallet address. Please connect your wallet.');
        setIsMinting(false);
        isMintingRef.current = false;
        return;
      }
      
      // If wallet isn't connected, show error
      if (!isWalletConnected) {
        logger.error(`[NFT] Wallet not connected`);
        setMintingError('Wallet not connected. Please connect your wallet first.');
        setIsMinting(false);
        isMintingRef.current = false;
        return;
      }
      
      // Check if user already has this NFT
      logger.log(`[NFT] Checking if user already has NFT for module ${moduleId}`);
      const userHasNFT = await hasModuleNFT(activeWalletAddress, moduleId);
      logger.log(`[NFT] Has NFT check result: ${userHasNFT}`);
      
      if (userHasNFT) {
        logger.log(`[NFT] User already has NFT for module ${moduleId}, skipping mint`);
        setMintingSuccess(true);
        setMintingError("You already own this NFT. Check your inventory.");
        setIsMinting(false);
        isMintingRef.current = false;
        return;
      }
      
      // Get the transaction to sign
      logger.log(`[NFT] Requesting mint transaction for module ${moduleId}`);
      const result = await mintModuleCompletionNFT(activeWalletAddress, moduleId);
      logger.log(`[NFT] Mint transaction result:`, result);
      
      if (result.success && result.transaction) {
        logger.log(`[NFT] Transaction created successfully, preparing for wallet signing`);
        
        try {
          // We need to convert the TransactionBlock to the format expected by @mysten/dapp-kit
          // First, build the transaction 
          const tx = result.transaction;
          
          // Set the sender address explicitly to avoid the "Missing transaction sender" error
          tx.setSender(activeWalletAddress);
          logger.log(`[NFT] Set transaction sender to: ${activeWalletAddress}`);
          
          // Build the transaction the way dapp-kit expects it
          const builtTx = await tx.build({ client: suiClient });
          logger.log(`[NFT] Transaction built, requesting wallet signature`);
          
          toast({
            title: "Confirm in Wallet",
            description: "Please confirm the NFT minting transaction in your wallet",
            duration: 10000,
          });
          
          // Sign and execute transaction with the dapp-kit
          logger.log(`[NFT] Calling signAndExecuteTransaction.mutateAsync`);
          const response = await signAndExecuteTransaction.mutateAsync({
            // Pass the built transaction bytes as base64
            transaction: btoa(String.fromCharCode(...new Uint8Array(builtTx)))
          });
          
          logger.log(`[NFT] Transaction signed and executed successfully:`, response);
          
          // Get transaction digest
          const txDigest = response.digest;
          logger.log(`[NFT] Transaction digest: ${txDigest}`);
          
          // Record the successful mint in Firestore
          logger.log(`[NFT] Recording successful mint in Firestore`);
          await recordSuccessfulMint(
            activeWalletAddress,
            moduleId,
            txDigest
          );
          logger.log(`[NFT] Mint recorded in database`);
          
          // Update UI state
          setMintingSuccess(true);
          setTxDigest(txDigest);
          
          // Show success toast
          toast({
            title: "NFT Minted Successfully",
            description: "Your achievement NFT has been minted to your wallet",
            duration: 5000,
          });
          
          // Trigger lighter confetti for successful minting
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { x: 0.5, y: 0.5 },
            gravity: 1.2,
            scalar: 0.7,
            disableForReducedMotion: true
          });
        } catch (walletError) {
          logger.error(`[NFT] Wallet error during transaction:`, walletError);
          
          // Check if user rejected transaction
          const errorMessage = walletError instanceof Error ? walletError.message : String(walletError);
          logger.error(`[NFT] Error message: ${errorMessage}`);
          
          if (errorMessage.includes('User rejected')) {
            setMintingError('Transaction was rejected. You can try again or continue without minting.');
            toast({
              title: "Transaction Rejected",
              description: "You rejected the NFT minting transaction",
              duration: 5000,
              variant: "destructive"
            });
          } else {
            setMintingError(errorMessage.includes('Error') ? 
              errorMessage : 
              'Error during wallet transaction. Please try again.');
            toast({
              title: "Minting Failed",
              description: "There was an error minting your NFT. You can try again.",
              duration: 5000,
              variant: "destructive"
            });
          }
        }
      } else {
        logger.error(`[NFT] Failed to create transaction:`, result.message);
        
        // Check if this is a duplicate NFT error
        if (result.message && result.message.includes('already own')) {
          setMintingSuccess(true); // Still show success since user has the NFT
          setMintingError(`You already own this NFT. Check your inventory.`);
        } else {
          setMintingError(result.message || 'Failed to create minting transaction');
        }
      }
    } catch (error) {
      logger.error(`[NFT] Unexpected error during minting:`, error);
      setMintingError(error instanceof Error ? error.message : 'An unexpected error occurred');
      toast({
        title: "Minting Error",
        description: "There was an unexpected error during the minting process",
        duration: 5000,
        variant: "destructive"
      });
    } finally {
      setIsMinting(false);
      isMintingRef.current = false;
    }
  }, [activeWalletAddress, isWalletConnected, moduleId, signAndExecuteTransaction, toast]);

  // Check if user already has this NFT when the popup opens
  useEffect(() => {
    const checkExistingNFT = async () => {
      if (!isOpen || !activeWalletAddress || hasCheckedExistingNFT) return;
      
      try {
        logger.log(`[NFT] Checking if user already has NFT for module ${moduleId}`);
        const userHasNFT = await hasModuleNFT(activeWalletAddress, moduleId);
        
        if (userHasNFT) {
          logger.log(`[NFT] User already has NFT for module ${moduleId}`);
          setMintingSuccess(true);
          setMintingError("You already own this NFT. Check your inventory.");
        } else {
          logger.log(`[NFT] User does not have NFT for module ${moduleId}, can proceed with minting`);
        }
        
        setHasCheckedExistingNFT(true);
      } catch (error) {
        logger.error(`[NFT] Error checking for existing NFT:`, error);
      }
    };
    
    checkExistingNFT();
  }, [isOpen, activeWalletAddress, moduleId, hasCheckedExistingNFT]);

  // Effect to handle popup open/close and NFT minting
  useEffect(() => {
    // Only run when popup is opened and wallet is connected
    if (isOpen && activeWalletAddress && !isMintingRef.current && !mintingSuccess && !mintingError) {
      // Trigger confetti for module completion
      confetti({
        particleCount: 80,
        spread: 50,
        origin: { x: 0.5, y: 0.3 },
        gravity: 1.2, // Make particles fall faster
        scalar: 0.8, // Make particles smaller
        disableForReducedMotion: true // Disable for reduced motion settings
      });
      
      logger.log(`[NFT] Popup opened for module ${moduleId}, wallet address: ${activeWalletAddress}`);
      
      // Validate the wallet address before proceeding
      if (activeWalletAddress === 'test-wallet' || !activeWalletAddress) {
        logger.error(`[NFT] Invalid wallet address for minting: ${activeWalletAddress}`);
        setMintingError('Please connect a valid wallet to mint NFTs.');
            return;
          }
      
      // Delay slightly to ensure popup is fully rendered
      const timer = setTimeout(() => {
        if (!mintingSuccess && !mintingError && isWalletConnected) {
          logger.log(`[NFT] Starting NFT minting process for module ${moduleId}`);
          // Start the minting process
          mintNFT();
        } else if (!isWalletConnected) {
          logger.error('[NFT] Wallet not connected, cannot mint NFT');
          setMintingError('Wallet not connected. Please connect your wallet to mint NFTs.');
        }
      }, 1000);
      
      // Clean up timeout to prevent memory leaks
      return () => {
        clearTimeout(timer);
      };
    }
    
    // Reset the ref when popup is closed
    if (!isOpen) {
      isMintingRef.current = false;
      setHasCheckedExistingNFT(false);
      setMintingError(null);
    }
  }, [isOpen, activeWalletAddress, mintNFT, isWalletConnected, mintingSuccess, mintingError, moduleId]);

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

  // Try minting again if it failed
  const handleRetryMint = () => {
    if (!isMinting && !mintingSuccess) {
      setMintingError(null);
          mintNFT();
        }
  };

  // Handle continuing to next module
  const handleContinue = async () => {
    setIsProcessingContinue(true);
    
    // Show toast notification for XP and SUI rewards
    toast({
      title: "Rewards Added!",
      description: `${xpEarned} XP and ${suiEarned} SUI tokens have been added to your account.`,
      duration: 3000,
    });
    
    // Simulate a short delay to show loading state
    setTimeout(() => {
      setIsProcessingContinue(false);
      onClose();
    }, 1000);
  };

  // Handle returning to galaxy map
  const handleReturnToMap = () => {
    setIsProcessingReturn(true);
    
    // Show toast notification for XP and SUI rewards
    toast({
      title: "Rewards Added!",
      description: `${xpEarned} XP and ${suiEarned} SUI tokens have been added to your account.`,
      duration: 3000,
    });
    
    // Simulate a short delay to show loading state
    setTimeout(() => {
      setIsProcessingReturn(false);
      if (onReturnToMap) {
        onReturnToMap();
      } else {
        navigate('/learning');
      }
      onClose();
    }, 1000);
  };

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
          disabled={isProcessingContinue || isProcessingReturn}
        >
          <X className="h-5 w-5" />
        </button>
        
        <div className="text-center mb-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-3">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-1">Congratulations, Cadet!</h2>
          <p className="text-muted-foreground">You've completed {moduleName}</p>
        </div>
        
        {/* NFT and Module Completion Details */}
          <div className="bg-black/40 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-4">
            {/* NFT Image */}
            <div className="relative w-24 h-24 border-2 border-primary/50 rounded-lg overflow-hidden shadow-glow">
              <img 
                src={nftImageUrl} 
                alt="Module Completion NFT" 
                className="w-full h-full object-cover"
              />
              
              {/* Overlay for minting status */}
              {isMinting && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
              
              {mintingSuccess && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="p-1 rounded-full bg-green-500/20">
                    <Check className="h-5 w-5 text-green-500" />
                  </div>
                </div>
              )}
            </div>
            
            {/* Module completion info */}
            <div className="flex-1">
              <h4 className="font-semibold text-sm">Module {moduleId} Master</h4>
              <p className="text-xs text-muted-foreground mb-2">
                Achievement NFT for {moduleName}
              </p>
              
              <div className="flex gap-3 text-sm">
                <div className="flex items-center text-yellow-500">
                  <Star className="h-4 w-4 mr-1" />
                  <span>{xpEarned} XP</span>
                </div>
                <div className="flex items-center text-blue-400">
                  <Coins className="h-4 w-4 mr-1" />
                  <span>{suiEarned} SUI</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Quiz Results */}
          {quizScore !== undefined && (
            <div className="mt-4 pt-3 border-t border-white/10">
              <div className="flex justify-between items-center">
                <h4 className="font-medium text-sm">Quiz Performance</h4>
                <span className="text-sm font-bold text-pink-500">{normalizedQuizScore}%</span>
              </div>
              {correctAnswers !== undefined && totalQuestions !== undefined && (
                <p className="text-xs text-muted-foreground mt-1">
                  You answered {correctAnswers} out of {totalQuestions} questions correctly
                </p>
              )}
            </div>
          )}
          
          {/* XP Breakdown Toggle */}
          <div className="mt-3">
            <button 
              onClick={() => setShowXpBreakdown(!showXpBreakdown)}
              className="text-xs text-primary/70 hover:text-primary flex items-center"
            >
              {showXpBreakdown ? (
                <>Hide XP breakdown <ChevronUp className="h-3 w-3 ml-1" /></>
              ) : (
                <>View XP breakdown <ChevronDown className="h-3 w-3 ml-1" /></>
              )}
            </button>
          </div>
          
          {/* XP Breakdown */}
          {showXpBreakdown && (
            <motion.div 
              className="mt-2 p-3 bg-primary/5 rounded-lg text-left"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base module completion:</span>
                  <span className="font-medium">{xpBreakdown.base} XP</span>
                </div>
                {quizScore !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quiz performance bonus:</span>
                    <span className="font-medium">{xpBreakdown.quiz} XP</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Flashcard mastery bonus:</span>
                  <span className="font-medium">~{xpBreakdown.flashcards} XP</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Alien challenges bonus:</span>
                  <span className="font-medium">~{xpBreakdown.challenges} XP</span>
                </div>
                <div className="border-t border-primary/10 pt-1 mt-1 flex justify-between font-medium">
                  <span>Total:</span>
                  <span>{xpBreakdown.total} XP</span>
                </div>
              </div>
            </motion.div>
          )}
          
          {/* Minting status and buttons */}
          <div className="space-y-2 mt-3">
            {mintingError && (
              <div className="bg-destructive/20 text-destructive text-xs p-2 rounded-md">
                {mintingError}
                </div>
              )}
              
            {mintingSuccess && txDigest && (
                <Button 
                  variant="outline" 
                  size="sm" 
                className="w-full text-xs"
                  onClick={viewOnExplorer}
                >
                  View on Sui Explorer
                </Button>
              )}
            
            {mintingError && !mintingSuccess && !isMinting && isWalletConnected && (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs"
                onClick={handleRetryMint}
              >
                Retry Minting
              </Button>
            )}
              
              {isMinting && (
                <p className="text-xs text-center text-muted-foreground">
                  Please confirm the transaction in your wallet...
                </p>
              )}
            </div>
        </div>
        
        {/* Unlocked achievements section */}
        {unlockedAchievements.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-2">Achievements Unlocked</h3>
            <div className="space-y-2">
              {unlockedAchievements.map((achievement, index) => (
                <motion.div 
                  key={achievement.id}
                  className="bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/30 rounded-lg p-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                >
                  <div className="flex items-center gap-2">
                    <div className="bg-background/40 p-1.5 rounded-full">
                      <Award className={`h-4 w-4 ${achievement.iconColor}`} />
                    </div>
                    <div>
                      <h4 className="font-medium text-xs">{achievement.title}</h4>
                      <p className="text-xs text-muted-foreground">{achievement.description}</p>
                      <div className="flex gap-2 mt-0.5">
                        <span className="text-xs flex items-center text-yellow-500">
                          <Star className="h-3 w-3 mr-0.5" />
                          {achievement.xpReward} XP
                        </span>
                        {achievement.suiReward > 0 && (
                          <span className="text-xs flex items-center text-blue-400">
                            <Coins className="h-3 w-3 mr-0.5" />
                            {achievement.suiReward} SUI
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
          </div>
        </div>
        )}
        
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <Button 
            onClick={handleContinue} 
            className="flex-1"
            disabled={isProcessingContinue || isProcessingReturn}
          >
            {isProcessingContinue ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Continue'
            )}
          </Button>
          <Button 
            onClick={handleReturnToMap} 
            variant="outline" 
            className="flex-1"
            disabled={isProcessingContinue || isProcessingReturn}
          >
            {isProcessingReturn ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Return to Galaxy Map'
            )}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ModuleCompletionPopup; 