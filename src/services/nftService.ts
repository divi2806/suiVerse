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

// Smart contract details
const PACKAGE_ID = '0x3113324e84c22ce4925d642f2c2ead709a8a8aaf0928cd23873ddec6f31a1440';

// Initialize Sui client - use testnet by default
const network = import.meta.env.VITE_SUI_NETWORK || 'testnet';
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
  moduleId: number
): TransactionBlock => {
  console.log(`[NFT] Creating transaction block for module ${moduleId}, recipient: ${recipientAddress}`);
  
  // Get module data
  const moduleData = MODULE_DATA.find(m => m.id === moduleId) || {
    name: `Module ${moduleId}`,
    description: `Completed module ${moduleId}`
  };

  // Generate image URL using DiceBear
  const imageUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=module${moduleId}`;
  
  console.log(`[NFT] Module data: ${moduleData.name}, image URL: ${imageUrl}`);
  console.log(`[NFT] Using contract: ${PACKAGE_ID}`);
  
  // Create a new transaction block
  const tx = new TransactionBlock();
  
  // Add the NFT minting transaction using the open minting function
  tx.moveCall({
    target: `${PACKAGE_ID}::academy_nfts::mint_achievement_nft_open`,
    arguments: [
      tx.pure(recipientAddress),
      tx.pure(moduleId),
      tx.pure(moduleData.name),
      tx.pure(moduleData.description),
      tx.pure(imageUrl)
    ]
  });

  console.log(`[NFT] Transaction block created successfully`);
  return tx;
};

/**
 * Mint an achievement NFT for module completion
 * This will create a transaction and return it for the user's wallet to sign
 * @param recipientAddress The wallet address of the user receiving the NFT
 * @param moduleId The module ID (1-16)
 * @returns Object with transaction status or transaction for wallet to sign
 */
export const mintModuleCompletionNFT = async (
  recipientAddress: string,
  moduleId: number
): Promise<{ success: boolean; txDigest?: string; message?: string; nftId?: string; transaction?: TransactionBlock }> => {
  try {
    console.log(`[NFT] Starting mintModuleCompletionNFT for address: ${recipientAddress}, module: ${moduleId}`);
    
    // Improved address validation
    if (!recipientAddress || typeof recipientAddress !== 'string') {
      console.error('[NFT] Invalid recipient address format');
      return { 
        success: false, 
        message: 'Invalid recipient address format' 
      };
    }
    
    if (moduleId < 1 || moduleId > 16) {
      console.error(`[NFT] Invalid moduleId: ${moduleId}`);
      return { 
        success: false, 
        message: 'Invalid module ID. Must be between 1 and 16.' 
      };
    }

    // Check if user already has this NFT
    const hasNFT = await hasModuleNFT(recipientAddress, moduleId);
    console.log(`[NFT] User already has NFT for module ${moduleId}: ${hasNFT}`);
    
    if (hasNFT) {
      return {
        success: false,
        message: `You already own the NFT for Module ${moduleId}. Check your inventory.`
      };
    }
    
    // Create the transaction for the wallet to sign
    console.log(`[NFT] Creating transaction for module ${moduleId}`);
    const transaction = createNFTMintingTransaction(recipientAddress, moduleId);
    
    // For backend integration, simply return the transaction for the frontend to sign with user's wallet
    return {
      success: true,
      message: 'Transaction created successfully. Please sign with your wallet.',
      transaction
    };
    
  } catch (error) {
    console.error('[NFT] Error creating NFT minting transaction:', error);
    
    // Create a fallback transaction as a last resort
    try {
      console.log(`[NFT] Attempting fallback transaction creation`);
      const transaction = createNFTMintingTransaction(recipientAddress, moduleId);
      
      return {
        success: true,
        message: 'Transaction created with fallback data. Please sign with your wallet.',
        transaction
      };
    } catch (fallbackError) {
      console.error('[NFT] Fallback transaction creation failed:', fallbackError);
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
  moduleId: number,
  txDigest: string,
  nftId?: string
) => {
  try {
    const moduleData = MODULE_DATA.find(m => m.id === moduleId) || {
      name: `Module ${moduleId}`,
      description: `Completed module ${moduleId}`
    };
    
    const imageUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=module${moduleId}`;
    
    // Create NFT data object without the nftId field initially
    const nftData = {
      userId: walletAddress,
      walletAddress: walletAddress,
      moduleId: moduleId,
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
    
    return false;
  }
};

/**
 * Check if user already has an NFT for a specific module
 * @param walletAddress User's wallet address
 * @param moduleId Module ID to check
 * @returns Boolean indicating if user has the NFT
 */
export const hasModuleNFT = async (walletAddress: string, moduleId: number): Promise<boolean> => {
  try {
    console.log(`[NFT] Checking if user ${walletAddress} has NFT for module ${moduleId}`);
    
    // Query Firestore for existing NFT records
    const nftsSnapshot = await getDocs(
      query(
        collection(db, 'user_nfts'),
        where('walletAddress', '==', walletAddress),
        where('moduleId', '==', moduleId)
      )
    );
    
    const hasNFTInFirestore = !nftsSnapshot.empty;
    
    if (hasNFTInFirestore) {
      console.log(`[NFT] Found existing NFT in Firestore for module ${moduleId}`);
      return true;
    }
    
    // Additional check if needed for on-chain verification
    // This would be a more complex implementation involving querying the blockchain
    
    return false;
  } catch (error) {
    console.error(`[NFT] Error checking if user has NFT:`, error);
    // Default to false to allow minting - better user experience than blocking incorrectly
    return false;
  }
};

/**
 * Get all NFTs owned by a user
 * @param walletAddress User's wallet address
 * @returns Array of NFT objects
 */
export const getUserNFTs = async (walletAddress: string) => {
  try {
    const nftsSnapshot = await getDocs(
      query(
        collection(db, 'user_nfts'),
        where('walletAddress', '==', walletAddress)
      )
    );
    
    return nftsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    
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