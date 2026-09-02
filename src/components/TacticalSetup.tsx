import React, { useState, useEffect } from 'react';
import {
  BoardState,
  PieceInstance,
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
import PitchBoard from './PitchBoard';
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
  const [setupTeam, setSetupTeam] = useState<TeamColor>(() =>
    multiplayerMode === 'online' && onlineRole ? onlineRole : 'white'
  );
  const [isRegistryOpen, setIsRegistryOpen] = useState(false);

  const isMyTeamInSetup = multiplayerMode === 'local' || onlineRole === setupTeam;

  // Lắng nghe online sync nếu đang ở phòng online
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

  // Cập nhật pieces trên sân khi roster thay đổi
  const handleWhiteRosterChange = (newRoster: TeamRoster) => {
    setWhiteRoster(newRoster);
    // Cập nhật typeId của các quân cờ đội trắng tương ứng
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

  // Áp dụng sơ đồ đội hình (4-4-2, 4-3-3, 3-5-2)
  const handleApplyPreset = (teamColor: TeamColor, preset: '4-4-2' | '4-3-3' | '3-5-2') => {
    if (multiplayerMode === 'online' && onlineRole !== teamColor) return;
    const isWhite = teamColor === 'white';
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

  // Tương tác trực tiếp trên sân cờ để hoán đổi vị trí
  const selectedPiece = board.pieces.find((p) => p.id === board.selectedPieceId);

  const handleSelectPiece = (pieceId: string) => {
    if (!isMyTeamInSetup) return;
    const piece = board.pieces.find((p) => p.id === pieceId);
    if (!piece) return;

    // Nếu bấm vào quân đội khác và đang chơi Local, tự đổi setupTeam
    if (piece.team !== setupTeam) {
      if (multiplayerMode === 'local') {
        setSetupTeam(piece.team);
        setBoard((prev) => ({ ...prev, selectedPieceId: pieceId }));
      }
      return;
    }

    // Nếu đã chọn 1 quân trước đó của cùng đội -> hoán đổi vị trí
    if (selectedPiece && selectedPiece.id !== pieceId && selectedPiece.team === setupTeam) {
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

  const handleCellClick = (x: number, y: number) => {
    if (!isMyTeamInSetup) return;
    const isWhite = setupTeam === 'white';
    const isInHalf = isWhite ? y >= 8 && y <= 13 : y >= 1 && y <= 6;
    if (!isInHalf) return;

    const existingPiece = board.pieces.find(
      (p) => p.position.x === x && p.position.y === y
    );

    if (existingPiece) {
      handleSelectPiece(existingPiece.id);
      return;
    }

    if (selectedPiece && selectedPiece.team === setupTeam) {
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

  // Bắt đầu trận đấu sau khi kiểm tra hợp lệ
  const handleStartGame = () => {
    const whitePieces = board.pieces.filter((p) => p.team === 'white');
    const blackPieces = board.pieces.filter((p) => p.team === 'black');

    const whiteKings = whitePieces.filter((p) => p.typeId === 'king').length;
    const blackKings = blackPieces.filter((p) => p.typeId === 'king').length;

    if (whiteKings < 1 || blackKings < 1) {
      alert('Cả 2 đội đều phải có ít nhất 1 Thủ Môn (Vua)!');
      return;
    }

    // Kiểm tra lương
    const whiteCost = whiteRoster.pieces.reduce((sum, id) => sum + (getPieceDefinition(id)?.cost || 0), 0);
    const blackCost = blackRoster.pieces.reduce((sum, id) => sum + (getPieceDefinition(id)?.cost || 0), 0);
    if (whiteCost > 150 || blackCost > 150) {
      alert('Có đội vượt quá ngân sách 150 điểm! Vui lòng điều chỉnh lại.');
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

  // Tính valid targets khi đang chọn quân trên sân
  const validTargets: Position[] = [];
  if (selectedPiece && selectedPiece.team === setupTeam && isMyTeamInSetup) {
    const isWhite = setupTeam === 'white';
    const minY = isWhite ? 8 : 1;
    const maxY = isWhite ? 13 : 6;
    for (let y = minY; y <= maxY; y++) {
      for (let x = 0; x <= 10; x++) {
        validTargets.push({ x, y });
      }
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-center py-2 px-2 sm:px-4 text-slate-100">
      {/* Top Navigation Bar */}
      <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3 mb-4 flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToMenu}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 flex items-center gap-1.5 transition-colors border border-slate-700"
          >
            <span>←</span> Menu Chính
          </button>
          <div className="h-5 w-[1px] bg-slate-700 hidden sm:block" />
          <div>
            <h2 className="text-base sm:text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-200 flex items-center gap-2">
              <span>📋</span> BỐ TRÍ CHIẾN THUẬT (TACTICAL SETUP)
            </h2>
          </div>
        </div>

        {/* Status / Mode info */}
        <div className="flex items-center gap-2">
          {multiplayerMode === 'online' ? (
            <span className="text-xs bg-emerald-950 text-emerald-400 font-bold px-3 py-1 rounded-full border border-emerald-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Online (Phòng: {onlineRoomId}) • Bạn là Đội {onlineRole === 'white' ? 'Trắng ♔' : 'Đỏ ♚'}
            </span>
          ) : (
            <span className="text-xs bg-slate-800 text-slate-300 font-medium px-3 py-1 rounded-full border border-slate-700">
              🎮 Chế độ 2 Người Chơi Cùng Máy (Local)
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

      {/* Main 3-Column FM Tactical Layout */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4 items-start mb-4">
        {/* Left Column: White Team Panel (approx 3.5 cols) */}
        <div className="lg:col-span-3 xl:col-span-3">
          <TeamPanel
            team="white"
            roster={whiteRoster}
            onRosterChange={handleWhiteRosterChange}
            onApplyPresetFormation={(preset) => handleApplyPreset('white', preset)}
            isActiveTeam={setupTeam === 'white'}
            onSelectAsActive={() => {
              if (multiplayerMode === 'local' || onlineRole === 'white') {
                setSetupTeam('white');
              }
            }}
            readOnly={multiplayerMode === 'online' && onlineRole !== 'white'}
          />
        </div>

        {/* Center Column: Interactive Pitch Board (approx 6 cols) */}
        <div className="lg:col-span-6 xl:col-span-6 flex flex-col items-center">
          {/* Pitch Control Banner */}
          <div className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 mb-2 flex items-center justify-between shadow">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Đang chỉnh sửa sân:</span>
              <div className="flex gap-1">
                <button
                  disabled={multiplayerMode === 'online' && onlineRole !== 'white'}
                  onClick={() => setSetupTeam('white')}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                    setupTeam === 'white'
                      ? 'bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-300'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Đội Trắng ♔
                </button>
                <button
                  disabled={multiplayerMode === 'online' && onlineRole !== 'black'}
                  onClick={() => setSetupTeam('black')}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                    setupTeam === 'black'
                      ? 'bg-red-600 text-white shadow-md ring-2 ring-red-400'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Đội Đỏ ♚
                </button>
              </div>
            </div>

            <p className="text-[11px] text-amber-300/80 font-medium hidden sm:block">
              👉 Nhấp quân để chọn, nhấp ô trống để dời hoặc quân khác để hoán đổi
            </p>
          </div>

          <PitchBoard
            board={board}
            validTargets={validTargets}
            onSelectPiece={handleSelectPiece}
            onCellClick={handleCellClick}
            isSetupMode={true}
            setupTeam={setupTeam}
          />
        </div>

        {/* Right Column: Black Team Panel (approx 3.5 cols) */}
        <div className="lg:col-span-3 xl:col-span-3">
          <TeamPanel
            team="black"
            roster={blackRoster}
            onRosterChange={handleBlackRosterChange}
            onApplyPresetFormation={(preset) => handleApplyPreset('black', preset)}
            isActiveTeam={setupTeam === 'black'}
            onSelectAsActive={() => {
              if (multiplayerMode === 'local' || onlineRole === 'black') {
                setSetupTeam('black');
              }
            }}
            readOnly={multiplayerMode === 'online' && onlineRole !== 'black'}
          />
        </div>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="w-full max-w-2xl bg-slate-900 border-2 border-amber-400/60 rounded-2xl p-4 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 backdrop-blur-md">
        <div className="text-center sm:text-left">
          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
            SẴN SÀNG RA SÂN?
          </h4>
          <p className="text-xs text-slate-400">
            Kiểm tra kỹ vị trí và danh sách 11 cầu thủ trước khi trọng tài nổi còi
          </p>
        </div>

        <button
          onClick={handleStartGame}
          className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 hover:from-emerald-400 hover:to-green-400 text-slate-950 font-black text-sm rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.4)] uppercase tracking-wider flex items-center justify-center gap-2 transform hover:scale-105 transition-all"
        >
          <span>🟢</span> BẮT ĐẦU TRẬN ĐẤU (KICK OFF)
        </button>
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
