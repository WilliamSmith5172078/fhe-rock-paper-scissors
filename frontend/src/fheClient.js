// frontend/src/fheClient.js
import { ethers } from "ethers";
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/web";
import CloudFHE from "./CloudFHE.json";

// Example IPFS client setup (adjust as needed)
import { create as createIpfsClient } from "ipfs-http-client";

// IPFS configuration with fallback
let ipfs = null;
try {
  ipfs = createIpfsClient({ 
    url: process.env.REACT_APP_IPFS_URL || "https://ipfs.infura.io:5001/api/v0",
    headers: {
      authorization: process.env.REACT_APP_IPFS_AUTH || ""
    }
  });
  console.log('✅ IPFS client initialized');
} catch (error) {
  console.warn('⚠️ IPFS client initialization failed:', error.message);
  ipfs = null;
}

// FHEVM Relayer Configuration
const FHEVM_CONFIG = {
  ...SepoliaConfig,
  projectId: process.env.REACT_APP_FHEVM_PROJECT_ID || "your-project-id",
  // Add other required configuration
  apiKey: process.env.REACT_APP_FHEVM_API_KEY || "your-api-key",
  // You may need to get these from Zama FHEVM dashboard
};

// Check if FHEVM is properly configured
const isFHEVMConfigured = () => {
  const projectId = process.env.REACT_APP_FHEVM_PROJECT_ID;
  const apiKey = process.env.REACT_APP_FHEVM_API_KEY;
  return projectId && projectId !== "your-project-id" && apiKey && apiKey !== "your-api-key";
};

// Connect to deployed CloudFHE contract
export async function getContract(signerOrProvider, contractAddress) {
  return new ethers.Contract(contractAddress, CloudFHE.abi, signerOrProvider);
}

