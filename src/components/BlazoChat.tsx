import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bot, 
  Send, 
  User, 
  Copy, 
  Check, 
  Sparkles, 
  Rocket, 
  Brain, 
  Zap,
  Code as CodeIcon,
  PenTool,
  FileDown,
  RefreshCw,
  Coins,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { generateSmartContract, analyzeSmartContract } from '@/services/geminiService';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Transaction } from '@mysten/sui/transactions';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-config';

interface Message {
  id: string;
  sender: 'user' | 'blazo';
  text: string;
  timestamp: Date;
  code?: string;
  explanation?: string;
  isLoading?: boolean;
}

interface BlazoCharacter {
  name: string;
  avatar: string;
  personality: string;
  greeting: string;
}

// Character options for Blazo
const blazoCharacter: BlazoCharacter = {
  name: "Blazo",
  avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=blazo&backgroundColor=2563eb&eyes=bulging",
  personality: "friendly, helpful, and excited about Move smart contracts",
  greeting: "Hey there, space explorer! 👋 I'm Blazo, your AI assistant for Move smart contracts on Sui. What kind of contract can I help you create today?"
};

// Example contract templates for suggestions
const CONTRACT_TEMPLATES = [
  {
    title: "Simple Coin",
    prompt: "Create a simple coin/token on Sui",
    icon: <Sparkles className="h-3 w-3" />
  },
  {
    title: "NFT Collection",
    prompt: "Create an NFT collection with minting functionality",
    icon: <PenTool className="h-3 w-3" />
  },
  {
    title: "Shared Counter",
    prompt: "Create a basic shared counter that anyone can increment",
    icon: <Zap className="h-3 w-3" />
  },
  {
    title: "Simple Marketplace",
    prompt: "Create a simple marketplace for buying and selling items",
    icon: <Rocket className="h-3 w-3" />
  },
  {
    title: "Multi-sig Wallet",
    prompt: "Create a multi-signature wallet contract",
    icon: <Brain className="h-3 w-3" />
  }
];

interface BlazoChatProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
}

export interface BlazoChatHandle {
  sendPrompt: (prompt: string) => Promise<void>;
}

