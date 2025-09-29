// frontend/src/fheClient.js
import { ethers } from "ethers";
// Relayer SDK disabled in this build
// import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/web";
import RockPaperScissors from "./RockPaperScissors.json";

// FHEVM Relayer Configuration
const FHEVM_CONFIG = null;

// Check FHEVM configuration
export const isFHEVMConfigured = () => false;

// Backend proxy mode: if provided, skip SDK in frontend
const BACKEND_URL = "";
export const isServerMode = () => false;
// Demo mode note: disabled by default; keep real paths
export const isDemoMode = () => false;

// Initialize FHEVM SDK
export async function initFHESDK() { return null; }

// Get contract instance
export async function getContract(signerOrProvider, contractAddress) {
  return new ethers.Contract(contractAddress, RockPaperScissors.abi, signerOrProvider);
}

// Create encrypted choice
export async function createEncryptedChoice() { throw new Error('Relayer disabled in this build'); }

// Request choice decryption
export async function requestChoiceDecryption() { return null; }

// Get game info
export async function getGameInfo(gameId, contractAddress) {
  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const contract = await getContract(provider, contractAddress);
    
    const gameData = await contract.getGame(gameId);
    return {
      player1: gameData.player1,
      player2: gameData.player2,
      state: gameData.state,
      winner: gameData.winner,
      betAmount: gameData.betAmount,
      createdAt: gameData.createdAt,
      finishedAt: gameData.finishedAt,
      exists: gameData.exists
    };
  } catch (error) {
    console.error('Get game info failed:', error);
    throw new Error('Get game info failed: ' + error.message);
  }
}

// Get player stats
export async function getPlayerStats(playerAddress, contractAddress) {
  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const contract = await getContract(provider, contractAddress);
    
    const stats = await contract.getPlayerStats(playerAddress);
    return {
      totalGames: stats.totalGames.toNumber(),
      wins: stats.wins.toNumber(),
      losses: stats.losses.toNumber(),
      ties: stats.ties.toNumber(),
      totalWinnings: parseFloat(ethers.utils.formatEther(stats.totalWinnings))
    };
  } catch (error) {
    console.error('Get player stats failed:', error);
    throw new Error('Get player stats failed: ' + error.message);
  }
}

// Get global stats
export async function getGameStats(contractAddress) {
  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const contract = await getContract(provider, contractAddress);
    
    const [totalGames, totalVolume] = await contract.getGameStats();
    return {
      totalGames: totalGames.toNumber(),
      totalVolume: parseFloat(ethers.utils.formatEther(totalVolume))
    };
  } catch (error) {
    console.error('Get global stats failed:', error);
    throw new Error('Get global stats failed: ' + error.message);
  }
}

// Get active games
export async function getActiveGames(contractAddress) {
  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const contract = await getContract(provider, contractAddress);
    
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
    
    return games;
  } catch (error) {
    console.error('Get active games failed:', error);
    throw new Error('Get active games failed: ' + error.message);
  }
}

// Test FHEVM connection
export async function testFHEVMConnection() {
  try {
    const instance = await initFHESDK();
    if (instance) {
      console.log('FHEVM connection OK');
      return true;
    } else {
      console.log('FHEVM connection failed, use demo');
      return false;
    }
  } catch (error) {
    console.error('FHEVM connection test failed:', error);
    return false;
  }
}

// Helper: compute game result
export function calculateGameResult(choice1, choice2) {
  if (choice1 === choice2) return 'tie';
  
  const winConditions = {
    0: 1, // Rock > Scissors
    1: 2, // Scissors > Paper
    2: 0  // Paper > Rock
  };
  
  if (winConditions[choice1] === choice2) {
    return 'player1_wins';
  } else {
    return 'player2_wins';
  }
}

// Get choice name
export function getChoiceName(choice) {
  const choices = {
    0: 'Rock',
    1: 'Scissors', 
    2: 'Paper'
  };
  return choices[choice] || 'Unknown';
}

// Get choice emoji
export function getChoiceEmoji(choice) {
  const emojis = {
    0: '🪨',
    1: '✂️',
    2: '📄'
  };
  return emojis[choice] || '❓';
}

// Get game state text
export function getGameStateText(state) {
  const states = {
    0: 'Waiting',
    1: 'Both played',
    2: 'Finished',
    3: 'Cancelled'
  };
  return states[state] || 'Unknown';
}

// Get game result text
export function getGameResultText(result) {
  const results = {
    0: 'Player1 wins',
    1: 'Player2 wins',
    2: 'Tie'
  };
  return results[result] || 'Unknown';
}