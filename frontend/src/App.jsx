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
  const [userFiles, setUserFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Contract configuration with safety checks
  const CONTRACT_ADDRESS = process.env.REACT_APP_CLOUDFHE_ADDR || '0xD46CD728c5DD949340B121ef68ac32a0c589Afd5';
  const CHAIN_ID = 11155111; // Sepolia testnet
  
  // Security validation
  const isContractAddressValid = (addr) => {
    return addr && 
           addr !== '0xYourContractAddressHere' && 
           addr !== '0xYourSepoliaContractAddress' && 
           addr.length === 42 && 
           addr.startsWith('0x');
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
      
      // Verify we're on the correct network (Sepolia)
      const network = await provider.getNetwork();
      if (network.chainId !== CHAIN_ID) {
        // Try to switch to Sepolia
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xaa36a7' }], // 11155111 in hex
          });
        } catch (switchError) {
          // If Sepolia is not added, add it
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0xaa36a7',
                chainName: 'Sepolia Test Network',
                nativeCurrency: {
                  name: 'SepoliaETH',
                  symbol: 'SepoliaETH',
                  decimals: 18
                },
                rpcUrls: ['https://sepolia.infura.io/v3/'],
                blockExplorerUrls: ['https://sepolia.etherscan.io/']
              }]
            });
          } else {
            alert('Please manually switch to Sepolia testnet in MetaMask');
            return;
          }
        }
      }

      setUserAddress(address);
      setIsConnected(true);
      setStatus('connected');
      
      // Load user files after connecting
      await loadUserFiles();
    } catch (error) {
      console.error('Connection failed:', error);
      alert('Failed to connect to MetaMask. Please try again.');
    }
  }

  // Load user files from contract
  async function loadUserFiles() {
    if (!isConnected || !userAddress) return;
    
    try {
      setLoadingFiles(true);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const abi = [
        'function getUserFiles(address user) external view returns (uint256[])',
        'function getFileInfo(uint256 id) external view returns (address uploader, uint256 uploadedAt, uint256 size)'
      ];
      const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);
      
      // Get user's file IDs
      const fileIds = await contract.getUserFiles(userAddress);
      
      // Get file info for each ID
      const files = await Promise.all(
        fileIds.map(async (id) => {
          const info = await contract.getFileInfo(id);
          return {
            id: id.toNumber(),
            uploader: info.uploader,
            uploadedAt: new Date(info.uploadedAt.toNumber() * 1000),
            size: info.size.toNumber()
          };
        })
      );
      
      setUserFiles(files);
      setLoadingFiles(false);
    } catch (error) {
      console.error('Failed to load user files:', error);
      setLoadingFiles(false);
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
      
          // Contract ABI with FHEVM functions
          const abi = [
            'function uploadCiphertext(bytes calldata ciphertext, euint32 encryptedSize, ebool isPublic) external returns (uint256)',
            'function getCiphertext(uint256 id) external view returns (bytes)',
            'function getEncryptedFileSize(uint256 id) external view returns (euint32)',
            'function getEncryptedFileVisibility(uint256 id) external view returns (ebool)',
            'function getFileInfo(uint256 id) external view returns (address uploader, uint256 uploadedAt, uint256 size)',
            'function getUserFiles(address user) external view returns (uint256[])',
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
      
      // Refresh user files list
      await loadUserFiles();
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

  // Download file by ID
  async function downloadFile(fileId) {
    try {
      setStatus('fetchingCiphertext');
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const abi = ['function getCiphertext(uint256 id) external view returns (bytes)'];
      const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);
      const ciphertextHex = await contract.getCiphertext(fileId);

      setStatus('requestingUserDecrypt');
      const plaintext = await requestUserDecrypt(CHAIN_ID, CONTRACT_ADDRESS, ciphertextHex);

      const blob = new Blob([new Uint8Array(plaintext)], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `file_${fileId}.bin`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setStatus('done');
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed. Please check the console for details.');
    }
  }

  // Delete file by ID
  async function deleteFile(fileId) {
    if (!confirm('Are you sure you want to delete this file?')) return;
    
    try {
      setStatus('deleting');
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const abi = ['function deleteFile(uint256 id) external'];
      const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
      
      const tx = await contract.deleteFile(fileId);
      await tx.wait();
      
      setStatus('deleted');
      alert('File deleted successfully!');
      
      // Refresh user files list
      await loadUserFiles();
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Delete failed. Please check the console for details.');
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">CloudFHE — Secure Demo</h1>
      
      {/* Security Warning */}
      <div className="mb-6 p-4 bg-yellow-100 border border-yellow-400 rounded-lg">
        <h3 className="font-bold text-yellow-800 mb-2">⚠️ Sepolia Testnet</h3>
        <p className="text-yellow-700 text-sm">
          This app is configured for Sepolia testnet. You need SepoliaETH for gas fees.
          Get test ETH from <a href="https://sepoliafaucet.com" target="_blank" rel="noopener noreferrer" className="underline">Sepolia Faucet</a>.
          This is for testing purposes only.
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
          Network: Sepolia Testnet (Chain ID: {CHAIN_ID})
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

      {/* User Files */}
      {isConnected && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold">Your Files</h3>
            <button 
              onClick={loadUserFiles}
              className="text-sm bg-gray-200 px-2 py-1 rounded hover:bg-gray-300"
              disabled={loadingFiles}
            >
              {loadingFiles ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          
          {loadingFiles ? (
            <p className="text-gray-500">Loading your files...</p>
          ) : userFiles.length === 0 ? (
            <p className="text-gray-500">No files uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {userFiles.map((file) => (
                <div key={file.id} className="border rounded p-3 bg-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">File ID: {file.id}</p>
                      <p className="text-sm text-gray-600">
                        Size: {(file.size / 1024).toFixed(2)} KB
                      </p>
                      <p className="text-sm text-gray-600">
                        Uploaded: {file.uploadedAt.toLocaleDateString()} {file.uploadedAt.toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="space-x-2">
                      <button 
                        onClick={() => downloadFile(file.id)}
                        className="text-sm bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                      >
                        Download
                      </button>
                      <button 
                        onClick={() => deleteFile(file.id)}
                        className="text-sm bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
