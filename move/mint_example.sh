#!/bin/bash

# Set the package ID from our deployment
PACKAGE_ID="0x3113324e84c22ce4925d642f2c2ead709a8a8aaf0928cd23873ddec6f31a1440"

# Example recipient address
RECIPIENT="0x528e0cbde56a7bf83f3f17cfd889e9678803ee586fe9267c160e2854a2077989"

# Run the mint_nft.sh script to mint an NFT for module 1
./mint_nft.sh $PACKAGE_ID $RECIPIENT 1 "Intro to Sui" "Completed the introduction to Sui module" "https://api.dicebear.com/7.x/identicon/svg?seed=module1"

# You can also mint other modules by changing the parameters
# For example, to mint module 2:
# ./mint_nft.sh $PACKAGE_ID $RECIPIENT 2 "Sui Move Basics" "Mastered the fundamentals of Move programming language" "https://api.dicebear.com/7.x/identicon/svg?seed=module2" 