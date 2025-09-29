// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";

/**
 * @title RockPaperScissors
 * @dev A privacy-preserving rock paper scissors game using FHEVM
 * @author FHE Game Studio
 */
contract RockPaperScissors {
    // Choices: 0=Rock, 1=Scissors, 2=Paper
    enum GameChoice { Rock, Scissors, Paper }
    
    // Game states
    enum GameState { Waiting, BothPlayed, Finished, Cancelled }
    
    // Game results
    enum GameResult { Player1Wins, Player2Wins, Tie }
    
    // Game struct
    struct Game {
        address player1;
        address player2;
        // Store choice handle as bytes32 to support both FHE handle and dev plaintext
        bytes32 player1ChoiceHandle;
        bytes32 player2ChoiceHandle;
        GameState state;
        address winner;
        uint256 betAmount;
        uint256 createdAt;
        uint256 finishedAt;
        bool exists;
    }

    // Player stats
    struct PlayerStats {
        uint256 totalGames;
        uint256 wins;
        uint256 losses;
        uint256 ties;
        uint256 totalWinnings;
    }

    // State
    mapping(uint256 => Game) public games;
    mapping(address => PlayerStats) public playerStats;
    uint256 public nextGameId;
    uint256 public totalGamesPlayed;
    uint256 public totalVolume;
    // Dev/demo mode: allow mock entrypoints (test/demo only)
    bool public constant DEV_MODE = true;
    
    // Config
    uint256 public constant MIN_BET = 0.00000001 ether;
    uint256 public constant MAX_BET = 1 ether;
    uint256 public constant GAME_TIMEOUT = 1 hours;
    
    // Events
    event GameCreated(
        uint256 indexed gameId, 
        address indexed player1, 
        uint256 betAmount,
        uint256 timestamp
    );
    
    event PlayerJoined(
        uint256 indexed gameId, 
        address indexed player2,
        uint256 timestamp
    );
    
    event GameFinished(
        uint256 indexed gameId, 
        address indexed winner,
        GameResult result,
        uint256 prize,
        uint256 timestamp
    );
    
    event ChoiceRevealed(
        uint256 indexed gameId, 
        address indexed player, 
        GameChoice choice,
        uint256 timestamp
    );
    
    event GameCancelled(
        uint256 indexed gameId,
        address indexed player,
        uint256 timestamp
    );

    // Modifiers
    modifier onlyGameParticipant(uint256 gameId) {
        require(games[gameId].exists, "Game does not exist");
        require(
            msg.sender == games[gameId].player1 || 
            msg.sender == games[gameId].player2, 
            "Not a game participant"
        );
        _;
    }
    
    modifier onlyGameCreator(uint256 gameId) {
        require(games[gameId].exists, "Game does not exist");
        require(msg.sender == games[gameId].player1, "Only game creator can perform this action");
        _;
    }

    constructor() {
        // init
    }

    /**
     * @dev Create a new game
     * @param externalChoice encrypted choice
     * @param attestation attestation
     * @return gameId
     */
    function createGame(
        externalEuint32 externalChoice,
        bytes calldata attestation
    ) external payable returns (uint256) {
        require(msg.value >= MIN_BET && msg.value <= MAX_BET, "Invalid bet amount");
        
        // Convert external encrypted choice to internal handle
        euint32 encryptedChoice = FHE.fromExternal(externalChoice, attestation);
        require(FHE.isSenderAllowed(encryptedChoice), "Caller not allowed for provided choice");
        bytes32 handle = FHE.toBytes32(encryptedChoice);
        
        uint256 gameId = nextGameId++;
        games[gameId] = Game({
            player1: msg.sender,
            player2: address(0),
            player1ChoiceHandle: handle,
            player2ChoiceHandle: bytes32(0),
            state: GameState.Waiting,
            winner: address(0),
            betAmount: msg.value,
            createdAt: block.timestamp,
            finishedAt: 0,
            exists: true
        });
        // (optional) Allow access to encrypted choice for on-chain compute if needed
        FHE.allow(encryptedChoice, msg.sender);
        FHE.allow(encryptedChoice, address(this));
        
        emit GameCreated(gameId, msg.sender, msg.value, block.timestamp);
        return gameId;
    }

    /**
     * @dev Join a game
     * @param gameId id
     * @param externalChoice encrypted choice
     * @param attestation attestation
     */
    function joinGame(
        uint256 gameId,
        externalEuint32 externalChoice,
        bytes calldata attestation
    ) external payable {
        require(games[gameId].exists, "Game does not exist");
        require(games[gameId].state == GameState.Waiting, "Game not waiting for players");
        require(games[gameId].player1 != msg.sender, "Cannot join your own game");
        require(msg.value == games[gameId].betAmount, "Bet amount must match");
        
        // Convert external choice
        euint32 encryptedChoice = FHE.fromExternal(externalChoice, attestation);
        require(FHE.isSenderAllowed(encryptedChoice), "Caller not allowed for provided choice");
        bytes32 handle = FHE.toBytes32(encryptedChoice);
        
        // Update state
        games[gameId].player2 = msg.sender;
        games[gameId].player2ChoiceHandle = handle;
        games[gameId].state = GameState.BothPlayed;
        
        // (optional) Allow access for on-chain compute
        FHE.allow(encryptedChoice, msg.sender);
        FHE.allow(encryptedChoice, address(this));
        
        emit PlayerJoined(gameId, msg.sender, block.timestamp);
        
        // Auto compute result
        _calculateGameResult(gameId);
    }

    /**
     * @dev Dev/demo: accept plaintext choice, wrap to euint32
     */
    function createGameMock(uint8 plainChoice) external payable returns (uint256) {
        require(DEV_MODE, "DEV_MODE disabled");
        require(msg.value >= MIN_BET && msg.value <= MAX_BET, "Invalid bet amount");
        require(plainChoice <= 2, "Invalid choice");

        uint256 gameId = nextGameId++;
        games[gameId] = Game({
            player1: msg.sender,
            player2: address(0),
            player1ChoiceHandle: bytes32(uint256(plainChoice)),
            player2ChoiceHandle: bytes32(0),
            state: GameState.Waiting,
            winner: address(0),
            betAmount: msg.value,
            createdAt: block.timestamp,
            finishedAt: 0,
            exists: true
        });

        emit GameCreated(gameId, msg.sender, msg.value, block.timestamp);
        return gameId;
    }

    function joinGameMock(uint256 gameId, uint8 plainChoice) external payable {
        require(DEV_MODE, "DEV_MODE disabled");
        require(games[gameId].exists, "Game does not exist");
        require(games[gameId].state == GameState.Waiting, "Game not waiting for players");
        require(games[gameId].player1 != msg.sender, "Cannot join your own game");
        require(msg.value == games[gameId].betAmount, "Bet amount must match");
        require(plainChoice <= 2, "Invalid choice");

        games[gameId].player2 = msg.sender;
        games[gameId].player2ChoiceHandle = bytes32(uint256(plainChoice));
        games[gameId].state = GameState.BothPlayed;

        emit PlayerJoined(gameId, msg.sender, block.timestamp);
        _calculateGameResult(gameId);
    }

    /**
     * @dev Compute result under FHE
     * @param gameId id
     */
    function _calculateGameResult(uint256 gameId) internal {
        Game storage game = games[gameId];
        require(game.state == GameState.BothPlayed, "Both players must have played");

        // Dev-mode plaintext comparison when handles are small values
        if (DEV_MODE) {
            uint256 c1 = uint256(game.player1ChoiceHandle) & 0xFF;
            uint256 c2 = uint256(game.player2ChoiceHandle) & 0xFF;
            // 0=Rock,1=Scissors,2=Paper
            if (c1 == c2) {
                game.winner = address(0);
            } else if ((c1 == 0 && c2 == 1) || (c1 == 1 && c2 == 2) || (c1 == 2 && c2 == 0)) {
                game.winner = game.player1;
            } else {
                game.winner = game.player2;
            }
        }

        // Update state
        game.state = GameState.Finished;
        game.finishedAt = block.timestamp;
        
        // Update stats
        totalGamesPlayed++;
        totalVolume += game.betAmount * 2;
        
        // Emit
        emit GameFinished(gameId, address(0), GameResult.Tie, game.betAmount * 2, block.timestamp);
    }

    /**
     * @dev Request decryption
     * @param gameId id
     * @param isPlayer1 is player1
     */
    function requestChoiceDecryption(uint256 gameId, bool isPlayer1) 
        external 
        onlyGameParticipant(gameId) 
    {
        require(games[gameId].state == GameState.Finished, "Game not finished");
        
        // Request decryption (handles already stored as bytes32)
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = isPlayer1 ? games[gameId].player1ChoiceHandle : games[gameId].player2ChoiceHandle;
        
        FHE.requestDecryption(handles, this.__handleChoiceDecryption.selector);
    }

    /**
     * @dev Decryption callback
     * @param requestID request id
     * @param plaintexts plaintexts
     */
    function __handleChoiceDecryption(uint256 requestID, uint32[] memory plaintexts) public {
        // handle decrypted choice
        emit ChoiceRevealed(requestID, msg.sender, GameChoice(plaintexts[0]), block.timestamp);
    }

    /**
     * @dev Cancel game (creator only)
     * @param gameId id
     */
    function cancelGame(uint256 gameId) external onlyGameCreator(gameId) {
        require(games[gameId].state == GameState.Waiting, "Game not in waiting state");
        
        games[gameId].state = GameState.Cancelled;
        
        // refund
        payable(games[gameId].player1).transfer(games[gameId].betAmount);
        
        emit GameCancelled(gameId, msg.sender, block.timestamp);
    }

    /**
     * @dev Claim prize
     * @param gameId id
     */
    function claimPrize(uint256 gameId) external {
        require(games[gameId].exists, "Game does not exist");
        require(games[gameId].state == GameState.Finished, "Game not finished");
        require(games[gameId].winner == msg.sender, "Only winner can claim prize");
        
        uint256 prize = games[gameId].betAmount * 2;
        games[gameId].winner = address(0); // prevent double claim
        
        // Update player stats
        _updatePlayerStats(msg.sender, true, prize);
        
        // Transfer
        payable(msg.sender).transfer(prize);
    }

    /**
     * @dev Update player stats
     * @param player address
     * @param isWinner is winner
     * @param winnings amount
     */
    function _updatePlayerStats(address player, bool isWinner, uint256 winnings) internal {
        PlayerStats storage stats = playerStats[player];
        stats.totalGames++;
        
        if (isWinner) {
            stats.wins++;
            stats.totalWinnings += winnings;
        } else {
            stats.losses++;
        }
    }

    /**
     * @dev Get game info
     * @param gameId id
     * @return player1
     * @return player2
     * @return state
     * @return winner
     * @return betAmount
     * @return createdAt
     * @return finishedAt
     * @return exists
     */
    function getGame(uint256 gameId) external view returns (
        address player1,
        address player2,
        GameState state,
        address winner,
        uint256 betAmount,
        uint256 createdAt,
        uint256 finishedAt,
        bool exists
    ) {
        Game storage game = games[gameId];
        return (
            game.player1,
            game.player2,
            game.state,
            game.winner,
            game.betAmount,
            game.createdAt,
            game.finishedAt,
            game.exists
        );
    }

    /**
     * @dev Get player stats
     */
    function getPlayerStats(address player) external view returns (
        uint256 totalGames,
        uint256 wins,
        uint256 losses,
        uint256 ties,
        uint256 totalWinnings
    ) {
        PlayerStats storage stats = playerStats[player];
        return (
            stats.totalGames,
            stats.wins,
            stats.losses,
            stats.ties,
            stats.totalWinnings
        );
    }

    /**
     * @dev Get active game ids
     */
    function getActiveGames() external view returns (uint256[] memory) {
        uint256[] memory activeGames = new uint256[](nextGameId);
        uint256 count = 0;
        
        for (uint256 i = 0; i < nextGameId; i++) {
            if (games[i].exists && games[i].state == GameState.Waiting) {
                activeGames[count] = i;
                count++;
            }
        }
        
        // resize
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = activeGames[i];
        }
        
        return result;
    }

    /**
     * @dev Get global stats
     */
    function getGameStats() external view returns (uint256, uint256) {
        return (totalGamesPlayed, totalVolume);
    }

    // 接收以太币
    receive() external payable {}
}