# Sepolia Testnet Setup Guide

## Required Environment Variables

Edit your `.env` file with the following information:

### 1. Private Key
```bash
PRIVATE_KEY=your_wallet_private_key_here
```
**⚠️ Security Note**: Never share your private key. This is for deployment only.

### 2. Sepolia RPC URL
Get a free RPC URL from:
- **Infura**: https://infura.io (Free tier: 100k requests/day)
- **Alchemy**: https://alchemy.com (Free tier: 300M compute units/month)

Example:
```bash
SEPOLIA_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
```

### 3. Etherscan API Key (Optional)
For contract verification:
- Sign up at https://etherscan.io
- Create API key
- Add to `.env`:
```bash
ETHERSCAN_API_KEY=your_etherscan_api_key
```

## Quick Setup Steps

1. **Get Sepolia ETH**:
   - Visit: https://sepoliafaucet.com
   - Or: https://faucet.sepolia.dev/
   - Request test ETH for your wallet

2. **Configure Environment**:
   ```bash
   # Edit .env file
   nano .env
   ```

3. **Deploy Contract**:
   ```bash
   npm run deploy:sepolia
   ```

4. **Update Frontend**:
   ```bash
   # Copy contract address from deployment output
   # Edit frontend/.env
   REACT_APP_CLOUDFHE_ADDR=0xYourDeployedContractAddress
   ```

## Example .env File
```bash
# Your wallet private key (keep secure!)
PRIVATE_KEY=0x1234567890abcdef...

# Sepolia RPC URL
SEPOLIA_URL=https://sepolia.infura.io/v3/your_project_id

# Etherscan API key (optional)
ETHERSCAN_API_KEY=your_api_key_here

# Frontend contract address (set after deployment)
REACT_APP_CLOUDFHE_ADDR=0xYourDeployedContractAddress
```
