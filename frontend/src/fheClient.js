// frontend/src/fheClient.js
import { ethers } from "ethers";
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/web";
import CloudFHE from "./CloudFHE.json";

// Example IPFS client setup (adjust as needed)
import { create as createIpfsClient } from "ipfs-http-client";
const ipfs = createIpfsClient({ url: "https://ipfs.infura.io:5001/api/v0" });

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
    const added = await ipfs.add(file);
    const ipfsHash = added.cid.toString();
    console.log('✅ File uploaded to IPFS:', ipfsHash);

    // 2. Init relayer SDK
    console.log('🔐 Initializing FHEVM Relayer SDK...');
    const instance = createInstance(SepoliaConfig);
    await instance.initSDK();
    console.log('✅ FHEVM Relayer SDK initialized');

    // 3. Create encrypted input for file size
    console.log('🔐 Creating encrypted input for file size:', file.size);
    const { externalValue, attestation } = await instance.createEncryptedInput({
      value: file.size,        // metadata you want encrypted
      user: userAddress,
      contract: contract.address,
    });
    console.log('✅ Encrypted input created:', { externalValue, attestation });

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
    console.error('❌ File retrieval failed:', error);
    throw new Error('Failed to retrieve file: ' + error.message);
  }
}

// Legacy functions for backward compatibility
export async function uploadToIPFS(file) {
  try {
    const added = await ipfs.add(file);
    return added.cid.toString();
  } catch (error) {
    console.error('IPFS upload failed:', error);
    throw new Error('Failed to upload file to IPFS: ' + error.message);
  }
}

export async function retrieveFromIPFS(ipfsHash) {
  try {
    const fileData = await retrieveFile(ipfsHash);
    return fileData.buffer;
  } catch (error) {
    console.error('IPFS retrieval failed:', error);
    throw new Error('Failed to retrieve file from IPFS: ' + error.message);
  }
}

export async function createEncryptedInput(fileSize, userAddress, contractAddress) {
  try {
    const instance = createInstance(SepoliaConfig);
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
    throw new Error('Failed to create encrypted input: ' + error.message);
  }
}

// User decryption with EIP-712 signing
export async function requestUserDecrypt(chainId, contractAddress, ciphertext) {
  try {
    const instance = createInstance(SepoliaConfig);
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
    const instance = createInstance(SepoliaConfig);
    await instance.initSDK();
    
    const decryptedData = await instance.decrypt(ciphertext);
    console.log('✅ File decrypted using Zama FHEVM Relayer (public)');
    return decryptedData;
  } catch (error) {
    console.error('FHEVM Relayer public decryption failed:', error);
    throw new Error('Failed to decrypt: ' + error.message);
  }
}