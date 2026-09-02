import React, { useState, useEffect } from 'react';
import {
  BoardState,
  Position,
  TeamColor,
  TeamRoster,
} from '@/engine/types';
import {
  createInitialBoard,
} from '@/engine/engine';
import {
  DEFAULT_BLACK_ROSTER,
  DEFAULT_WHITE_ROSTER,
  getPieceDefinition,
} from '@/engine/piece-registry';
import { multiplayerService, NetworkPacket } from '@/services/multiplayer';
import HalfPitchBoard from './HalfPitchBoard';
import TeamPanel from './TeamPanel';
import PieceRegistryModal from './PieceRegistryModal';

interface TacticalSetupProps {
  initialWhiteRoster?: TeamRoster;
  initialBlackRoster?: TeamRoster;
  multiplayerMode?: 'local' | 'online';
  onlineRole?: TeamColor | null;
  onlineRoomId?: string | null;
  onStartMatch: (board: BoardState, whiteRoster: TeamRoster, blackRoster: TeamRoster) => void;
  onBackToMenu: () => void;
}

export default function TacticalSetup({
  initialWhiteRoster = DEFAULT_WHITE_ROSTER,
  initialBlackRoster = DEFAULT_BLACK_ROSTER,
  multiplayerMode = 'local',
  onlineRole = null,
  onlineRoomId = null,
  onStartMatch,
  onBackToMenu,
}: TacticalSetupProps) {
  const [whiteRoster, setWhiteRoster] = useState<TeamRoster>(initialWhiteRoster);
  const [blackRoster, setBlackRoster] = useState<TeamRoster>(initialBlackRoster);
  const [board, setBoard] = useState<BoardState>(() =>
    createInitialBoard(initialWhiteRoster, initialBlackRoster)
  );

  const [whiteReady, setWhiteReady] = useState(false);
  const [blackReady, setBlackReady] = useState(false);

  const [isRegistryOpen, setIsRegistryOpen] = useState(false);

  // Online synchronization
  useEffect(() => {
    if (multiplayerMode === 'online') {
      multiplayerService.init({
        onConnected: () => {},
        onDisconnected: () => {
          alert('Đối thủ đã rời khỏi phòng!');
          onBackToMenu();
        },
        onPacketReceived: (packet: NetworkPacket) => {
          if (packet.type === 'SYNC_STATE') {
            setBoard(packet.board);
            if (packet.board.whiteRoster) setWhiteRoster(packet.board.whiteRoster);
            if (packet.board.blackRoster) setBlackRoster(packet.board.blackRoster);
          } else if (packet.type === 'EMOTE' && packet.emoji === 'READY') {
            if (packet.team === 'white') setWhiteReady(true);
            if (packet.team === 'black') setBlackReady(true);
          } else if (packet.type === 'EMOTE' && packet.emoji === 'UNREADY') {
            if (packet.team === 'white') setWhiteReady(false);
            if (packet.team === 'black') setBlackReady(false);
          }
        },
        onError: (err: string) => {
          console.error('Multiplayer error:', err);
        },
      });
    }
  }, [multiplayerMode, onBackToMenu]);

  // Sync helper
  const syncBoardState = (nextBoard: BoardState) => {
    setBoard(nextBoard);
    (window as any).__CHESS_FOOTBALL_BOARD_STATE__ = nextBoard;
    if (multiplayerMode === 'online') {
      multiplayerService.sendPacket({
        type: 'SYNC_STATE',
        board: { ...nextBoard, whiteRoster, blackRoster },
        senderId: '',
      });
    }
  };

  // Update pieces on roster changes
  const handleWhiteRosterChange = (newRoster: TeamRoster) => {
    setWhiteRoster(newRoster);
    const updatedPieces = board.pieces.map((p) => {
      if (p.team === 'white' && p.formationIndex < newRoster.pieces.length) {
        return {
          ...p,
          typeId: newRoster.pieces[p.formationIndex],
        };
      }
      return p;
    });
    const nextBoard = { ...board, pieces: updatedPieces, whiteRoster: newRoster };
    syncBoardState(nextBoard);
  };

  const handleBlackRosterChange = (newRoster: TeamRoster) => {
    setBlackRoster(newRoster);
    const updatedPieces = board.pieces.map((p) => {
      if (p.team === 'black' && p.formationIndex < newRoster.pieces.length) {
        return {
          ...p,
          typeId: newRoster.pieces[p.formationIndex],
        };
      }
      return p;
    });
    const nextBoard = { ...board, pieces: updatedPieces, blackRoster: newRoster };
    syncBoardState(nextBoard);
  };

  // Preset formations
  const handleApplyPreset = (teamColor: TeamColor, preset: '4-4-2' | '4-3-3' | '3-5-2') => {
    const isWhite = teamColor === 'white';
    if (isWhite && whiteReady) return;
    if (!isWhite && blackReady) return;

    let positions: Position[] = [];

    if (preset === '4-4-2') {
      positions = isWhite
        ? [
            { x: 5, y: 13 },
            { x: 1, y: 11 }, { x: 3, y: 11 }, { x: 7, y: 11 }, { x: 9, y: 11 },
            { x: 1, y: 9 }, { x: 4, y: 9 }, { x: 6, y: 9 }, { x: 9, y: 9 },
            { x: 4, y: 8 }, { x: 6, y: 8 },
          ]
        : [
            { x: 5, y: 1 },
            { x: 1, y: 3 }, { x: 3, y: 3 }, { x: 7, y: 3 }, { x: 9, y: 3 },
            { x: 1, y: 5 }, { x: 4, y: 5 }, { x: 6, y: 5 }, { x: 9, y: 5 },
            { x: 4, y: 6 }, { x: 6, y: 6 },
          ];
    } else if (preset === '4-3-3') {
      positions = isWhite
        ? [
            { x: 5, y: 13 },
            { x: 1, y: 11 }, { x: 3, y: 11 }, { x: 7, y: 11 }, { x: 9, y: 11 },
            { x: 2, y: 9 }, { x: 5, y: 9 }, { x: 8, y: 9 },
            { x: 2, y: 8 }, { x: 5, y: 8 }, { x: 8, y: 8 },
          ]
        : [
            { x: 5, y: 1 },
            { x: 1, y: 3 }, { x: 3, y: 3 }, { x: 7, y: 3 }, { x: 9, y: 3 },
            { x: 2, y: 5 }, { x: 5, y: 5 }, { x: 8, y: 5 },
            { x: 2, y: 6 }, { x: 5, y: 6 }, { x: 8, y: 6 },
          ];
    } else if (preset === '3-5-2') {
      positions = isWhite
        ? [
            { x: 5, y: 13 },
            { x: 3, y: 11 }, { x: 5, y: 11 }, { x: 7, y: 11 },
            { x: 1, y: 9 }, { x: 3, y: 9 }, { x: 5, y: 9 }, { x: 7, y: 9 }, { x: 9, y: 9 },
            { x: 4, y: 8 }, { x: 6, y: 8 },
          ]
        : [
            { x: 5, y: 1 },
            { x: 3, y: 3 }, { x: 5, y: 3 }, { x: 7, y: 3 },
            { x: 1, y: 5 }, { x: 3, y: 5 }, { x: 5, y: 5 }, { x: 7, y: 5 }, { x: 9, y: 5 },
            { x: 4, y: 6 }, { x: 6, y: 6 },
          ];
    }

    const currentTeamPieces = board.pieces.filter((p) => p.team === teamColor);
    const otherPieces = board.pieces.filter((p) => p.team !== teamColor);
    const updatedTeamPieces = currentTeamPieces.map((p, idx) => ({
      ...p,
      position: positions[idx] || p.position,
    }));

    const nextBoard: BoardState = {
      ...board,
      pieces: [...otherPieces, ...updatedTeamPieces],
      selectedPieceId: null,
    };
    syncBoardState(nextBoard);
  };

  // Piece swap / move interaction on half pitches
  const selectedPiece = board.pieces.find((p) => p.id === board.selectedPieceId);

  const handleSelectPiece = (teamColor: TeamColor, pieceId: string) => {
    if (teamColor === 'white' && whiteReady) return;
    if (teamColor === 'black' && blackReady) return;
    if (multiplayerMode === 'online' && onlineRole !== teamColor) return;

    const piece = board.pieces.find((p) => p.id === pieceId);
    if (!piece || piece.team !== teamColor) return;

    // Swap positions if another piece of the same team was already selected
    if (selectedPiece && selectedPiece.id !== pieceId && selectedPiece.team === teamColor) {
      const p1Pos = { ...selectedPiece.position };
      const p2Pos = { ...piece.position };
      const nextBoard: BoardState = {
        ...board,
        pieces: board.pieces.map((p) => {
          if (p.id === selectedPiece.id) return { ...p, position: p2Pos };
          if (p.id === piece.id) return { ...p, position: p1Pos };
          return p;
        }),
        selectedPieceId: null,
      };
      syncBoardState(nextBoard);
      return;
    }

    setBoard((prev) => ({
      ...prev,
      selectedPieceId: prev.selectedPieceId === pieceId ? null : pieceId,
    }));
  };

  const handleCellClick = (teamColor: TeamColor, x: number, y: number) => {
    if (teamColor === 'white' && whiteReady) return;
    if (teamColor === 'black' && blackReady) return;
    if (multiplayerMode === 'online' && onlineRole !== teamColor) return;

    const isWhite = teamColor === 'white';
    const isInHalf = isWhite ? y >= 8 && y <= 13 : y >= 1 && y <= 6;
    if (!isInHalf) return;

    const existingPiece = board.pieces.find(
      (p) => p.position.x === x && p.position.y === y && p.team === teamColor
    );

    if (existingPiece) {
      handleSelectPiece(teamColor, existingPiece.id);
      return;
    }

    if (selectedPiece && selectedPiece.team === teamColor) {
      const nextBoard: BoardState = {
        ...board,
        pieces: board.pieces.map((p) =>
          p.id === selectedPiece.id ? { ...p, position: { x, y } } : p
        ),
        selectedPieceId: null,
      };
      syncBoardState(nextBoard);
    }
  };

  // Toggle ready status
  const handleToggleReady = (teamColor: TeamColor) => {
    if (teamColor === 'white') {
      const whiteCost = whiteRoster.pieces.reduce((sum, id) => sum + (getPieceDefinition(id)?.cost || 0), 0);
      if (whiteCost > 150) {
        alert('Đội Trắng vượt quá quỹ lương 150 điểm!');
        return;
      }
      const newReady = !whiteReady;
      setWhiteReady(newReady);
      if (multiplayerMode === 'online') {
        multiplayerService.sendPacket({
          type: 'EMOTE',
          emoji: newReady ? 'READY' : 'UNREADY',
          team: 'white',
          senderId: '',
        });
      }
    } else {
      const blackCost = blackRoster.pieces.reduce((sum, id) => sum + (getPieceDefinition(id)?.cost || 0), 0);
      if (blackCost > 150) {
        alert('Đội Đỏ vượt quá quỹ lương 150 điểm!');
        return;
      }
      const newReady = !blackReady;
      setBlackReady(newReady);
      if (multiplayerMode === 'online') {
        multiplayerService.sendPacket({
          type: 'EMOTE',
          emoji: newReady ? 'READY' : 'UNREADY',
          team: 'black',
          senderId: '',
        });
      }
    }
  };

  // Start match when BOTH teams are ready
  const handleStartGame = () => {
    if (!whiteReady || !blackReady) {
      alert('Cả 2 đội đều phải xác nhận Sẵn Sàng (✓) trước khi bắt đầu!');
      return;
    }

    const whitePieces = board.pieces.filter((p) => p.team === 'white');
    const blackPieces = board.pieces.filter((p) => p.team === 'black');

    const whiteKings = whitePieces.filter((p) => p.typeId === 'king').length;
    const blackKings = blackPieces.filter((p) => p.typeId === 'king').length;

    if (whiteKings < 1 || blackKings < 1) {
      alert('Cả 2 đội đều phải có ít nhất 1 Thủ Môn (Vua)!');
      return;
    }

    const savedFormation = board.pieces.map((p) => ({
      ...p,
      position: { ...p.position },
      isStunned: false,
      abilityCooldown: 0,
    }));

    const nextBoard: BoardState = {
      ...board,
      phase: 'playing',
      savedFormation,
      pieces: savedFormation,
      currentTurn: 'white',
      remainingAP: 2,
      selectedPieceId: null,
      activeAction: null,
      whiteRoster,
      blackRoster,
      commentary: [
        {
          id: `c_${Date.now()}`,
          text: '🔔 Trọng tài đã nổi còi bắt đầu trận đấu! Đội Trắng giao bóng (2 lượt/vòng đấu).',
          type: 'whistle',
          timestamp: '00:00',
        },
      ],
    };

    if (multiplayerMode === 'online') {
      multiplayerService.sendPacket({
        type: 'SYNC_STATE',
        board: nextBoard,
        senderId: '',
      });
    }

    onStartMatch(nextBoard, whiteRoster, blackRoster);
  };

  // Calculate targets for visual guidance
  const validTargets: Position[] = [];
  if (selectedPiece) {
    const isWhite = selectedPiece.team === 'white';
    const minY = isWhite ? 8 : 1;
    const maxY = isWhite ? 13 : 6;
    for (let y = minY; y <= maxY; y++) {
      for (let x = 0; x <= 10; x++) {
        validTargets.push({ x, y });
      }
    }
  }

  const bothReady = whiteReady && blackReady;

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-center py-2 px-2 sm:px-4 text-slate-100">
      {/* Top Header */}
      <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3 mb-4 flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToMenu}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 flex items-center gap-1.5 transition-colors border border-slate-700"
          >
            <span>←</span> Menu Chính
          </button>
          <div className="h-5 w-[1px] bg-slate-700 hidden sm:block" />
          <h2 className="text-base sm:text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-200 flex items-center gap-2">
            <span>📋</span> BỐ TRÍ CHIẾN THUẬT (FOOTBALL MANAGER STYLE)
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {multiplayerMode === 'online' ? (
            <span className="text-xs bg-emerald-950 text-emerald-400 font-bold px-3 py-1 rounded-full border border-emerald-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Online: {onlineRoomId} • Bạn là Đội {onlineRole === 'white' ? 'Trắng ♔' : 'Đỏ ♚'}
            </span>
          ) : (
            <span className="text-xs bg-slate-800 text-slate-300 font-medium px-3 py-1 rounded-full border border-slate-700">
              🎮 2 Người Cùng Máy (Local)
            </span>
          )}

          <button
            onClick={() => setIsRegistryOpen(true)}
            className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-cyan-300 border border-cyan-500/30 flex items-center gap-1"
          >
            <span>📚</span> Kho Quân Cờ
          </button>
        </div>
      </div>

      {/* TOP HALF: TEAM BLACK (RED) */}
      <div className="w-full bg-slate-950/80 border border-red-500/30 rounded-3xl p-3 sm:p-4 mb-4 shadow-2xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Left Column: Black Team Panel */}
          <div className="lg:col-span-6">
            <TeamPanel
              team="black"
              roster={blackRoster}
              onRosterChange={handleBlackRosterChange}
              onApplyPresetFormation={(preset) => handleApplyPreset('black', preset)}
              isReady={blackReady}
              onToggleReady={() => handleToggleReady('black')}
              readOnly={multiplayerMode === 'online' && onlineRole !== 'black'}
            />
          </div>

          {/* Right Column: Black Team Half Pitch */}
          <div className="lg:col-span-6 flex justify-center">
            <HalfPitchBoard
              team="black"
              board={board}
              validTargets={selectedPiece?.team === 'black' ? validTargets : []}
              onSelectPiece={(id) => handleSelectPiece('black', id)}
              onCellClick={(x, y) => handleCellClick('black', x, y)}
              isReady={blackReady}
            />
          </div>
        </div>
      </div>

      {/* MIDDLE BANNER: DUAL READY STATUS & KICKOFF BUTTON */}
      <div className="w-full bg-slate-900 border-2 border-amber-400/60 rounded-2xl p-3 sm:p-4 mb-4 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Readiness indicator badges */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-bold text-xs ${
            blackReady
              ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
              : 'bg-red-950/40 border-red-500/50 text-red-300 animate-pulse'
          }`}>
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span>Đội Đỏ: {blackReady ? '✅ ĐÃ SẴN SÀNG' : '⏳ Đang sắp xếp...'}</span>
          </div>

          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-bold text-xs ${
            whiteReady
              ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
              : 'bg-amber-950/40 border-amber-500/50 text-amber-300 animate-pulse'
          }`}>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span>Đội Trắng: {whiteReady ? '✅ ĐÃ SẴN SÀNG' : '⏳ Đang sắp xếp...'}</span>
          </div>
        </div>

        {/* Kickoff CTA */}
        <div>
          {bothReady ? (
            <button
              onClick={handleStartGame}
              className="px-8 py-3 bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 hover:from-emerald-400 hover:to-green-400 text-slate-950 font-black text-sm rounded-xl shadow-[0_0_25px_rgba(16,185,129,0.5)] uppercase tracking-wider flex items-center justify-center gap-2 transform hover:scale-105 transition-all animate-bounce"
            >
              <span>🟢</span> BẮT ĐẦU TRẬN ĐẤU (KICK OFF)
            </button>
          ) : (
            <div className="text-xs text-slate-400 text-center md:text-right font-medium">
              👉 Cả 2 đội cần bấm <strong className="text-amber-400">Xác Nhận Đội Hình</strong> để khai cuộc!
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM HALF: TEAM WHITE */}
      <div className="w-full bg-slate-950/80 border border-amber-500/30 rounded-3xl p-3 sm:p-4 shadow-2xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Left Column: White Team Panel */}
          <div className="lg:col-span-6">
            <TeamPanel
              team="white"
              roster={whiteRoster}
              onRosterChange={handleWhiteRosterChange}
              onApplyPresetFormation={(preset) => handleApplyPreset('white', preset)}
              isReady={whiteReady}
              onToggleReady={() => handleToggleReady('white')}
              readOnly={multiplayerMode === 'online' && onlineRole !== 'white'}
            />
          </div>

          {/* Right Column: White Team Half Pitch */}
          <div className="lg:col-span-6 flex justify-center">
            <HalfPitchBoard
              team="white"
              board={board}
              validTargets={selectedPiece?.team === 'white' ? validTargets : []}
              onSelectPiece={(id) => handleSelectPiece('white', id)}
              onCellClick={(x, y) => handleCellClick('white', x, y)}
              isReady={whiteReady}
            />
          </div>
        </div>
      </div>

      {/* Piece Registry Modal */}
      {isRegistryOpen && (
        <PieceRegistryModal
          onClose={() => setIsRegistryOpen(false)}
          onPieceAdded={() => setBoard((prev) => ({ ...prev }))}
        />
      )}
    </div>
  );
}
