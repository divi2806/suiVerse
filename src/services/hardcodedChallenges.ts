import { ChallengeType, DailyChallenge } from './dailyChallengesService';

// Hardcoded code puzzle challenges
export const codePuzzleChallenges: any[] = [
  {
    challenge: "Complete the Sui Move function to create a new Coin",
    codeTemplate: `module sui::coin {
  public fun create<T>(
    value: u64,
    ctx: &mut TxContext
  ): Coin<T> {
    // TODO: Complete the code
  }
}`,
    solution: `let id = object::new(ctx);
Coin { id, value }`,
    hint1: "You need to create a new object with ID",
    hint2: "Return a Coin struct with the new ID and value"
  },
  {
    challenge: "Implement a function to transfer an NFT to a recipient",
    codeTemplate: `module example::nft {
  use sui::transfer;
  use sui::object::{Self, UID};
  use sui::tx_context::{Self, TxContext};
  
  struct NFT has key, store {
    id: UID,
    name: String,
    description: String
  }
  
  // TODO: Implement the transfer_nft function
}`,
    solution: `public fun transfer_nft(nft: NFT, recipient: address) {
  transfer::transfer(nft, recipient)
}`,
    hint1: "Use the transfer module from Sui framework",
    hint2: "The function should take an NFT and a recipient address"
  },
  {
    challenge: "Complete the function to add balance to an existing Coin",
    codeTemplate: `module sui::coin {
  struct Coin<phantom T> has key, store {
    id: UID,
    balance: Balance<T>
  }
  
  public fun join<T>(self: &mut Coin<T>, other: Coin<T>) {
    // TODO: Complete the code
  }
}`,
    solution: `let Coin { id, balance: other_balance } = other;
object::delete(id);
balance::join(&mut self.balance, other_balance);`,
    hint1: "You need to destructure the other coin",
    hint2: "Join the balances and delete the other coin's ID"
  }
];

// Hardcoded quiz challenges
export const quizChallenges: any[] = [
  {
    question: "What is the purpose of the 'key' ability in Sui Move?",
    options: [
      "It allows a struct to be stored as a global state object",
      "It makes a struct immutable",
      "It enables a struct to be used as a generic parameter",
      "It restricts access to struct fields"
    ],
    correctAnswer: 0,
    explanation: "The 'key' ability in Sui Move allows a struct to be stored as a global state object with a unique ID. This is essential for creating objects that exist on-chain and can be transferred between addresses."
  },
  {
    question: "What does the 'phantom' keyword mean when used with generic type parameters?",
    options: [
      "The type only appears in compile-time checks but not at runtime",
      "The type is hidden from other modules",
      "The type can't be modified",
      "The type is automatically dropped at the end of a transaction"
    ],
    correctAnswer: 0,
    explanation: "The 'phantom' keyword is used with generic type parameters that only appear in type signatures but not in the actual data structure. It's commonly used with coin types in Sui Move."
  },
  {
    question: "Which consensus mechanism does Sui use?",
    options: [
      "Narwhal and Bullshark DAG-based consensus",
      "Proof of Work (PoW)",
      "Delegated Proof of Stake (DPoS)",
      "Proof of Authority (PoA)"
    ],
    correctAnswer: 0,
    explanation: "Sui uses Narwhal and Bullshark, which is a DAG-based consensus mechanism that allows for parallel transaction processing and high throughput."
  },
  {
    question: "What is the main difference between Sui Move and Core Move?",
    options: [
      "Sui Move uses object-centric storage rather than global storage",
      "Sui Move doesn't support generics",
      "Sui Move can only be used for financial applications",
      "Sui Move is written in Rust while Core Move is in C++"
    ],
    correctAnswer: 0,
    explanation: "Sui Move uses an object-centric model where each object has a unique ID and can be directly accessed, unlike Core Move which uses a global storage model with resources stored under account addresses."
  },
  {
    question: "How does Sui achieve high transaction throughput?",
    options: [
      "By processing independent transactions in parallel",
      "By using larger block sizes",
      "By requiring more powerful validators",
      "By limiting the types of transactions that can be processed"
    ],
    correctAnswer: 0,
    explanation: "Sui achieves high throughput by identifying and processing independent transactions (those that don't affect the same objects) in parallel, rather than processing all transactions sequentially."
  }
];

// Hardcoded bug hunt challenges
export const bugHuntChallenges: any[] = [
  {
    scenario: "This code is supposed to create and transfer an NFT",
    buggyCode: `module example::buggy_nft {
  use sui::transfer;
  use sui::object::{Self, UID};
  use sui::tx_context::{Self, TxContext};

  struct NFT has key {
    id: UID,
    name: string,
    description: string,
  }

  public fun create_nft(name: string, description: string, ctx: &mut TxContext): NFT {
    let nft = NFT {
      id: object::new(ctx),
      name,
      description,
    };
    nft
  }

  public fun transfer_nft(nft: NFT, recipient: address) {
    transfer::transfer(nft, recipient)
  }
}`,
    bugs: [
      {
        lineHint: "In the struct definition",
        description: "The NFT struct is missing the 'store' ability, which is needed for transfers",
        fix: "Change 'struct NFT has key {' to 'struct NFT has key, store {'"
      },
      {
        lineHint: "In the struct fields",
        description: "The string type is used but not imported",
        fix: "Add 'use std::string::String;' and change 'string' to 'String'"
      }
    ]
  },
  {
    scenario: "This code is supposed to implement a simple counter",
    buggyCode: `module example::counter {
  use sui::object::{Self, UID};
  use sui::tx_context::{Self, TxContext};
  
  struct Counter has key {
    id: UID,
    value: u64
  }
  
  public fun create(ctx: &mut TxContext): Counter {
    Counter {
      id: object::new(ctx),
      count: 0
    }
  }
  
  public fun increment(counter: &mut Counter) {
    counter.value = counter.value + 1;
  }
}`,
    bugs: [
      {
        lineHint: "In the create function",
        description: "The field name is incorrect",
        fix: "Change 'count: 0' to 'value: 0'"
      },
      {
        lineHint: "Missing transfer functionality",
        description: "There's no way to transfer the counter",
        fix: "Add transfer module import and a transfer function"
      }
    ]
  }
];

