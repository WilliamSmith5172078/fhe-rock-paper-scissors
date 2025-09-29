const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying RockPaperScissors to Sepolia testnet...");
  
  // Use working Sepolia RPC endpoint
  const sepoliaUrl = "https://rpc.sepolia.org";
  const privateKey = "0xe3a702fcfd9bd43f83ba88f5fc712a888dce37a543d1b9b4e08f87f0abd42221";
  
  // Create provider and wallet
  const provider = new ethers.providers.JsonRpcProvider(sepoliaUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log("📡 Connected to Sepolia testnet");
  console.log("👤 Deployer address:", wallet.address);
  
  // Check balance
  const balance = await wallet.getBalance();
  const balanceEth = ethers.utils.formatEther(balance);
  console.log("💰 Balance:", balanceEth, "ETH");
  
  if (balance.lt(ethers.utils.parseEther("0.001"))) {
    console.log("⚠️  Low balance! Get Sepolia ETH from:");
    console.log("   https://sepoliafaucet.com");
    console.log("   Your address:", wallet.address);
    console.log("   Trying deployment anyway...");
  }
  
  // Deploy contract
  console.log("\n📦 Deploying RockPaperScissors contract...");
  const RockPaperScissors = await ethers.getContractFactory("RockPaperScissors");
  const rockPaperScissors = await RockPaperScissors.connect(wallet).deploy();
  
  console.log("⏳ Waiting for deployment...");
  await rockPaperScissors.deployed();
  
  console.log("✅ RockPaperScissors deployed successfully!");
  console.log("📍 Contract Address:", rockPaperScissors.address);
  console.log("🔗 Transaction Hash:", rockPaperScissors.deployTransaction.hash);
  console.log("🌐 Explorer:", `https://sepolia.etherscan.io/address/${rockPaperScissors.address}`);
  
  console.log("\n📝 Next Steps:");
  console.log("1. Copy this contract address:", rockPaperScissors.address);
  console.log("2. Update frontend/.env:");
  console.log(`   REACT_APP_CLOUDFHE_ADDR=${rockPaperScissors.address}`);
  console.log("3. Redeploy frontend:");
  console.log("   vercel --prod");
  
  console.log("\n🎉 Your RockPaperScissors contract is now live on Sepolia testnet!");
  
  // Save contract address to file
  const fs = require('fs');
  fs.writeFileSync('deployed-contract.txt', rockPaperScissors.address);
  console.log("💾 Contract address saved to deployed-contract.txt");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });

