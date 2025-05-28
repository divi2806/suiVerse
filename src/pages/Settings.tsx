import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import NavBar from '@/components/NavBar';
import StarField from '@/components/StarField';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { handleWalletConnect, handleWalletDisconnect } from '@/utils/walletHelpers';
import { 
  Bell, 
  WalletCards, 
  Settings as SettingsIcon, 
  Moon,
  Sun,
  Eye,
  Volume2,
  Vibrate,
  User,
  Trash2,
  Save,
  LogOut,
  Loader2
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Label } from "@/components/ui/label";
import { toast } from '@/components/ui/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { doc, getDoc, updateDoc, deleteDoc, setDoc, query, collection, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase-config';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { calculateLevel } from '@/services/learningService';

const Settings = () => {
  const [connected, setConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const currentAccount = useCurrentAccount();
  const { userData, updateUserData } = useAuth();
  const disconnectMutation = useDisconnectWallet();

  // Setting states
  const [displayName, setDisplayName] = useState('');
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [autoConnect, setAutoConnect] = useState(true);
  const [language, setLanguage] = useState('en');
  const [privacyMode, setPrivacyMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Check for wallet connection on component mount
  useEffect(() => {
    if (currentAccount) {
      setConnected(true);
      setWalletAddress(currentAccount.address);
    } else {
      setConnected(false);
      setWalletAddress(null);
    }
  }, [currentAccount]);

  // Load user settings from Firestore
  useEffect(() => {
    const loadUserSettings = async () => {
      if (!walletAddress) return;
      
      try {
        const userSettingsRef = doc(db, 'user_settings', walletAddress);
        const settingsDoc = await getDoc(userSettingsRef);
        
        if (settingsDoc.exists()) {
          const settings = settingsDoc.data();
          
          // Update state with settings from Firestore
          setDisplayName(userData?.displayName || '');
          setNotificationEnabled(settings.notifications?.enabled ?? true);
          setSoundEnabled(settings.notifications?.sound ?? true);
          setVibrationEnabled(settings.notifications?.vibration ?? true);
          setDarkMode(settings.appearance?.darkMode ?? true);
          setAutoConnect(settings.wallet?.autoConnect ?? true);
          setLanguage(settings.language || 'en');
          setPrivacyMode(settings.privacy?.enabled ?? false);
        } else {
          // Set defaults if no settings document exists
          setDisplayName(userData?.displayName || '');
          // Other settings are already initialized with defaults
        }
      } catch (error) {
        
        toast({
          title: "Error",
          description: "Failed to load settings",
          variant: "destructive",
        });
      }
    };
    
    loadUserSettings();
  }, [walletAddress, userData]);

  // Handle wallet connection
  const handleConnect = (address: string) => {
    handleWalletConnect(address, (addr) => {
      setConnected(true);
      setWalletAddress(addr);
    });
  };

  // Handle wallet disconnection
  const disconnect = () => {
    setConnected(false);
    setWalletAddress(null);
  };

  const handleDisconnect = handleWalletDisconnect(disconnectMutation, disconnect);

  // Handle settings save
  const handleSaveSettings = async () => {
    if (!walletAddress) {
      toast({
        title: "Error",
        description: "Please connect your wallet to save settings",
        variant: "destructive",
      });
      return;
    }
    
    setIsSaving(true);
    
    try {
      const userSettingsRef = doc(db, 'user_settings', walletAddress);
      
      // Save user display name
      if (displayName !== userData?.displayName) {
        // Update display name in learningProgress collection
        if (userData) {
          await updateUserData({
            ...userData,
            displayName
          });
        }
      }
      
      // Save settings to Firestore
      await setDoc(userSettingsRef, {
        notifications: {
          enabled: notificationEnabled,
          sound: soundEnabled,
          vibration: vibrationEnabled
        },
        appearance: {
          darkMode: darkMode
        },
        wallet: {
          autoConnect: autoConnect
        },
        language: language,
        privacy: {
          enabled: privacyMode
        },
        updatedAt: new Date()
      }, { merge: true });
      
      toast({
        title: "Settings Saved",
        description: "Your preferences have been updated",
        duration: 3000,
      });
    } catch (error) {
      
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!walletAddress) {
      toast({
        title: "Error",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }
    
    setIsDeleting(true);
    
    try {
      // Delete user data
      await deleteDoc(doc(db, 'learningProgress', walletAddress));
      
      // Delete user settings
      await deleteDoc(doc(db, 'user_settings', walletAddress));
      
      // Delete user achievements
      const achievementsQuery = query(
        collection(db, 'user_achievements'),
        where('walletAddress', '==', walletAddress)
      );
      
      const achievementsSnapshot = await getDocs(achievementsQuery);
      const deletePromises: Promise<void>[] = [];
      
      achievementsSnapshot.forEach(doc => {
        deletePromises.push(deleteDoc(doc.ref));
      });
      
      // Delete activity history
      const activitiesQuery = query(
        collection(db, 'learning_activities'),
        where('walletAddress', '==', walletAddress)
      );
      
      const activitiesSnapshot = await getDocs(activitiesQuery);
      
      activitiesSnapshot.forEach(doc => {
        deletePromises.push(deleteDoc(doc.ref));
      });
      
      // Execute all deletion promises
      await Promise.all(deletePromises);
      
      // Disconnect wallet
      handleDisconnect();
      
      toast({
        title: "Account Deleted",
        description: "Your account and all associated data have been deleted",
        duration: 5000,
      });
      
      // Close dialog
      setShowDeleteDialog(false);
    } catch (error) {
      
      toast({
        title: "Error",
        description: "Failed to delete account",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };
  
  // User stats with fallback values if not connected
  const userXp = userData?.xp || 0;
  const userLevel = calculateLevel(userXp);
  
  const userStats = {
    xp: userXp,
    streak: userData?.streak || 0,
    level: userLevel,
    username: userData?.displayName || (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Explorer'),
    avatarSrc: userData?.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=cosmic',
    suiTokens: userData?.suiTokens || 0
  };
  
  
  

  return (
    <div className="relative min-h-screen">
      <StarField />
      
      <NavBar 
        connected={connected}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        userXp={userStats.xp}
        userStreak={userStats.streak}
        userLevel={userStats.level}
        username={userStats.username}
        avatarSrc={userStats.avatarSrc}
      />
      
      <main className="container mx-auto pt-24 px-4 pb-20">
        <section className="mb-8">
          <motion.h1 
            className="text-3xl md:text-4xl font-heading font-bold mb-6 text-center"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-gradient">Settings</span>
          </motion.h1>
          
          {!connected && (
            <div className="text-center mb-8">
              <p className="text-lg text-muted-foreground mb-4">Connect your wallet to access all settings</p>
              <Button 
                onClick={() => document.querySelector('.neon-button')?.dispatchEvent(new MouseEvent('click', {bubbles: true}))}
                className="neon-button"
              >
                Connect Wallet
              </Button>
            </div>
          )}
        </section>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main content */}
          <div className="lg:col-span-3">
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="w-full grid grid-cols-4 mb-6">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="wallet">Wallet</TabsTrigger>
                <TabsTrigger value="notifications">Notifications</TabsTrigger>
                <TabsTrigger value="account">Account</TabsTrigger>
              </TabsList>
              
              {/* General Settings Tab */}
              <TabsContent value="general" className="space-y-6">
                <Card className="galaxy-card">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <SettingsIcon className="h-5 w-5 mr-2 text-primary" />
                      General Settings
                    </CardTitle>
                    <CardDescription>Adjust your display preferences and app settings</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-base">Theme</Label>
                          <div className="text-sm text-muted-foreground">Choose between light and dark mode</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Sun className="h-5 w-5 text-muted-foreground" />
                          <Switch 
                            checked={darkMode} 
                            onCheckedChange={setDarkMode} 
                          />
                          <Moon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div className="space-y-2">
                        <Label htmlFor="language">Language</Label>
                        <Select 
                          value={language} 
                          onValueChange={setLanguage}
                        >
                          <SelectTrigger id="language">
                            <SelectValue placeholder="Select Language" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="es">Spanish</SelectItem>
                            <SelectItem value="fr">French</SelectItem>
                            <SelectItem value="zh">Chinese</SelectItem>
                            <SelectItem value="ru">Russian</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <Separator />
                      
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-base">Privacy Mode</Label>
                          <div className="text-sm text-muted-foreground">Hide sensitive information</div>
                        </div>
                        <Switch 
                          checked={privacyMode} 
                          onCheckedChange={setPrivacyMode} 
                        />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      onClick={handleSaveSettings}
                      className="w-full"
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Settings
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
              
              {/* Wallet Settings Tab */}
              <TabsContent value="wallet" className="space-y-6">
                <Card className="galaxy-card">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <WalletCards className="h-5 w-5 mr-2 text-primary" />
                      Wallet Settings
                    </CardTitle>
                    <CardDescription>Manage your wallet connections and preferences</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      {connected ? (
                        <div className="bg-card/50 p-4 rounded-lg">
                          <div className="flex justify-between items-center">
                            <div>
                              <Label className="text-base">Connected Wallet</Label>
                              <div className="text-sm mt-1 font-mono">{walletAddress}</div>
                            </div>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={handleDisconnect}
                            >
                              <LogOut className="h-4 w-4 mr-2" />
                              Disconnect
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-card/50 p-4 rounded-lg text-center">
                          <div className="mb-4 text-muted-foreground">No wallet connected</div>
                          <Button 
                            onClick={() => document.querySelector('.neon-button')?.dispatchEvent(new MouseEvent('click', {bubbles: true}))}
                            className="neon-button"
                          >
                            Connect Wallet
                          </Button>
                        </div>
                      )}
                      
                      <Separator />
                      
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-base">Auto-Connect</Label>
                          <div className="text-sm text-muted-foreground">Automatically connect wallet on startup</div>
                        </div>
                        <Switch 
                          checked={autoConnect} 
                          onCheckedChange={setAutoConnect} 
                        />
                      </div>
                      
                      <Separator />
                      
                      <div className="space-y-2">
                        <Label className="text-base">Network</Label>
                        <Select defaultValue="testnet">
                          <SelectTrigger>
                            <SelectValue placeholder="Select Network" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mainnet">Mainnet</SelectItem>
                            <SelectItem value="testnet">Testnet</SelectItem>
                            <SelectItem value="devnet">Devnet</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      onClick={handleSaveSettings}
                      className="w-full"
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Settings
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
              
              {/* Notifications Tab */}
              <TabsContent value="notifications" className="space-y-6">
                <Card className="galaxy-card">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Bell className="h-5 w-5 mr-2 text-primary" />
                      Notification Settings
                    </CardTitle>
                    <CardDescription>Control how and when you receive notifications</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-base">Push Notifications</Label>
                          <div className="text-sm text-muted-foreground">Allow app to send you notifications</div>
                        </div>
                        <Switch 
                          checked={notificationEnabled} 
                          onCheckedChange={setNotificationEnabled} 
                        />
                      </div>
                      
                      <Separator />
                      
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-base">Sound Effects</Label>
                          <div className="text-sm text-muted-foreground">Play sounds for notifications and rewards</div>
                        </div>
                        <div className="flex items-center">
                          <Volume2 className="h-5 w-5 mr-2 text-muted-foreground" />
                          <Switch 
                            checked={soundEnabled} 
                            onCheckedChange={setSoundEnabled} 
                          />
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-base">Vibration</Label>
                          <div className="text-sm text-muted-foreground">Vibrate device for notifications</div>
                        </div>
                        <div className="flex items-center">
                          <Vibrate className="h-5 w-5 mr-2 text-muted-foreground" />
                          <Switch 
                            checked={vibrationEnabled} 
                            onCheckedChange={setVibrationEnabled} 
                          />
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div className="space-y-2">
                        <Label className="text-base">Notification Types</Label>
                        <div className="grid grid-cols-1 gap-4 mt-2">
                          <div className="flex items-center space-x-2">
                            <Switch id="daily-streak" defaultChecked />
                            <Label htmlFor="daily-streak" className="flex-1">Daily streak reminders</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch id="rewards" defaultChecked />
                            <Label htmlFor="rewards" className="flex-1">Reward notifications</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch id="module-updates" defaultChecked />
                            <Label htmlFor="module-updates" className="flex-1">New learning modules</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch id="duel-invites" defaultChecked />
                            <Label htmlFor="duel-invites" className="flex-1">Duel invitations</Label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      onClick={handleSaveSettings}
                      className="w-full"
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Settings
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
              
              {/* Account Tab */}
              <TabsContent value="account" className="space-y-6">
                <Card className="galaxy-card">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <User className="h-5 w-5 mr-2 text-primary" />
                      Account Settings
                    </CardTitle>
                    <CardDescription>Manage your profile and account information</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="display-name">Display Name</Label>
                        <Input 
                          id="display-name" 
                          placeholder="Enter your display name" 
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                        />
                      </div>
                      
                      <Separator />
                      
                      <div className="space-y-2">
                        <Label>Profile Picture</Label>
                        <div className="flex items-center space-x-4">
                          <Avatar className="h-16 w-16 border border-primary/30">
                            <AvatarImage src={userStats.avatarSrc} />
                            <AvatarFallback>{userStats.username.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <Button variant="outline" size="sm">
                            Change Avatar
                          </Button>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div className="space-y-2">
                        <Label>Email Notifications</Label>
                        <div className="grid grid-cols-1 gap-4 mt-2">
                          <div className="flex items-center space-x-2">
                            <Switch id="email-updates" defaultChecked />
                            <Label htmlFor="email-updates" className="flex-1">Learning updates</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch id="email-marketing" />
                            <Label htmlFor="email-marketing" className="flex-1">Marketing emails</Label>
                          </div>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div className="space-y-2">
                        <Label className="text-base text-destructive">Danger Zone</Label>
                        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              className="mt-2"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Account
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Are you absolutely sure?</DialogTitle>
                              <DialogDescription>
                                This action cannot be undone. This will permanently delete your
                                account and remove all your data from our servers.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="bg-destructive/10 p-3 rounded-md border border-destructive/20 text-sm">
                              Warning: This action cannot be undone!
                              All your learning progress, achievements, and tokens will be lost forever.
                            </div>
                            <DialogFooter>
                              <Button
                                variant="outline"
                                onClick={() => setShowDeleteDialog(false)}
                              >
                                Cancel
                              </Button>
                              <Button 
                                variant="destructive"
                                onClick={handleDeleteAccount}
                                disabled={isDeleting}
                              >
                                {isDeleting ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Deleting...
                                  </>
                                ) : (
                                  <>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Account
                                  </>
                                )}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <p className="text-xs text-muted-foreground mt-2">
                          This will permanently delete your learning progress and profile information.
                          This action cannot be undone.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      onClick={handleSaveSettings}
                      className="w-full"
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Profile
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
          
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
              <Card className="galaxy-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Quick Links</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start"
                      onClick={() => {
                        const element = document.querySelector('[data-state="inactive"][value="general"]');
                        if (element instanceof HTMLElement) element.click();
                      }}
                    >
                      <SettingsIcon className="h-4 w-4 mr-2" />
                      General
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start"
                      onClick={() => {
                        const element = document.querySelector('[data-state="inactive"][value="wallet"]');
                        if (element instanceof HTMLElement) element.click();
                      }}
                    >
                      <WalletCards className="h-4 w-4 mr-2" />
                      Wallet
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start"
                      onClick={() => {
                        const element = document.querySelector('[data-state="inactive"][value="notifications"]');
                        if (element instanceof HTMLElement) element.click();
                      }}
                    >
                      <Bell className="h-4 w-4 mr-2" />
                      Notifications
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start"
                      onClick={() => {
                        const element = document.querySelector('[data-state="inactive"][value="account"]');
                        if (element instanceof HTMLElement) element.click();
                      }}
                    >
                      <User className="h-4 w-4 mr-2" />
                      Account
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="galaxy-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Need Help?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full">
                    Contact Support
                  </Button>
                  <Button variant="ghost" className="w-full">
                    FAQ
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings; 