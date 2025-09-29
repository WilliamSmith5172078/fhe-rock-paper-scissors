const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("🚀 Deploying FHE Rock Paper Scissors...");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH");

  // Deploy contract
  const RockPaperScissors = await ethers.getContractFactory("RockPaperScissors");
  const rockPaperScissors = await RockPaperScissors.deploy();

  await rockPaperScissors.deployed();

  console.log("✅ RockPaperScissors deployed!");
  console.log("Address:", rockPaperScissors.address);
  console.log("Network:", await deployer.provider.getNetwork());
  
  console.log("\n📝 Post-deploy:");
  console.log("1. Add this to frontend/.env:");
  console.log("   REACT_APP_CONTRACT_ADDR=" + rockPaperScissors.address);
  console.log("2. Ensure MetaMask on correct network");
  console.log("3. Get Sepolia test ETH for playing");
  
  console.log("\n🎮 Features:");
  console.log("- Create and join games");
  console.log("- Encrypted choices");
  console.log("- Automatic prize distribution");
  console.log("- Player statistics");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deploy failed:", error);
    process.exit(1);
  });