module stellar_academy_nfts::academy_nfts {
    use sui::tx_context::{Self, TxContext};
    use sui::object::{Self, UID};
    use sui::package;
    use sui::display;
    use sui::transfer;
    use sui::url::{Self, Url};
    use std::string::{Self, String};

    /// Error codes
    const EInvalidModuleId: u64 = 0;
    #[allow(unused_const)]
    const ENotAuthorized: u64 = 1;

    /// One-time witness for the module
    struct ACADEMY_NFTS has drop {}

    /// The Achievement NFT that users receive upon module completion
    struct ModuleAchievementNFT has key, store {
        id: UID,
        module_id: u64,
        module_name: String,
        image_url: Url,
        description: String,
        recipient: address,
        timestamp: u64,
    }

    /// Publisher capability to authorize minting
    struct MinterCap has key, store {
        id: UID,
    }

    /// Initialize the contract and create the display info for NFTs
    fun init(witness: ACADEMY_NFTS, ctx: &mut TxContext) {
        // Create Publisher object
        let publisher = package::claim(witness, ctx);
        
        // Define the display schema for the NFT
        let keys = vector[
            string::utf8(b"name"),
            string::utf8(b"description"),
            string::utf8(b"image_url"),
            string::utf8(b"module_id"),
            string::utf8(b"module_name"),
            string::utf8(b"recipient"),
            string::utf8(b"timestamp"),
            string::utf8(b"project_url"),
        ];
        
        let values = vector[
            string::utf8(b"Stellar Academy: {module_name} Achievement"),
            string::utf8(b"{description}"),
            string::utf8(b"{image_url}"),
            string::utf8(b"{module_id}"),
            string::utf8(b"{module_name}"),
            string::utf8(b"{recipient}"),
            string::utf8(b"{timestamp}"),
            string::utf8(b"https://sui-stellar-academy.vercel.app/"),
        ];
        
        // Create the Display object
        let display = display::new_with_fields<ModuleAchievementNFT>(
            &publisher, keys, values, ctx
        );
        
        // Commit the Display
        display::update_version(&mut display);
        
        // Transfer the Display to the package
        transfer::public_transfer(display, tx_context::sender(ctx));
        transfer::public_transfer(publisher, tx_context::sender(ctx));
        
        // We still create and transfer the minter cap for backward compatibility
        let minter_cap = MinterCap {
            id: object::new(ctx),
        };
        transfer::transfer(minter_cap, tx_context::sender(ctx));
    }

    /// Mint a new achievement NFT for completing a module (open to any address)
    public entry fun mint_achievement_nft_open(
        recipient: address,
        module_id: u64,
        module_name: vector<u8>,
        description: vector<u8>,
        image_url: vector<u8>,
        ctx: &mut TxContext
    ) {
        // Validate module_id (1-16 for the 16 modules)
        assert!(module_id >= 1 && module_id <= 16, EInvalidModuleId);
        
        // Create the NFT
        let nft = ModuleAchievementNFT {
            id: object::new(ctx),
            module_id,
            module_name: string::utf8(module_name),
            image_url: url::new_unsafe_from_bytes(image_url),
            description: string::utf8(description),
            recipient,
            timestamp: tx_context::epoch(ctx),
        };
        
        // Transfer the NFT to the recipient
        transfer::public_transfer(nft, recipient);
    }

    /// Mint a new achievement NFT for completing a module (requires MinterCap)
    /// Kept for backward compatibility
    public entry fun mint_achievement_nft(
        _: &MinterCap,
        recipient: address,
        module_id: u64,
        module_name: vector<u8>,
        description: vector<u8>,
        image_url: vector<u8>,
        ctx: &mut TxContext
    ) {
        // Validate module_id (1-16 for the 16 modules)
        assert!(module_id >= 1 && module_id <= 16, EInvalidModuleId);
        
        // Create the NFT
        let nft = ModuleAchievementNFT {
            id: object::new(ctx),
            module_id,
            module_name: string::utf8(module_name),
            image_url: url::new_unsafe_from_bytes(image_url),
            description: string::utf8(description),
            recipient,
            timestamp: tx_context::epoch(ctx),
        };
        
        // Transfer the NFT to the recipient
        transfer::public_transfer(nft, recipient);
    }

    /// Get the module ID of an NFT
    public fun get_module_id(nft: &ModuleAchievementNFT): u64 {
        nft.module_id
    }

    /// Get the module name of an NFT
    public fun get_module_name(nft: &ModuleAchievementNFT): &String {
        &nft.module_name
    }

    /// Get the image URL of an NFT
    public fun get_image_url(nft: &ModuleAchievementNFT): &Url {
        &nft.image_url
    }

    /// Get the description of an NFT
    public fun get_description(nft: &ModuleAchievementNFT): &String {
        &nft.description
    }

    /// Get the recipient of an NFT
    public fun get_recipient(nft: &ModuleAchievementNFT): address {
        nft.recipient
    }

    /// Get the timestamp when the NFT was minted
    public fun get_timestamp(nft: &ModuleAchievementNFT): u64 {
        nft.timestamp
    }
} 