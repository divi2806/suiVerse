/**
 * Simple Console Log Cleanup Script
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directories to ignore
const IGNORED_DIRS = ['node_modules', 'dist', '.git'];

// File extensions to process
const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

// Process a file to remove console logs
function processFile(filePath) {
  try {
    // Read file content
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Replace console logs
    const newContent = content
      .replace(/console\.log\([^)]*\);?\n?/g, '')
      .replace(/console\.warn\([^)]*\);?\n?/g, '')
      .replace(/console\.error\([^)]*\);?\n?/g, '');
    
    // If content was modified, write it back
    if (newContent !== content) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`Cleaned: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (err) {
    console.error(`Error processing ${filePath}:`, err.message);
    return false;
  }
}

// Process a directory recursively
function processDirectory(dir) {
  let modifiedCount = 0;
  
  // Read directory contents
  const items = fs.readdirSync(dir);
  
  // Process each item
  for (const item of items) {
    const itemPath = path.join(dir, item);
    const stats = fs.statSync(itemPath);
    
    if (stats.isDirectory() && !IGNORED_DIRS.includes(item)) {
      // Recursively process subdirectories
      modifiedCount += processDirectory(itemPath);
    } else if (
      stats.isFile() && 
      FILE_EXTENSIONS.includes(path.extname(item))
    ) {
      // Process files with matching extensions
      if (processFile(itemPath)) {
        modifiedCount++;
      }
    }
  }
  
  return modifiedCount;
}

// Main function
function main() {
  console.log('Starting console log cleanup...');
  
  // Process files starting from src directory
  const modifiedCount = processDirectory(path.join(__dirname, 'src'));
  
  console.log(`Cleanup complete! Modified ${modifiedCount} files.`);
}

// Run the script
main(); 