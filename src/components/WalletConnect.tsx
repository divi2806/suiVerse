import { ConnectButton, useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { useEffect, useRef, useState } from 'react';
import { handleWalletDisconnect } from '@/utils/walletHelpers';
import { toast } from '@/components/ui/use-toast';

interface WalletConnectProps {
  onConnect: (address: string) => void;
  onDisconnect: () => void;
  className?: string;
  children?: React.ReactNode;
  connected?: boolean;
}

export const WalletConnect: React.FC<WalletConnectProps> = ({
  onConnect,
  onDisconnect,
  className = 'neon-button',
  children,
  connected = false,
}) => {
  const currentAccount = useCurrentAccount();
  const disconnectMutation = useDisconnectWallet();
  
  // Store the current wallet address to detect real changes
  const walletAddressRef = useRef<string | null>(null);
  
  // Use a single, simplified effect for connection status
  useEffect(() => {
    // Early exit if no account or if we're marked as already connected
    if (!currentAccount || connected) return;
    
    // Only call onConnect if this is a new wallet address we haven't processed yet
    const newAddress = currentAccount.address;
    if (newAddress !== walletAddressRef.current) {
      walletAddressRef.current = newAddress;
      onConnect(newAddress);
    }
  }, [currentAccount, connected, onConnect]);

  // Use the utility function for disconnecting
  const handleDisconnect = async () => {
    try {
      // Clear the wallet address reference first
      walletAddressRef.current = null;
      
      // Call the disconnect mutation directly
      await disconnectMutation.mutateAsync();
      
      // Notify user of successful disconnection
      toast({
        title: "Wallet Disconnected",
        description: "Your wallet has been disconnected. Connect again to continue tracking progress.",
        duration: 3000,
      });
      
      // Call the onDisconnect callback to update parent components
      onDisconnect();
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

  return connected ? (
    <button 
      onClick={handleDisconnect}
      className={className}
      id="connect-wallet-button"
    >
      {children || "Disconnect Wallet"}
    </button>
  ) : (
    <ConnectButton connectText={children || "Connect Wallet"} className={className} id="connect-wallet-button" />
  );
};

export default WalletConnect; 