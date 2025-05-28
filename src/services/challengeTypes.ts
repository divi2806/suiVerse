// Current supported challenge types
export type ChallengeType = 
  | 'code_puzzle' 
  | 'quiz' 
  | 'concept_review' 
  | 'security_audit' 
  | 'optimization'
  | 'defi_scenario';

// Deprecated challenge types being phased out
export type DeprecatedChallengeType = 'math_puzzle' | 'nft_design' | 'bug_hunt';

// Combined type for backward compatibility
export type AnyHistoricalChallengeType = ChallengeType | DeprecatedChallengeType;

// Check if a challenge type is currently supported
export const isValidChallengeType = (type: string): type is ChallengeType => {
  const validTypes: ChallengeType[] = [
    'code_puzzle', 
    'quiz', 
    'concept_review', 
    'security_audit', 
    'optimization',
    'defi_scenario'
  ];
  return validTypes.includes(type as ChallengeType);
};

// Get a replacement challenge type for deprecated types
export const getReplacementChallengeType = (seed: number): ChallengeType => {
  const replacementTypes: ChallengeType[] = ['quiz', 'code_puzzle', 'concept_review'];
  const replacementIndex = seed % replacementTypes.length;
  return replacementTypes[replacementIndex];
}; 