import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { doc, addDoc, collection, serverTimestamp, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase-config';
import { decodeSuiPrivateKey } from '@mysten/sui.js/cryptography';

// Use the same admin key as in services/suiPaymentService.ts
const ADMIN_PRIVATE_KEY = 'suiprivkey1qrcmny2gqtfuptu4u8cusrh7mevdu5nnwe95dhzfkwafrut55tc8wvymdue';

// Initialize Sui client - use testnet by default
const network = import.meta.env.VITE_SUI_NETWORK || 'testnet';
const suiClient = new SuiClient({ url: getFullnodeUrl(network) });

// Default SUI amount for rewards
export const DEFAULT_REWARD_AMOUNT = 0.1; // 0.1 SUI

// Create keypair from admin private key
let adminKeypair: Ed25519Keypair;
try {
  // Use decodeSuiPrivateKey to properly decode the Bech32-encoded private key
  const { secretKey } = decodeSuiPrivateKey(ADMIN_PRIVATE_KEY);
  adminKeypair = Ed25519Keypair.fromSecretKey(secretKey);
  console.log("Successfully created keypair from admin private key in utils");
} catch (error) {
  console.error("Failed to create keypair from provided private key in utils:", error);
  // Fallback to a hex key for development purposes only
  try {
    const fallbackKey = 'f1b9914802d3c0af95e1f1c80efede58de5273764b46dc49b3ba91f174a2f077';
    // Convert hex to Uint8Array for the fallback key
    const fallbackKeyBytes = new Uint8Array(
      fallbackKey.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
    );
    adminKeypair = Ed25519Keypair.fromSecretKey(fallbackKeyBytes);
    console.log("Using fallback key for admin wallet in utils");
  } catch (fallbackError) {
    console.error("Failed to create keypair from fallback key in utils:", fallbackError);
    throw new Error("Could not initialize admin wallet in utils - critical error");
  }
}

const adminAddress = adminKeypair.getPublicKey().toSuiAddress();

// Helper to convert SUI to MIST (the smallest unit)
const suiToMist = (amount: number): bigint => {
  return BigInt(Math.floor(amount * 1_000_000_000));
};

/**
 * Sends SUI from the admin wallet to the recipient
 * 
 * @param recipientAddress The recipient's wallet address
 * @param amount Amount in SUI to send
 * @param reason The reason for the payment (for logging)
 * @returns Object with success status and transaction digest
 */
export const sendSuiReward = async (
  recipientAddress: string, 
  amount: number = DEFAULT_REWARD_AMOUNT, 
  reason: string = 'Challenge Reward'
): Promise<{ success: boolean; txDigest?: string; message?: string }> => {
  try {
    if (!recipientAddress || !amount) {
      return { 
        success: false, 
        message: 'Missing recipient address or amount' 
      };
    }

    console.log(`Processing payment from utils: ${amount} SUI to ${recipientAddress} for ${reason}`);

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

    console.log(`Successfully sent ${amount} SUI to ${recipientAddress}, txDigest: ${result.digest}`);

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

    console.log(`Transaction recorded in Firestore with ID: ${txRef.id}`);

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
    console.error('Error sending SUI tokens:', error);
    
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
      console.error('Failed to log transaction error:', dbError);
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
    console.error('Error checking admin balance:', error);
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