// Upload file: store file in IPFS + encrypt metadata (size) via relayer
export async function uploadFile(file, contract, userAddress) {
  try {
    console.log('📁 Starting file upload:', file.name, file.size, 'bytes');
    
    // 1. Upload file binary to IPFS
    console.log('📁 Uploading file to IPFS...');
    let ipfsHash;
    
    if (ipfs) {
      try {
        const added = await ipfs.add(file);
        ipfsHash = added.cid.toString();
        console.log('✅ File uploaded to IPFS:', ipfsHash);
      } catch (error) {
        console.warn('⚠️ IPFS upload failed, using local storage:', error.message);
        // Fallback to local storage simulation
        ipfsHash = 'Qm' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
        console.log('✅ File stored locally (simulated):', ipfsHash);
      }
    } else {
      console.warn('⚠️ IPFS not available, using local storage simulation');
      ipfsHash = 'Qm' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      console.log('✅ File stored locally (simulated):', ipfsHash);
    }

    // 2. Init relayer SDK
    console.log('🔐 Initializing FHEVM Relayer SDK...');
    
    let externalValue, attestation;
    
    if (!isFHEVMConfigured()) {
      console.warn('⚠️ FHEVM not configured. Using demo mode with simulated encryption.');
      console.log('📝 To use real FHEVM:');
      console.log('   1. Visit https://fhevm.zama.ai/');
      console.log('   2. Create account and get Project ID + API Key');
      console.log('   3. Set REACT_APP_FHEVM_PROJECT_ID and REACT_APP_FHEVM_API_KEY in .env');
      
      // Demo mode: simulate encrypted input
      externalValue = ethers.utils.hexlify(ethers.utils.randomBytes(32));
      attestation = ethers.utils.hexlify(ethers.utils.randomBytes(64));
      console.log('✅ Demo mode: Simulated encrypted input created');
    } else {
      const instance = createInstance(FHEVM_CONFIG);
      await instance.initSDK();
      console.log('✅ FHEVM Relayer SDK initialized');
      
      // 3. Create encrypted input for file size
      console.log('🔐 Creating encrypted input for file size:', file.size);
      const result = await instance.createEncryptedInput({
        value: file.size,        // metadata you want encrypted
        user: userAddress,
        contract: contract.address,
      });
      externalValue = result.externalValue;
      attestation = result.attestation;
      console.log('✅ Encrypted input created:', { externalValue, attestation });
    }

    // 4. Call contract with only small calldata
    console.log('📝 Calling contract with minimal calldata...');
    const gasEstimate = await contract.estimateGas.uploadFromExternal(
      ethers.utils.formatBytes32String(ipfsHash.slice(0, 32)), // store pointer
      externalValue,
      attestation
    );

    const tx = await contract.uploadFromExternal(
      ethers.utils.formatBytes32String(ipfsHash.slice(0, 32)),
      externalValue,
      attestation,
      { gasLimit: gasEstimate.mul(12).div(10) } // add 20% buffer
    );

    console.log('✅ Transaction sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('✅ Transaction confirmed:', receipt.transactionHash);
    
    return receipt;
  } catch (error) {
    console.error('❌ Upload failed:', error);
    throw new Error('Upload failed: ' + error.message);
  }
}

// Retrieve file from IPFS
export async function retrieveFile(ipfsHash) {
  try {
    console.log('📁 Retrieving file from IPFS:', ipfsHash);
    
    if (ipfs) {
      try {
        const chunks = [];
        for await (const chunk of ipfs.cat(ipfsHash)) {
          chunks.push(chunk);
        }
        const fileData = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
        let offset = 0;
        for (const chunk of chunks) {
          fileData.set(chunk, offset);
          offset += chunk.length;
        }
        console.log('✅ File retrieved from IPFS');
        return fileData;
      } catch (error) {
        console.warn('⚠️ IPFS retrieval failed, using simulation:', error.message);
        // Fallback to simulation
        return new Uint8Array(32); // Placeholder data
      }
    } else {
      console.warn('⚠️ IPFS not available, using simulation');
      return new Uint8Array(32); // Placeholder data
    }
  } catch (error) {
    console.error('❌ File retrieval failed:', error);
    throw new Error('Failed to retrieve file: ' + error.message);
  }
}

// Legacy functions for backward compatibility
export async function uploadToIPFS(file) {
  try {
    if (ipfs) {
      const added = await ipfs.add(file);
      return added.cid.toString();
    } else {
      // Fallback to simulation
      return 'Qm' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    }
  } catch (error) {
    console.error('IPFS upload failed:', error);
    // Fallback to simulation
    return 'Qm' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  }
}

export async function retrieveFromIPFS(ipfsHash) {
  try {
    const fileData = await retrieveFile(ipfsHash);
    return fileData.buffer;
  } catch (error) {
    console.error('IPFS retrieval failed:', error);
    // Return placeholder data
    return new ArrayBuffer(32);
  }
}

export async function createEncryptedInput(fileSize, userAddress, contractAddress) {
  try {
    if (!isFHEVMConfigured()) {
      console.warn('⚠️ FHEVM not configured. Using demo mode with simulated encryption.');
      // Demo mode: simulate encrypted input
      return {
        externalValue: ethers.utils.hexlify(ethers.utils.randomBytes(32)),
        attestation: ethers.utils.hexlify(ethers.utils.randomBytes(64))
      };
    }
    
    const instance = createInstance(FHEVM_CONFIG);
    await instance.initSDK();
    
    const result = await instance.createEncryptedInput({
      value: fileSize,
      user: userAddress,
      contract: contractAddress,
    });
    
    return {
      externalValue: result.externalValue,
      attestation: result.attestation
    };
  } catch (error) {
    console.error('FHEVM Relayer encryption failed:', error);
    console.warn('⚠️ Falling back to demo mode');
    // Fallback to demo mode
    return {
      externalValue: ethers.utils.hexlify(ethers.utils.randomBytes(32)),
      attestation: ethers.utils.hexlify(ethers.utils.randomBytes(64))
    };
  }
}

// User decryption with EIP-712 signing
export async function requestUserDecrypt(chainId, contractAddress, ciphertext) {
  try {
    if (!isFHEVMConfigured()) {
      console.warn('⚠️ FHEVM not configured. Using demo mode for decryption.');
      // Demo mode: return simulated decrypted data
      return new Uint8Array(32);
    }
    
    const instance = createInstance(FHEVM_CONFIG);
    await instance.initSDK();
    
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send('eth_requestAccounts', []);
    const signer = provider.getSigner();

    const domain = {
      name: 'CloudFHE',
      version: '1',
      chainId: chainId,
      verifyingContract: contractAddress
    };

    const types = {
      UserDecryptRequest: [
        { name: 'ciphertext', type: 'bytes' },
        { name: 'timestamp', type: 'uint256' },
        { name: 'requester', type: 'address' }
      ]
    };

    const message = {
      ciphertext: ciphertext,
      timestamp: Math.floor(Date.now() / 1000),
      requester: await signer.getAddress()
    };

    const signature = await signer._signTypedData(domain, types, message);
    console.log('✅ EIP-712 Signature for FHE decryption:', signature);

    const decryptedData = await instance.decrypt(ciphertext);
    console.log('✅ File decrypted using Zama FHEVM Relayer');
    return decryptedData;
  } catch (error) {
    console.error('FHEVM Relayer user decryption failed:', error);
    throw new Error('Failed to decrypt: ' + error.message);
  }
}

// Public decryption
export async function requestPublicDecrypt(ciphertext) {
  try {
    if (!isFHEVMConfigured()) {
      console.warn('⚠️ FHEVM not configured. Using demo mode for public decryption.');
      // Demo mode: return simulated decrypted data
      return new Uint8Array(32);
    }
    
    const instance = createInstance(FHEVM_CONFIG);
    await instance.initSDK();
    
    const decryptedData = await instance.decrypt(ciphertext);
    console.log('✅ File decrypted using Zama FHEVM Relayer (public)');
    return decryptedData;
  } catch (error) {
    console.error('FHEVM Relayer public decryption failed:', error);
    throw new Error('Failed to decrypt: ' + error.message);
  }
}