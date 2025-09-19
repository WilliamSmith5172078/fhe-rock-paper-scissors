const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("🚀 Deploying CloudFHE to Sepolia testnet using public RPC...");
  
  // Use public Sepolia RPC endpoint
  const sepoliaUrl = process.env.SEPOLIA_URL || "https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161";
  
  // Check if private key is provided
  if (!process.env.PRIVATE_KEY || process.env.PRIVATE_KEY === 'your_private_key_here') {
    console.log("❌ Please set your PRIVATE_KEY in .env file");
    console.log("📝 Edit .env and add:");
    console.log("   PRIVATE_KEY=0x1234567890abcdef...");
    console.log("   (Get from MetaMask: Settings → Security & Privacy → Reveal Private Key)");
    process.exit(1);
  }
  
  // Create provider and wallet
  const provider = new ethers.providers.JsonRpcProvider(sepoliaUrl);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  console.log("📡 Connected to Sepolia testnet");
  console.log("👤 Deployer address:", wallet.address);
  
  // Check balance
  const balance = await wallet.getBalance();
  const balanceEth = ethers.utils.formatEther(balance);
  console.log("💰 Balance:", balanceEth, "ETH");
  
  if (balance.lt(ethers.utils.parseEther("0.01"))) {
    console.log("⚠️  Low balance! Get Sepolia ETH from:");
    console.log("   https://sepoliafaucet.com");
    console.log("   https://faucet.sepolia.dev/");
    console.log("   https://www.alchemy.com/faucets/ethereum-sepolia");
    process.exit(1);
  }
  
  // Deploy contract
  console.log("\n📦 Deploying CloudFHE contract...");
  const CloudFHE = await ethers.getContractFactory("CloudFHE");
  const cloudFHE = await CloudFHE.connect(wallet).deploy();
  
  console.log("⏳ Waiting for deployment...");
  await cloudFHE.deployed();
  
  console.log("✅ CloudFHE deployed successfully!");
  console.log("📍 Contract Address:", cloudFHE.address);
  console.log("🔗 Transaction Hash:", cloudFHE.deployTransaction.hash);
  console.log("🌐 Explorer:", `https://sepolia.etherscan.io/address/${cloudFHE.address}`);
  
  // Verify contract on Etherscan
  if (process.env.ETHERSCAN_API_KEY && process.env.ETHERSCAN_API_KEY !== 'your_etherscan_api_key') {
    console.log("\n⏳ Waiting for block confirmations for verification...");
    await cloudFHE.deployTransaction.wait(6);
    
    try {
      console.log("🔍 Verifying contract on Etherscan...");
      await hre.run("verify:verify", {
        address: cloudFHE.address,
        constructorArguments: [],
      });
      console.log("✅ Contract verified on Etherscan!");
    } catch (error) {
      console.log("❌ Verification failed:", error.message);
    }
  }
  
  console.log("\n📝 Next Steps:");
  console.log("1. Copy this contract address:", cloudFHE.address);
  console.log("2. Update frontend/.env:");
  console.log(`   REACT_APP_CLOUDFHE_ADDR=${cloudFHE.address}`);
  console.log("3. Redeploy frontend:");
  console.log("   vercel --prod");
  
  console.log("\n🎉 Your CloudFHE contract is now live on Sepolia testnet!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
