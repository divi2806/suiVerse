interface Window {
  showModuleCompletionPopup: (data: {
    moduleId: number;
    moduleName: string;
    walletAddress: string;
    xpEarned: number;
    suiEarned: number;
  }) => void;
} 