const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying RockPaperScissors to local network...");
  
  // Get the contract factory
  const RockPaperScissors = await ethers.getContractFactory("RockPaperScissors");
  
  // Deploy the contract
  console.log("📦 Deploying contract...");
  const rockPaperScissors = await RockPaperScissors.deploy();
  
  // Wait for deployment to complete
  await rockPaperScissors.deployed();
  
  console.log("✅ RockPaperScissors deployed to:", rockPaperScissors.address);
  console.log("🔗 Network: Local Hardhat");
  console.log("📋 Transaction hash:", rockPaperScissors.deployTransaction.hash);
  
  console.log("\n📝 Contract Details:");
  console.log("- Address:", rockPaperScissors.address);
  console.log("- Network: Local Hardhat (Chain ID: 31337)");
  
  // Save contract address
  const fs = require('fs');
  fs.writeFileSync('deployed-contract-local.txt', rockPaperScissors.address);
  console.log("💾 Contract address saved to deployed-contract-local.txt");
  
  console.log("\n🌐 For Sepolia deployment:");
  console.log("1. Get Sepolia ETH from: https://sepoliafaucet.com");
  console.log("2. Use a working RPC endpoint (Infura/Alchemy)");
  console.log("3. Run: npx hardhat run scripts/deploy-sepolia.js --network sepolia");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });

