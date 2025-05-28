import { getFullnodeUrl, SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { doc, addDoc, collection, serverTimestamp, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase-config';
import { decodeSuiPrivateKey } from '@mysten/sui.js/cryptography';

// Admin wallet details (PRODUCTION READY - using the admin wallet private key)
const ADMIN_PRIVATE_KEY = 'suiprivkey1qrcmny2gqtfuptu4u8cusrh7mevdu5nnwe95dhzfkwafrut55tc8wvymdue';

// Initialize Sui client - use testnet by default
const network = import.meta.env.VITE_SUI_NETWORK || 'testnet';
const suiClient = new SuiClient({ url: getFullnodeUrl(network) });

// Create keypair from admin private key
let adminKeypair: Ed25519Keypair;
try {
  // Use decodeSuiPrivateKey to properly decode the Bech32-encoded private key
  const { secretKey } = decodeSuiPrivateKey(ADMIN_PRIVATE_KEY);
  adminKeypair = Ed25519Keypair.fromSecretKey(secretKey);
  
} catch (error) {
  
  // Fallback to a hex key for development purposes only
  try {
    const fallbackKey = 'f1b9914802d3c0af95e1f1c80efede58de5273764b46dc49b3ba91f174a2f077';
    // Convert hex to Uint8Array for the fallback key
    const fallbackKeyBytes = new Uint8Array(
      fallbackKey.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
    );
    adminKeypair = Ed25519Keypair.fromSecretKey(fallbackKeyBytes);
    
  } catch (fallbackError) {
    
    throw new Error("Could not initialize admin wallet - critical error");
  }
}

const adminAddress = adminKeypair.getPublicKey().toSuiAddress();

/**
 * Send SUI tokens from the admin wallet to a user wallet
 * @param recipientAddress The wallet address of the user receiving SUI
 * @param amount Amount of SUI to send (in SUI units, not MIST) - e.g., 0.1 for 0.1 SUI
 * @param reason Reason for the payment, used for transaction tracking
 * @returns Object with transaction status
 */
export const sendSuiReward = async (
  recipientAddress: string,
  amount: number,
  reason: string
): Promise<{ success: boolean; txDigest?: string; message?: string }> => {
  try {
    if (!recipientAddress || !amount) {
      return { 
        success: false, 
        message: 'Missing recipient address or amount' 
      };
    }

    

    // Convert SUI to MIST (1 SUI = 10^9 MIST)
    const amountInMist = BigInt(Math.floor(amount * 1_000_000_000));
    
    // Create a new transaction block
    const tx = new TransactionBlock();
    
    // Add the SUI transfer transaction
    tx.transferObjects([
      tx.splitCoins(tx.gas, [tx.pure(amountInMist)])
    ], tx.pure(recipientAddress));
    
    // Sign and execute the transaction
    const result = await suiClient.signAndExecuteTransactionBlock({
      transactionBlock: tx,
      signer: adminKeypair,
    });

    

    // Store transaction record in Firestore
    const txRef = await addDoc(collection(db, 'transactions'), {
      from: adminAddress,
      to: recipientAddress,
      walletAddress: recipientAddress,
      amount: amount,
      amountInMist: amountInMist.toString(),
      reason: reason,
      network: network,
      txDigest: result.digest,
      status: 'success',
      timestamp: serverTimestamp()
    });

    

    // Update user's SUI token balance in their profile
    const userProfileRef = doc(db, 'learningProgress', recipientAddress);
    await updateDoc(userProfileRef, {
      suiTokens: increment(amount),
      totalSuiEarned: increment(amount),
      lastReward: serverTimestamp()
    });

    // Also record the reward in user rewards collection for tracking
    await addDoc(collection(db, 'user_rewards'), {
      userId: recipientAddress,
      amount: amount,
      reason: reason,
      txDigest: result.digest,
      timestamp: serverTimestamp()
    });

    return { 
      success: true, 
      txDigest: result.digest 
    };
  } catch (error) {
    
    
    // Store failed transaction attempt
    try {
      await addDoc(collection(db, 'failed_transactions'), {
        from: adminAddress,
        to: recipientAddress,
        amount: amount,
        reason: reason,
        error: JSON.stringify(error),
        timestamp: serverTimestamp()
      });
    } catch (dbError) {
      
    }
    
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error sending SUI tokens' 
    };
  }
};

/**
 * Check the SUI balance of the admin wallet
 * @returns The balance in SUI
 */
export const checkAdminBalance = async (): Promise<number> => {
  try {
    const balance = await suiClient.getBalance({
      owner: adminAddress,
    });
    
    // Convert balance from MIST to SUI
    return Number(balance.totalBalance) / 1_000_000_000;
  } catch (error) {
    
    return 0;
  }
};

/**
 * Check if a Sui address is valid
 * @param address The address to validate
 * @returns Whether the address is valid
 */
export const isValidSuiAddress = (address: string): boolean => {
  if (!address) return false;
  
  // Validate format (0x followed by 64 hex characters)
  const addressRegex = /^0x[a-fA-F0-9]{64}$/;
  return addressRegex.test(address);
};

export default {
  sendSuiReward,
  checkAdminBalance,
  isValidSuiAddress,
  adminAddress // Expose admin address for verification purposes
}; 