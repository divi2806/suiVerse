# PowerShell script to remove console.log, console.warn, and console.error statements
# from TypeScript and JavaScript files

# Track modified files
$modifiedFiles = 0

# Function to process a file and remove console log statements
function Process-File {
    param($filePath)
    
    try {
        # Read file content
        $content = Get-Content -Path $filePath -Raw
        
        if ($null -eq $content) {
            return $false
        }
        
        # Original content length
        $originalLength = $content.Length
        
        # Replace console log statements using regex
        # Note: PowerShell regex is different than JavaScript
        $newContent = $content -replace "console\.log\([^;]*\);", ""
        $newContent = $newContent -replace "console\.warn\([^;]*\);", ""
        $newContent = $newContent -replace "console\.error\([^;]*\);", ""
        
        # If content was modified
        if ($newContent.Length -ne $originalLength) {
            # Write modified content back to file
            Set-Content -Path $filePath -Value $newContent -NoNewline
            
            # Calculate bytes removed
            $bytesRemoved = $originalLength - $newContent.Length
            
            # Output status
            Write-Host "Cleaned: $filePath (removed $bytesRemoved bytes)"
            
            return $true
        }
        
        return $false
    }
    catch {
        Write-Host "Error processing $filePath" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        return $false
    }
}

# Function to recursively process directories
function Process-Directory {
    param($directory)
    
    $modified = 0
    
    # Get all TypeScript and JavaScript files
    $files = Get-ChildItem -Path $directory -Recurse -File -Include "*.ts", "*.tsx", "*.js", "*.jsx" |
             Where-Object { $_.Directory.FullName -notmatch "(node_modules|dist|\.git)" }
    
    # Process each file
    foreach ($file in $files) {
        $result = Process-File -filePath $file.FullName
        if ($result) {
            $modified++
        }
    }
    
    return $modified
}

# Main script
Write-Host "Starting console log cleanup..." -ForegroundColor Cyan

# Process src directory
$modifiedFiles = Process-Directory -directory ".\src"

Write-Host "Cleanup complete! Modified $modifiedFiles files." -ForegroundColor Green 