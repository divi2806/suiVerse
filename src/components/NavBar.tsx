import React, { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Rocket, 
  Trophy, 
  Menu, 
  X, 
  Star, 
  CircleCheck, 
  Home as HomeIcon, 
  Book as BookIcon, 
  Trophy as TrophyIcon, 
  Settings as SettingsIcon, 
  Gamepad as GamepadIcon, 
  LayoutDashboard as LayoutDashboardIcon, 
  Package as PackageIcon,
  Bot as BotIcon,
  Award as AwardIcon
} from 'lucide-react';
import { WalletConnect } from './WalletConnect';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from '@/contexts/AuthContext';
import { calculateLevel } from '@/services/learningService';
import { useDisconnectWallet } from '@mysten/dapp-kit';
import { toast } from "@/components/ui/use-toast";

interface NavBarProps {
  connected: boolean;
  onConnect: (address: string) => void;
  onDisconnect: () => void;
  userXp?: number;
  userStreak?: number;
  userLevel?: number;
  username?: string;
  avatarSrc?: string;
}

// NavLink component for consistent navigation styling
const NavLink = memo(({ 
  to, 
  icon, 
  children, 
  exact, 
  onClick 
}: { 
  to: string; 
  icon: React.ReactNode; 
  children: React.ReactNode; 
  exact?: boolean;
  onClick?: () => void;
}) => {
  const location = useLocation();
  const isActive = exact ? location.pathname === to : location.pathname.startsWith(to);
  
  return (
    <Link
      to={to}
      className={`px-3 py-2 rounded-md flex items-center text-sm font-medium transition-colors ${
        isActive 
          ? 'bg-primary/10 text-primary' 
          : 'text-foreground/70 hover:text-primary hover:bg-primary/5'
      }`}
      onClick={onClick}
    >
      {icon}
      {children}
    </Link>
  );
});

NavLink.displayName = 'NavLink';

// User Profile Dropdown component to reduce rerenders
const UserProfileDropdown = memo(({ 
  username, 
  avatarSrc, 
  userLevel, 
  handleConnect,
  handleDisconnect 
}: { 
  username: string, 
  avatarSrc: string, 
  userLevel: number,
  handleConnect: (address: string) => void,
  handleDisconnect: () => void
}) => {
  // Use a stable reference for menu content to prevent infinite rerender loops
  const [open, setOpen] = useState(false);
  
  // Memoize menu content to prevent needless rerenders
  const menuContent = useMemo(() => (
    <DropdownMenuContent align="end" className="galaxy-card mt-2">
      <div className="flex flex-col items-center p-4 space-y-2 border-b border-border">
        <Avatar className="h-16 w-16 border-2 border-primary mb-2">
          <AvatarImage src={avatarSrc} alt={username} />
          <AvatarFallback className="bg-muted text-primary">
            {username.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <p className="font-medium">{username}</p>
        <div className="bg-muted rounded-full px-3 py-0.5 text-xs">
          Level {userLevel} Explorer
        </div>
      </div>
      <DropdownMenuItem asChild>
        <Link to="/profile" className="w-full">Profile</Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link to="/inventory" className="w-full">Inventory</Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link to="/settings" className="w-full">Settings</Link>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => {
        handleDisconnect();
        setOpen(false);
      }}>
        <span className="w-full text-left text-destructive">Disconnect</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  ), [avatarSrc, username, userLevel, handleDisconnect]);
  
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8 border border-primary/30">
            <AvatarImage src={avatarSrc} alt={username} />
            <AvatarFallback className="bg-muted text-primary">
              {username.charAt(0)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      {menuContent}
    </DropdownMenu>
  );
});

UserProfileDropdown.displayName = 'UserProfileDropdown';

