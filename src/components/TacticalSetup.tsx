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
  BOARD_WIDTH,
} from '@/engine/engine';
import {
  DEFAULT_BLACK_ROSTER,
  DEFAULT_WHITE_ROSTER,
  getAllPieces,
  getPieceDefinition,
} from '@/engine/piece-registry';
import { multiplayerService, NetworkPacket } from '@/services/multiplayer';
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

const SALARY_CAP = 150;
const MAX_PIECES_PER_TEAM = 11;
const MIN_PIECES_PER_TEAM = 5;

export default function TacticalSetup({
  initialWhiteRoster = DEFAULT_WHITE_ROSTER,
  initialBlackRoster = DEFAULT_BLACK_ROSTER,
  multiplayerMode = 'local',
  onlineRole = null,
  onlineRoomId = null,
  onStartMatch,
  onBackToMenu,
}: TacticalSetupProps) {
  const [activeTabTeam, setActiveTabTeam] = useState<TeamColor>(() =>
    multiplayerMode === 'online' && onlineRole ? onlineRole : 'white'
  );

  const [whiteRoster, setWhiteRoster] = useState<TeamRoster>(initialWhiteRoster);
  const [blackRoster, setBlackRoster] = useState<TeamRoster>(initialBlackRoster);
  const [board, setBoard] = useState<BoardState>(() =>
    createInitialBoard(initialWhiteRoster, initialBlackRoster)
  );

  const [whiteReady, setWhiteReady] = useState(false);
  const [blackReady, setBlackReady] = useState(false);

  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [isAddPieceModalOpen, setIsAddPieceModalOpen] = useState(false);
  const [isRegistryOpen, setIsRegistryOpen] = useState(false);

  const allAvailablePieces = getAllPieces();

  // Current active team context
  const isWhite = activeTabTeam === 'white';
  const currentTeamPieces = board.pieces.filter((p) => p.team === activeTabTeam);
  const currentRoster = isWhite ? whiteRoster : blackRoster;
  const isCurrentTeamReady = isWhite ? whiteReady : blackReady;
  const isReadOnly = multiplayerMode === 'online' && onlineRole !== activeTabTeam;

  // King count check
  const kingCount = currentTeamPieces.filter((p) => p.typeId === 'king').length;

  // Calculate budget
  const totalCost = currentTeamPieces.reduce((sum, p) => {
    const def = getPieceDefinition(p.typeId);
    return sum + (def?.cost || 0);
  }, 0);
  const remainingBudget = SALARY_CAP - totalCost;
  const isOverBudget = remainingBudget < 0;

  // Sync state helper
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

  // Online listener
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

  // Find an empty position in the team's half to place a new piece
  const findEmptyPositionInHalf = (team: TeamColor): Position | null => {
    const isW = team === 'white';
    const minY = isW ? 8 : 1;
    const maxY = isW ? 13 : 6;

    for (let y = minY; y <= maxY; y++) {
      for (let x = 1; x <= 9; x++) {
        const isOccupied = board.pieces.some(
          (p) => p.position.x === x && p.position.y === y && p.team === team
        );
        if (!isOccupied) {
          return { x, y };
        }
      }
    }
    return null;
  };

  // Add new piece to the active team
  const handleAddPiece = (pieceId: string) => {
    if (isReadOnly || isCurrentTeamReady) return;

    if (currentTeamPieces.length >= MAX_PIECES_PER_TEAM) {
      alert(`Đội hình đã đạt tối đa ${MAX_PIECES_PER_TEAM} quân cờ!`);
      return;
    }

    if (pieceId === 'king' && kingCount >= 1) {
      alert('Mỗi đội chỉ được phép có duy nhất 1 con Vua (Thủ Môn)!');
      return;
    }

    const def = getPieceDefinition(pieceId);
    if (totalCost + def.cost > SALARY_CAP) {
      alert(`Vượt quá quỹ lương ${SALARY_CAP} điểm!`);
      return;
    }

    const targetPos = findEmptyPositionInHalf(activeTabTeam);
    if (!targetPos) {
      alert('Không còn ô trống trên nửa sân để đặt quân!');
      return;
    }

    const newPiece: PieceInstance = {
      id: `p_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      typeId: pieceId,
      team: activeTabTeam,
      position: targetPos,
      formationIndex: currentTeamPieces.length,
    };

    const nextPieces = [...board.pieces, newPiece];
    const newPieceTypeIds = nextPieces
      .filter((p) => p.team === activeTabTeam)
      .map((p) => p.typeId);

    const updatedRoster: TeamRoster = {
      ...currentRoster,
      pieces: newPieceTypeIds,
    };

    if (isWhite) setWhiteRoster(updatedRoster);
    else setBlackRoster(updatedRoster);

    const nextBoard: BoardState = {
      ...board,
      pieces: nextPieces,
      whiteRoster: isWhite ? updatedRoster : whiteRoster,
      blackRoster: !isWhite ? updatedRoster : blackRoster,
    };

    syncBoardState(nextBoard);
    setIsAddPieceModalOpen(false);
  };

  // Delete a piece from the team
  const handleDeletePiece = (pieceId: string) => {
    if (isReadOnly || isCurrentTeamReady) return;

    const pieceToDelete = board.pieces.find((p) => p.id === pieceId);
    if (!pieceToDelete) return;

    // RULE: Exactly 1 King must remain
    if (pieceToDelete.typeId === 'king') {
      alert('Không thể xóa Vua! Mỗi đội bắt buộc phải có 1 con Vua làm Thủ Môn.');
      return;
    }

    if (currentTeamPieces.length <= MIN_PIECES_PER_TEAM) {
      alert(`Mỗi đội cần có tối thiểu ${MIN_PIECES_PER_TEAM} quân cờ trên sân!`);
      return;
    }

    const nextPieces = board.pieces.filter((p) => p.id !== pieceId);
    const newPieceTypeIds = nextPieces
      .filter((p) => p.team === activeTabTeam)
      .map((p) => p.typeId);

    const updatedRoster: TeamRoster = {
      ...currentRoster,
      pieces: newPieceTypeIds,
    };

    if (isWhite) setWhiteRoster(updatedRoster);
    else setBlackRoster(updatedRoster);

    const nextBoard: BoardState = {
      ...board,
      pieces: nextPieces,
      selectedPieceId: selectedPieceId === pieceId ? null : selectedPieceId,
      whiteRoster: isWhite ? updatedRoster : whiteRoster,
      blackRoster: !isWhite ? updatedRoster : blackRoster,
    };

    if (selectedPieceId === pieceId) {
      setSelectedPieceId(null);
    }

    syncBoardState(nextBoard);
  };

  // Select / Swap piece on pitch or table
  const handleSelectPiece = (pieceId: string) => {
    if (isReadOnly || isCurrentTeamReady) return;
    const piece = board.pieces.find((p) => p.id === pieceId);
    if (!piece || piece.team !== activeTabTeam) return;

    if (selectedPieceId && selectedPieceId !== pieceId) {
      const selectedP = board.pieces.find((p) => p.id === selectedPieceId);
      if (selectedP && selectedP.team === activeTabTeam) {
        // Swap positions
        const p1Pos = { ...selectedP.position };
        const p2Pos = { ...piece.position };
        const nextBoard: BoardState = {
          ...board,
          pieces: board.pieces.map((p) => {
            if (p.id === selectedPieceId) return { ...p, position: p2Pos };
            if (p.id === piece.id) return { ...p, position: p1Pos };
            return p;
          }),
          selectedPieceId: null,
        };
        setSelectedPieceId(null);
        syncBoardState(nextBoard);
        return;
      }
    }

    setSelectedPieceId((prev) => (prev === pieceId ? null : pieceId));
  };

  // Click on empty cell on pitch to move selected piece
  const handlePitchCellClick = (x: number, y: number) => {
    if (isReadOnly || isCurrentTeamReady || !selectedPieceId) return;
    const isInHalf = isWhite ? y >= 8 && y <= 13 : y >= 1 && y <= 6;
    if (!isInHalf) return;

    const existingPiece = board.pieces.find(
      (p) => p.position.x === x && p.position.y === y && p.team === activeTabTeam
    );

    if (existingPiece) {
      handleSelectPiece(existingPiece.id);
      return;
    }

    const nextBoard: BoardState = {
      ...board,
      pieces: board.pieces.map((p) =>
        p.id === selectedPieceId ? { ...p, position: { x, y } } : p
      ),
      selectedPieceId: null,
    };
    setSelectedPieceId(null);
    syncBoardState(nextBoard);
  };

  // Toggle ready status
  const handleToggleReady = () => {
    if (isOverBudget) {
      alert(`Đội hình vượt quá ngân sách lương (${SALARY_CAP} điểm)! Vui lòng điều chỉnh.`);
      return;
    }

    if (kingCount !== 1) {
      alert('Mỗi đội bắt buộc phải có ĐÚNG 1 con Vua (Thủ Môn)!');
      return;
    }

    if (currentTeamPieces.length < MIN_PIECES_PER_TEAM) {
      alert(`Đội hình cần tối thiểu ${MIN_PIECES_PER_TEAM} quân cờ để ra sân!`);
      return;
    }

    const newReady = !isCurrentTeamReady;
    if (isWhite) {
      setWhiteReady(newReady);
    } else {
      setBlackReady(newReady);
    }

    if (multiplayerMode === 'online') {
      multiplayerService.sendPacket({
        type: 'EMOTE',
        emoji: newReady ? 'READY' : 'UNREADY',
        team: activeTabTeam,
        senderId: '',
      });
    }
  };

  // Start game
  const handleStartGame = () => {
    const whitePieces = board.pieces.filter((p) => p.team === 'white');
    const blackPieces = board.pieces.filter((p) => p.team === 'black');

    const whiteKings = whitePieces.filter((p) => p.typeId === 'king').length;
    const blackKings = blackPieces.filter((p) => p.typeId === 'king').length;

    if (whiteKings !== 1 || blackKings !== 1) {
      alert('Mỗi đội bắt buộc phải có ĐÚNG 1 con Vua (Thủ Môn)!');
      return;
    }

    if (!whiteReady || !blackReady) {
      alert('Cả 2 đội đều phải xác nhận Sẵn Sàng (✓) trước khi bắt đầu trận đấu!');
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

  const bothReady = whiteReady && blackReady;

  // Selected piece info
  const selectedPiece = board.pieces.find((p) => p.id === selectedPieceId);
  const selectedPieceDef = selectedPiece ? getPieceDefinition(selectedPiece.typeId) : null;

  // Grid coordinates for the active team's half pitch
  const startY = isWhite ? 7 : 0;
  const endY = isWhite ? 14 : 7;
  const rowIndices = Array.from({ length: endY - startY + 1 }, (_, i) => startY + i);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-center py-2 px-2 sm:px-4 text-slate-100 min-h-[90vh]">
      {/* Top Header & Team Switcher Bar */}
      <div className="w-full bg-[#111827] border border-slate-800 rounded-2xl p-2.5 mb-3 flex flex-wrap items-center justify-between gap-3 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBackToMenu}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 flex items-center gap-1.5 transition-colors border border-slate-700"
          >
            <span>←</span> Menu
          </button>

          {/* Dual Team Switcher Tabs */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                if (multiplayerMode === 'local' || onlineRole === 'white') {
                  setActiveTabTeam('white');
                  setSelectedPieceId(null);
                }
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                activeTabTeam === 'white'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>♔</span>
              <span>ĐỘI TRẮNG</span>
              {whiteReady ? (
                <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded-full">✓ SẴN SÀNG</span>
              ) : (
                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded-full">⏳ Đang xếp</span>
              )}
            </button>

            <button
              onClick={() => {
                if (multiplayerMode === 'local' || onlineRole === 'black') {
                  setActiveTabTeam('black');
                  setSelectedPieceId(null);
                }
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                activeTabTeam === 'black'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>♚</span>
              <span>ĐỘI ĐỎ</span>
              {blackReady ? (
                <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded-full">✓ SẴN SÀNG</span>
              ) : (
                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded-full">⏳ Đang xếp</span>
              )}
            </button>
          </div>
        </div>

        {/* Kick Off Button or Ready Status */}
        <div className="flex items-center gap-2">
          {bothReady ? (
            <button
              onClick={handleStartGame}
              className="px-6 py-2 bg-gradient-to-r from-lime-400 via-emerald-400 to-green-500 hover:from-lime-300 hover:to-emerald-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-[0_0_25px_rgba(163,230,53,0.6)] uppercase tracking-wider flex items-center gap-2 animate-bounce"
            >
              <span>🟢</span> BẮT ĐẦU TRẬN ĐẤU (KICK OFF)
            </button>
          ) : (
            <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-amber-300/90 bg-amber-950/40 px-3 py-1.5 rounded-xl border border-amber-500/30">
              <span>⏳</span>
              <span>Cả 2 đội cần bấm [Xác Nhận Đội Hình] để bắt đầu</span>
            </div>
          )}

          <button
            onClick={() => setIsRegistryOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-cyan-300 border border-cyan-500/30 flex items-center gap-1"
          >
            <span>📚</span> Bách Khoa
          </button>
        </div>
      </div>

      {/* Main Layout: Left Team Pieces List + Right Grass Pitch */}
      <div className="w-full flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* LEFT COLUMN: Clean List of Team Pieces with Add/Delete actions (~ 45% width / 5 cols) */}
        <div className="lg:col-span-5 flex flex-col bg-[#141b2d] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          {/* Header Bar */}
          <div className="p-3.5 bg-[#0d121f] border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base font-black text-white">
                DANH SÁCH QUÂN CỜ ({currentTeamPieces.length}/{MAX_PIECES_PER_TEAM})
              </span>
            </div>

            {/* Add Piece Button */}
            {!isReadOnly && !isCurrentTeamReady && (
              <button
                disabled={currentTeamPieces.length >= MAX_PIECES_PER_TEAM}
                onClick={() => setIsAddPieceModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-lime-400 to-emerald-400 hover:from-lime-300 hover:to-emerald-300 text-slate-950 font-black text-xs flex items-center gap-1 shadow-md disabled:opacity-40"
              >
                <span>➕</span> THÊM QUÂN
              </button>
            )}
          </div>

          {/* Piece List Rows */}
          <div className="flex-1 p-3 overflow-y-auto space-y-1.5 custom-scrollbar max-h-[440px]">
            {currentTeamPieces.map((piece, idx) => {
              const def = getPieceDefinition(piece.typeId);
              const isSelected = selectedPieceId === piece.id;
              const isKing = piece.typeId === 'king';

              return (
                <div
                  key={piece.id}
                  onClick={() => handleSelectPiece(piece.id)}
                  className={`flex items-center justify-between p-2.5 rounded-2xl transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-[#bef264]/20 border-[#bef264] ring-2 ring-[#bef264] text-white shadow-lg'
                      : 'bg-[#10172a]/80 border-slate-800 hover:bg-[#1e293b]/90 text-slate-300'
                  }`}
                >
                  {/* Left: Symbol & Name & Role */}
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-xl shrink-0 shadow">
                      {def?.symbol || '♟'}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-bold text-white truncate">
                          {def?.vietnameseName}
                        </span>
                        {isKing && (
                          <span className="text-[9px] bg-yellow-500/20 text-yellow-300 px-1.5 py-0.2 rounded font-black border border-yellow-500/30">
                            DUY NHẤT
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-amber-300 font-mono font-bold">
                          {def?.cost || 0} điểm
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Vị trí: ({piece.position.x}, {piece.position.y})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Delete button */}
                  {!isReadOnly && !isCurrentTeamReady && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isKing ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePiece(piece.id);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-600 border border-red-500/40 text-red-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1"
                        >
                          <span>🗑️</span> Xóa
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-bold px-2 py-1 bg-slate-950 rounded-lg">
                          🔒 Cố định
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Selected Piece Action Box (Quick Move / Info) */}
          {selectedPiece && selectedPieceDef && (
            <div className="mx-3 mb-2 p-2.5 bg-slate-950/90 rounded-2xl border border-lime-400/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{selectedPieceDef.symbol}</span>
                <div>
                  <span className="text-xs font-bold text-white">
                    Đang chọn: {selectedPieceDef.vietnameseName}
                  </span>
                  <p className="text-[10px] text-lime-300">
                    Nhấp vào <strong>ô trống</strong> trên sân để di dời, hoặc nhấp <strong>quân khác</strong> để hoán đổi
                  </p>
                </div>
              </div>

              {selectedPiece.typeId !== 'king' && !isReadOnly && !isCurrentTeamReady && (
                <button
                  onClick={() => handleDeletePiece(selectedPiece.id)}
                  className="px-2.5 py-1 bg-red-600/30 hover:bg-red-600 text-red-300 hover:text-white rounded-lg text-xs font-bold border border-red-500/40"
                >
                  Xóa quân
                </button>
              )}
            </div>
          )}

          {/* Bottom Salary Cap Bar & Ready Confirmation Button */}
          <div className="p-3 bg-[#0d121f] border-t border-slate-800 flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-[11px] font-bold text-slate-400">QUỸ LƯƠNG ĐỘI HÌNH:</span>
              <span className={`font-mono font-black ${isOverBudget ? 'text-red-400' : 'text-lime-400'}`}>
                {totalCost} / {SALARY_CAP} Điểm {isOverBudget && `(Vượt ${Math.abs(remainingBudget)}đ)`}
              </span>
            </div>

            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-300 ${
                  isOverBudget ? 'bg-red-500' : 'bg-gradient-to-r from-lime-400 to-emerald-400'
                }`}
                style={{ width: `${Math.min(100, (totalCost / SALARY_CAP) * 100)}%` }}
              />
            </div>

            {/* Ready Confirmation CTA */}
            {!isReadOnly && (
              <button
                onClick={handleToggleReady}
                className={`w-full py-3 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl transition-all ${
                  isCurrentTeamReady
                    ? 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/50'
                    : isOverBudget
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40 cursor-not-allowed opacity-50'
                    : 'bg-gradient-to-r from-lime-400 to-emerald-500 hover:from-lime-300 hover:to-emerald-400 text-slate-950 shadow-[0_0_20px_rgba(190,242,100,0.3)] transform hover:scale-[1.02]'
                }`}
              >
                {isCurrentTeamReady ? (
                  <>
                    <span>🔓</span> HỦY XÁC NHẬN (CHỈNH SỬA LẠI)
                  </>
                ) : (
                  <>
                    <span>✅</span> XÁC NHẬN XONG ĐỘI HÌNH (SẴN SÀNG)
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Full Pitch Grass Canvas with Clean Piece Cards (~ 55% width / 7 cols) */}
        <div className="lg:col-span-7 flex flex-col bg-[#141b2d] border border-slate-800 rounded-3xl p-3 sm:p-4 overflow-hidden shadow-2xl relative">
          {/* Pitch Top Bar: Info Badge */}
          <div className="flex items-center justify-between px-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-lime-400 animate-pulse" />
              <span className="text-xs font-black text-white uppercase tracking-wider">
                SÂN BỐ TRÍ: {isWhite ? 'ĐỘI TRẮNG (SÂN DƯỚI)' : 'ĐỘI ĐỎ (SÂN TRÊN)'}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 hidden sm:inline">
              👉 Nhấp quân để chọn/hoán đổi, nhấp ô trống để dời
            </span>
          </div>

          {/* Grass Field Canvas */}
          <div className="relative flex-1 rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-800 bg-[#15803d] flex items-center justify-center p-1 sm:p-2 min-h-[480px]">
            {/* Field Pattern & Markings */}
            <div
              className="grid gap-[2px] relative w-full h-full bg-[#166534] p-1.5 rounded-xl"
              style={{
                gridTemplateColumns: `repeat(${BOARD_WIDTH}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${rowIndices.length}, minmax(0, 1fr))`,
              }}
            >
              {rowIndices.map((y) =>
                Array.from({ length: BOARD_WIDTH }).map((_, x) => {
                  const piece = board.pieces.find(
                    (p) => p.position.x === x && p.position.y === y && p.team === activeTabTeam
                  );
                  const isSelected = selectedPieceId === piece?.id;

                  // Turf stripes
                  const isEvenRow = y % 2 === 0;
                  const isCenterLine = y === 7;
                  const isTopGoalArea = y === 0 && x >= 4 && x <= 6;
                  const isBottomGoalArea = y === 14 && x >= 4 && x <= 6;
                  const isOutOfPitch = (y === 0 || y === 14) && (x < 4 || x > 6);
                  const isTopBox = y <= 3 && x >= 2 && x <= 8 && y >= 1;
                  const isBottomBox = y >= 11 && x >= 2 && x <= 8 && y <= 13;

                  let cellBg = isEvenRow ? 'bg-[#15803d]/90' : 'bg-[#16a34a]/90';

                  if (isTopGoalArea || isBottomGoalArea) {
                    cellBg = 'bg-yellow-950/80 border border-yellow-400/80';
                  } else if (isOutOfPitch) {
                    cellBg = 'opacity-0 pointer-events-none';
                  }

                  return (
                    <div
                      key={`${x}-${y}`}
                      onClick={() => handlePitchCellClick(x, y)}
                      className={`relative flex items-center justify-center rounded transition-all group overflow-visible ${cellBg} ${
                        isOutOfPitch ? '' : 'cursor-pointer hover:brightness-110'
                      }`}
                    >
                      {/* Field Markings Lines */}
                      {y === 1 && !isOutOfPitch && (
                        <div className="absolute inset-x-0 top-0 h-[2px] bg-white/50 pointer-events-none" />
                      )}
                      {y === 13 && !isOutOfPitch && (
                        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/50 pointer-events-none" />
                      )}
                      {isCenterLine && (
                        <div className={`absolute inset-x-0 ${isWhite ? 'top-0' : 'bottom-0'} h-[2px] bg-white/60 pointer-events-none`} />
                      )}
                      {x === 5 && y === 7 && (
                        <div className="absolute w-5 h-5 rounded-full border-2 border-white/60 pointer-events-none" />
                      )}
                      {isTopBox && y === 3 && (
                        <div className="absolute inset-x-0 bottom-0 h-[1.5px] bg-white/30 pointer-events-none" />
                      )}
                      {isBottomBox && y === 11 && (
                        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-white/30 pointer-events-none" />
                      )}

                      {/* CLEAN PIECE CARD ON PITCH */}
                      {piece && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectPiece(piece.id);
                          }}
                          className={`relative z-20 flex flex-col items-center justify-between rounded-lg cursor-pointer transition-all duration-200 w-[52px] sm:w-[68px] md:w-[74px] h-[52px] sm:h-[64px] md:h-[68px] shadow-2xl overflow-hidden ${
                            isSelected
                              ? 'bg-[#1e293b] ring-2 sm:ring-4 ring-[#bef264] scale-110 shadow-[0_0_20px_rgba(190,242,100,0.8)] z-30'
                              : 'bg-[#18233c]/95 hover:bg-[#1e293b] border border-slate-600 hover:scale-105'
                          }`}
                        >
                          {/* Top Symbol */}
                          <div className="flex-1 flex items-center justify-center w-full pt-1">
                            <span className="text-xl sm:text-2xl md:text-3xl drop-shadow-md">
                              {getPieceDefinition(piece.typeId)?.symbol || '♟'}
                            </span>
                          </div>

                          {/* Bottom Bar: Name & Points */}
                          <div className="w-full bg-[#0d1322] px-1 py-0.5 flex items-center justify-between border-t border-slate-700/80">
                            <span className="text-[8px] sm:text-[9px] font-black text-slate-200 truncate max-w-[42px] sm:max-w-[50px]">
                              {getPieceDefinition(piece.typeId)?.vietnameseName.split(' ')[0] || getPieceDefinition(piece.typeId)?.name}
                            </span>
                            <span className="text-[8px] sm:text-[9px] font-black text-lime-400 font-mono">
                              {getPieceDefinition(piece.typeId)?.cost || 0}đ
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ADD PIECE MODAL (Market Picker) */}
      {isAddPieceModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setIsAddPieceModalOpen(false)}
        >
          <div
            className="bg-[#141b2d] border-2 border-lime-400 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-[#0d121f] border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-lime-400 uppercase">
                  THÊM QUÂN CỜ VÀO ĐỘI {isWhite ? 'TRẮNG' : 'ĐỎ'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Số lượng hiện tại: {currentTeamPieces.length}/{MAX_PIECES_PER_TEAM} • Ngân sách còn lại:{' '}
                  <span className={remainingBudget < 0 ? 'text-red-400 font-bold' : 'text-lime-400 font-bold'}>
                    {remainingBudget} điểm
                  </span>
                </p>
              </div>
              <button
                onClick={() => setIsAddPieceModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto max-h-[60vh]">
              {allAvailablePieces.map((p) => {
                const isKing = p.id === 'king';
                const cannotAddKing = isKing && kingCount >= 1;
                const isAffordable = remainingBudget >= p.cost;
                const isAvailable = !cannotAddKing && isAffordable;

                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => handleAddPiece(p.id)}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                      !isAvailable
                        ? 'opacity-40 bg-slate-950 border-slate-800 cursor-not-allowed text-slate-500'
                        : 'bg-slate-900/80 border-slate-700 hover:border-lime-400/60 hover:bg-slate-850 text-white'
                    }`}
                  >
                    <div className="flex items-start justify-between w-full">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{p.symbol}</span>
                        <div>
                          <div className="text-xs font-black text-white">{p.vietnameseName}</div>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-950 text-slate-300 font-bold uppercase">
                            {p.role}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-black text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                          {p.cost}đ
                        </span>
                        {cannotAddKing && (
                          <span className="text-[9px] text-red-400 font-bold mt-0.5">
                            Đã có 1 Vua
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-300 mt-2 line-clamp-2 leading-relaxed">
                      {p.description}
                    </p>

                    {p.specialAbilityDesc && (
                      <div className="mt-2 text-[10px] text-cyan-300 bg-cyan-950/50 p-1.5 rounded-lg border border-cyan-500/30">
                        ⚡ {p.specialAbilityDesc}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-3 bg-[#0d121f] border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setIsAddPieceModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

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
