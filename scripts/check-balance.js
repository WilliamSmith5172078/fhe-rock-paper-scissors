const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  console.log("🔍 Checking Sepolia wallet balance...");
  
  // Use Alchemy Sepolia endpoint (more reliable)
  const provider = new ethers.providers.JsonRpcProvider("https://eth-sepolia.g.alchemy.com/v2/demo");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  console.log("👤 Wallet address:", wallet.address);
  
  try {
    const balance = await wallet.getBalance();
    const balanceEth = ethers.utils.formatEther(balance);
    console.log("💰 Balance:", balanceEth, "ETH");
    
    if (balance.lt(ethers.utils.parseEther("0.01"))) {
      console.log("\n⚠️  You need Sepolia ETH for deployment!");
      console.log("🌐 Get test ETH from these faucets:");
      console.log("   - https://sepoliafaucet.com");
      console.log("   - https://faucet.sepolia.dev/");
      console.log("   - https://www.alchemy.com/faucets/ethereum-sepolia");
      console.log("   - https://sepolia-faucet.pk910.de/");
      console.log("\n📝 Your wallet address:", wallet.address);
    } else {
      console.log("✅ You have enough ETH for deployment!");
    }
  } catch (error) {
    console.log("❌ Error checking balance:", error.message);
  }
}

main().catch(console.error);
