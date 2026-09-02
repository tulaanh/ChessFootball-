import React, { useState, useEffect } from 'react';
import {
  BoardState,
  PieceInstance,
  Position,
  TeamColor,
  TeamRoster,
  GameMode,
  AIDifficulty,
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
  initialBoard?: BoardState;
  initialWhiteRoster?: TeamRoster;
  initialBlackRoster?: TeamRoster;
  multiplayerMode?: 'local' | 'online';
  gameMode?: GameMode;
  aiDifficulty?: AIDifficulty;
  onlineRole?: TeamColor | null;
  onlineRoomId?: string | null;
  onStartMatch: (board: BoardState, whiteRoster: TeamRoster, blackRoster: TeamRoster) => void;
  onBackToMenu: () => void;
}

const SALARY_CAP = 150;
const MAX_PIECES_PER_TEAM = 11;

export default function TacticalSetup({
  initialBoard,
  initialWhiteRoster = DEFAULT_WHITE_ROSTER,
  initialBlackRoster = DEFAULT_BLACK_ROSTER,
  multiplayerMode = 'local',
  gameMode = 'local',
  aiDifficulty = 'normal',
  onlineRole = null,
  onlineRoomId = null,
  onStartMatch,
  onBackToMenu,
}: TacticalSetupProps) {
  const [activeTabTeam, setActiveTabTeam] = useState<TeamColor>(() =>
    multiplayerMode === 'online' && onlineRole ? onlineRole : 'white'
  );

  const [whiteRoster, setWhiteRoster] = useState<TeamRoster>(initialBoard?.whiteRoster || initialWhiteRoster);
  const [blackRoster, setBlackRoster] = useState<TeamRoster>(initialBoard?.blackRoster || initialBlackRoster);
  const [board, setBoard] = useState<BoardState>(() =>
    initialBoard || createInitialBoard(initialWhiteRoster, initialBlackRoster)
  );

  const [whiteReady, setWhiteReady] = useState(false);
  const [blackReady, setBlackReady] = useState(gameMode === 'ai');

  // Interaction states
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [placingTypeId, setPlacingTypeId] = useState<string | null>(null);
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

  // Click on a piece type in the left catalog to select for placement
  const handleSelectPieceTypeToPlace = (typeId: string) => {
    if (isReadOnly || isCurrentTeamReady) return;

    if (currentTeamPieces.length >= MAX_PIECES_PER_TEAM) {
      alert(`Đội hình đã đạt tối đa ${MAX_PIECES_PER_TEAM} quân cờ!`);
      return;
    }

    const def = getPieceDefinition(typeId);
    if (totalCost + def.cost > SALARY_CAP) {
      alert(`Vượt quá quỹ lương ${SALARY_CAP} điểm!`);
      return;
    }

    if (placingTypeId === typeId) {
      setPlacingTypeId(null);
    } else {
      setPlacingTypeId(typeId);
      setSelectedPieceId(null);
    }
  };

  // Place the selected piece type onto an empty cell (x, y) on the pitch
  const handlePlacePieceAtCell = (x: number, y: number) => {
    if (!placingTypeId || isReadOnly || isCurrentTeamReady) return;

    if (currentTeamPieces.length >= MAX_PIECES_PER_TEAM) {
      alert(`Đội hình đã đủ ${MAX_PIECES_PER_TEAM} quân cờ!`);
      setPlacingTypeId(null);
      return;
    }

    const def = getPieceDefinition(placingTypeId);
    if (totalCost + def.cost > SALARY_CAP) {
      alert(`Vượt quá quỹ lương ${SALARY_CAP} điểm!`);
      setPlacingTypeId(null);
      return;
    }

    const newPiece: PieceInstance = {
      id: `p_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      typeId: placingTypeId,
      team: activeTabTeam,
      position: { x, y },
      formationIndex: currentTeamPieces.length,
    };

    const updatedPieces = [...board.pieces, newPiece];
    const newPieceTypeIds = updatedPieces
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
      pieces: updatedPieces,
      whiteRoster: isWhite ? updatedRoster : whiteRoster,
      blackRoster: !isWhite ? updatedRoster : blackRoster,
    };

    syncBoardState(nextBoard);

    // Keep placing mode active if team can still afford another piece of this type and not full
    const newTeamPiecesCount = currentTeamPieces.length + 1;
    const newTotalCost = totalCost + def.cost;
    if (newTeamPiecesCount >= MAX_PIECES_PER_TEAM || newTotalCost + def.cost > SALARY_CAP) {
      setPlacingTypeId(null);
    }
  };

  // Remove a piece instance from the team (No minimum limit restriction)
  const handleDeletePiece = (pieceId: string) => {
    if (isReadOnly || isCurrentTeamReady) return;

    const pieceToDelete = board.pieces.find((p) => p.id === pieceId);
    if (!pieceToDelete) return;

    // RULE: King cannot be deleted
    if (pieceToDelete.typeId === 'king') {
      alert('Không thể xóa Vua! Mỗi đội bắt buộc phải có 1 con Vua làm Thủ Môn.');
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

  // Quick clear all pieces of the active team except the King
  const handleClearAllPiecesExceptKing = () => {
    if (isReadOnly || isCurrentTeamReady) return;

    const kingPiece = currentTeamPieces.find((p) => p.typeId === 'king');
    if (!kingPiece) return;

    if (currentTeamPieces.length <= 1) {
      alert('Đội hình hiện tại chỉ có duy nhất quân Vua!');
      return;
    }

    const otherTeamPieces = board.pieces.filter((p) => p.team !== activeTabTeam);
    const nextPieces = [...otherTeamPieces, kingPiece];

    const updatedRoster: TeamRoster = {
      ...currentRoster,
      pieces: ['king'],
    };

    if (isWhite) setWhiteRoster(updatedRoster);
    else setBlackRoster(updatedRoster);

    const nextBoard: BoardState = {
      ...board,
      pieces: nextPieces,
      selectedPieceId: null,
      whiteRoster: isWhite ? updatedRoster : whiteRoster,
      blackRoster: !isWhite ? updatedRoster : blackRoster,
    };

    setSelectedPieceId(null);
    setPlacingTypeId(null);
    syncBoardState(nextBoard);
  };

  // Select / Swap existing piece on pitch
  const handleSelectPiece = (pieceId: string) => {
    if (isReadOnly || isCurrentTeamReady) return;
    const piece = board.pieces.find((p) => p.id === pieceId);
    if (!piece || piece.team !== activeTabTeam) return;

    // If we are currently placing a new piece, cancel placing mode
    if (placingTypeId) {
      setPlacingTypeId(null);
    }

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

  // Click on empty cell on pitch
  const handlePitchCellClick = (x: number, y: number) => {
    if (isReadOnly || isCurrentTeamReady) return;
    const isInHalf = isWhite ? y >= 8 && y <= 13 : y >= 1 && y <= 6;
    if (!isInHalf) return;

    const existingPiece = board.pieces.find(
      (p) => p.position.x === x && p.position.y === y && p.team === activeTabTeam
    );

    if (existingPiece) {
      handleSelectPiece(existingPiece.id);
      return;
    }

    // If placing a new piece type -> place it at (x, y)
    if (placingTypeId) {
      handlePlacePieceAtCell(x, y);
      return;
    }

    // If moving an existing selected piece -> move to (x, y)
    if (selectedPieceId) {
      const nextBoard: BoardState = {
        ...board,
        pieces: board.pieces.map((p) =>
          p.id === selectedPieceId ? { ...p, position: { x, y } } : p
        ),
        selectedPieceId: null,
      };
      setSelectedPieceId(null);
      syncBoardState(nextBoard);
    }
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

    if (currentTeamPieces.length > MAX_PIECES_PER_TEAM) {
      alert(`Số lượng quân cờ không được vượt quá ${MAX_PIECES_PER_TEAM} quân!`);
      return;
    }

    const newReady = !isCurrentTeamReady;
    if (isWhite) {
      setWhiteReady(newReady);
    } else {
      setBlackReady(newReady);
    }

    // Clear placement mode
    setPlacingTypeId(null);
    setSelectedPieceId(null);

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

    if (whitePieces.length > MAX_PIECES_PER_TEAM || blackPieces.length > MAX_PIECES_PER_TEAM) {
      alert(`Mỗi đội chỉ được có tối đa ${MAX_PIECES_PER_TEAM} quân cờ!`);
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

    const isMidMatchAdjustment = (board.score.white > 0 || board.score.black > 0) || Boolean(board.turnNumber && board.turnNumber > 1);
    const nextTurn = isMidMatchAdjustment ? (board.currentTurn || 'white') : 'white';

    const nextBoard: BoardState = {
      ...board,
      phase: 'playing',
      savedFormation,
      pieces: savedFormation,
      ballPosition: { x: 5, y: 7 },
      currentTurn: nextTurn,
      remainingAP: 2,
      selectedPieceId: null,
      activeAction: null,
      whiteRoster,
      blackRoster,
      commentary: [
        {
          id: `c_${Date.now()}`,
          text: isMidMatchAdjustment
            ? `🔔 Trận đấu tiếp tục sau bàn thắng! Đội ${nextTurn === 'white' ? 'Trắng' : 'Đỏ'} giao bóng tại giữa sân.`
            : '🔔 Trọng tài đã nổi còi bắt đầu trận đấu! Đội Trắng giao bóng (2 lượt/vòng đấu).',
          type: 'whistle',
          timestamp: `${(board.turnNumber || 1) * 3}'`,
        },
        ...board.commentary,
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
  const isMidMatchAdjustment = (board.score.white > 0 || board.score.black > 0) || Boolean(board.turnNumber && board.turnNumber > 1);

  // Selected piece info
  const selectedPiece = board.pieces.find((p) => p.id === selectedPieceId);
  const selectedPieceDef = selectedPiece ? getPieceDefinition(selectedPiece.typeId) : null;

  // Available pieces that CAN BE ADDED (excluding King)
  const piecesAvailableToAdd = allAvailablePieces.filter((p) => p.id !== 'king');
  const placingPieceDef = placingTypeId ? getPieceDefinition(placingTypeId) : null;

  // Grid coordinates for the active team's half pitch
  const startY = isWhite ? 7 : 0;
  const endY = isWhite ? 14 : 7;
  const rowIndices = Array.from({ length: endY - startY + 1 }, (_, i) => startY + i);

  return (
    <div className="w-full max-w-[1600px] mx-auto flex flex-col items-center py-2 px-2 sm:px-4 md:px-6 text-slate-100 min-h-[92vh]">
      {/* Top Header & Team Switcher Bar */}
      <div className="w-full bg-slate-800/95 border border-slate-700 rounded-2xl p-3 mb-3 flex flex-wrap items-center justify-between gap-3 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBackToMenu}
            className="px-3.5 py-2 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-colors border border-slate-600 shadow"
          >
            <span>←</span> Menu
          </button>

          {/* Mid-Match Score Indicator */}
          {isMidMatchAdjustment && (
            <div className="px-3.5 py-1.5 bg-amber-500/10 border border-amber-400/40 rounded-xl text-xs font-black text-amber-300 flex items-center gap-2 shadow">
              <span>⚽ TỈ SỐ:</span>
              <span className="font-mono text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                ⚪ {board.score.white} - {board.score.black} 🔴
              </span>
            </div>
          )}

          {/* Team Tabs Switcher */}
          <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-700 shadow-inner">
            <button
              onClick={() => {
                if (multiplayerMode === 'local' || onlineRole === 'white' || isReadOnly) {
                  setActiveTabTeam('white');
                  setSelectedPieceId(null);
                  setPlacingTypeId(null);
                }
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                activeTabTeam === 'white'
                  ? 'bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-300'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <span>♔</span>
              <span>ĐỘI TRẮNG</span>
              {whiteReady ? (
                <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded-full">✓ SẴN SÀNG</span>
              ) : (
                <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded-full">⏳ Đang xếp</span>
              )}
            </button>

            <button
              onClick={() => {
                if (gameMode !== 'ai' && (multiplayerMode === 'local' || onlineRole === 'black')) {
                  setActiveTabTeam('black');
                  setSelectedPieceId(null);
                  setPlacingTypeId(null);
                } else if (gameMode === 'ai') {
                  setActiveTabTeam('black');
                }
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                activeTabTeam === 'black'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <span>{gameMode === 'ai' ? '🤖' : '♚'}</span>
              <span>{gameMode === 'ai' ? 'ĐỘI ĐỎ (MÁY AI)' : 'ĐỘI ĐỎ'}</span>
              {blackReady ? (
                <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded-full">✓ SẴN SÀNG</span>
              ) : (
                <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded-full">⏳ Đang xếp</span>
              )}
            </button>
          </div>
        </div>

        {/* Kick Off Button or Ready Status */}
        <div className="flex items-center gap-2">
          {bothReady ? (
            <button
              onClick={handleStartGame}
              className="px-6 py-2.5 bg-gradient-to-r from-lime-400 via-emerald-400 to-green-500 hover:from-lime-300 hover:to-emerald-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-[0_0_25px_rgba(163,230,53,0.6)] uppercase tracking-wider flex items-center gap-2 animate-bounce"
            >
              <span>🟢</span> {isMidMatchAdjustment ? 'TIẾP TỤC TRẬN ĐẤU (GIAO BÓNG)' : 'BẮT ĐẦU TRẬN ĐẤU (KICK OFF)'}
            </button>
          ) : (
            <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-amber-300/90 bg-amber-950/40 px-3 py-1.5 rounded-xl border border-amber-500/30">
              <span>⏳</span>
              <span>
                {gameMode === 'ai'
                  ? 'Bạn hãy bấm [Xác Nhận Đội Hình] của Đội Trắng để bắt đầu đấu với Máy!'
                  : `Cả 2 đội cần bấm [Xác Nhận Đội Hình] để ${isMidMatchAdjustment ? 'tiếp tục' : 'bắt đầu'}`}
              </span>
            </div>
          )}

          <button
            onClick={() => setIsRegistryOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-xs font-bold text-cyan-300 border border-cyan-500/40 flex items-center gap-1 shadow"
          >
            <span>📚</span> Bách Khoa
          </button>
        </div>
      </div>

      {/* Main Layout: Left Available Pieces (4 cols) + Right Grass Pitch (8 cols) */}
      <div className="w-full flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* LEFT COLUMN: PIECES AVAILABLE TO ADD (~ 33% width / 4 cols) */}
        <div className="lg:col-span-4 flex flex-col bg-slate-800/90 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl">
          {/* Header Bar */}
          <div className="p-3.5 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
            <div>
              <span className="text-sm sm:text-base font-black text-white flex items-center gap-1.5">
                <span>➕</span> CÁC QUÂN CÓ THỂ THÊM
              </span>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Bấm vào quân cờ để chọn, sau đó nhấp vào ô trống trên sân cỏ
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-lime-400 font-black px-2 py-1 rounded-xl bg-lime-950/80 border border-lime-500/40">
                {currentTeamPieces.length}/{MAX_PIECES_PER_TEAM} Quân
              </span>
            </div>
          </div>

          {/* Placement Guide Notification */}
          {placingTypeId && placingPieceDef && (
            <div className="mx-3 mt-3 p-2.5 bg-lime-950/80 border border-lime-400/80 rounded-2xl flex items-center justify-between animate-pulse shadow-lg">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{placingPieceDef.symbol}</span>
                <div>
                  <span className="text-xs font-black text-white">
                    Đang chọn: {placingPieceDef.vietnameseName}
                  </span>
                  <p className="text-[10px] text-lime-300">
                    👉 Nhấp vào ô trống trên sân cỏ bên phải để đặt quân!
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPlacingTypeId(null)}
                className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] font-bold rounded-lg border border-slate-700"
              >
                Hủy
              </button>
            </div>
          )}

          {/* Available Pieces List */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2 custom-scrollbar max-h-[440px]">
            {piecesAvailableToAdd.map((pieceDef) => {
              const countOnPitch = currentTeamPieces.filter((p) => p.typeId === pieceDef.id).length;
              const canAfford = remainingBudget >= pieceDef.cost;
              const isSquadFull = currentTeamPieces.length >= MAX_PIECES_PER_TEAM;
              const isPlacingThis = placingTypeId === pieceDef.id;
              const canAdd = !isReadOnly && !isCurrentTeamReady && !isSquadFull && canAfford;

              return (
                <div
                  key={pieceDef.id}
                  onClick={() => {
                    if (canAdd) handleSelectPieceTypeToPlace(pieceDef.id);
                  }}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                    isPlacingThis
                      ? 'bg-lime-400/20 border-lime-400 ring-2 ring-lime-400 shadow-[0_0_15px_rgba(163,230,53,0.3)] text-white'
                      : canAdd
                      ? 'bg-slate-700/60 border-slate-600/80 hover:border-lime-400/60 hover:bg-slate-700 text-slate-100 shadow-sm'
                      : 'bg-slate-800/40 border-slate-700/40 opacity-40 cursor-not-allowed text-slate-400'
                  }`}
                >
                  {/* Left: Symbol & Name & Role */}
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-600 flex items-center justify-center text-2xl shrink-0 shadow">
                      {pieceDef.symbol}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-bold text-white truncate">
                          {pieceDef.vietnameseName}
                        </span>
                        {countOnPitch > 0 && (
                          <span className="text-[9px] bg-slate-800 text-lime-400 px-1.5 py-0.2 rounded font-mono font-black border border-slate-600">
                            Trên sân: {countOnPitch}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-amber-300 font-mono font-bold">
                          {pieceDef.cost} điểm
                        </span>
                        <span className="text-[10px] text-slate-300">
                          {pieceDef.role === 'GK'
                            ? 'Thủ Môn'
                            : pieceDef.role === 'DEF'
                            ? 'Hậu Vệ'
                            : pieceDef.role === 'MID'
                            ? 'Tiền Vệ'
                            : 'Tiền Đạo'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Select to Place CTA */}
                  {!isReadOnly && !isCurrentTeamReady && (
                    <button
                      type="button"
                      disabled={!canAdd}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectPieceTypeToPlace(pieceDef.id);
                      }}
                      className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1 shrink-0 transition-all ${
                        isPlacingThis
                          ? 'bg-lime-400 text-slate-950 shadow-md ring-2 ring-lime-300 animate-pulse'
                          : 'bg-slate-800 hover:bg-lime-400 hover:text-slate-950 text-lime-300 border border-slate-600'
                      }`}
                    >
                      <span>{isPlacingThis ? '✓ Đang chọn' : '➕ Đặt quân'}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Salary Cap Bar & Ready Confirmation Button */}
          <div className="p-3 bg-slate-800 border-t border-slate-700 flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-[11px] font-bold text-slate-300">QUỸ LƯƠNG ĐỘI HÌNH:</span>
              <span className={`font-mono font-black ${isOverBudget ? 'text-rose-400' : 'text-lime-400'}`}>
                {totalCost} / {SALARY_CAP} Điểm {isOverBudget && `(Vượt ${Math.abs(remainingBudget)}đ)`}
              </span>
            </div>

            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
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
                    ? 'bg-slate-700 hover:bg-slate-600 text-amber-400 border border-amber-500/50'
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

        {/* RIGHT COLUMN: Full Pitch Grass Canvas with Existing Pieces & Remove Action (~ 67% width / 8 cols) */}
        <div className="lg:col-span-8 flex flex-col bg-slate-800/90 border border-slate-700 rounded-3xl p-3 sm:p-5 overflow-hidden shadow-2xl relative">
          {/* Pitch Top Bar: Info Badge & Selected Piece Delete Bar */}
          <div className="flex items-center justify-between px-2 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-lime-400 animate-pulse" />
              <span className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                SÂN BỐ TRÍ: {isWhite ? 'ĐỘI TRẮNG (SÂN DƯỚI)' : 'ĐỘI ĐỎ (SÂN TRÊN)'}
              </span>
            </div>

            {/* Selected piece delete option or Quick Clear All option on pitch */}
            <div className="flex items-center gap-2">
              {selectedPiece && selectedPieceDef && !isReadOnly && !isCurrentTeamReady && (
                <div className="flex items-center gap-2 bg-slate-900 px-3.5 py-1.5 rounded-xl border border-lime-400/40 animate-fade-in shadow-md">
                  <span className="text-xs sm:text-sm font-bold text-white">
                    {selectedPieceDef.symbol} {selectedPieceDef.vietnameseName.split(' ')[0]}
                  </span>
                  {selectedPiece.typeId !== 'king' ? (
                    <button
                      onClick={() => handleDeletePiece(selectedPiece.id)}
                      className="px-2.5 py-1 rounded-lg bg-red-950 hover:bg-red-600 text-red-300 hover:text-white text-xs font-black border border-red-500/40 transition-colors"
                    >
                      🗑️ Xóa khỏi sân
                    </button>
                  ) : (
                    <span className="text-xs text-amber-400 font-bold">🔒 Vua (Thủ Môn)</span>
                  )}
                </div>
              )}

              {!isReadOnly && !isCurrentTeamReady && currentTeamPieces.length > 1 && (
                <button
                  type="button"
                  onClick={handleClearAllPiecesExceptKing}
                  className="px-3.5 py-1.5 bg-red-950/70 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 text-xs font-black rounded-xl transition-all flex items-center gap-1 shadow"
                  title="Xóa nhanh toàn bộ quân cờ hiện tại trừ quân Vua"
                >
                  <span>🧹</span> Xóa Hết Đội Hình (Giữ Vua)
                </button>
              )}
            </div>
          </div>

          {/* Grass Field Canvas */}
          <div className="relative flex-1 rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-600 bg-slate-900 flex items-center justify-center p-2 sm:p-4 min-h-[540px] lg:min-h-[620px]">
            {/* Field Pattern & Markings: Constrained to 11/8 aspect ratio for perfect 1:1 square grid cells */}
            <div
              className="grid gap-1.5 sm:gap-2 relative w-full bg-[#14532d] p-2.5 sm:p-4 rounded-3xl border-2 border-emerald-500/40 shadow-2xl"
              style={{
                gridTemplateColumns: `repeat(${BOARD_WIDTH}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${rowIndices.length}, minmax(0, 1fr))`,
                aspectRatio: '11 / 8',
                maxWidth: 'min(100%, calc(86vh * 11 / 8), 920px)',
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

                  let cellBg = isEvenRow ? 'bg-[#15803d]' : 'bg-[#16a34a]';

                  if (isTopGoalArea || isBottomGoalArea) {
                    cellBg = 'bg-slate-900/85 border-2 border-white/90 shadow-[0_0_15px_rgba(255,255,255,0.4)] backdrop-blur-sm';
                  } else if (isOutOfPitch) {
                    cellBg = 'opacity-0 pointer-events-none';
                  }

                  // If in placing mode and cell is empty within team's half
                  const isPlacingTarget = placingTypeId && !piece && !isOutOfPitch;

                  return (
                    <div
                      key={`${x}-${y}`}
                      onClick={() => handlePitchCellClick(x, y)}
                      className={`relative aspect-square flex items-center justify-center rounded-lg transition-all group overflow-visible ${cellBg} ${
                        isOutOfPitch
                          ? ''
                          : isPlacingTarget
                          ? 'cursor-pointer ring-2 ring-lime-400 hover:bg-lime-400/40 bg-lime-950/40 scale-[0.98]'
                          : 'cursor-pointer hover:brightness-110'
                      }`}
                    >
                      {/* Goal Mesh Pattern Overlay */}
                      {(isTopGoalArea || isBottomGoalArea) && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
                          <span className="text-[9px] sm:text-[11px] font-black text-white tracking-widest">GOAL</span>
                        </div>
                      )}

                      {/* Field Markings Lines */}
                      {y === 1 && !isOutOfPitch && (
                        <div className="absolute inset-x-0 top-0 h-[2px] bg-white/70 pointer-events-none" />
                      )}
                      {y === 13 && !isOutOfPitch && (
                        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/70 pointer-events-none" />
                      )}
                      {isCenterLine && (
                        <div className={`absolute inset-x-0 ${isWhite ? 'top-0' : 'bottom-0'} h-[2px] bg-white/70 pointer-events-none`} />
                      )}
                      {x === 5 && y === 7 && (
                        <div className="absolute w-5 h-5 rounded-full border-2 border-white/70 pointer-events-none" />
                      )}
                      {isTopBox && y === 3 && (
                        <div className="absolute inset-x-0 bottom-0 h-[1.5px] bg-white/40 pointer-events-none" />
                      )}
                      {isBottomBox && y === 11 && (
                        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-white/40 pointer-events-none" />
                      )}

                      {/* Placing Target Indicator */}
                      {isPlacingTarget && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-pulse">
                          <span className="text-lg sm:text-xl text-lime-300 font-black drop-shadow-md">+</span>
                        </div>
                      )}

                      {/* 3D PIECE BADGE ON PITCH (ULTRA HIGH CONTRAST & GIANT SYMBOL) */}
                      {piece && (() => {
                        const def = getPieceDefinition(piece.typeId);
                        const isWhiteTeam = piece.team === 'white';
                        return (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectPiece(piece.id);
                            }}
                            className={`relative z-20 w-[94%] h-[94%] rounded-2xl flex items-center justify-center cursor-pointer transition-all duration-200 ${
                              isSelected
                                ? 'ring-4 ring-yellow-400 scale-110 shadow-[0_0_25px_rgba(250,204,21,1)] z-30'
                                : 'hover:scale-105 shadow-[0_6px_14px_rgba(0,0,0,0.5)]'
                            } ${
                              isWhiteTeam
                                ? 'bg-gradient-to-br from-white via-slate-100 to-slate-200 border-[3px] border-slate-900 text-slate-950 ring-1 ring-white/60'
                                : 'bg-gradient-to-br from-red-500 via-red-600 to-rose-700 border-[3px] border-white text-white ring-2 ring-red-400/80'
                            }`}
                          >
                            {/* Top Left: Role Badge */}
                            <span
                              className={`absolute -top-1.5 -left-1 px-1.5 py-[1px] rounded-md text-[8px] sm:text-[10px] font-black uppercase tracking-tight shadow-md border leading-none z-10 ${
                                def.role === 'GK'
                                  ? 'bg-yellow-400 text-slate-950 border-yellow-300'
                                  : def.role === 'FWD'
                                  ? 'bg-rose-600 text-white border-rose-300'
                                  : def.role === 'MID'
                                  ? 'bg-blue-600 text-white border-blue-300'
                                  : 'bg-emerald-600 text-white border-emerald-300'
                              }`}
                            >
                              {def.role}
                            </span>

                            {/* Bottom Right: Cost Badge */}
                            <span className="absolute -bottom-1.5 -right-1 px-1.5 py-[1px] rounded-md text-[8px] sm:text-[10px] font-mono font-black bg-slate-950 text-lime-400 border border-lime-400 shadow-md leading-none z-10">
                              {def.cost}đ
                            </span>

                            {/* Center GIANT Chess Symbol */}
                            <span
                              className={`text-2xl sm:text-3xl md:text-4xl font-black leading-none ${
                                isWhiteTeam
                                  ? 'text-slate-950 drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]'
                                  : 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]'
                              }`}
                            >
                              {def.symbol}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })
              )}
            </div>
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
