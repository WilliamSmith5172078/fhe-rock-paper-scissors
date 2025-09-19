import React, {useState} from 'react';
import { 
  createEncryptedInput, 
  createEncryptedSize, 
  createEncryptedBoolean,
  requestUserDecrypt, 
  requestPublicDecrypt
} from './fheClient';
import { ethers } from 'ethers';

export default function App() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [storedId, setStoredId] = useState(null);
  const [decryptedBlob, setDecryptedBlob] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [userAddress, setUserAddress] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  // Contract configuration with safety checks
  const CONTRACT_ADDRESS = process.env.REACT_APP_CLOUDFHE_ADDR || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
  const CHAIN_ID = 31337; // Local Hardhat network (safe for testing)
  
  // Security validation
  const isContractAddressValid = (addr) => {
    return addr && addr !== '0xYourContractAddressHere' && addr.length === 42 && addr.startsWith('0x');
  };

  // Connect to MetaMask with safety checks
  async function connectWallet() {
    try {
      if (!window.ethereum) {
        alert('MetaMask not detected. Please install MetaMask to use this app.');
        return;
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      
      // Verify we're on the correct network
      const network = await provider.getNetwork();
      if (network.chainId !== CHAIN_ID) {
        alert(`Please switch to the correct network (Chain ID: ${CHAIN_ID})`);
        return;
      }

      setUserAddress(address);
      setIsConnected(true);
      setStatus('connected');
    } catch (error) {
      console.error('Connection failed:', error);
      alert('Failed to connect to MetaMask. Please try again.');
    }
  }

  async function onFileChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    
    // Security checks
    if (f.size > 100 * 1024) {
      alert('File exceeds 100KB limit');
      return;
    }
    
    // Check file type for security
    const allowedTypes = ['text/plain', 'application/pdf', 'image/jpeg', 'image/png', 'application/octet-stream'];
    if (!allowedTypes.includes(f.type)) {
      alert('File type not allowed for security reasons');
      return;
    }
    
    setFile(f);
  }

  async function onUpload() {
    // Security checks
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }
    
    if (!isContractAddressValid(CONTRACT_ADDRESS)) {
      alert('Invalid contract address. Please check your configuration.');
      return;
    }
    
    if (!file) return alert('Please select a file');
    
    try {
      setStatus('reading');
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);

      setStatus('encrypting');
      // Create real FHE encrypted data
      const ciphertext = await createEncryptedInput(uint8);
      const encryptedSize = await createEncryptedSize(file.size);
      const encryptedVisibility = await createEncryptedBoolean(isPublic);

      setStatus('sending');
      // upload encrypted data to contract using ethers
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      // Contract ABI with FHE functions
      const abi = [
        'function uploadCiphertext(bytes calldata ciphertext, bytes calldata encryptedSize, bytes calldata isPublic) external returns (uint256)',
        'function getCiphertext(uint256 id) external view returns (bytes)',
        'function getEncryptedFileSize(uint256 id) external view returns (bytes)',
        'function getEncryptedFileVisibility(uint256 id) external view returns (bytes)',
        'function getFileInfo(uint256 id) external view returns (address uploader, uint256 uploadedAt, uint256 size)',
        'function paused() external view returns (bool)'
      ];
      
      const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

      // Check if contract is paused
      const isPaused = await contract.paused();
      if (isPaused) {
        alert('Contract is currently paused. Please try again later.');
        return;
      }

      // Convert encrypted data to hex strings
      const ciphertextHex = ethers.utils.hexlify(ciphertext);
      const sizeHex = ethers.utils.hexlify(encryptedSize);
      const visibilityHex = ethers.utils.hexlify(encryptedVisibility);
      
      const tx = await contract.uploadCiphertext(ciphertextHex, sizeHex, visibilityHex);
      const receipt = await tx.wait();

      // parse event from receipt (FileUploaded)
      const event = receipt.events?.find(ev => ev.event === 'FileUploaded');
      let id = null;
      if (event && event.args) id = event.args[0].toNumber();

      setStoredId(id);
      setStatus('uploaded');
      alert(`File uploaded successfully! ID: ${id}`);
    } catch (error) {
      console.error('Upload failed:', error);
      setStatus('error');
      alert('Upload failed. Please check the console for details.');
    }
  }

  async function onDownloadPersonal() {
    if (!storedId) return alert('no stored id');
    setStatus('fetchingCiphertext');
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const abi = ['function getCiphertext(uint256 id) external view returns (bytes)'];
    const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);
    const ciphertextHex = await contract.getCiphertext(storedId);

    setStatus('requestingUserDecrypt');
    const ciphertext = ciphertextHex; // pass raw bytes hex
    const plaintext = await requestUserDecrypt(CHAIN_ID, CONTRACT_ADDRESS, ciphertext);

    // plaintext is binary; convert to blob and URL
    const blob = new Blob([new Uint8Array(plaintext)], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    setDecryptedBlob({ url, blob });
    setStatus('done');
  }

  async function onDownloadPublic() {
    if (!storedId) return alert('no stored id');
    setStatus('fetchingCiphertext');
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const abi = ['function getCiphertext(uint256 id) external view returns (bytes)'];
    const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);
    const ciphertextHex = await contract.getCiphertext(storedId);

    setStatus('requestingPublicDecrypt');
    const plaintext = await requestPublicDecrypt(ciphertextHex);

    const blob = new Blob([new Uint8Array(plaintext)], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    setDecryptedBlob({ url, blob });
    setStatus('done');
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">CloudFHE — Secure Demo</h1>
      
      {/* Security Warning */}
      <div className="mb-6 p-4 bg-yellow-100 border border-yellow-400 rounded-lg">
        <h3 className="font-bold text-yellow-800 mb-2">⚠️ Security Notice</h3>
        <p className="text-yellow-700 text-sm">
          This is a DEMO application for educational purposes only. 
          Do NOT use with real funds or sensitive data. 
          This contract runs on a local test network for safety.
        </p>
      </div>

      {/* Connection Status */}
      <div className="mb-4 p-4 bg-gray-100 rounded-lg">
        <h3 className="font-bold mb-2">Wallet Connection</h3>
        {isConnected ? (
          <div className="text-green-600">
            ✅ Connected: {userAddress}
          </div>
        ) : (
          <div>
            <button 
              onClick={connectWallet}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Connect MetaMask
            </button>
          </div>
        )}
      </div>

      {/* Contract Info */}
      <div className="mb-4 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-bold mb-2">Contract Information</h3>
        <p className="text-sm text-gray-600">
          Address: {CONTRACT_ADDRESS}
        </p>
        <p className="text-sm text-gray-600">
          Network: Local Hardhat (Chain ID: {CHAIN_ID})
        </p>
      </div>

      {/* File Operations */}
      <div className="mb-4">
        <h3 className="font-bold mb-2">File Operations</h3>
        <input 
          type="file" 
          onChange={onFileChange}
          className="mb-2 p-2 border rounded"
          disabled={!isConnected}
        />
        
        {/* File Visibility Toggle */}
        <div className="mb-2">
          <label className="flex items-center space-x-2">
            <input 
              type="checkbox" 
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="rounded"
              disabled={!isConnected}
            />
            <span className="text-sm">Make file public (encrypted boolean)</span>
          </label>
        </div>
        
        <div className="mt-2 space-x-2">
          <button 
            onClick={onUpload} 
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
            disabled={!isConnected || !file}
          >
            Upload (Encrypt)
          </button>
          <button 
            onClick={onDownloadPersonal} 
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
            disabled={!isConnected || !storedId}
          >
            Download (Personal Decrypt)
          </button>
          <button 
            onClick={onDownloadPublic} 
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 disabled:bg-gray-400"
            disabled={!isConnected || !storedId}
          >
            Download (Public Decrypt)
          </button>
        </div>
      </div>

      {/* Status */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-bold mb-2">Status</h3>
        <p>Current Status: <span className="font-mono">{status}</span></p>
        <p>Stored File ID: <span className="font-mono">{storedId ?? '-'}</span></p>
      </div>

      {decryptedBlob && (
        <div className="mt-4 p-4 bg-green-50 rounded-lg">
          <h3 className="font-bold mb-2">Download Ready</h3>
          <a 
            href={decryptedBlob.url} 
            download={file?.name || 'download.bin'} 
            className="text-blue-600 underline hover:text-blue-800"
          >
            Save decrypted file
          </a>
        </div>
      )}

      {/* Technical Notes */}
      <div className="mt-6 p-4 bg-gray-100 rounded-lg text-sm text-gray-600">
        <h3 className="font-bold mb-2">FHE Technical Features</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>✅ Real Zama FHEVM integration with homomorphic encryption</li>
          <li>✅ Encrypted file size tracking (euint32)</li>
          <li>✅ Encrypted boolean visibility flags (ebool)</li>
          <li>✅ Homomorphic operations: comparison, addition, subtraction</li>
          <li>✅ EIP-712 signing for secure user decryption</li>
          <li>✅ Gateway integration for FHE computations</li>
          <li>✅ Encrypted user statistics and file metadata</li>
          <li>⚠️ Files limited to 100KB for demo purposes</li>
          <li>⚠️ Requires FHEVM gateway running locally</li>
        </ul>
      </div>
    </div>
  );
}
