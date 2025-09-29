# 🪨✂️📄 FHE Rock Paper Scissors

A privacy-preserving Rock Paper Scissors game powered by Zama FHEVM. Fully homomorphic encryption keeps player choices private.

## 🌟 Features

- 🔐 **Privacy**: Choices encrypted with FHEVM
- 🎮 **Realtime**: Create and join rooms
- 💰 **Betting**: Stake ETH to play
- 🏆 **Stats**: Player and global statistics
- 🌐 **Sepolia Testnet**: Deployed on Ethereum Sepolia
- ⚡ **Modern UI**: Responsive React UI

## 🎯 Game Rules

### Basics
1. **Choose**: Rock(🪨), Scissors(✂️), Paper(📄)
2. **Create**: Player1 creates a game and submits encrypted choice
3. **Join**: Player2 joins and submits encrypted choice
4. **Compute**: Result computed under encryption
5. **Prize**: Winner takes double stake

### Win Conditions
- Rock > Scissors
- Scissors > Paper  
- Paper > Rock
- Same choice = Tie

## 🔐 FHE Advantages

### Privacy
- **Encrypted choices** before submission
- **Homomorphic compute** on-chain
- **Anti-cheat**: no leakage during the game
- **Decentralized**: on-chain verifiable

### Implementation
- Zama FHEVM primitives
- Comparisons under encryption
- Verifiable results, private choices
- Fully decentralized privacy

## 📁 Project Structure

```
fhe-rock-paper-scissors/
├── contracts/
│   └── RockPaperScissors.sol      # Smart contract
├── frontend/
│   ├── src/
│   │   ├── App.jsx               # Main UI
│   │   ├── fheClient.js          # FHEVM client
│   │   ├── RockPaperScissors.json # ABI
│   │   └── index.js              # React entry
│   └── package.json             # Frontend deps
├── scripts/
│   └── deploy.js                 # Deploy script
├── hardhat.config.js            # Hardhat config
└── package.json                 # Project deps
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- MetaMask extension
- Sepolia test ETH

### 1. Install deps

```bash
# Clone
git clone <repository-url>
cd fhe-rock-paper-scissors

# Root deps
npm install

# Frontend deps
cd frontend
npm install
```

### 2. Configure env


```bash
# Private key (for deploy)
PRIVATE_KEY=your_private_key_here

# Sepolia RPC URL
SEPOLIA_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY

# Etherscan API key
ETHERSCAN_API_KEY=your_etherscan_api_key
```

```bash
# Contract address
REACT_APP_CONTRACT_ADDR=0xYourContractAddress

# FHEVM (optional)
REACT_APP_FHEVM_PROJECT_ID=your_project_id
REACT_APP_FHEVM_API_KEY=your_api_key
```

### 3. Deploy contracts

```bash
# Compile
npm run compile

# Deploy to Sepolia
npm run deploy:sepolia
```

### 4. Start frontend

```bash
# Start dev server
npm run frontend:start
```

Open `http://localhost:3000`.

## 🎮 How to Play

### 1. Connect wallet
- Switch MetaMask to Sepolia
- Ensure enough SepoliaETH
- Get from [Sepolia Faucet](https://sepoliafaucet.com)

### 2. Start game
- Choose move (Rock/Scissors/Paper)
- Set bet (0.001 - 1 ETH)
- Create or join

### 3. Wait for result
- Auto computed result
- Winner gets double
- See your stats

## 🔧 Development

### Contracts

#### Core functions
- `createGame()`: create and submit encrypted choice
- `joinGame()`: join game
- `_calculateGameResult()`: compute results under FHE
- `getGame()`: get game info
- `getPlayerStats()`: get player stats

#### Events
- `GameCreated`
- `PlayerJoined`
- `GameFinished`
- `ChoiceRevealed`

### Frontend

#### Main components
- Wallet connection
- Move selection
- Active games list
- Player stats
- Global stats

#### FHE integration
- Create encrypted input
- Decryption request
- Result compute
- Privacy verification

## 🛡️ Security

### Privacy
- FHE-protected choices
- Prevent leakage and cheating
- Decentralized privacy

### Contract security
- Access control
- State checks
- Prize distribution
- Reentrancy-safe

### Frontend security
- Input validation
- Secure wallet connect
- Error handling

## 📊 Statistics

### Player stats
- Total games
- Wins
- Losses
- Ties
- Total winnings

### Global stats
- Total platform games
- Total volume
- Active players

## 🔍 Troubleshooting

### FAQ

1. **MetaMask connect fails**
   - Ensure Sepolia network
   - Check RPC settings

2. **Contract not found**
   - Verify address
   - Ensure deployed

3. **Insufficient gas**
   - Get more SepoliaETH
   - Check balance

4. **FHEVM not available**
   - Demo still works
   - Configure FHEVM project for full features

### Help

- See [Zama Docs](https://docs.zama.ai/)
- Check FHEVM SDK docs
- Ensure deps installed

## 🧪 Testing

### Run tests

```bash
# Contract tests
npm run test

# Coverage
npm run coverage

# Frontend tests
cd frontend && npm test
```

### Local network

```bash
# Start local Hardhat
npx hardhat node

# Deploy to local
npm run deploy:localhost
```

## 📝 Notes

### Using Cursor IDE

1. Open project in Cursor
2. Use `@docs` to load Zama docs
3. Create `.cursorrules`:

```bash
# .cursorrules
- Use TypeScript for safety
- React best practices
- Proper error handling
- Document FHE operations
- Strongly typed blockchain I/O
```

### Code style

- ESLint + Prettier
- Solidity best practices
- Error handling
- Documentation

## 📄 License

MIT License - see LICENSE.

## ⚠️ Disclaimer

This is a demo. Use at your own risk; secure before production.

## 🤝 Contributing

Welcome issues and PRs!

### Contribution guide

1. Fork
2. Feature branch
3. Commit
4. Push
5. Open PR

## 📞 Contact

- Repo: [GitHub Repository]
- Issues: [GitHub Issues]
- Discussions: [GitHub Discussions]

---

**Enjoy private Rock Paper Scissors!** 🪨✂️📄

*FHE makes gaming fair, transparent and private!*
