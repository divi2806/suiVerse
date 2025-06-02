import { SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { 
  doc, 
  addDoc, 
  collection, 
  serverTimestamp, 
  getDoc, 
  setDoc,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase-config';
import logger from '@/utils/logger';
import { defaultNetwork } from '@/lib/sui-config';

// Smart contract details - using testnet package by default
// This should be the deployed package ID on testnet for the NFT contract
const PACKAGE_ID = import.meta.env.VITE_NFT_PACKAGE_ID || '0x3113324e84c22ce4925d642f2c2ead709a8a8aaf0928cd23873ddec6f31a1440';
const MODULE_NAME = 'academy_nfts';
const FUNCTION_NAME = 'mint_achievement_nft_open';

// Initialize Sui client - use testnet by default
const network = import.meta.env.VITE_SUI_NETWORK || defaultNetwork || 'testnet';
const suiClient = new SuiClient({ url: getFullnodeUrl(network) });

// Helper function to get fullnode URL
function getFullnodeUrl(network: string): string {
  switch (network) {
    case 'mainnet':
      return 'https://fullnode.mainnet.sui.io:443';
    case 'testnet':
      return 'https://fullnode.testnet.sui.io:443';
    case 'devnet':
      return 'https://fullnode.devnet.sui.io:443';
    case 'localnet':
      return 'http://127.0.0.1:9000';
    default:
      return 'https://fullnode.testnet.sui.io:443';
  }
}

// Module names and descriptions
const MODULE_DATA = [
  { id: 1, name: "Introduction to Sui", description: "Completed the foundational module on Sui blockchain" },
  { id: 2, name: "Sui Move Basics", description: "Mastered the fundamentals of Move programming language" },
  { id: 3, name: "Object Model", description: "Understood Sui's unique object-centric model" },
  { id: 4, name: "Custom Types", description: "Created and utilized custom types in Move" },
  { id: 5, name: "Ownership & Transfer", description: "Mastered object ownership and transfer mechanisms" },
  { id: 6, name: "Capability Pattern", description: "Implemented secure access control using capabilities" },
  { id: 7, name: "Events & Indexing", description: "Built systems with event emission and indexing" },
  { id: 8, name: "Collections", description: "Managed groups of objects with collection patterns" },
  { id: 9, name: "Dynamic Fields", description: "Utilized dynamic fields for flexible object composition" },
  { id: 10, name: "One-Time Witness", description: "Implemented the one-time witness pattern" },
  { id: 11, name: "Witness Pattern", description: "Secured operations with witness pattern authentication" },
  { id: 12, name: "Publisher Pattern", description: "Managed package publishing and versioning" },
  { id: 13, name: "Shared Objects", description: "Built applications with shared object access" },
  { id: 14, name: "Sui Tokenomics", description: "Understood Sui's economic model and incentives" },
  { id: 15, name: "Advanced Patterns", description: "Implemented sophisticated design patterns in Move" },
  { id: 16, name: "Graduation", description: "Completed the entire SuiVerse Academy curriculum" }
];

/**
 * Creates a transaction block for minting an NFT
 * @param recipientAddress The wallet address of the user receiving the NFT
 * @param moduleId The module ID (1-16)
 * @returns TransactionBlock ready to be executed by the wallet
 */
export const createNFTMintingTransaction = (
  recipientAddress: string,
  moduleId: number | string
): TransactionBlock => {
  logger.log(`[NFT] Creating transaction block for module ${moduleId}, recipient: ${recipientAddress}`);
  logger.log(`[NFT] Using network: ${network}, package ID: ${PACKAGE_ID}`);
  
  // Convert moduleId to a number if it's a string
  const moduleIdNumber = typeof moduleId === 'string' ? 
    parseInt(moduleId.replace(/[^0-9]/g, '')) || 1 : moduleId;
  
  // Ensure moduleId is within valid range (1-16)
  const safeModuleId = Math.max(1, Math.min(16, moduleIdNumber));
  
  logger.log(`[NFT] Converted moduleId: ${moduleId} -> ${safeModuleId}`);
  
  // Get module data
  const moduleData = MODULE_DATA.find(m => m.id === safeModuleId) || {
    name: `Module ${safeModuleId}`,
    description: `Completed module ${safeModuleId}`
  };

  // Generate image URL using DiceBear
  const imageUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=module${safeModuleId}`;
  
  logger.log(`[NFT] Module data: ${moduleData.name}, image URL: ${imageUrl}`);
  logger.log(`[NFT] Using contract: ${PACKAGE_ID}::${MODULE_NAME}::${FUNCTION_NAME}`);
  
  // Create a new transaction block
  const tx = new TransactionBlock();
  
  try {
    // Add the NFT minting transaction using the open minting function
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::${FUNCTION_NAME}`,
      arguments: [
        tx.pure(recipientAddress),
        tx.pure(safeModuleId), // Use the safe numeric moduleId
        tx.pure(moduleData.name),
        tx.pure(moduleData.description),
        tx.pure(imageUrl)
      ]
    });
    
    // Set gas budget to ensure transaction doesn't fail due to gas issues
    tx.setGasBudget(30000000);
    
    logger.log(`[NFT] Transaction block created successfully`);
    return tx;
  } catch (error) {
    logger.error(`[NFT] Error creating transaction block:`, error);
    throw error;
  }
};

