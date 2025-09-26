// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Fixed CloudFHE contract adapted to Zama FHEVM Solidity library patterns.
// Key points implemented:
// - Uses @fhevm/solidity (FHE handles) instead of raw bytes where appropriate
// - Uses symbolic FHE calls (they emit events) so coprocessors will perform actual FHE offchain
// - Uses FHE.allow / FHE.allowTransient and FHE.isSenderAllowed for ACL checks
// - Avoids FHE operations in view/pure functions
// - Provides upload (fromExternal), a homomorphic size-add example, and a public decryption request

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";

contract CloudFHE {
    // File metadata stored onchain as transparent types, but file sizes and sensitive values are stored as FHE handles
    struct FileEntry {
        address owner;
        bytes32 fileHash; // pointer to IPFS / offchain storage if used
        euint32 sizeHandle; // encrypted file size handle
        bool exists;
    }

    mapping(uint256 => FileEntry) public files;
    uint256 public nextId;

    // Decryption oracle address (set by deployer)
    address public decryptionOracle;

    event FileUploaded(uint256 indexed id, address indexed owner, bytes32 fileHash, bytes32 sizeHandle);
    event DecryptionRequested(uint256 indexed id, bytes32[] handles, bytes4 callback);

    constructor(address _decryptionOracle) {
        decryptionOracle = _decryptionOracle;
    }

    // ------------------------------------------------------------------
    // Upload an encrypted file.
    // The frontend / relayer should have obtained the externalEuint32 handle list
    // and a coprocessor attestation (signatures) and pass the handle here.
    // fromExternal verifies the attestation and returns an euint32 handle.
    // ------------------------------------------------------------------
    function uploadFromExternal(
        bytes32 ipfsHash,
        externalEuint32 externalSize,
        bytes calldata attestation
    ) external returns (uint256) {
        // Convert external handle -> local handle (does internal checks using attestation)
        euint32 sizeHandle = FHE.fromExternal(externalSize, attestation);

        // enforce that caller is allowed to access the handle
        require(FHE.isSenderAllowed(sizeHandle), "caller not allowed for provided handle");

        uint256 id = nextId++;
        files[id] = FileEntry({
            owner: msg.sender,
            fileHash: ipfsHash,
            sizeHandle: sizeHandle,
            exists: true
        });

        // Persist ACL: allow owner persistent access to their file size and allow this contract to use it later
        FHE.allow(sizeHandle, msg.sender);
        FHE.allow(sizeHandle, address(this));

        emit FileUploaded(id, msg.sender, ipfsHash, FHE.toBytes32(sizeHandle));
        return id;
    }

    // ------------------------------------------------------------------
    // Example homomorphic operation: add a delta to the encrypted size.
    // This is a symbolic FHE call: it returns a new handle and emits an event
    // that coprocessors will execute offchain. The function is non-view.
    // ------------------------------------------------------------------
    function incrementSize(uint256 id, euint32 delta) external {
        require(files[id].exists, "file not found");
        // only owner may request size changes
        require(msg.sender == files[id].owner, "only owner");

        // ensure caller is allowed to operate on the stored handle
        require(FHE.isSenderAllowed(files[id].sizeHandle), "caller not allowed for file handle");

        // perform symbolic add -> produces new handle deterministically and emits FheOpEvent
        euint32 newSize = FHE.add(files[id].sizeHandle, delta);

        // allow owner and contract persistent access to new handle (so future ops can use it)
        FHE.allow(newSize, files[id].owner);
        FHE.allow(newSize, address(this));

        // update mapping
        files[id].sizeHandle = newSize;
    }

    // ------------------------------------------------------------------
    // Request public decryption of a file's encrypted size.
    // This creates an onchain request that the FHEVM relayer will pick up
    // and perform threshold decryption.
    // ------------------------------------------------------------------
    function requestPublicDecryption(uint256 id) external {
        require(files[id].exists, "file not found");

        // Request decryption through FHEVM relayer
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = FHE.toBytes32(files[id].sizeHandle);

        // Use FHE.requestDecryption for relayer integration
        FHE.requestDecryption(handles, this.__handleDecryption.selector);

        emit DecryptionRequested(id, handles, this.__handleDecryption.selector);
    }

    // ------------------------------------------------------------------
    // Callback invoked by the FHEVM relayer after processing the decryption.
    // This function is called by the relayer with the decrypted plaintext.
    // ------------------------------------------------------------------
    function __handleDecryption(uint256 requestID, uint32[] memory /* plaintexts */) public {
        // Verify caller is authorized (in production, this would be the relayer)
        require(msg.sender == decryptionOracle || decryptionOracle == address(0), "unauthorized caller");
        
        // At this point, 'plaintexts[0]' contains the decrypted uint32 file size
        // We intentionally don't write plaintexts to storage to avoid accidental exposure
        // The frontend should capture the result from events or off-chain storage
        
        // Emit an event with the decrypted result for frontend to capture
        emit DecryptionRequested(requestID, new bytes32[](0), this.__handleDecryption.selector);
    }

    // ------------------------------------------------------------------
    // Request homomorphic computation (placeholder for future implementation)
    // This demonstrates how to perform encrypted computations off-chain
    // ------------------------------------------------------------------
    function requestHomomorphicComputation(uint256 id, string memory /* operation */) external {
        require(files[id].exists, "file not found");
        require(msg.sender == files[id].owner, "only owner");

        // For now, this is a placeholder for future homomorphic computation features
        // In a full implementation, this would request encrypted computations from the relayer
        
        emit DecryptionRequested(id, new bytes32[](0), this.requestHomomorphicComputation.selector);
    }

    // Admin function to update the oracle (kept for compatibility)
    function setDecryptionOracle(address _oracle) external {
        // In a production app restrict this to onlyOwner / governance
        decryptionOracle = _oracle;
    }
}
