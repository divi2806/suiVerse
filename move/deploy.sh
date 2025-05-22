#!/bin/bash

# Build the package
echo "Building Stellar Academy NFTs package..."
sui move build

# Publish the package to testnet
echo "Publishing package to testnet..."
sui client publish --gas-budget 100000000 --json

echo "Done!" 