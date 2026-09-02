import React, { useState } from 'react';
import MainMenu from './components/MainMenu';
import TacticalSetup from './components/TacticalSetup';
import ChessFootballGame from './components/ChessFootballGame';
import { BoardState, TeamColor, TeamRoster, GameMode, AIDifficulty } from './engine/types';
import { DEFAULT_BLACK_ROSTER, DEFAULT_WHITE_ROSTER } from './engine/piece-registry';
import { createInitialBoard } from './engine/engine';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'menu' | 'setup' | 'playing'>('menu');
  const [gameMode, setGameMode] = useState<GameMode>('local');
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('normal');
  const [onlineRole, setOnlineRole] = useState<TeamColor | null>(null);
  const [onlineRoomId, setOnlineRoomId] = useState<string | null>(null);

  const [whiteRoster, setWhiteRoster] = useState<TeamRoster>(DEFAULT_WHITE_ROSTER);
  const [blackRoster, setBlackRoster] = useState<TeamRoster>(DEFAULT_BLACK_ROSTER);
  const [currentBoard, setCurrentBoard] = useState<BoardState>(() =>
    createInitialBoard(DEFAULT_WHITE_ROSTER, DEFAULT_BLACK_ROSTER)
  );

  // Handle Offline Start from Main Menu -> Go to Tactical Setup
  const handleStartOffline = () => {
    setGameMode('local');
    setOnlineRole(null);
    setOnlineRoomId(null);
    setCurrentScreen('setup');
  };

  // Handle AI Mode Start from Main Menu -> Go to Tactical Setup
  const handleStartAI = (difficulty: AIDifficulty) => {
    setGameMode('ai');
    setAiDifficulty(difficulty);
    setOnlineRole(null);
    setOnlineRoomId(null);
    setCurrentScreen('setup');
  };

  // Handle Online Start from Main Menu (after room joined) -> Go to Tactical Setup
  const handleStartOnline = (role: TeamColor, roomId: string) => {
    setGameMode('online');
    setOnlineRole(role);
    setOnlineRoomId(roomId);
    setCurrentScreen('setup');
  };

  // Handle Kickoff from Tactical Setup -> Go to Live Match Playing
  const handleStartMatch = (board: BoardState, newWhiteRoster: TeamRoster, newBlackRoster: TeamRoster) => {
    setCurrentBoard(board);
    setWhiteRoster(newWhiteRoster);
    setBlackRoster(newBlackRoster);
    setCurrentScreen('playing');
  };

  const handleBackToMenu = () => {
    setCurrentScreen('menu');
  };

  const handleBackToSetup = (boardToAdjust?: BoardState) => {
    if (boardToAdjust) {
      setCurrentBoard(boardToAdjust);
    }
    setCurrentScreen('setup');
  };

  return (
    <main className="min-h-screen bg-[#0f172a] bg-gradient-to-b from-[#1e293b] via-[#0f172a] to-[#0b1120] text-slate-100 py-3 sm:py-5 selection:bg-amber-400 selection:text-slate-950 font-sans">
      <div className="max-w-7xl mx-auto px-2 sm:px-4">
        {currentScreen === 'menu' && (
          <MainMenu
            onStartOffline={handleStartOffline}
            onStartAI={handleStartAI}
            onStartOnline={handleStartOnline}
          />
        )}

        {currentScreen === 'setup' && (
          <TacticalSetup
            initialBoard={currentBoard}
            initialWhiteRoster={whiteRoster}
            initialBlackRoster={blackRoster}
            multiplayerMode={gameMode === 'online' ? 'online' : 'local'}
            gameMode={gameMode}
            aiDifficulty={aiDifficulty}
            onlineRole={onlineRole}
            onlineRoomId={onlineRoomId}
            onStartMatch={handleStartMatch}
            onBackToMenu={handleBackToMenu}
          />
        )}

        {currentScreen === 'playing' && (
          <ChessFootballGame
            initialBoard={currentBoard}
            whiteRoster={whiteRoster}
            blackRoster={blackRoster}
            multiplayerMode={gameMode === 'online' ? 'online' : 'local'}
            gameMode={gameMode}
            aiDifficulty={aiDifficulty}
            onlineRole={onlineRole}
            onlineRoomId={onlineRoomId}
            onBackToMenu={handleBackToMenu}
            onBackToSetup={handleBackToSetup}
          />
        )}
      </div>
    </main>
  );
}
