import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui.js/cryptography';

// Test function to verify our key decoding works correctly
export function testKeyDecoding() {
  const privateKey = 'suiprivkey1qrcmny2gqtfuptu4u8cusrh7mevdu5nnwe95dhzfkwafrut55tc8wvymdue';
  
  try {
    // Using the recommended method from SUI documentation
    const { secretKey } = decodeSuiPrivateKey(privateKey);
    const keypair = Ed25519Keypair.fromSecretKey(secretKey);
    
    // Log the public address to verify it matches the expected one
    const address = keypair.getPublicKey().toSuiAddress();
    console.log('Successfully decoded private key');
    console.log('Generated address:', address);
    
    return {
      success: true,
      address
    };
  } catch (error) {
    console.error('Error decoding private key:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Also test the fallback method
export function testFallbackMethod() {
  const fallbackKey = 'f1b9914802d3c0af95e1f1c80efede58de5273764b46dc49b3ba91f174a2f077';
  
  try {
    // Convert hex to Uint8Array for the fallback key
    const fallbackKeyBytes = new Uint8Array(
      fallbackKey.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
    );
    
    const keypair = Ed25519Keypair.fromSecretKey(fallbackKeyBytes);
    const address = keypair.getPublicKey().toSuiAddress();
    
    console.log('Successfully created keypair from fallback key');
    console.log('Fallback address:', address);
    
    return {
      success: true,
      address
    };
  } catch (error) {
    console.error('Error with fallback method:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
} 