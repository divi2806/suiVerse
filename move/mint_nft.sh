#!/bin/bash

# Check if all required arguments are provided
if [ "$#" -lt 6 ]; then
    echo "Usage: $0 <package_id> <recipient_address> <module_id> <module_name> <description> <image_url>"
    echo "Example: $0 0x123 0x789 1 \"Intro to Sui\" \"Completed the introduction module\" \"https://api.dicebear.com/7.x/identicon/svg?seed=module1\""
    exit 1
fi

PACKAGE_ID=$1
RECIPIENT=$2
MODULE_ID=$3
MODULE_NAME=$4
DESCRIPTION=$5
IMAGE_URL=$6

# Mint the NFT
echo "Minting NFT for module $MODULE_ID..."
sui client call \
    --package $PACKAGE_ID \
    --module academy_nfts \
    --function mint_achievement_nft_open \
    --args $RECIPIENT $MODULE_ID "$MODULE_NAME" "$DESCRIPTION" "$IMAGE_URL" \
    --gas-budget 10000000

echo "Done!" 