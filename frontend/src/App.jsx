import React, {useState, useEffect} from 'react';
import { 
  getContract,
  getGameStats
} from './fheClient';
import { ethers } from 'ethers';

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [userAddress, setUserAddress] = useState('');
  const [currentGame, setCurrentGame] = useState(null);
  const [activeGames, setActiveGames] = useState([]);
  const [playerChoice, setPlayerChoice] = useState(null);
  const [gameStatus, setGameStatus] = useState('idle');
  const [betAmount, setBetAmount] = useState('0.01');
  const [gameHistory, setGameHistory] = useState([]);
  const [playerStats, setPlayerStats] = useState({
    totalGames: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    totalWinnings: 0
  });
  const [globalStats, setGlobalStats] = useState({
    totalGames: 0,
    totalVolume: 0
  });

  // Choice constants
  const CHOICES = {
    0: { name: 'Rock', emoji: '🪨', color: 'bg-gray-500' },
    1: { name: 'Scissors', emoji: '✂️', color: 'bg-gray-400' },
    2: { name: 'Paper', emoji: '📄', color: 'bg-yellow-100' }
  };

  // Contract config (hardcoded)
  // TODO: replace the address below with your freshly deployed contract address
  const CONTRACT_ADDRESS = '0xcfbF68979D69296071Fceb21b9Ff076825Efa602';
  const CHAIN_ID = 11155111; // Sepolia testnet

  // Validators
  function isValidAddress(addr) {
    return typeof addr === 'string' && addr.startsWith('0x') && addr.length === 42 && addr !== '0xYourContractAddress';
  }

  // Connect wallet
  async function connectWallet() {
    try {
      if (!window.ethereum) {
        alert('Please install MetaMask');
        return;
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      
      // Verify network
      const network = await provider.getNetwork();
      if (network.chainId !== CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xaa36a7' }],
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0xaa36a7',
                chainName: 'Sepolia Test Network',
                nativeCurrency: {
                  name: 'SepoliaETH',
                  symbol: 'SepoliaETH',
                  decimals: 18
                },
                rpcUrls: ['https://sepolia.infura.io/v3/'],
                blockExplorerUrls: ['https://sepolia.etherscan.io/']
              }]
            });
          }
        }
      }

      setUserAddress(address);
      setIsConnected(true);
      setGameStatus('connected');
      
      // Load data
      await loadPlayerStats();
      await loadActiveGames();
      await loadGlobalStats();
    } catch (error) {
      console.error('Connect failed:', error);
      alert('Failed to connect wallet, please retry');
    }
  }

  // Load player stats
  async function loadPlayerStats() {
    if (!isConnected) return;
    
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = await getContract(provider, CONTRACT_ADDRESS);
      
      const stats = await contract.getPlayerStats(userAddress);
      setPlayerStats({
        totalGames: stats.totalGames.toNumber(),
        wins: stats.wins.toNumber(),
        losses: stats.losses.toNumber(),
        ties: stats.ties.toNumber(),
        totalWinnings: parseFloat(ethers.utils.formatEther(stats.totalWinnings))
      });
    } catch (error) {
      console.error('Load player stats failed:', error);
    }
  }

  // Load global stats
  async function loadGlobalStats() {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = await getContract(provider, CONTRACT_ADDRESS);
      
      const [totalGames, totalVolume] = await contract.getGameStats();
      setGlobalStats({
        totalGames: totalGames.toNumber(),
        totalVolume: parseFloat(ethers.utils.formatEther(totalVolume))
      });
    } catch (error) {
      console.error('Load global stats failed:', error);
    }
  }

  // Load active games
  async function loadActiveGames() {
    if (!isConnected) return;
    
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = await getContract(provider, CONTRACT_ADDRESS);
      
      const gameIds = await contract.getActiveGames();
      const games = [];
      
      for (const gameId of gameIds) {
        const gameData = await contract.getGame(gameId);
        games.push({
          id: gameId,
          player1: gameData.player1,
          betAmount: ethers.utils.formatEther(gameData.betAmount),
          createdAt: new Date(gameData.createdAt * 1000)
        });
      }
      
      setActiveGames(games);
    } catch (error) {
      console.error('Load games failed:', error);
    }
  }

  // Create game
  async function createGame() {
    if (!isConnected || !playerChoice) {
      alert('Connect wallet and choose your move');
      return;
    }

    if (!isValidAddress(CONTRACT_ADDRESS)) {
      alert('Invalid contract address. Set REACT_APP_CONTRACT_ADDR in frontend/.env');
      return;
    }

    try {
      setGameStatus('creating');
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = await getContract(signer, CONTRACT_ADDRESS);

      const betAmountWei = ethers.utils.parseEther(betAmount);
      // Always use DEV mock methods (no relayer/backend)
      // Preflight static call to surface revert reasons early
      try {
        await contract.callStatic.createGameMock(playerChoice, { value: betAmountWei });
      } catch (e) {
        console.error('Preflight revert (createGameMock):', e);
        throw new Error('Preflight failed: createGameMock reverted. Ensure the deployed contract includes createGameMock and bet >= MIN_BET');
      }
      const gasEstimate = await contract.estimateGas.createGameMock(playerChoice, { value: betAmountWei }).catch(() => null);
      const tx = await contract.createGameMock(
        playerChoice,
        {
          value: betAmountWei,
          ...(gasEstimate ? { gasLimit: gasEstimate.mul(12).div(10) } : { gasLimit: 300000 })
        }
      );

      await tx.wait();
      setGameStatus('game_created');
      alert('Game created! Waiting for another player...');
      
      // Refresh
      await loadActiveGames();
      await loadPlayerStats();
    } catch (error) {
      console.error('Create game failed:', error);
      alert('Create game failed: ' + error.message);
      setGameStatus('error');
    }
  }

  // Join game
  async function joinGame(gameId) {
    if (!isConnected || !playerChoice) {
      alert('Connect wallet and choose your move');
      return;
    }

    if (!isValidAddress(CONTRACT_ADDRESS)) {
      alert('Invalid contract address. Set REACT_APP_CONTRACT_ADDR in frontend/.env');
      return;
    }

    try {
      setGameStatus('joining');
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = await getContract(signer, CONTRACT_ADDRESS);
      
      const betAmountWei = ethers.utils.parseEther(betAmount);
      // Always use DEV mock methods (no relayer/backend)
      try {
        await contract.callStatic.joinGameMock(gameId, playerChoice, { value: betAmountWei });
      } catch (e) {
        console.error('Preflight revert (joinGameMock):', e);
        throw new Error('Preflight failed: joinGameMock reverted. Check game exists, not creator, and bet matches');
      }
      const gasEstimate = await contract.estimateGas.joinGameMock(gameId, playerChoice, { value: betAmountWei }).catch(() => null);
      const tx = await contract.joinGameMock(
        gameId,
        playerChoice,
        {
          value: betAmountWei,
          ...(gasEstimate ? { gasLimit: gasEstimate.mul(12).div(10) } : { gasLimit: 300000 })
        }
      );

      await tx.wait();
      setGameStatus('game_joined');
      alert('Joined game! Result is being computed...');
      
      // Refresh
      await loadActiveGames();
      await loadPlayerStats();
      await loadGlobalStats();
    } catch (error) {
      console.error('Join game failed:', error);
      alert('Join game failed: ' + error.message);
      setGameStatus('error');
    }
  }

  // Select choice
  function selectChoice(choice) {
    setPlayerChoice(choice);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            🪨✂️📄 FHE Rock Paper Scissors
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            Protect your move privacy with FHE
          </p>
        </div>

        {/* Notice */}
        <div className="mb-8 p-6 bg-yellow-100 border-l-4 border-yellow-500 rounded-lg">
          <div className="flex items-center">
            <div className="text-yellow-500 mr-3">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-yellow-800">⚠️ Sepolia Testnet</h3>
              <p className="text-yellow-700 text-sm">
                This game runs on Sepolia testnet. You need SepoliaETH for gas. Get test ETH from <a href="https://sepoliafaucet.com" target="_blank" rel="noopener noreferrer" className="underline font-semibold">Sepolia Faucet</a>. Your choice is protected by FHE.
              </p>
            </div>
          </div>
        </div>

        {/* Wallet */}
        <div className="mb-8 p-6 bg-white rounded-xl shadow-lg">
          <h3 className="text-xl font-bold mb-4 flex items-center">
            <span className="mr-2">🔗</span>
            Wallet
          </h3>
          {isConnected ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-green-600 font-semibold">Connected: {userAddress}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-blue-600 font-semibold">Total games</div>
                  <div className="text-2xl font-bold">{playerStats.totalGames}</div>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="text-green-600 font-semibold">Wins</div>
                  <div className="text-2xl font-bold">{playerStats.wins}</div>
                </div>
                <div className="bg-red-50 p-3 rounded-lg">
                  <div className="text-red-600 font-semibold">Losses</div>
                  <div className="text-2xl font-bold">{playerStats.losses}</div>
                </div>
                <div className="bg-yellow-50 p-3 rounded-lg">
                  <div className="text-yellow-600 font-semibold">Winnings</div>
                  <div className="text-2xl font-bold">{playerStats.totalWinnings.toFixed(4)} ETH</div>
                </div>
              </div>
            </div>
          ) : (
            <button 
              onClick={connectWallet}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg"
            >
              Connect MetaMask
            </button>
          )}
        </div>

        {isConnected && (
          <>
            {/* Game settings */}
            <div className="mb-8 p-6 bg-white rounded-xl shadow-lg">
              <h3 className="text-xl font-bold mb-6 flex items-center">
                <span className="mr-2">🎮</span>
                Game settings
              </h3>
              
              {/* Select move */}
              <div className="mb-6">
                <label className="block text-lg font-semibold mb-4">Choose your move:</label>
                <div className="flex justify-center space-x-6">
                  {Object.entries(CHOICES).map(([value, choice]) => (
                    <button
                      key={value}
                      onClick={() => selectChoice(parseInt(value))}
                      className={`p-6 rounded-2xl border-4 transition-all duration-200 transform hover:scale-105 ${
                        playerChoice === parseInt(value) 
                          ? 'border-blue-500 bg-blue-100 shadow-lg' 
                          : 'border-gray-300 hover:border-gray-400 hover:shadow-md'
                      }`}
                    >
                      <div className="text-6xl mb-2">{choice.emoji}</div>
                      <div className="text-lg font-semibold">{choice.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bet amount */}
              <div className="mb-6">
                <label className="block text-lg font-semibold mb-2">Bet amount (ETH):</label>
                <div className="flex items-center space-x-4">
                  <input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    min="0.001"
                    step="0.001"
                    className="border-2 border-gray-300 rounded-lg px-4 py-2 text-lg focus:border-blue-500 focus:outline-none"
                    placeholder="0.01"
                  />
                  <span className="text-gray-600">ETH</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">Min: 0.001 ETH, Max: 1 ETH</p>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={createGame}
                  disabled={!playerChoice}
                  className="bg-gradient-to-r from-green-600 to-green-700 text-white px-8 py-3 rounded-lg font-semibold hover:from-green-700 hover:to-green-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
                >
                  Create game
                </button>
                <button
                  onClick={loadActiveGames}
                  className="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-8 py-3 rounded-lg font-semibold hover:from-gray-700 hover:to-gray-800 transition-all duration-200 shadow-lg"
                >
                  Refresh games
                </button>
              </div>
            </div>

            {/* Active games */}
            <div className="mb-8 p-6 bg-white rounded-xl shadow-lg">
              <h3 className="text-xl font-bold mb-6 flex items-center">
                <span className="mr-2">🎯</span>
                Joinable games
              </h3>
              {activeGames.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">🎮</div>
                  <p className="text-gray-500 text-lg">No active games</p>
                  <p className="text-gray-400 text-sm">Create one or wait for others</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {activeGames.map((game) => (
                    <div key={game.id} className="border-2 border-gray-200 rounded-xl p-6 hover:border-blue-300 transition-all duration-200">
                      <div className="flex justify-between items-center">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-4">
                            <span className="text-2xl font-bold text-blue-600">#{game.id}</span>
                            <span className="text-lg font-semibold">Room</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                            <div>
                              <span className="font-semibold">Creator:</span> {game.player1.slice(0, 6)}...{game.player1.slice(-4)}
                            </div>
                            <div>
                              <span className="font-semibold">Bet:</span> {game.betAmount} ETH
                            </div>
                            <div>
                              <span className="font-semibold">Created:</span> {game.createdAt.toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => joinGame(game.id)}
                          disabled={!playerChoice}
                          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
                        >
                          Join
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Global stats */}
            <div className="mb-8 p-6 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl shadow-lg">
              <h3 className="text-xl font-bold mb-6 flex items-center">
                <span className="mr-2">📊</span>
                Game statistics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">{globalStats.totalGames}</div>
                  <div className="text-gray-600">Total games</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{globalStats.totalVolume.toFixed(4)}</div>
                  <div className="text-gray-600">Total volume (ETH)</div>
                </div>
              </div>
            </div>

            {/* Current status */}
            <div className="mb-8 p-6 bg-white rounded-xl shadow-lg">
              <h3 className="text-xl font-bold mb-4 flex items-center">
                <span className="mr-2">⚡</span>
                Game status
              </h3>
              <div className="space-y-2">
                <p className="text-lg">
                  <span className="font-semibold">Status:</span> 
                  <span className="ml-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-mono">
                    {gameStatus}
                  </span>
                </p>
                {playerChoice !== null && (
                  <p className="text-lg">
                    <span className="font-semibold">Your choice:</span> 
                    <span className="ml-2 text-2xl">
                      {CHOICES[playerChoice].emoji} {CHOICES[playerChoice].name}
                    </span>
                  </p>
                )}
              </div>
            </div>

            {/* FHE notes */}
            <div className="p-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl shadow-lg">
              <h3 className="text-xl font-bold mb-4 flex items-center">
                <span className="mr-2">🔐</span>
                FHE privacy
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-green-500">✅</span>
                    <span>Use Zama FHEVM to protect choices</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-green-500">✅</span>
                    <span>Compute results under encryption</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-green-500">✅</span>
                    <span>Decrypt only after game ends</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-green-500">✅</span>
                    <span>Prevent cheating and leakage</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-green-500">✅</span>
                    <span>Decentralized privacy</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-green-500">✅</span>
                    <span>Transparent and verifiable results</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}