// Format text to replace markdown-style bold with HTML bold and improve code formatting
const formatResponseText = (text: string): string => {
  // Replace markdown-style bold with HTML strong tags
  let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Format section headers (###) with heading styles and add more spacing
  formatted = formatted.replace(/###\s+(.*?)(?:\n|$)/g, '<h3 class="text-lg font-semibold mt-8 mb-4 pt-4 border-t border-border/30">$1</h3>');
  
  // Format subheaders (numbers followed by dot and space) with better spacing
  formatted = formatted.replace(/(\d+)\.\s+(.*?)(?:\n|$)/g, '<div class="mt-6 mb-3 subheader"><strong>$1.</strong> $2</div>');
  
  // Format nested subheaders (letters followed by dot and space)
  formatted = formatted.replace(/\s+([a-z])\.\s+(.*?)(?:\n|$)/g, '<div class="ml-4 mt-4 mb-3 nested-item"><strong>$1.</strong> $2</div>');
  
  // Format code references (backticks) with code styling
  formatted = formatted.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-primary/10 rounded text-primary font-mono text-sm">$1</code>');
  
  // Format function definitions with special styling and more spacing
  formatted = formatted.replace(/(public|entry)\s+(fun|function)\s+([a-zA-Z0-9_]+)/g, 
    '<div class="mt-8 mb-4 pt-4 border-t border-border/30"><span class="text-blue-400 font-medium">$1</span> <span class="text-blue-400 font-medium">$2</span> <span class="font-semibold">$3</span></div>');
  
  // Add larger spacing between big sections (double line breaks)
  formatted = formatted.replace(/\n\n/g, '<div class="my-6 border-b border-border/30 pb-3"></div>');
  
  // Handle lists better
  formatted = formatted.replace(/^\s*-\s+(.*?)(?:\n|$)/gm, '<li class="ml-4 my-3">$1</li>');
  formatted = formatted.replace(/(<li.*?<\/li>)(\n?)(<li.*?<\/li>)/g, '$1$3');
  
  // Wrap consecutive list items in ul tags with more spacing
  let listPattern = /(<li.*?<\/li>)(<li.*?<\/li>)+/g;
  while (listPattern.test(formatted)) {
    formatted = formatted.replace(listPattern, '<ul class="my-5 py-3 space-y-3">$&</ul>');
  }
  
  // Add styling for function names, module names etc.
  formatted = formatted.replace(/\b(module|struct|fun|public|entry|friend|const)\b/g, '<span class="text-blue-400 font-medium">$1</span>');
  formatted = formatted.replace(/\b(init|create|transfer|get|set|has)\w*\b/g, '<span class="text-green-400 font-medium">$1</span>');
  
  // Add dividers between conceptual sections when paragraph starts with "Let's" or "Now"
  formatted = formatted.replace(/(?<=<\/div>)(Let's|Now)/g, '<div class="my-6 pt-4 border-t border-border/40"></div>$1');
  
  // Add paragraph spacing
  formatted = formatted.replace(/([.!?])\s+(?=[A-Z])/g, '$1</p><p class="my-3">');
  
  // Wrap text in paragraphs if not already in a container
  if (!formatted.includes('<p')) {
    formatted = '<p>' + formatted + '</p>';
  }
  
  return formatted;
};

const BlazoChat = forwardRef<BlazoChatHandle, BlazoChatProps>(({ textareaRef }, ref) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      sender: 'blazo',
      text: blazoCharacter.greeting,
      timestamp: new Date(),
    }
  ]);
  
  const [promptInput, setPromptInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [queryCount, setQueryCount] = useState(0);
  const [showPaymentPopup, setShowPaymentPopup] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [hasUnlockedAccess, setHasUnlockedAccess] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
  const { userData, updateUserData } = useAuth();
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  
  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copiedCode) {
      const timer = setTimeout(() => {
        setCopiedCode(false);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [copiedCode]);
  
  // Check if payment is required after query count changes
  useEffect(() => {
    if (queryCount === 4 && !hasUnlockedAccess) {
      setShowPaymentPopup(true);
    }
  }, [queryCount, hasUnlockedAccess]);
  
  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    sendPrompt: async (prompt: string) => {
      setPromptInput(prompt);
      await sendMessage(prompt);
    }
  }));
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!promptInput.trim() || isGenerating) return;
    
    await sendMessage(promptInput);
  };
  
  // Separate function to send messages (allows reuse by example prompts)
  const sendMessage = async (message: string) => {
    if (!message.trim() || isGenerating) return;
    
    // Check if access is restricted and payment is required
    if (queryCount >= 4 && !hasUnlockedAccess) {
      setShowPaymentPopup(true);
      return;
    }
    
    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: message,
      timestamp: new Date()
    };
    
    const loadingMessage: Message = {
      id: (Date.now() + 1).toString(),
      sender: 'blazo',
      text: 'Generating your smart contract...',
      timestamp: new Date(),
      isLoading: true
    };
    
    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setPromptInput('');
    setIsGenerating(true);
    
    // Increment query count
    setQueryCount(prev => prev + 1);
    
    try {
      // Generate smart contract using Gemini API
      const { code, explanation } = await generateSmartContract(message);
      
      // Format any markdown-style bold in explanation
      const formattedExplanation = formatResponseText(explanation);
      
      // Replace loading message with actual response
      setMessages(prev => prev.map(msg => 
        msg.id === loadingMessage.id
          ? {
              ...msg,
              text: 'Here\'s your Move smart contract:',
              code,
              explanation: formattedExplanation,
              isLoading: false
            }
          : msg
      ));
      
      // If user is logged in, award XP for using Blazo
      if (userData && userData.walletAddress) {
        // Award 15 XP for generating a contract
        const newXp = (userData.xp || 0) + 15;
        
        // Update user data with new XP
        updateUserData({
          ...userData,
          xp: newXp
        });
        
        // Show XP earned notification
        toast({
          title: "XP Earned!",
          description: "You earned 15 XP for creating a smart contract.",
          duration: 3000,
        });
      }
    } catch (error) {
      
      
      // Replace loading message with error
      setMessages(prev => prev.map(msg => 
        msg.id === loadingMessage.id
          ? {
              ...msg,
              text: 'Oops! I had trouble generating that smart contract. Could you try a different prompt or be more specific?',
              isLoading: false
            }
          : msg
      ));
      
      toast({
        title: "Generation Error",
        description: "There was an error generating your smart contract. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleTemplateClick = (prompt: string) => {
    setPromptInput(prompt);
  };
  
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    
    toast({
      title: "Code Copied!",
      description: "Smart contract code copied to clipboard",
      duration: 1500,
    });
  };
  
  const handleDownloadCode = (code: string, prompt: string) => {
    // Create sanitized filename from the prompt
    const sanitizedName = prompt.toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 30);
    
    const filename = `blazo_${sanitizedName}.move`;
    
    // Create blob and download
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Code Downloaded!",
      description: `Saved as ${filename}`,
      duration: 2000,
    });
  };
  
  const handleAnalyzeCode = async (code: string) => {
    if (!code || isGenerating) return;
    
    const loadingMessage: Message = {
      id: Date.now().toString(),
      sender: 'blazo',
      text: 'Analyzing your smart contract...',
      timestamp: new Date(),
      isLoading: true
    };
    
    setMessages(prev => [...prev, loadingMessage]);
    setIsGenerating(true);
    
    try {
      const analysis = await analyzeSmartContract(code);
      
      // Format any markdown-style bold in analysis text
      const formattedAnalysis = formatResponseText(analysis);
      
      setMessages(prev => prev.map(msg => 
        msg.id === loadingMessage.id
          ? {
              ...msg,
              text: 'Smart Contract Analysis:',
              explanation: formattedAnalysis,
              isLoading: false
            }
          : msg
      ));
    } catch (error) {
      
      
      setMessages(prev => prev.map(msg => 
        msg.id === loadingMessage.id
          ? {
              ...msg,
              text: 'I had trouble analyzing that smart contract. Please try again later.',
              isLoading: false
            }
          : msg
      ));
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Handle payment for unlocking Blazo access
  const handlePayment = async () => {
    if (!currentAccount || isPaying) return;
    
    setIsPaying(true);
    
    try {
      // Create a simple transaction block
      const tx = new Transaction();
      
      // Transfer 1 SUI to the platform wallet
      const platformWallet = "0x1a0653c5c65355eef0069f431f18ef8f829125e1ed20db0bfd054b4d338553ef";
      
      // Add 1 SUI coin transfer transaction (1 SUI = 10^9 MIST)
      const amountMist = 1_000_000_000;
      
      // Create transaction - use Transaction class instead of TransactionBlock
      const [coin] = tx.splitCoins(tx.gas, [amountMist]);
      tx.transferObjects([coin], platformWallet);
      
      // Execute the transaction using the hook pattern established in the project
      return new Promise<void>((resolve, reject) => {
        signAndExecuteTransaction(
          {
            transaction: tx,
          },
          {
            onSuccess: (result) => {
              
              
              // Update user's access status
              setHasUnlockedAccess(true);
              setShowPaymentPopup(false);
              
              // Show success notification
              toast({
                title: "Access Unlocked!",
                description: "You now have unlimited access to Blazo AI",
                duration: 3000,
              });
              
              // Also update user data to remember they've paid
              if (userData) {
                // Store the data in a way that doesn't trigger type errors
                // Use field that exists in WalletUserData interface
                updateUserData({
                  ...userData,
                  suiTokens: (userData.suiTokens || 0) - 1, // Deduct 1 SUI token
                });

                // Use a Firebase direct write approach for custom fields
                try {
                  const docRef = doc(db, 'learningProgress', userData.walletAddress);
                  updateDoc(docRef, {
                    blazoUnlocked: true
                  });
                } catch (err) {
                  
                }
              }
              
              resolve();
            },
            onError: (error) => {
              
              toast({
                title: "Payment Failed",
                description: "There was an error processing your payment. Please try again.",
                variant: "destructive",
                duration: 3000,
              });
              setIsPaying(false);
              reject(error);
            },
            onSettled: () => {
              setIsPaying(false);
            }
          }
        );
      });
    } catch (error) {
      
      toast({
        title: "Payment Failed",
        description: "There was an error processing your payment. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
      setIsPaying(false);
    }
  };
  
  const renderMessage = (message: Message) => {
    if (message.sender === 'blazo') {
      return (
        <div className="flex flex-col space-y-2 animate-fadeIn">
          <div className="flex items-start space-x-2">
            <Avatar className="h-8 w-8 border border-primary/30 flex-shrink-0">
              <AvatarImage src={blazoCharacter.avatar} />
              <AvatarFallback className="bg-primary/20">BZ</AvatarFallback>
            </Avatar>
            
            <div className="flex flex-col space-y-1 w-full max-w-[calc(100%-40px)]">
              <div className="flex items-center">
                <span className="text-xs font-medium text-primary mr-2">Blazo</span>
                <span className="text-xs text-muted-foreground">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              
              {message.isLoading ? (
                <div className="bg-primary/5 p-3 rounded-lg rounded-tl-none">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="h-2 w-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="h-2 w-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="h-2 w-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-sm">{message.text}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-primary/5 p-3 rounded-lg rounded-tl-none">
                  <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                  
                  {message.code && (
                    <div className="mt-3 space-y-2">
                      <div className="relative">
                        <div className="absolute top-2 right-2 flex space-x-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 rounded-full bg-background/20 backdrop-blur-sm"
                            onClick={() => handleCopyCode(message.code || '')}
                          >
                            {copiedCode ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 rounded-full bg-background/20 backdrop-blur-sm"
                            onClick={() => handleDownloadCode(message.code || '', messages[messages.indexOf(message) - 1]?.text || 'smart_contract')}
                          >
                            <FileDown className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        <div className="max-h-[500px] overflow-auto rounded-md">
                          <SyntaxHighlighter
                            language="rust"
                            style={vscDarkPlus}
                            customStyle={{
                              margin: 0,
                              borderRadius: '0.375rem',
                              fontSize: '0.85rem',
                              lineHeight: '1.5',
                            }}
                          >
                            {message.code}
                          </SyntaxHighlighter>
                        </div>
                      </div>
                      
                      <div className="flex justify-between">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => handleAnalyzeCode(message.code || '')}
                          disabled={isGenerating}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Analyze Code
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {message.explanation && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="text-xs font-medium mb-3 text-primary">Explanation:</div>
                      <div 
                        className="text-sm explanation-content prose-sm max-w-none space-y-4" 
                        dangerouslySetInnerHTML={{ __html: message.explanation }}
                      ></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="flex justify-end animate-fadeIn">
          <div className="flex flex-col space-y-1 max-w-[85%]">
            <div className="flex items-center justify-end">
              <span className="text-xs text-muted-foreground mr-2">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-xs font-medium">You</span>
            </div>
            <div className="bg-primary/10 p-3 rounded-lg rounded-tr-none">
              <p className="text-sm whitespace-pre-wrap">{message.text}</p>
            </div>
          </div>
        </div>
      );
    }
  };
  
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full px-1">
          <div className="flex flex-col space-y-4 p-3">
            {messages.map(message => (
              <div key={message.id}>
                {renderMessage(message)}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>
      
      <div className="border-t border-border p-3">
        <div className="mb-2">
          <p className="text-xs text-muted-foreground mb-2">Quick templates:</p>
          <div className="flex flex-wrap gap-2">
            {CONTRACT_TEMPLATES.map((template, index) => (
              <Badge
                key={index}
                variant="outline"
                className="cursor-pointer hover:bg-primary/5 transition-colors bg-card"
                onClick={() => handleTemplateClick(template.prompt)}
              >
                {template.icon}
                <span className="ml-1">{template.title}</span>
              </Badge>
            ))}
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <div className="flex-1 relative">
            <Textarea
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="Describe the smart contract you'd like to create..."
              className="min-h-[60px] max-h-[120px] resize-none pr-10"
              disabled={isGenerating}
              ref={textareaRef || internalTextareaRef}
            />
            <div className="absolute right-3 bottom-3">
              <CodeIcon className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <Button 
            type="submit" 
            size="icon"
            disabled={isGenerating || !promptInput.trim()}
            className={isGenerating ? 'opacity-50' : 'neon-button'}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
        
        <div className="mt-2 flex items-center justify-end">
          {userData?.walletAddress && (
            <p className="text-xs flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-yellow-400" />
              <span>Earn 15 XP per contract generated</span>
            </p>
          )}
        </div>
      </div>
      
      {/* Payment Popup */}
      <AnimatePresence>
        {showPaymentPopup && (
          <motion.div
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="galaxy-card max-w-md w-full p-6 relative overflow-hidden"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25 }}
            >
              <div className="star-bg"></div>
              
              <div className="text-center mb-6">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Lock className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-heading font-bold">Unlock Blazo AI</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  You've reached the free limit of 4 queries.
                  Unlock unlimited access to Blazo AI for just 1 SUI.
                </p>
              </div>
              
              <div className="p-4 bg-primary/5 rounded-lg mb-6">
                <div className="flex justify-between mb-2">
                  <span className="text-sm">Unlimited smart contracts</span>
                  <Check className="h-4 w-4 text-primary" />
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm">Code analysis & optimization</span>
                  <Check className="h-4 w-4 text-primary" />
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">XP rewards for each contract</span>
                  <Check className="h-4 w-4 text-primary" />
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowPaymentPopup(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-primary text-white neon-button"
                  onClick={handlePayment}
                  disabled={isPaying}
                >
                  {isPaying ? (
                    <span className="flex items-center">
                      <span className="animate-spin mr-2">◌</span>
                      Processing...
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <Coins className="h-4 w-4 mr-2" />
                      Pay 1 SUI
                    </span>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

BlazoChat.displayName = 'BlazoChat';

export default BlazoChat; 