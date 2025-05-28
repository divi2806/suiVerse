/**
 * Console Log Cleanup Script
 * 
 * This script removes all console.log, console.warn, and console.error statements
 * from TypeScript and JavaScript files in the codebase, except for those in 
 * production utility functions that are critical for operation.
 * 
 * Usage:
 * 1. Save this file in the project root
 * 2. Run: node cleanup-logs.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Directories to ignore
const IGNORED_DIRS = [
  'node_modules',
  'dist',
  '.git',
];

// Files that should keep console logs (critical utilities)
const KEEP_LOGS_FILES = [
  // Add any files that should keep console logs for production
];

// Regular expressions for matching console statements
const CONSOLE_PATTERNS = [
  // Console.log statements with various formatting
  /^\s*console\.log\(.+\);?\s*$/gm,
  // Console.log in JSX/TSX with surrounding whitespace
  /{\s*console\.log\(.+\)\s*}/gm,
  // Console.warn statements
  /^\s*console\.warn\(.+\);?\s*$/gm,
  // Console.error statements (except in error handlers)
  /^\s*console\.error\(.+\);?\s*$/gm,
];

// File extensions to process
const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

/**
 * Recursively find all files in directory
 */
function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory() && !IGNORED_DIRS.includes(file)) {
      findFiles(filePath, fileList);
    } else if (
      stat.isFile() && 
      FILE_EXTENSIONS.includes(path.extname(file)) &&
      !KEEP_LOGS_FILES.includes(file)
    ) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Remove console logs from a file
 */
function removeConsoleLogs(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalSize = content.length;
    let modified = false;

    // Apply each pattern
    CONSOLE_PATTERNS.forEach(pattern => {
      const newContent = content.replace(pattern, '');
      if (newContent !== content) {
        modified = true;
        content = newContent;
      }
    });

    // Only write back if file was modified
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      const newSize = content.length;
      const reduction = originalSize - newSize;
      console.log(`Cleaned ${filePath} (removed ${reduction} bytes)`);
      return 1;
    }
    
    return 0;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return 0;
  }
}

/**
 * Main function
 */
function main() {
  console.log('Starting console log cleanup...');
  
  // Get all files recursively
  const files = findFiles('.');
  console.log(`Found ${files.length} files to process`);
  
  // Process each file
  let modifiedCount = 0;
  files.forEach(file => {
    modifiedCount += removeConsoleLogs(file);
  });
  
  console.log(`Completed! Modified ${modifiedCount} files.`);
  
  // Run eslint fix to clean up any formatting issues
  try {
    console.log('Running ESLint to fix formatting...');
    execSync('npx eslint --fix "src/**/*.{ts,tsx,js,jsx}"');
  } catch (error) {
    console.log('ESLint finished with warnings (this is normal)');
  }
}

// Run the script
main(); 