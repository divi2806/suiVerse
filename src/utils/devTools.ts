import { 
  regenerateEnhancedModule, 
  regenerateModuleQuiz, 
  regenerateGalaxyModules 
} from '@/services/geminiService';
import { initializeGalaxiesMetadata } from '@/services/learningService';

/**
 * Development utility functions that can be accessed via browser console
 * Use by typing: window.devTools.regenerateModule('move-language')
 */
export const devTools = {
  /**
   * Regenerate a module with enhanced content
   * @param moduleId The ID of the module to regenerate
   * @returns Promise resolving to success status
   */
  regenerateModule: async (moduleId: string): Promise<boolean> => {
    console.log(`[DevTools] Regenerating module ${moduleId}...`);
    try {
      const result = await regenerateEnhancedModule(moduleId);
      console.log(`[DevTools] Module regeneration ${result ? 'successful' : 'failed'}`);
      return result;
    } catch (error) {
      console.error(`[DevTools] Error regenerating module:`, error);
      return false;
    }
  },
  
  /**
   * Regenerate quiz questions for a module
   * @param moduleId The ID of the module to regenerate quiz for
   * @returns Promise resolving to success status
   */
  regenerateQuiz: async (moduleId: string): Promise<boolean> => {
    console.log(`[DevTools] Regenerating quiz for module ${moduleId}...`);
    try {
      const result = await regenerateModuleQuiz(moduleId);
      console.log(`[DevTools] Quiz regeneration ${result ? 'successful' : 'failed'}`);
      return result;
    } catch (error) {
      console.error(`[DevTools] Error regenerating quiz:`, error);
      return false;
    }
  },
  
  /**
   * Regenerate all modules in a galaxy
   * @param galaxyName The name of the galaxy to regenerate modules for
   * @returns Promise resolving to success status and count
   */
  regenerateGalaxy: async (galaxyName: string): Promise<{success: boolean, count: number}> => {
    console.log(`[DevTools] Regenerating all modules in galaxy ${galaxyName}...`);
    try {
      const result = await regenerateGalaxyModules(galaxyName);
      console.log(`[DevTools] Galaxy regeneration ${result.success ? 'successful' : 'failed'}, ${result.count} modules regenerated`);
      return result;
    } catch (error) {
      console.error(`[DevTools] Error regenerating galaxy:`, error);
      return { success: false, count: 0 };
    }
  },
  
  /**
   * Initialize galaxies metadata in Firebase
   * @returns Promise resolving to success status
   */
  initializeGalaxies: async (): Promise<boolean> => {
    console.log(`[DevTools] Initializing galaxies metadata...`);
    try {
      const result = await initializeGalaxiesMetadata();
      console.log(`[DevTools] Galaxies initialization ${result ? 'successful' : 'failed'}`);
      return result;
    } catch (error) {
      console.error(`[DevTools] Error initializing galaxies:`, error);
      return false;
    }
  }
};

// Make devTools available globally
declare global {
  interface Window {
    devTools: typeof devTools;
  }
}

// Expose devTools to the window object
if (typeof window !== 'undefined') {
  window.devTools = devTools;
  console.log('[DevTools] Development tools loaded. Access via window.devTools');
} 