// Test script to force mint an NFT
// Run this from the browser console:
// 1. Load the script: fetch('/test-mint.js').then(r => r.text()).then(t => eval(t))
// 2. Call the function: testMintNFT()

function testMintNFT(moduleId = 1, walletAddress = '0x528e0cbde56a7bf83f3f17cfd889e9678803ee586fe9267c160e2854a2077989') {
  console.log('==== TEST MINT NFT ====');
  console.log(`Triggering NFT mint for module ${moduleId} to wallet ${walletAddress}`);
  
  // Try to find the showModuleCompletionPopup function
  if (typeof window.showModuleCompletionPopup === 'function') {
    console.log('Using showModuleCompletionPopup global function');
    window.showModuleCompletionPopup({
      moduleId: moduleId,
      moduleName: `Test Module ${moduleId}`,
      walletAddress: walletAddress,
      xpEarned: 100,
      suiEarned: 0.5
    });
    return;
  }
  
  // Try the direct method
  if (typeof window.showDirectModuleCompletionPopup === 'function') {
    console.log('Using showDirectModuleCompletionPopup global function');
    window.showDirectModuleCompletionPopup({
      moduleId: moduleId,
      moduleName: `Test Module ${moduleId}`,
      walletAddress: walletAddress,
      xpEarned: 100,
      suiEarned: 0.5
    });
    return;
  }
  
  // Last resort: dispatch a custom event
  console.log('Using custom event method');
  const event = new CustomEvent('moduleCompleted', {
    detail: {
      moduleId: moduleId,
      moduleName: `Test Module ${moduleId}`,
      walletAddress: walletAddress,
      xpEarned: 100,
      suiEarned: 0.5
    }
  });
  document.dispatchEvent(event);
}

console.log('Test mint script loaded! Run testMintNFT() to test NFT minting'); 