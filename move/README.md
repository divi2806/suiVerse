# Stellar Academy NFTs

This package contains the smart contract for minting achievement NFTs for the Stellar Academy.

## Features

- Mint achievement NFTs for completing modules
- NFTs include module information, description, and image URL
- Supports 16 different modules (1-16)
- Open minting capability - any address can mint NFTs

## Setup

1. Make sure you have the Sui CLI installed:
   ```
   cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui
   ```

2. Configure your Sui client to use the testnet:
   ```
   sui client switch --env testnet
   ```

3. Make sure you have a wallet with some SUI tokens for gas. You can get testnet SUI from the [Sui Faucet](https://faucet.testnet.sui.io/).

## Building and Publishing

1. Navigate to the `move` directory:
   ```
   cd move
   ```

2. Build the package:
   ```
   sui move build
   ```

3. Publish the package to testnet:
   ```
   sui client publish --gas-budget 100000000
   ```

   After publishing, you'll get a response with important IDs:
   - Package ID: The address of your published package
   - MinterCap ID: The ID of the minter capability object

   Save these IDs as they'll be needed for minting NFTs.

## Minting NFTs

You can mint NFTs using the provided `mint_nft.sh` script:

```bash
./mint_nft.sh <package_id> <recipient_address> <module_id> <module_name> <description> <image_url>
```

Example:
```bash
./mint_nft.sh 0xf3e2627ef59f2ec5336dca8b42f7f019442cf72c637f19ae39f839932c36beff 0x528e0cbde56a7bf83f3f17cfd889e9678803ee586fe9267c160e2854a2077989 1 "Intro to Sui" "Completed the introduction to Sui module" "https://api.dicebear.com/7.x/identicon/svg?seed=module1"
```

## Direct Contract Call

Alternatively, you can call the contract directly using the Sui CLI:

```bash
sui client call \
    --package <package_id> \
    --module academy_nfts \
    --function mint_achievement_nft_open \
    --args <recipient_address> <module_id> "<module_name>" "<description>" "<image_url>" \
    --gas-budget 10000000
```

The contract supports module IDs from 1 to 16, corresponding to the different modules in the Stellar Academy.

## Module NFT Images

For the NFT images, we use DiceBear's API to generate unique identicons for each module:

```
https://api.dicebear.com/7.x/identicon/svg?seed=module1
https://api.dicebear.com/7.x/identicon/svg?seed=module2
...
https://api.dicebear.com/7.x/identicon/svg?seed=module16
```

You can also use other DiceBear styles like:
- https://api.dicebear.com/7.x/shapes/svg?seed=module1
- https://api.dicebear.com/7.x/pixel-art/svg?seed=module1
- https://api.dicebear.com/7.x/bottts/svg?seed=module1

## Module Names and Descriptions

Here are suggested names and descriptions for the 16 modules:

1. "Introduction to Sui" - "Completed the foundational module on Sui blockchain"
2. "Sui Move Basics" - "Mastered the fundamentals of Move programming language"
3. "Object Model" - "Understood Sui's unique object-centric model"
4. "Custom Types" - "Created and utilized custom types in Move"
5. "Ownership & Transfer" - "Mastered object ownership and transfer mechanisms"
6. "Capability Pattern" - "Implemented secure access control using capabilities"
7. "Events & Indexing" - "Built systems with event emission and indexing"
8. "Collections" - "Managed groups of objects with collection patterns"
9. "Dynamic Fields" - "Utilized dynamic fields for flexible object composition"
10. "One-Time Witness" - "Implemented the one-time witness pattern"
11. "Witness Pattern" - "Secured operations with witness pattern authentication"
12. "Publisher Pattern" - "Managed package publishing and versioning"
13. "Shared Objects" - "Built applications with shared object access"
14. "Sui Tokenomics" - "Understood Sui's economic model and incentives"
15. "Advanced Patterns" - "Implemented sophisticated design patterns in Move"
16. "Graduation" - "Completed the entire Stellar Academy curriculum" 