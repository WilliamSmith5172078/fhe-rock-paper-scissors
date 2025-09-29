const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying RockPaperScissors to Sepolia testnet...");
  
  // Get the contract factory
  const RockPaperScissors = await ethers.getContractFactory("RockPaperScissors");
  
  // Deploy the contract
  console.log("📦 Deploying contract...");
  const rockPaperScissors = await RockPaperScissors.deploy();
  
  // Wait for deployment to complete
  await rockPaperScissors.deployed();
  
  console.log("✅ RockPaperScissors deployed to:", rockPaperScissors.address);
  console.log("🔗 Network: Sepolia testnet");
  console.log("📋 Transaction hash:", rockPaperScissors.deployTransaction.hash);
  
  // Verify contract on Etherscan (if API key is provided)
  if (process.env.ETHERSCAN_API_KEY) {
    console.log("⏳ Waiting for block confirmations...");
    await rockPaperScissors.deployTransaction.wait(6); // Wait for 6 confirmations
    
    console.log("🔍 Verifying contract on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: rockPaperScissors.address,
        constructorArguments: [],
      });
      console.log("✅ Contract verified on Etherscan!");
    } catch (error) {
      console.log("❌ Verification failed:", error.message);
    }
  }
  
  console.log("\n📝 Next steps:");
  console.log("1. Copy the contract address:", rockPaperScissors.address);
  console.log("2. Set REACT_APP_CONTRACT_ADDR in your frontend .env file");
  console.log("3. Redeploy your frontend to Vercel");
  console.log("4. Get SepoliaETH from https://sepoliafaucet.com");
  
  console.log("\n🌐 Contract Details:");
  console.log("- Address:", rockPaperScissors.address);
  console.log("- Network: Sepolia (Chain ID: 11155111)");
  console.log("- Explorer: https://sepolia.etherscan.io/address/" + rockPaperScissors.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });

