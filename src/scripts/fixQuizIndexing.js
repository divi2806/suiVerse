import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-config';

// Modules to skip (already using 1-based indexing)
const skipModules = ['intro-to-sui', 'move-language', 'smart-contracts-101'];

// Modules to fix (all except the ones already known to be correct)
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

export async function fixQuizIndexing() {
  console.log('Starting to fix quiz indexing...');
  let fixedCount = 0;
  const results = [];
  
  for (const moduleId of modulesToFix) {
    try {
      console.log(`Processing module: ${moduleId}`);
      
      // Get the module document
      const moduleRef = doc(db, 'generatedModules', moduleId);
      const moduleDoc = await getDoc(moduleRef);
      
      if (!moduleDoc.exists()) {
        console.log(`Module ${moduleId} not found, skipping`);
        results.push({ moduleId, status: 'skipped', reason: 'not found' });
        continue;
      }
      
      const moduleData = moduleDoc.data();
      
      // Check if module has quiz questions
      if (!moduleData.quiz || !Array.isArray(moduleData.quiz) || moduleData.quiz.length === 0) {
        console.log(`Module ${moduleId} has no quiz questions, skipping`);
        results.push({ moduleId, status: 'skipped', reason: 'no quiz' });
        continue;
      }
      
      // Check if already fixed
      if (moduleData.indexingFixedReverse) {
        console.log(`Module ${moduleId} already fixed, skipping`);
        results.push({ moduleId, status: 'skipped', reason: 'already fixed' });
        continue;
      }
      
      // Create a copy of the quiz with updated correctAnswer values
      const updatedQuiz = moduleData.quiz.map(question => {
        // Convert correctAnswer to proper 0-based index by subtracting 2 from all values
        // Make sure we don't go below 0
        const oldValue = question.correctAnswer;
        const newValue = Math.max(0, oldValue - 2);
        
        console.log(`  - Fixing question "${question.question.substring(0, 40)}...": ${oldValue} -> ${newValue}`);
        
        return {
          ...question,
          correctAnswer: newValue
        };
      });
      
      // Update the module document
      await updateDoc(moduleRef, {
        quiz: updatedQuiz,
        indexingFixedReverse: true // Mark as fixed
      });
      
      console.log(`✅ Fixed ${moduleId}`);
      results.push({ moduleId, status: 'fixed', count: updatedQuiz.length });
      fixedCount++;
    } catch (error) {
      console.error(`Error fixing ${moduleId}:`, error);
      results.push({ moduleId, status: 'error', error: error.message });
    }
  }
  
  console.log(`Completed! Fixed ${fixedCount} modules.`);
  return results;
} 