// Hardcoded concept review challenges
export const conceptReviewChallenges: any[] = [
  {
    concept: "Object Ownership in Sui",
    description: "In Sui, objects can have different ownership models: owned by an address, shared with everyone, or immutable.",
    questionPrompt: "Explain the differences between address-owned, shared, and immutable objects in Sui",
    keyPoints: [
      "Address-owned objects can only be used by their owner",
      "Shared objects can be accessed by anyone but require consensus",
      "Immutable objects can be used by anyone but cannot be modified"
    ],
    practicalExample: "A game item NFT might be address-owned, a marketplace might be shared, and game rules might be immutable"
  },
  {
    concept: "Move's Type System and Abilities",
    description: "Move's type system includes abilities (key, store, copy, drop) that determine what operations can be performed on values of that type.",
    questionPrompt: "What are the four abilities in Move and when would you use each one?",
    keyPoints: [
      "key: Allows a type to be used as a persistent object with an ID",
      "store: Allows values to be transferred between addresses",
      "copy: Allows values to be copied (duplicated)",
      "drop: Allows values to be dropped (discarded)"
    ],
    practicalExample: "An NFT might have key, store abilities but not copy or drop to ensure it can't be duplicated or destroyed"
  }
];

// Test concept review challenge - guaranteed to work during development
export const testConceptReviewChallenge: any = {
  concept: "Consensus Mechanisms in Sui",
  description: "Sui uses a unique Byzantine Fault Tolerance (BFT) consensus mechanism called Narwhal and Bullshark, which enables high-throughput transaction processing.",
  questionPrompt: "Explain how Sui's consensus mechanism differs from traditional blockchain consensus approaches and what advantages it provides for transaction throughput.",
  keyPoints: [
    "Sui uses a DAG-based consensus mechanism (Narwhal and Bullshark) rather than a linear chain",
    "Transactions that don't conflict can be processed in parallel",
    "Immediate finality for single-owner transactions without consensus",
    "Only shared object operations require full consensus",
    "Narwhal is the mempool and data availability engine",
    "Bullshark is the consensus protocol that builds on Narwhal"
  ],
  practicalExample: "When a user transfers an NFT they own to another address, the transaction can finalize immediately. But when interacting with a shared marketplace contract used by multiple users, the transaction goes through full consensus to prevent conflicts."
};

// Generate fallback challenges of different types and difficulties
export const getFallbackChallenges = (): DailyChallenge[] => {
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const challenges: DailyChallenge[] = [];

  // Create a code puzzle challenge (easy)
  const codePuzzleIndex = seed % codePuzzleChallenges.length;
  challenges.push({
    id: `code_puzzle-fallback-${seed}-0`,
    title: "Move Code Challenge",
    description: "Complete the Move code snippet to implement the required functionality",
    type: 'code_puzzle',
    content: codePuzzleChallenges[codePuzzleIndex],
    difficulty: 'easy',
    xpReward: 50,
    suiReward: 0.05,
    tokenReward: 0.1,
    dateCreated: today,
    expiresAt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
    completed: false,
    progress: 0
  });

  // Create a quiz challenge (medium)
  const quizIndex = seed % quizChallenges.length;
  challenges.push({
    id: `quiz-fallback-${seed}-1`,
    title: "Sui Blockchain Quiz",
    description: "Test your knowledge of Sui blockchain concepts",
    type: 'quiz',
    content: quizChallenges[quizIndex],
    difficulty: 'medium',
    xpReward: 100,
    suiReward: 0.1,
    tokenReward: 0.1,
    dateCreated: today,
    expiresAt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
    completed: false,
    progress: 0
  });

  // Create either a bug hunt or concept review challenge (hard)
  // Use the seed to determine whether to create a bug hunt or concept review
  if (seed % 2 === 0) {
    // Create a bug hunt challenge
    const bugHuntIndex = seed % bugHuntChallenges.length;
    challenges.push({
      id: `bug_hunt-fallback-${seed}-2`,
      title: "Debug the Move Contract",
      description: "Find and fix the bugs in this Sui Move smart contract code",
      type: 'bug_hunt',
      content: bugHuntChallenges[bugHuntIndex],
      difficulty: 'hard',
      xpReward: 200,
      suiReward: 0.2,
      tokenReward: 0.1,
      dateCreated: today,
      expiresAt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      completed: false,
      progress: 0
    });
  } else {
    // Create a concept review challenge
    const conceptReviewIndex = seed % conceptReviewChallenges.length;
    challenges.push({
      id: `concept_review-fallback-${seed}-2`,
      title: "Blockchain Concept Mastery",
      description: "Review and apply this key Sui blockchain concept in a practical context",
      type: 'concept_review',
      content: conceptReviewChallenges[conceptReviewIndex],
      difficulty: 'hard',
      xpReward: 150,
      suiReward: 0.15,
      tokenReward: 0.1,
      dateCreated: today,
      expiresAt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      completed: false,
      progress: 0
    });
  }

  return challenges;
}; 