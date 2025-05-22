import { toast } from '@/components/ui/use-toast';
import { useDisconnectWallet } from '@mysten/dapp-kit';

/**
 * Handles wallet disconnection with consistent behavior
 * 
 * @param callback Optional callback to execute after disconnection
 * @returns Function that handles disconnection
 */
export const handleWalletDisconnect = (disconnectMutation: ReturnType<typeof useDisconnectWallet>, callback?: () => void) => {
  return async () => {
    try {
      // Disconnect from the SUI wallet
      await disconnectMutation.mutateAsync();
      
      // Notify user of successful disconnection
      toast({
        title: "Wallet Disconnected",
        description: "Your wallet has been disconnected. Connect again to continue tracking progress.",
        duration: 3000,
      });
      
      // Call the callback if provided
      if (callback) {
        callback();
      }
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
      toast({
        title: "Disconnection Failed",
        description: "There was a problem disconnecting your wallet.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };
};

/**
 * Handles wallet connection with consistent behavior
 * 
 * @param address The wallet address that was connected
 * @param callback Optional callback to execute after connection
 * @param showNotification Whether to show a notification (default: false)
 * @returns Function that handles connection
 */
export const handleWalletConnect = (
  address: string, 
  callback?: (address: string) => void,
  showNotification: boolean = false
) => {
  // Avoid duplicate toasts by checking if we've shown a toast for this address already
  const lastNotifiedAddress = sessionStorage.getItem('lastNotifiedAddress');
  
  // Only show toast if requested AND this is a new address
  if (showNotification && lastNotifiedAddress !== address) {
    // Store the address to avoid duplicate notifications
    sessionStorage.setItem('lastNotifiedAddress', address);
    
    toast({
      title: "Wallet Connected",
      description: "Your wallet has been successfully connected.",
      duration: 2000,
    });
  }
  
  // Call the callback if provided
  if (callback) {
    callback(address);
  }
  
  return address;
}; 