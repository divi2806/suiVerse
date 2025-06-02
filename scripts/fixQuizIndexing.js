const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, updateDoc } = require('firebase/firestore');

// Initialize Firebase (replace with your config)
const firebaseConfig = {
  // Config will be loaded from environment
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Modules to skip (already using 1-based indexing)
const skipModules = ['intro-to-sui', 'move-language', 'smart-contracts-101'];

// List of modules to fix
const modulesToFix = [
  'objects-ownership',
  'advanced-concepts',
  'nft-marketplace',
  'defi-protocols',
  'blockchain-security',
  'tokenomics',
  'cross-chain-apps',
  'sui-governance',
  'zk-applications',
  'gaming-on-blockchain',
  'social-networks',
  'identity-solutions',
  'real-world-assets',
  'graduation-galaxy'
];

async function fixQuizIndexing() {
  console.log('Starting to fix quiz indexing...');
  let fixedCount = 0;
  
  for (const moduleId of modulesToFix) {
    try {
      console.log(`Processing module: ${moduleId}`);
      
      // Get the module document
      const moduleRef = doc(db, 'generatedModules', moduleId);
      const moduleDoc = await getDoc(moduleRef);
      
      if (!moduleDoc.exists()) {
        console.log(`Module ${moduleId} not found, skipping`);
        continue;
      }
      
      const moduleData = moduleDoc.data();
      
      // Check if module has quiz questions
      if (!moduleData.quiz || !Array.isArray(moduleData.quiz) || moduleData.quiz.length === 0) {
        console.log(`Module ${moduleId} has no quiz questions, skipping`);
        continue;
      }
      
      // Create a copy of the quiz with updated correctAnswer values
      const updatedQuiz = moduleData.quiz.map(question => {
        // Only update if the correctAnswer is 0-based (0,1,2,3)
        if (question.correctAnswer >= 0 && question.correctAnswer <= 3) {
          return {
            ...question,
            correctAnswer: question.correctAnswer + 1 // Convert to 1-based (1,2,3,4)
          };
        }
        return question;
      });
      
      // Update the module document
      await updateDoc(moduleRef, {
        quiz: updatedQuiz,
        indexingFixed: true // Mark as fixed
      });
      
      console.log(`✅ Fixed ${moduleId}`);
      fixedCount++;
    } catch (error) {
      console.error(`Error fixing ${moduleId}:`, error);
    }
  }
  
  console.log(`Completed! Fixed ${fixedCount} modules.`);
}

// Run the fix function
fixQuizIndexing().catch(console.error); 