/**
 * Mint an achievement NFT for module completion
 * This will create a transaction and return it for the user's wallet to sign
 * @param recipientAddress The wallet address of the user receiving the NFT
 * @param moduleId The module ID (1-16) or module name string
 * @returns Object with transaction status or transaction for wallet to sign
 */
export const mintModuleCompletionNFT = async (
  recipientAddress: string,
  moduleId: number | string
): Promise<{ success: boolean; txDigest?: string; message?: string; nftId?: string; transaction?: TransactionBlock }> => {
  try {
    logger.log(`[NFT] Starting mintModuleCompletionNFT for address: ${recipientAddress}, module: ${moduleId}`);
    
    // Improved address validation
    if (!recipientAddress || typeof recipientAddress !== 'string') {
      logger.error('[NFT] Invalid recipient address format');
      return { 
        success: false, 
        message: 'Invalid recipient address format' 
      };
    }
    
    // Convert moduleId to a number if it's a string
    const moduleIdNumber = typeof moduleId === 'string' ? 
      parseInt(moduleId.replace(/[^0-9]/g, '')) || 1 : moduleId;
    
    // Ensure moduleId is within valid range (1-16)
    const safeModuleId = Math.max(1, Math.min(16, moduleIdNumber));
    
    if (safeModuleId < 1 || safeModuleId > 16) {
      logger.error(`[NFT] Invalid moduleId: ${moduleId} (converted to ${safeModuleId})`);
      return { 
        success: false, 
        message: 'Invalid module ID. Must be between 1 and 16.' 
      };
    }

    // Check if user already has this NFT
    const hasNFT = await hasModuleNFT(recipientAddress, safeModuleId);
    logger.log(`[NFT] User already has NFT for module ${safeModuleId}: ${hasNFT}`);
    
    if (hasNFT) {
      return {
        success: false,
        message: `You already own the NFT for Module ${safeModuleId}. Check your inventory.`
      };
    }
    
    // Create the transaction for the wallet to sign
    logger.log(`[NFT] Creating transaction for module ${safeModuleId}`);
    const transaction = createNFTMintingTransaction(recipientAddress, safeModuleId);
    
    // For backend integration, simply return the transaction for the frontend to sign with user's wallet
    return {
      success: true,
      message: 'Transaction created successfully. Please sign with your wallet.',
      transaction
    };
    
  } catch (error) {
    logger.error('[NFT] Error creating NFT minting transaction:', error);
    
    // Create a fallback transaction as a last resort
    try {
      logger.log(`[NFT] Attempting fallback transaction creation`);
      const safeModuleId = typeof moduleId === 'string' ? 1 : Math.max(1, Math.min(16, moduleId));
      const transaction = createNFTMintingTransaction(recipientAddress, safeModuleId);
      
      return {
        success: true,
        message: 'Transaction created with fallback data. Please sign with your wallet.',
        transaction
      };
    } catch (fallbackError) {
      logger.error('[NFT] Fallback transaction creation failed:', fallbackError);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error creating NFT minting transaction' 
      };
    }
  }
};

