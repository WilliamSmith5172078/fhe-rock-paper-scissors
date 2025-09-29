const fs = require('fs');
const path = require('path');

console.log('🔧 RockPaperScissors Sepolia Setup Helper\n');

const envPath = path.join(__dirname, '.env');

if (!fs.existsSync(envPath)) {
  console.log('❌ .env file not found. Creating from template...');
  fs.copyFileSync(path.join(__dirname, 'env.example'), envPath);
  console.log('✅ .env file created!\n');
}

console.log('📝 Please edit your .env file with the following information:\n');

console.log('1. PRIVATE_KEY=your_wallet_private_key_here');
console.log('   ⚠️  This is your wallet private key for deployment\n');

console.log('2. SEPOLIA_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID');
console.log('   📡 Get free RPC URL from: https://infura.io or https://alchemy.com\n');

console.log('3. ETHERSCAN_API_KEY=your_etherscan_api_key (optional)');
console.log('   🔍 For contract verification: https://etherscan.io\n');

console.log('💡 Quick Links:');
console.log('   - Sepolia Faucet: https://sepoliafaucet.com');
console.log('   - Infura: https://infura.io');
console.log('   - Alchemy: https://alchemy.com\n');

console.log('🚀 After editing .env, run: npm run deploy:sepolia');