const NavBar = memo<NavBarProps>(({
  connected,
  onConnect,
  onDisconnect,
  userXp,
  userStreak,
  userLevel,
  username,
  avatarSrc
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { userData } = useAuth();
  const disconnectMutation = useDisconnectWallet();

  // Track the last connected address to avoid duplicate onConnect calls
  const lastConnectedAddressRef = useRef<string | null>(null);

  // Wrap the onConnect handler to avoid duplicate calls
  const handleConnect = useCallback((address: string) => {
    // Only call onConnect if it's a new address
    if (address !== lastConnectedAddressRef.current) {
      lastConnectedAddressRef.current = address;
      onConnect(address);
    }
  }, [onConnect]);

  const handleDisconnect = useCallback(async () => {
    try {
      // Clear the reference
      lastConnectedAddressRef.current = null;
      
      // Call the disconnect mutation directly
      await disconnectMutation.mutateAsync();
      
      // Call the onDisconnect callback
      onDisconnect();
      
      // Close mobile menu if open
      setMobileMenuOpen(false);
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
      // Show error toast
      toast({
        title: "Disconnection Failed",
        description: "There was a problem disconnecting your wallet.",
        variant: "destructive",
        duration: 3000,
      });
    }
  }, [onDisconnect, disconnectMutation]);

  // Get user data from context or props with proper logging
  const userStats = useMemo(() => {
    // Always prioritize userData.photoURL from context
    const finalAvatarSrc = userData?.photoURL || avatarSrc || 'https://api.dicebear.com/7.x/bottts/svg?seed=fixed';
    
    // Get user XP and calculate level
    const userXpValue = userData?.xp || userXp || 0;
    const calculatedLevel = calculateLevel(userXpValue);
    
    return {
      xp: userXpValue,
      streak: userData?.streak || userStreak || 0,
      level: calculatedLevel, // Use calculated level instead of stored level
      username: userData?.displayName || username || 'Explorer',
      avatarSrc: finalAvatarSrc
    };
  }, [userData, userXp, userStreak, username, avatarSrc]);

  // Memoize the connect wallet button to prevent rerenders
  const connectWalletButton = useMemo(() => (
    <WalletConnect 
      onConnect={handleConnect} 
      onDisconnect={handleDisconnect} 
      connected={false}
      className="neon-button"
    >
      Connect Wallet
    </WalletConnect>
  ), [handleConnect, handleDisconnect]);

  // Memoize the mobile menu to prevent rerenders
  const mobileMenu = useMemo(() => {
    if (!mobileMenuOpen) return null;
    
    return (
      <div className="md:hidden fixed inset-0 z-50 bg-background/95 backdrop-blur-sm">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <Link to="/" className="flex items-center" onClick={() => setMobileMenuOpen(false)}>
              <Rocket className="h-6 w-6 text-primary mr-2" />
              <span className="font-heading text-lg font-bold">SuiVerse</span>
            </Link>
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 rounded-full hover:bg-muted"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              <NavLink 
                to="/" 
                icon={<HomeIcon className="h-5 w-5 mr-3" />}
                exact
                onClick={() => setMobileMenuOpen(false)}
              >
                Home
              </NavLink>
              <NavLink 
                to="/learning" 
                icon={<BookIcon className="h-5 w-5 mr-3" />}
                onClick={() => setMobileMenuOpen(false)}
              >
                Learn
              </NavLink>
              <NavLink 
                to="/games" 
                icon={<GamepadIcon className="h-5 w-5 mr-3" />}
                onClick={() => setMobileMenuOpen(false)}
              >
                Games
              </NavLink>
              <NavLink 
                to="/rewards" 
                icon={<PackageIcon className="h-5 w-5 mr-3" />}
                onClick={() => setMobileMenuOpen(false)}
              >
                Rewards
              </NavLink>
              <NavLink 
                to="/inventory" 
                icon={<LayoutDashboardIcon className="h-5 w-5 mr-3" />}
                onClick={() => setMobileMenuOpen(false)}
              >
                Inventory
              </NavLink>
              <NavLink 
                to="/leaderboard" 
                icon={<TrophyIcon className="h-5 w-5 mr-3" />}
                onClick={() => setMobileMenuOpen(false)}
              >
                Leaderboard
              </NavLink>
              <NavLink 
                to="/blazo" 
                icon={<BotIcon className="h-5 w-5 mr-3" />}
                onClick={() => setMobileMenuOpen(false)}
              >
                Blazo AI
              </NavLink>
            </div>
            
            <div className="mt-8 p-4 border-t border-border">
              {connected ? (
                <div className="flex flex-col space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Avatar className="h-10 w-10 border border-primary/30">
                        <AvatarImage src={userStats.avatarSrc} alt={userStats.username} />
                        <AvatarFallback>{userStats.username.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{userStats.username}</p>
                        <p className="text-xs text-muted-foreground">Level {userStats.level}</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-card p-2 rounded-md text-center">
                      <p className="text-xs text-muted-foreground">Streak</p>
                      <p className="font-medium">{userStats.streak} Days</p>
                    </div>
                    <div className="bg-card p-2 rounded-md text-center">
                      <p className="text-xs text-muted-foreground">XP</p>
                      <p className="font-medium">{userStats.xp}</p>
                    </div>
                  </div>
                  <Button variant="destructive" size="sm" onClick={handleDisconnect}>
                    Disconnect Wallet
                  </Button>
                </div>
              ) : (
                <Button 
                  onClick={() => setMobileMenuOpen(false)} 
                  className="w-full"
                >
                  Connect Wallet
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }, [mobileMenuOpen, connected, userStats, handleDisconnect]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/70 border-b border-border/40">
      <nav className="container mx-auto px-4 flex items-center justify-between h-16">
        {/* Logo */}
        <div className="flex items-center">
          <Link to="/" className="flex items-center">
            <Rocket className="h-6 w-6 text-primary mr-2" />
            <span className="font-heading text-lg font-bold hidden sm:inline-block">
              SuiVerse
            </span>
          </Link>
        </div>
        
        {/* Main Navigation */}
        <div className="hidden md:flex space-x-1">
          <NavLink to="/" exact icon={<HomeIcon className="h-4 w-4 mr-2" />}>
            Home
          </NavLink>
          <NavLink to="/learning" icon={<BookIcon className="h-4 w-4 mr-2" />}>
            Learn
          </NavLink>
          <NavLink to="/games" icon={<GamepadIcon className="h-4 w-4 mr-2" />}>
            Games
          </NavLink>
          <NavLink to="/rewards" icon={<PackageIcon className="h-4 w-4 mr-2" />}>
            Rewards
          </NavLink>
          <NavLink to="/inventory" icon={<LayoutDashboardIcon className="h-4 w-4 mr-2" />}>
            Inventory
          </NavLink>
          <NavLink to="/leaderboard" icon={<TrophyIcon className="h-4 w-4 mr-2" />}>
            Leaderboard
          </NavLink>
          <NavLink to="/blazo" icon={<BotIcon className="h-4 w-4 mr-2" />}>
            Blazo AI
          </NavLink>
        </div>

        {/* User Stats and Profile */}
        <div className="hidden md:flex items-center space-x-4">
          {connected ? (
            <>
              <div className="flex items-center space-x-2">
                <CircleCheck className="h-4 w-4 text-secondary" />
                <span className="text-secondary font-medium">Day {userStats.streak}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Star className="h-4 w-4 text-accent" />
                <span className="text-accent font-medium">{userStats.xp} XP</span>
              </div>
              <UserProfileDropdown 
                username={userStats.username} 
                avatarSrc={userStats.avatarSrc} 
                userLevel={userStats.level}
                handleConnect={handleConnect}
                handleDisconnect={handleDisconnect}
              />
            </>
          ) : (
            connectWalletButton
          )}
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-primary"
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </nav>

      {/* Mobile Navigation */}
      {mobileMenu}
    </header>
  );
});

NavBar.displayName = 'NavBar';

export default NavBar;
