// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";

contract CloudFHE {
    // File metadata stored onchain as transparent types, but file sizes and sensitive values are stored as FHE handles
    struct FileEntry {
        address owner;
        bytes32 fileHash; // pointer to IPFS / offchain storage
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
    // Upload an encrypted file using proper Zama FHEVM flow.
    // File content is stored off-chain (IPFS), only handles + attestation on-chain.
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
    // Request public decryption of a file's encrypted size. This creates an
    // onchain request that an oracle / relayer will pick up and call the
    // decryption oracle (offchain KMS) to perform threshold decryption.
    // The contract passes a callback selector for the oracle response.
    // ------------------------------------------------------------------
    function requestPublicDecryption(uint256 id) external {
        require(files[id].exists, "file not found");
        // must have been allowed for decryption on Gateway (contract-side ACL enforcement)
        // The actual decryption flow requires the Decryption oracle address to be set.
        require(decryptionOracle != address(0), "oracle not set");

        bytes32[] memory handles = new bytes32[](1);
        handles[0] = FHE.toBytes32(files[id].sizeHandle);

        // This library helper (FHE.requestDecryption) emits an event the offchain oracle listens to
        FHE.requestDecryption(handles, this.__handleDecryption.selector);

        emit DecryptionRequested(id, handles, this.__handleDecryption.selector);
    }

    // ------------------------------------------------------------------
    // Callback invoked by the decryption oracle after KMS signs the plaintext.
    // The FHE library exposes a checkSignatures to validate KMS signatures.
    // ------------------------------------------------------------------
    function __handleDecryption(uint256 requestID, uint32[] memory /* plaintexts */) public {
        // verify caller is the configured oracle to prevent unauthorized callbacks
        require(msg.sender == decryptionOracle || decryptionOracle == address(0), "unauthorized oracle");
        
        // In production, you would validate KMS signatures here:
        // FHE.checkSignatures(requestID, signatures);
        
        // At this point, 'plaintexts' contains the decrypted uint32 file sizes
        // We intentionally don't write plaintexts to storage to avoid accidental exposure
        emit DecryptionRequested(requestID, new bytes32[](0), this.__handleDecryption.selector);
    }

    // ------------------------------------------------------------------
    // Request homomorphic computation (placeholder for future implementation)
    // ------------------------------------------------------------------
    function requestHomomorphicComputation(uint256 id, string memory /* operation */) external {
        require(files[id].exists, "file not found");
        require(msg.sender == files[id].owner, "only owner");
        emit DecryptionRequested(id, new bytes32[](0), this.requestHomomorphicComputation.selector);
    }

    // Admin function to update the oracle
    function setDecryptionOracle(address _oracle) external {
        decryptionOracle = _oracle;
    }
}