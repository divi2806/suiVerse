import { ConnectButton, useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { useEffect, useRef, useState } from 'react';
import { handleWalletDisconnect } from '@/utils/walletHelpers';

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
  const handleDisconnect = () => {
    walletAddressRef.current = null;
    handleWalletDisconnect(disconnectMutation, onDisconnect)();
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