import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/components/ui/use-toast';
import { 
  regenerateEnhancedModule, 
  regenerateModuleQuiz,
  regenerateGalaxyModules,
  forceRegenerateModule,
  forceRegenerateGalaxyModules
} from '@/services/geminiService';
import { 
  initializeGalaxiesMetadata, 
  getGalaxiesWithModules,
  updateNextModuleLockStatus,
  forceUpdateModuleStatus,
  repairCompletedModules
} from '@/services/learningService';
import { fixQuizIndexing } from '@/scripts/fixQuizIndexing';
import NavBar from "@/components/NavBar";
import { Loader2, AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { doc, getDoc, updateDoc, arrayUnion, serverTimestamp, collection, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-config';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import logger from '@/utils/logger';

// Define module queue type
interface ModuleQueueItem {
  moduleId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

const Admin: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [moduleId, setModuleId] = useState('move-language');
  const [isInitializingGalaxies, setIsInitializingGalaxies] = useState(false);
  const [isRegeneratingModule, setIsRegeneratingModule] = useState(false);
  const [isRegeneratingQuiz, setIsRegeneratingQuiz] = useState(false);
  const [isRegeneratingGalaxy, setIsRegeneratingGalaxy] = useState(false);
  const [selectedGalaxy, setSelectedGalaxy] = useState('explorer');
  const [walletAddress, setWalletAddress] = useState('');
  const [isFixingUserProgress, setIsFixingUserProgress] = useState(false);
  const [moduleIdToFix, setModuleIdToFix] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isForceRegenerating, setIsForceRegenerating] = useState(false);
  const [isForceRegeneratingGalaxy, setIsForceRegeneratingGalaxy] = useState(false);
  const [walletAddressToFix, setWalletAddressToFix] = useState('');
  
  // Queue system for module regeneration
  const [moduleQueue, setModuleQueue] = useState<ModuleQueueItem[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [queueProgress, setQueueProgress] = useState(0);

  // Handle initializing galaxies metadata
  const handleInitializeGalaxies = async () => {
    setIsInitializingGalaxies(true);
    try {
      const result = await initializeGalaxiesMetadata();
      if (result) {
        toast({
          title: "Success",
          description: "Galaxies metadata initialized successfully",
          variant: "default"
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to initialize galaxies metadata",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsInitializingGalaxies(false);
    }
  };

  // Handle regenerating a module with improved error handling
  const handleRegenerateModule = async () => {
    setIsRegeneratingModule(true);
    try {
      // Show a toast notification that we're starting the regeneration
      toast({
        title: "Processing",
        description: `Starting regeneration of module ${moduleId}...`,
        variant: "default"
      });
      
      const result = await regenerateEnhancedModule(moduleId);
      if (result) {
        toast({
          title: "Success",
          description: `Module ${moduleId} regenerated successfully`,
          variant: "default"
        });
      } else {
        toast({
          title: "Warning",
          description: `Module ${moduleId} regeneration completed with some issues. Check the module content.`,
          variant: "destructive"
        });
      }
    } catch (error) {
      logger.error(`Error regenerating module ${moduleId}:`, error);
      
      // Provide more helpful error messages based on the error type
      let errorMessage = "An unknown error occurred";
      
      if (error instanceof Error) {
        if (error.message.includes('503') || error.message.includes('overloaded')) {
          errorMessage = "The AI service is currently overloaded. The system will automatically retry with backoff.";
        } else if (error.message.includes('rate limit')) {
          errorMessage = "Rate limit exceeded. Please try again in a few minutes.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsRegeneratingModule(false);
    }
  };

  // Handle regenerating quiz questions with improved error handling
  const handleRegenerateQuiz = async () => {
    setIsRegeneratingQuiz(true);
    try {
      // Show a toast notification that we're starting the quiz regeneration
      toast({
        title: "Processing",
        description: `Starting regeneration of quiz for module ${moduleId}...`,
        variant: "default"
      });
      
      const result = await regenerateModuleQuiz(moduleId);
      if (result) {
        toast({
          title: "Success",
          description: `Quiz for module ${moduleId} regenerated successfully`,
          variant: "default"
        });
      } else {
        toast({
          title: "Warning",
          description: `Quiz regeneration completed with some issues. Check the quiz content.`,
          variant: "destructive"
        });
      }
    } catch (error) {
      logger.error(`Error regenerating quiz for module ${moduleId}:`, error);
      
      // Provide more helpful error messages based on the error type
      let errorMessage = "An unknown error occurred";
      
      if (error instanceof Error) {
        if (error.message.includes('503') || error.message.includes('overloaded')) {
          errorMessage = "The AI service is currently overloaded. The system will automatically retry with backoff.";
        } else if (error.message.includes('rate limit')) {
          errorMessage = "Rate limit exceeded. Please try again in a few minutes.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsRegeneratingQuiz(false);
    }
  };

  // Add a module to the regeneration queue
  const addToQueue = () => {
    if (!moduleId) return;
    
    // Check if module is already in the queue
    if (moduleQueue.some(item => item.moduleId === moduleId)) {
      toast({
        title: "Warning",
        description: `Module ${moduleId} is already in the queue`,
        variant: "destructive"
      });
      return;
    }
    
    // Add to queue
    setModuleQueue(prev => [...prev, { moduleId, status: 'pending' }]);
    
    toast({
      title: "Added to Queue",
      description: `Module ${moduleId} added to regeneration queue`,
      variant: "default"
    });
    
    // Start processing if not already processing
    if (!isProcessingQueue) {
      processQueue();
    }
  };
  
  // Process the module regeneration queue with delays between requests
  const processQueue = async () => {
    if (isProcessingQueue || moduleQueue.length === 0) return;
    
    setIsProcessingQueue(true);
    
    // Process each item in the queue
    let remaining = [...moduleQueue];
    let completed = 0;
    
    while (remaining.length > 0) {
      // Get the next item
      const currentItem = remaining[0];
      
      // Update status to processing
      setModuleQueue(prev => 
        prev.map(item => 
          item.moduleId === currentItem.moduleId 
            ? { ...item, status: 'processing' } 
            : item
        )
      );
      
      try {
        // Process the module
        logger.log(`Processing module ${currentItem.moduleId}`);
        
        // Regenerate the module
        const result = await regenerateEnhancedModule(currentItem.moduleId);
        
        // Update status based on result
        setModuleQueue(prev => 
          prev.map(item => 
            item.moduleId === currentItem.moduleId 
              ? { 
                  ...item, 
                  status: result ? 'completed' : 'failed',
                  error: result ? undefined : 'Regeneration completed with issues'
                } 
              : item
          )
        );
        
        // Update progress
        completed++;
        setQueueProgress(Math.floor((completed / moduleQueue.length) * 100));
        
      } catch (error) {
        logger.error(`Error processing module ${currentItem.moduleId}:`, error);
        
        // Update status to failed
        setModuleQueue(prev => 
          prev.map(item => 
            item.moduleId === currentItem.moduleId 
              ? { 
                  ...item, 
                  status: 'failed',
                  error: error instanceof Error ? error.message : 'Unknown error'
                } 
              : item
          )
        );
        
        // Update progress
        completed++;
        setQueueProgress(Math.floor((completed / moduleQueue.length) * 100));
      }
      
      // Remove from remaining
      remaining = remaining.slice(1);
      
      // Add a delay between requests to avoid overloading the API
      // Only add delay if there are more items to process
      if (remaining.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 20000)); // 20 second delay
      }
    }
    
    setIsProcessingQueue(false);
    
    // Show completion toast
    toast({
      title: "Queue Completed",
      description: `Processed ${moduleQueue.length} modules`,
      variant: "default"
    });
  };
  
  // Clear the queue
  const clearQueue = () => {
    if (isProcessingQueue) {
      toast({
        title: "Warning",
        description: "Cannot clear queue while processing",
        variant: "destructive"
      });
      return;
    }
    
    setModuleQueue([]);
    setQueueProgress(0);
    
    toast({
      title: "Queue Cleared",
      description: "Regeneration queue has been cleared",
      variant: "default"
    });
  };

  // Handle regenerating all modules in a galaxy
  const handleRegenerateGalaxy = async () => {
    setIsRegeneratingGalaxy(true);
    try {
      // Show a toast notification that we're starting the galaxy regeneration
      toast({
        title: "Processing",
        description: `Starting regeneration of all modules in ${selectedGalaxy} galaxy...`,
        variant: "default"
      });
      
      const result = await regenerateGalaxyModules(selectedGalaxy);
      if (result.success) {
        toast({
          title: "Success",
          description: `Successfully regenerated ${result.count} modules in ${selectedGalaxy} galaxy`,
          variant: "default"
        });
      } else {
        toast({
          title: "Warning",
          description: `Galaxy regeneration completed with some issues. Check the module content.`,
          variant: "destructive"
        });
      }
    } catch (error) {
      logger.error(`Error regenerating galaxy ${selectedGalaxy}:`, error);
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsRegeneratingGalaxy(false);
    }
  };
  
  // Handle force regenerating all modules in a galaxy with high-quality content
  const handleForceRegenerateGalaxy = async () => {
    setIsForceRegeneratingGalaxy(true);
    try {
      // Show a toast notification that we're starting the galaxy force regeneration
      toast({
        title: "Processing",
        description: `Starting high-quality regeneration of all modules in ${selectedGalaxy} galaxy...`,
        variant: "default"
      });
      
      const result = await forceRegenerateGalaxyModules(selectedGalaxy);
      if (result.success) {
        toast({
          title: "Success",
          description: `Successfully regenerated ${result.count} modules in ${selectedGalaxy} galaxy with high-quality content`,
          variant: "default"
        });
      } else {
        toast({
          title: "Warning",
          description: `Galaxy regeneration completed with some issues. Check the module content.`,
          variant: "destructive"
        });
      }
    } catch (error) {
      logger.error(`Error force regenerating galaxy ${selectedGalaxy}:`, error);
      
      let errorMessage = "An unknown error occurred";
      
      if (error instanceof Error) {
        if (error.message.includes('503') || error.message.includes('overloaded')) {
          errorMessage = "The AI service is currently overloaded. The system will automatically retry with backoff.";
        } else if (error.message.includes('rate limit')) {
          errorMessage = "Rate limit exceeded. Please try again in a few minutes.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsForceRegeneratingGalaxy(false);
    }
  };

  // Handle fixing user progress data
  const handleFixUserProgress = async () => {
    if (!walletAddress) {
      toast({
        title: "Error",
        description: "Please enter a wallet address",
        variant: "destructive"
      });
      return;
    }

    setIsFixingUserProgress(true);
    try {
      // Get user progress document
      const userProgressRef = doc(db, 'learningProgress', walletAddress);
      const userProgressDoc = await getDoc(userProgressRef);
      
      if (!userProgressDoc.exists()) {
        toast({
          title: "Error",
          description: "User progress not found for this wallet address",
          variant: "destructive"
        });
        return;
      }
      
      const userData = userProgressDoc.data();
      const completedModules = userData.completedModules || [];
      const currentGalaxyId = userData.currentGalaxy || 1;
      
      // Get galaxies with modules to determine which galaxies should be unlocked
      const galaxiesWithModules = await getGalaxiesWithModules(walletAddress);
      
      // Track which galaxies should be unlocked
      const galaxiesToUnlock = new Set<number>([1]); // Galaxy 1 is always unlocked
      
      // Add the current galaxy to the list of unlocked galaxies
      galaxiesToUnlock.add(currentGalaxyId);
      
      // Check each galaxy to see if it's completed
      for (let i = 0; i < galaxiesWithModules.length - 1; i++) {
        const galaxy = galaxiesWithModules[i];
        const nextGalaxy = galaxiesWithModules[i + 1];
        
        // If all modules in this galaxy are completed, the next galaxy should be unlocked
        const allModulesCompleted = galaxy.modules.every(module => 
          completedModules.includes(module.id)
        );
        
        if (allModulesCompleted) {
          galaxiesToUnlock.add(nextGalaxy.id);
        }
      }
      
      // Convert Set to Array for Firestore
      const unlockedGalaxiesArray = Array.from(galaxiesToUnlock);
      
      // Update the user's progress document
      await updateDoc(userProgressRef, {
        unlockedGalaxies: unlockedGalaxiesArray,
        lastUpdated: serverTimestamp()
      });
      
      toast({
        title: "Success",
        description: `Fixed progress data for ${walletAddress}. Unlocked galaxies: ${unlockedGalaxiesArray.join(', ')}`,
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsFixingUserProgress(false);
    }
  };

  // Handle fixing module unlocking issues for a specific user and module
  const handleFixModuleUnlocking = async () => {
    try {
      setIsLoading(true);
      
      if (!walletAddress || !moduleIdToFix) {
        toast({
          title: "Error",
          description: "Please provide both wallet address and module ID",
          variant: "destructive"
        });
        return;
      }
      
      toast({
        title: "Processing",
        description: `Fixing module unlocking for ${moduleIdToFix}`,
      });
      
      // First, ensure the module is in the completedModules array
      const userProgressRef = doc(db, 'learningProgress', walletAddress);
      const userDoc = await getDoc(userProgressRef);
      
      if (!userDoc.exists()) {
        toast({
          title: "Error",
          description: "User progress document not found",
          variant: "destructive"
        });
        return;
      }
      
      // Call the function to update the next module's lock status
      const success = await updateNextModuleLockStatus(walletAddress, moduleIdToFix);
      
      if (success) {
        toast({
          title: "Success",
          description: `Fixed module unlocking for ${moduleIdToFix}`,
          variant: "default"
        });
      } else {
        toast({
          title: "Error",
          description: `Failed to fix module unlocking`,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle force regenerating a module with high-quality content
  const handleForceRegenerateModule = async () => {
    setIsForceRegenerating(true);
    try {
      // Show a toast notification that we're starting the force regeneration
      toast({
        title: "Processing",
        description: `Starting high-quality regeneration of module ${moduleId}...`,
        variant: "default"
      });
      
      const result = await forceRegenerateModule(moduleId);
      if (result) {
        toast({
          title: "Success",
          description: `Module ${moduleId} has been regenerated with high-quality content`,
          variant: "default"
        });
      } else {
        toast({
          title: "Warning",
          description: `Module regeneration completed with some issues. Check the module content.`,
          variant: "destructive"
        });
      }
    } catch (error) {
      logger.error(`Error force regenerating module ${moduleId}:`, error);
      
      // Provide more helpful error messages based on the error type
      let errorMessage = "An unknown error occurred";
      
      if (error instanceof Error) {
        if (error.message.includes('503') || error.message.includes('overloaded')) {
          errorMessage = "The AI service is currently overloaded. The system will automatically retry with backoff.";
        } else if (error.message.includes('rate limit')) {
          errorMessage = "Rate limit exceeded. Please try again in a few minutes.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsForceRegenerating(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-gray-900 to-gray-800">
      <NavBar 
        connected={false}
        onConnect={() => {}}
        onDisconnect={() => {}}
        userXp={0}
        userStreak={0}
        userLevel={1}
        username="Admin"
        avatarSrc="https://api.dicebear.com/7.x/bottts/svg?seed=admin"
      />
      
      <main className="container mx-auto pt-24 px-4 pb-20">
        <Card className="p-6 bg-card/90 backdrop-blur-md border-border">
          <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
          
          <div className="space-y-8">
            {/* Initialize Galaxies */}
            <div>
              <h2 className="text-xl font-semibold mb-3">Initialize Galaxies</h2>
              <p className="text-muted-foreground mb-4">
                Initialize the galaxies metadata in Firebase if it doesn't exist.
              </p>
              <Button 
                onClick={handleInitializeGalaxies} 
                disabled={isInitializingGalaxies}
                className="w-full md:w-auto"
              >
                {isInitializingGalaxies && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Initialize Galaxies
              </Button>
            </div>
            
            <Separator />
            
            {/* Fix User Progress */}
            <div>
              <h2 className="text-xl font-semibold mb-3">Fix User Progress</h2>
              <p className="text-muted-foreground mb-4">
                Fix a user's progress data by ensuring unlockedGalaxies field is properly set.
              </p>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <Label htmlFor="walletAddress" className="mb-2 block">Wallet Address</Label>
                  <Input
                    id="walletAddress"
                    placeholder="Enter user's wallet address"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={handleFixUserProgress} 
                    disabled={isFixingUserProgress || !walletAddress}
                    className="w-full md:w-auto"
                  >
                    {isFixingUserProgress && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Fix User Progress
                  </Button>
                </div>
              </div>
            </div>
            
            <Separator />
            
            {/* Fix Module Unlocking */}
            <div>
              <h2 className="text-xl font-semibold mb-3">Fix Module Unlocking</h2>
              <p className="text-muted-foreground mb-4">
                Fix issues with module unlocking by explicitly unlocking the next module after a completed one.
              </p>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <Label htmlFor="walletAddress" className="mb-2 block">Wallet Address</Label>
                  <Input
                    id="walletAddress"
                    placeholder="Enter user's wallet address"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="completedModuleId" className="mb-2 block">Completed Module ID</Label>
                  <Input
                    id="completedModuleId"
                    placeholder="e.g. move-language"
                    value={moduleIdToFix}
                    onChange={(e) => setModuleIdToFix(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={handleFixModuleUnlocking} 
                    disabled={!walletAddress || !moduleIdToFix || isLoading}
                    className="w-full md:w-auto"
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Fix Module Unlocking
                  </Button>
                </div>
              </div>
            </div>
            
            <Separator />
            
            {/* View Module Completion Status */}
            <div>
              <h2 className="text-xl font-semibold mb-3">View Module Completion Status</h2>
              <p className="text-muted-foreground mb-4">
                Check module completion status for a specific user.
              </p>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <Label htmlFor="statusWalletAddress" className="mb-2 block">Wallet Address</Label>
                  <Input
                    id="statusWalletAddress"
                    placeholder="0x..."
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={async () => {
                      try {
                        if (!walletAddress) {
                          toast({
                            title: "Error",
                            description: "Please provide a wallet address",
                            variant: "destructive"
                          });
                          return;
                        }
                        
                        setIsLoading(true);
                        toast({
                          title: "Processing",
                          description: "Fetching module completion status...",
                        });
                        
                        // Get user progress
                        const userProgressRef = doc(db, 'learningProgress', walletAddress);
                        const userDoc = await getDoc(userProgressRef);
                        
                        if (!userDoc.exists()) {
                          toast({
                            title: "Error",
                            description: "User progress document not found",
                            variant: "destructive"
                          });
                          return;
                        }
                        
                        const userData = userDoc.data();
                        const completedModules = userData.completedModules || [];
                        
                        // Get galaxies with modules
                        const galaxiesData = await getGalaxiesWithModules(walletAddress);
                        
                        logger.log(`[Admin] User ${walletAddress} has ${completedModules.length} completed modules`);
                        logger.log(`[Admin] Completed modules:`, completedModules);
                        
                        // Log completion status for all modules
                        logger.log('[Admin] Module completion status:');
                        galaxiesData.forEach(galaxy => {
                          logger.log(`[Admin] Galaxy ${galaxy.id} (${galaxy.name}) - ${galaxy.modules.length} modules:`);
                          galaxy.modules.forEach(module => {
                            const isCompleted = completedModules.includes(module.id);
                            logger.log(`[Admin] - Module ${module.id} (${module.title}): completed=${isCompleted}, locked=${module.locked}`);
                          });
                        });
                        
                        toast({
                          title: "Success",
                          description: `Check console for module completion status for ${walletAddress}`,
                        });
                      } catch (error) {
                        logger.error("Error checking module status:", error);
                        toast({
                          title: "Error",
                          description: "Failed to check module status",
                          variant: "destructive"
                        });
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={!walletAddress || isLoading}
                    className="w-full md:w-auto"
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Check Module Status
                  </Button>
                </div>
              </div>
            </div>
            
            <Separator />
            
            {/* Regenerate Module */}
            <div>
              <h2 className="text-xl font-semibold mb-3">Regenerate Module</h2>
              <p className="text-muted-foreground mb-4">
                Regenerate a specific module with enhanced content.
              </p>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <Label htmlFor="moduleId" className="mb-2 block">Module ID</Label>
                  <Input
                    id="moduleId"
                    placeholder="e.g. move-language"
                    value={moduleId}
                    onChange={(e) => setModuleId(e.target.value)}
                  />
                </div>
                <div className="flex items-end space-x-2">
                  <Button 
                    onClick={handleRegenerateModule} 
                    disabled={isRegeneratingModule || !moduleId}
                    className="w-full md:w-auto"
                  >
                    {isRegeneratingModule && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Regenerate Module
                  </Button>
                  <Button 
                    onClick={handleRegenerateQuiz} 
                    disabled={isRegeneratingQuiz || !moduleId}
                    variant="outline"
                    className="w-full md:w-auto"
                  >
                    {isRegeneratingQuiz && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Regenerate Quiz
                  </Button>
                  <Button 
                    onClick={addToQueue} 
                    disabled={!moduleId}
                    variant="secondary"
                    className="w-full md:w-auto"
                  >
                    Add to Queue
                  </Button>
                </div>
              </div>
              
              {/* Module Queue Section */}
              <div className="mt-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold">Module Queue</h3>
                  <Button 
                    onClick={clearQueue} 
                    disabled={isProcessingQueue || moduleQueue.length === 0}
                    variant="outline"
                    size="sm"
                  >
                    Clear Queue
                  </Button>
                </div>
                
                {/* Queue Progress */}
                {isProcessingQueue && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Processing queue...</span>
                      <span>{queueProgress}%</span>
                    </div>
                    <Progress value={queueProgress} className="h-2" />
                  </div>
                )}
                
                {/* Queue List */}
                <div className="border border-border rounded-md overflow-hidden">
                  {moduleQueue.length > 0 ? (
                    <div className="divide-y divide-border">
                      {moduleQueue.map((item, index) => (
                        <div 
                          key={`${item.moduleId}-${index}`} 
                          className={`p-3 flex justify-between items-center ${
                            item.status === 'processing' ? 'bg-blue-950/20' :
                            item.status === 'completed' ? 'bg-green-950/20' :
                            item.status === 'failed' ? 'bg-red-950/20' : ''
                          }`}
                        >
                          <div>
                            <span className="font-medium">{item.moduleId}</span>
                            {item.error && (
                              <p className="text-xs text-red-400 mt-1">{item.error}</p>
                            )}
                          </div>
                          <div>
                            {item.status === 'pending' && <span className="text-sm text-gray-400">Pending</span>}
                            {item.status === 'processing' && (
                              <span className="text-sm text-blue-400 flex items-center">
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                Processing
                              </span>
                            )}
                            {item.status === 'completed' && <span className="text-sm text-green-400">Completed</span>}
                            {item.status === 'failed' && <span className="text-sm text-red-400">Failed</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-muted-foreground">
                      Queue is empty
                    </div>
                  )}
                </div>
                
                {/* API Status Alert */}
                {(isRegeneratingModule || isRegeneratingQuiz || isProcessingQueue) && (
                  <Alert className="mt-4 bg-card/60">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>API Status</AlertTitle>
                    <AlertDescription>
                      The Gemini API can sometimes be overloaded. If requests fail, the system will automatically retry with exponential backoff.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
            
            {/* Force Regenerate High-Quality Module */}
            <div className="mt-6">
              <h2 className="text-xl font-semibold mb-3">Force Regenerate High-Quality Module</h2>
              <p className="text-muted-foreground mb-4">
                Force regenerate a module with high-quality content including detailed flashcards (7-8 theory, 7-8 coding), 
                targeted quiz questions (6-7 theory, 3-4 coding), and aligned alien challenges.
              </p>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <Label htmlFor="forceModuleId" className="mb-2 block">Module ID</Label>
                  <Input
                    id="forceModuleId"
                    placeholder="e.g. advanced-concepts"
                    value={moduleId}
                    onChange={(e) => setModuleId(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button 
                  onClick={handleForceRegenerateModule} 
                  disabled={isForceRegenerating}
                  className="w-full md:w-auto"
                  variant="outline"
                >
                  {isForceRegenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating High-Quality Content...
                    </>
                  ) : (
                    'Force Regenerate High-Quality Content'
                  )}
                </Button>
              </div>
            </div>
            
            <Separator />
            
            {/* Regenerate Galaxy */}
            <div>
              <h2 className="text-xl font-semibold mb-3">Regenerate Galaxy</h2>
              <p className="text-muted-foreground mb-4">
                Regenerate all modules in a specific galaxy with enhanced content.
              </p>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <Label htmlFor="galaxySelect" className="mb-2 block">Galaxy</Label>
                  <Select
                    value={selectedGalaxy}
                    onValueChange={setSelectedGalaxy}
                  >
                    <SelectTrigger id="galaxySelect" className="w-full">
                      <SelectValue placeholder="Select a galaxy" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="genesis">Genesis Galaxy</SelectItem>
                      <SelectItem value="explorer">Explorer Galaxy</SelectItem>
                      <SelectItem value="innovator">Innovator Galaxy</SelectItem>
                      <SelectItem value="architect">Architect Galaxy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={handleRegenerateGalaxy} 
                    disabled={isRegeneratingGalaxy || !selectedGalaxy}
                    className="w-full md:w-auto"
                  >
                    {isRegeneratingGalaxy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Regenerate All Modules
                  </Button>
                </div>
              </div>
              <p className="text-amber-500 text-sm mt-2">
                Warning: This will regenerate all modules in the selected galaxy and may take several minutes.
              </p>
            </div>
            
            <Separator />
            
            {/* Force Regenerate Galaxy */}
            <div className="mt-6">
              <h2 className="text-xl font-semibold mb-3">Force Regenerate Galaxy</h2>
              <p className="text-muted-foreground mb-4">
                Force regenerate all modules in a specific galaxy with high-quality content.
              </p>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <Label htmlFor="galaxySelect" className="mb-2 block">Galaxy</Label>
                  <Select
                    value={selectedGalaxy}
                    onValueChange={setSelectedGalaxy}
                  >
                    <SelectTrigger id="galaxySelect" className="w-full">
                      <SelectValue placeholder="Select a galaxy" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="genesis">Genesis Galaxy</SelectItem>
                      <SelectItem value="explorer">Explorer Galaxy</SelectItem>
                      <SelectItem value="innovator">Innovator Galaxy</SelectItem>
                      <SelectItem value="architect">Architect Galaxy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button 
                  onClick={handleForceRegenerateGalaxy} 
                  disabled={isForceRegeneratingGalaxy}
                  className="w-full md:w-auto"
                  variant="outline"
                >
                  {isForceRegeneratingGalaxy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating High-Quality Content...
                    </>
                  ) : (
                    'Force Regenerate High-Quality Content'
                  )}
                </Button>
              </div>
            </div>
            
            <Separator />
            
            {/* Fix Quiz Indexing */}
            <div className="mt-6">
              <h2 className="text-xl font-semibold mb-3">Fix Quiz Indexing</h2>
              <p className="text-muted-foreground mb-4">
                Fix quiz questions where correctAnswer values are incorrectly set too high.
                This will convert values like 4 to 2, and 3 to 1 to match the actual 0-based 
                option indices (0,1,2,3) shown in the UI.
              </p>
              <div className="flex justify-end">
                <Button 
                  onClick={async () => {
                    try {
                      setIsLoading(true);
                      toast({
                        title: "Processing",
                        description: "Fixing quiz indexing for all modules...",
                      });
                      
                      const results = await fixQuizIndexing();
                      const fixedCount = results.filter(r => r.status === 'fixed').length;
                      
                      toast({
                        title: "Success",
                        description: `Fixed ${fixedCount} modules. Check console for details.`,
                        variant: "default"
                      });
                      
                      logger.log('Fix quiz indexing results:', results);
                    } catch (error) {
                      logger.error('Error fixing quiz indexing:', error);
                      toast({
                        title: "Error",
                        description: error instanceof Error ? error.message : "An unknown error occurred",
                        variant: "destructive"
                      });
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading}
                  variant="outline"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Fixing Quiz Indexing...
                    </>
                  ) : (
                    'Fix Quiz Indexing'
                  )}
                </Button>
              </div>
            </div>
            
            <Separator />
            
            {/* Fix Module Completion Status */}
            <div className="mt-6">
              <h2 className="text-xl font-semibold mb-3">Fix Module Completion Status</h2>
              <p className="text-muted-foreground mb-4">
                Force update a module's completion status and unlock the next module.
                Use this if a module is marked as completed in Firestore but not showing correctly in the UI.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label htmlFor="walletAddress">Wallet Address</Label>
                  <Input
                    id="walletAddress"
                    placeholder="0x1234..."
                    value={walletAddressToFix}
                    onChange={(e) => setWalletAddressToFix(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="moduleIdToFix">Module ID</Label>
                  <Input
                    id="moduleIdToFix" 
                    placeholder="move-language"
                    value={moduleIdToFix}
                    onChange={(e) => setModuleIdToFix(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button 
                  onClick={async () => {
                    try {
                      setIsLoading(true);
                      toast({
                        title: "Processing",
                        description: `Fixing module completion status for ${moduleIdToFix}...`,
                        duration: 3000,
                      });
                      
                      if (!walletAddressToFix || !moduleIdToFix) {
                        toast({
                          title: "Error",
                          description: "Wallet address and module ID are required",
                          variant: "destructive",
                        });
                        setIsLoading(false);
                        return;
                      }
                      
                      const result = await forceUpdateModuleStatus(walletAddressToFix, moduleIdToFix);
                      
                      if (result) {
                        toast({
                          title: "Success",
                          description: `Module ${moduleIdToFix} completion status fixed successfully`,
                          duration: 3000,
                        });
                      } else {
                        toast({
                          title: "Error",
                          description: "Failed to fix module completion status",
                          variant: "destructive",
                          duration: 3000,
                        });
                      }
                    } catch (error) {
                      logger.error("Error fixing module completion status:", error);
                      toast({
                        title: "Error",
                        description: error instanceof Error ? error.message : "Unknown error",
                        variant: "destructive",
                        duration: 3000,
                      });
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading || !walletAddressToFix || !moduleIdToFix}
                >
                  {isLoading ? 'Processing...' : 'Fix Module Status'}
                </Button>
              </div>
            </div>
            
            <Separator />
            
            {/* Repair Completed Modules */}
            <div className="mt-6">
              <h2 className="text-xl font-semibold mb-3">Repair Completed Modules</h2>
              <p className="text-muted-foreground mb-4">
                Repair missing completedModules array in user progress document by scanning module progress subcollection.
                Use this to fix production issues where the completedModules array is missing but individual modules are marked as completed.
              </p>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <Label htmlFor="repairWalletAddress" className="mb-2 block">Wallet Address</Label>
                  <Input
                    id="repairWalletAddress"
                    placeholder="0x1234..."
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={async () => {
                      try {
                        if (!walletAddress) {
                          toast({
                            title: "Error",
                            description: "Please provide a wallet address",
                            variant: "destructive"
                          });
                          return;
                        }
                        
                        setIsLoading(true);
                        toast({
                          title: "Processing",
                          description: "Repairing completedModules array...",
                        });
                        
                        // Import the repairCompletedModules function if not already imported
                        const { repairCompletedModules } = await import('@/services/learningService');
                        
                        const result = await repairCompletedModules(walletAddress);
                        
                        if (result) {
                          toast({
                            title: "Success",
                            description: "Successfully repaired completedModules array. Module completion status should now be accurate.",
                            duration: 5000,
                          });
                        } else {
                          toast({
                            title: "Information",
                            description: "No repair needed. The completedModules array already exists or no user data found.",
                            duration: 5000,
                          });
                        }
                      } catch (error) {
                        logger.error("Error repairing completedModules:", error);
                        toast({
                          title: "Error",
                          description: error instanceof Error ? error.message : "Unknown error",
                          variant: "destructive",
                          duration: 3000,
                        });
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={isLoading || !walletAddress}
                  >
                    {isLoading ? 'Processing...' : 'Repair Completed Modules'}
                  </Button>
                </div>
              </div>
            </div>
            
            <Separator />
            
            {/* Full Refresh Learning Data */}
            <div className="mt-6">
              <h2 className="text-xl font-semibold mb-3">Full Refresh Learning Data</h2>
              <p className="text-muted-foreground mb-4">
                Perform a full refresh of learning metadata from Firestore. Use this after updating learning content or fixing 
                galaxy/module metadata in production to ensure all data is synchronized and up-to-date.
              </p>
              <Alert className="mb-4 bg-amber-950/20 border-amber-500/50">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <AlertTitle className="text-amber-500">Production Update Tool</AlertTitle>
                <AlertDescription className="text-amber-300/90">
                  This tool performs multiple operations to refresh learning data:
                  <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                    <li>Reinitializes galaxies metadata if needed</li>
                    <li>Refreshes module data from Firestore</li>
                    <li>Updates user progress documents with correct completion status</li>
                    <li>Repairs any inconsistencies between module documents and progress arrays</li>
                  </ul>
                </AlertDescription>
              </Alert>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <Label htmlFor="refreshWalletAddress" className="mb-2 block">Wallet Address (Optional)</Label>
                  <Input
                    id="refreshWalletAddress"
                    placeholder="0x1234... (leave empty for global refresh)"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={async () => {
                      try {
                        setIsLoading(true);
                        toast({
                          title: "Processing",
                          description: walletAddress 
                            ? `Refreshing learning data for ${walletAddress}...` 
                            : "Performing global learning data refresh...",
                          duration: 3000,
                        });
                        
                        // First initialize galaxies metadata
                        await initializeGalaxiesMetadata();
                        
                        // If wallet address provided, refresh data for that user
                        if (walletAddress) {
                          // Ensure user progress is properly initialized
                          const { ensureLearningProgressInitialized } = await import('@/services/learningService');
                          await ensureLearningProgressInitialized(walletAddress, 'intro-to-sui');
                          
                          // Repair completedModules array if needed
                          await repairCompletedModules(walletAddress);
                          
                          // Get fresh data from Firestore
                          await getGalaxiesWithModules(walletAddress);
                          
                          toast({
                            title: "Success",
                            description: `Learning data for ${walletAddress} has been refreshed`,
                            duration: 3000,
                          });
                        } else {
                          // For global refresh, just reinitialize galaxy metadata
                          // This will update the galaxies and modules collections
                          const result = await initializeGalaxiesMetadata();
                          
                          if (result) {
                            toast({
                              title: "Success",
                              description: "Global learning metadata has been refreshed",
                              duration: 3000,
                            });
                          } else {
                            toast({
                              title: "Warning",
                              description: "Global refresh completed with some issues",
                              variant: "destructive",
                              duration: 3000,
                            });
                          }
                        }
                      } catch (error) {
                        logger.error("Error refreshing learning data:", error);
                        toast({
                          title: "Error",
                          description: error instanceof Error ? error.message : "Unknown error occurred",
                          variant: "destructive",
                          duration: 3000,
                        });
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={isLoading}
                    className="w-full md:w-auto"
                    variant="outline"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Refreshing Data...
                      </>
                    ) : (
                      'Full Refresh Learning Data'
                    )}
                  </Button>
                </div>
              </div>
            </div>
            
            <Separator />
            
            {/* Full Refresh Learning Data */}
            <div className="mt-6">
              <h2 className="text-xl font-semibold mb-3">Force Unlock Next Module</h2>
              <p className="text-muted-foreground mb-4">
                Force unlock the next module in sequence for a user. Use this when a user has completed a module but the next module remains locked.
                This creates or updates the module progress documents directly in Firestore.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label htmlFor="unlockWalletAddress">Wallet Address</Label>
                  <Input
                    id="unlockWalletAddress"
                    placeholder="0x1234..."
                    value={walletAddressToFix}
                    onChange={(e) => setWalletAddressToFix(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="completedModuleId">Current/Completed Module ID</Label>
                  <Input
                    id="completedModuleId" 
                    placeholder="move-language"
                    value={moduleIdToFix}
                    onChange={(e) => setModuleIdToFix(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button 
                  onClick={async () => {
                    try {
                      if (!walletAddressToFix || !moduleIdToFix) {
                        toast({
                          title: "Error",
                          description: "Wallet address and module ID are required",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      setIsLoading(true);
                      toast({
                        title: "Processing",
                        description: `Finding and unlocking next module after ${moduleIdToFix}...`,
                        duration: 3000,
                      });
                      
                      // Find the next module for the current module
                      const galaxiesData = await getGalaxiesWithModules(walletAddressToFix);
                      let nextModuleId = null;
                      
                      // Search through galaxies to find the current module and its next module
                      for (const galaxy of galaxiesData) {
                        const moduleIndex = galaxy.modules.findIndex(m => m.id === moduleIdToFix);
                        if (moduleIndex !== -1 && moduleIndex < galaxy.modules.length - 1) {
                          nextModuleId = galaxy.modules[moduleIndex + 1].id;
                          break;
                        }
                      }
                      
                      if (!nextModuleId) {
                        toast({
                          title: "Error",
                          description: "Could not find a next module for the provided module ID",
                          variant: "destructive",
                          duration: 3000,
                        });
                        setIsLoading(false);
                        return;
                      }
                      
                      // Get user progress document reference
                      const userProgressRef = doc(db, 'learningProgress', walletAddressToFix);
                      const userDoc = await getDoc(userProgressRef);
                      
                      if (!userDoc.exists()) {
                        toast({
                          title: "Error",
                          description: "User progress document not found",
                          variant: "destructive",
                          duration: 3000,
                        });
                        setIsLoading(false);
                        return;
                      }
                      
                      // Explicitly unlock the next module in the moduleProgress subcollection
                      const moduleProgressRef = doc(collection(userProgressRef, 'moduleProgress'), nextModuleId);
                      const moduleProgressDoc = await getDoc(moduleProgressRef);
                      
                      if (moduleProgressDoc.exists()) {
                        // Update existing module progress doc to unlocked
                        await updateDoc(moduleProgressRef, {
                          locked: false,
                          lastAccessed: serverTimestamp()
                        });
                      } else {
                        // Create new module progress doc with unlocked status
                        await setDoc(moduleProgressRef, {
                          moduleId: nextModuleId,
                          completed: false,
                          locked: false,
                          completedLessons: [],
                          lastAccessed: serverTimestamp()
                        });
                      }
                      
                      // Also update the currentModuleId if needed
                      const userData = userDoc.data();
                      if (userData.currentModuleId === moduleIdToFix) {
                        await updateDoc(userProgressRef, {
                          currentModuleId: nextModuleId,
                          lastActivityTimestamp: serverTimestamp()
                        });
                      }
                      
                      toast({
                        title: "Success",
                        description: `Successfully unlocked next module: ${nextModuleId}`,
                        duration: 5000,
                      });
                    } catch (error) {
                      logger.error("Error unlocking next module:", error);
                      toast({
                        title: "Error",
                        description: error instanceof Error ? error.message : "Unknown error",
                        variant: "destructive",
                        duration: 3000,
                      });
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading || !walletAddressToFix || !moduleIdToFix}
                >
                  {isLoading ? 'Processing...' : 'Force Unlock Next Module'}
                </Button>
              </div>
            </div>
            
            <Separator />
            
            {/* Return to Learning */}
            <div className="flex justify-end">
              <Button 
                variant="outline" 
                onClick={() => navigate('/learning')}
              >
                Return to Learning
              </Button>
            </div>
          </div>
        </Card>
      </main>
      
      <Toaster />
    </div>
  );
};

export default Admin; 