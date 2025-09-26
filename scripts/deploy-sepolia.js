const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying CloudFHE to Sepolia testnet...");
  
  // Get the contract factory
  const CloudFHE = await ethers.getContractFactory("CloudFHE");
  
  // Deploy the contract with decryption oracle address
  console.log("📦 Deploying contract...");
  // For demo purposes, use a zero address as oracle
  // In production, you would set this to a real decryption oracle address
  const decryptionOracle = "0x0000000000000000000000000000000000000000";
  const cloudFHE = await CloudFHE.deploy(decryptionOracle);
  
  // Wait for deployment to complete
  await cloudFHE.deployed();
  
  console.log("✅ CloudFHE deployed to:", cloudFHE.address);
  console.log("🔗 Network: Sepolia testnet");
  console.log("📋 Transaction hash:", cloudFHE.deployTransaction.hash);
  
  // Verify contract on Etherscan (if API key is provided)
  if (process.env.ETHERSCAN_API_KEY) {
    console.log("⏳ Waiting for block confirmations...");
    await cloudFHE.deployTransaction.wait(6); // Wait for 6 confirmations
    
    console.log("🔍 Verifying contract on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: cloudFHE.address,
        constructorArguments: [decryptionOracle],
      });
      console.log("✅ Contract verified on Etherscan!");
    } catch (error) {
      console.log("❌ Verification failed:", error.message);
    }
  }
  
  console.log("\n📝 Next steps:");
  console.log("1. Copy the contract address:", cloudFHE.address);
  console.log("2. Set REACT_APP_CLOUDFHE_ADDR in your .env file");
  console.log("3. Redeploy your frontend to Vercel");
  console.log("4. Get SepoliaETH from https://sepoliafaucet.com");
  
  console.log("\n🌐 Contract Details:");
  console.log("- Address:", cloudFHE.address);
  console.log("- Network: Sepolia (Chain ID: 11155111)");
  console.log("- Explorer: https://sepolia.etherscan.io/address/" + cloudFHE.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });

