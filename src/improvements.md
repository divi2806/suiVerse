Improvements summary for SuiVerse Learning Platform


## 1. Fixed Galaxy Metadata Storage
- Added initializeGalaxiesMetadata function to ensure galaxy data is stored in Firebase
- Integrated this function into App startup
- Created Admin page to manually trigger galaxy initialization

## 2. Enhanced Move Language Module Content
- Created a specialized prompt for the Move Language module with more detailed code examples
- Added regenerateEnhancedModule function to regenerate modules with better content
- Created mechanism to force regenerate quiz questions to make them unique

## 3. Added Developer Tools
- Created Admin page with UI for managing content
- Added browser console utility (window.devTools) for triggering regeneration
- Fixed imports and navigation

## 4. Improved Quiz Questions
- Added specialized regenerateModuleQuiz function to create unique questions per module
- Enhanced prompts to create more specific questions