/**
 * Record a successful NFT mint in Firestore
 * @param walletAddress User's wallet address
 * @param moduleId Module ID
 * @param txDigest Transaction digest from the blockchain
 * @param nftId ID of the minted NFT object (if available)
 */
export const recordSuccessfulMint = async (
  walletAddress: string,
  moduleId: number | string,
  txDigest: string,
  nftId?: string
) => {
  try {
    // Convert moduleId to a number if it's a string
    const moduleIdNumber = typeof moduleId === 'string' ? 
      parseInt(moduleId.replace(/[^0-9]/g, '')) || 1 : moduleId;
    
    // Ensure moduleId is within valid range (1-16)
    const safeModuleId = Math.max(1, Math.min(16, moduleIdNumber));
    
    const moduleData = MODULE_DATA.find(m => m.id === safeModuleId) || {
      name: `Module ${safeModuleId}`,
      description: `Completed module ${safeModuleId}`
    };
    
    const imageUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=module${safeModuleId}`;
    
    // Create NFT data object without the nftId field initially
    const nftData = {
      userId: walletAddress,
      walletAddress: walletAddress,
      moduleId: safeModuleId,
      moduleName: moduleData.name,
      description: moduleData.description,
      imageUrl: imageUrl,
      txDigest: txDigest,
      network: network,
      timestamp: serverTimestamp()
    };
    
    // Only add nftId to the object if it's defined
    if (nftId !== undefined) {
      Object.assign(nftData, { nftId });
    }
    
    await addDoc(collection(db, 'user_nfts'), nftData);
    
    return true;
  } catch (error) {
    logger.error('[NFT] Error recording successful mint:', error);
    return false;
  }
};

/**
 * Check if user already has an NFT for a specific module
 * @param walletAddress User's wallet address
 * @param moduleId Module ID to check
 * @returns Boolean indicating if the user already has the NFT
 */
export const hasModuleNFT = async (walletAddress: string, moduleId: number | string): Promise<boolean> => {
  try {
    logger.log(`[NFT] Checking if user ${walletAddress} has NFT for module ${moduleId}`);
    
    // Skip check for test wallets
    if (walletAddress === 'test-wallet' || !walletAddress) {
      logger.log('[NFT] Test wallet or empty address detected, returning false');
      return false;
    }
    
    // Convert moduleId to a number if it's a string
    const moduleIdNumber = typeof moduleId === 'string' ? 
      parseInt(moduleId.replace(/[^0-9]/g, '')) || 1 : moduleId;
    
    // Ensure moduleId is within valid range (1-16)
    const safeModuleId = Math.max(1, Math.min(16, moduleIdNumber));
    
    // First, check in Firestore for faster response
    const nftsRef = collection(db, 'user_nfts');
    const q = query(
      nftsRef, 
      where('walletAddress', '==', walletAddress),
      where('moduleId', '==', safeModuleId)
    );
    
    logger.log(`[NFT] Querying Firestore for NFT with moduleId ${safeModuleId} and wallet ${walletAddress}`);
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      logger.log(`[NFT] Found existing NFT in Firestore for module ${safeModuleId}, count: ${querySnapshot.size}`);
      return true;
    }
    
    logger.log(`[NFT] No NFT found in Firestore for module ${safeModuleId}`);
    
    // If not found in Firestore, return false
    return false;
  } catch (error) {
    logger.error(`[NFT] Error checking if user has NFT:`, error);
    return false; // Default to false on error to allow the user to try minting
  }
};

/**
 * Get all NFTs owned by a user
 * @param walletAddress User's wallet address
 * @returns Array of NFT objects
 */
export const getUserNFTs = async (walletAddress: string) => {
  try {
    // Query user_nfts collection for the user's NFTs
    const nftsRef = collection(db, 'user_nfts');
    const q = query(nftsRef, where('walletAddress', '==', walletAddress));
    const querySnapshot = await getDocs(q);
    
    const nfts = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore timestamp to JS Date
      timestamp: doc.data().timestamp?.toDate() || new Date(),
    }));
    
    return nfts;
  } catch (error) {
    logger.error('[NFT] Error getting user NFTs:', error);
    return [];
  }
};

export default {
  mintModuleCompletionNFT,
  createNFTMintingTransaction,
  recordSuccessfulMint,
  hasModuleNFT,
  getUserNFTs
}; 