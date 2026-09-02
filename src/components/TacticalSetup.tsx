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

const POSITION_LABELS = [
  'GK',
  'LB',
  'LCB',
  'RCB',
  'RB',
  'LM',
  'LCM',
  'RCM',
  'RM',
  'LST',
  'RST',
];

const POSITION_FULL_NAMES = [
  'Thủ môn (Goalkeeper)',
  'Hậu vệ cánh trái (Left Back)',
  'Trung vệ trái (Center Back)',
  'Trung vệ phải (Center Back)',
  'Hậu vệ cánh phải (Right Back)',
  'Tiền vệ cánh trái (Left Mid)',
  'Tiền vệ trung tâm (Central Mid)',
  'Tiền vệ trung tâm (Central Mid)',
  'Tiền vệ cánh phải (Right Mid)',
  'Tiền đạo 1 (Left Striker)',
  'Tiền đạo 2 (Right Striker)',
];

const SALARY_CAP = 150;

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

  const [activeSubTab, setActiveSubTab] = useState<'player' | 'formation' | 'tactics'>('player');

  const [whiteRoster, setWhiteRoster] = useState<TeamRoster>(initialWhiteRoster);
  const [blackRoster, setBlackRoster] = useState<TeamRoster>(initialBlackRoster);
  const [board, setBoard] = useState<BoardState>(() =>
    createInitialBoard(initialWhiteRoster, initialBlackRoster)
  );

  const [whiteReady, setWhiteReady] = useState(false);
  const [blackReady, setBlackReady] = useState(false);

  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [selectedSlotForPick, setSelectedSlotForPick] = useState<number | null>(null);
  const [isRegistryOpen, setIsRegistryOpen] = useState(false);

  const allAvailablePieces = getAllPieces();

  // Current active team context
  const isWhite = activeTabTeam === 'white';
  const currentRoster = isWhite ? whiteRoster : blackRoster;
  const isCurrentTeamReady = isWhite ? whiteReady : blackReady;
  const isReadOnly = multiplayerMode === 'online' && onlineRole !== activeTabTeam;

  // Calculate budget
  const totalCost = currentRoster.pieces.reduce((sum, pId) => {
    const def = getPieceDefinition(pId);
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

  // Handle slot piece replacement
  const handleSelectPieceForSlot = (pieceId: string) => {
    if (selectedSlotForPick === null || isReadOnly || isCurrentTeamReady) return;
    const nextPieces = [...currentRoster.pieces];
    nextPieces[selectedSlotForPick] = pieceId;

    const newRoster = { ...currentRoster, pieces: nextPieces };
    if (isWhite) {
      setWhiteRoster(newRoster);
    } else {
      setBlackRoster(newRoster);
    }

    // Update piece instance on board
    const updatedPieces = board.pieces.map((p) => {
      if (p.team === activeTabTeam && p.formationIndex === selectedSlotForPick) {
        return { ...p, typeId: pieceId };
      }
      return p;
    });

    const nextBoard: BoardState = {
      ...board,
      pieces: updatedPieces,
      whiteRoster: isWhite ? newRoster : whiteRoster,
      blackRoster: !isWhite ? newRoster : blackRoster,
    };
    syncBoardState(nextBoard);
    setSelectedSlotForPick(null);
  };

  // Presets
  const handleApplyPreset = (preset: '4-4-2' | '4-3-3' | '3-5-2') => {
    if (isReadOnly || isCurrentTeamReady) return;
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

    const currentTeamPieces = board.pieces.filter((p) => p.team === activeTabTeam);
    const otherPieces = board.pieces.filter((p) => p.team !== activeTabTeam);
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

  // Click on player card on pitch or table
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

  // Click on empty pitch cell to move piece
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

  // Toggle ready
  const handleToggleReady = () => {
    if (isOverBudget) {
      alert(`Đội hình vượt quá ngân sách lương quy định (${SALARY_CAP} điểm)! Vui lòng điều chỉnh.`);
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

  // Start match
  const handleStartGame = () => {
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

        {/* Kick Off Button or Ready Banner */}
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
              <span>Cả 2 đội cần bấm [Xác Nhận Đội Hình] để mở khóa Kick Off</span>
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

      {/* Main FM Tactical Management Canvas */}
      <div className="w-full flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* LEFT COLUMN: Simplified Clean Table (~ 45% width / 5 cols) */}
        <div className="lg:col-span-5 flex flex-col bg-[#141b2d] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          {/* Sub-Tabs Header */}
          <div className="flex items-center bg-[#0d121f] border-b border-slate-800">
            <button
              onClick={() => setActiveSubTab('player')}
              className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
                activeSubTab === 'player'
                  ? 'bg-[#bef264] text-slate-950 border-[#bef264] shadow-[0_0_15px_rgba(190,242,100,0.3)]'
                  : 'text-slate-400 hover:text-white border-transparent hover:bg-slate-850'
              }`}
            >
              DANH SÁCH QUÂN
            </button>

            <button
              onClick={() => setActiveSubTab('formation')}
              className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
                activeSubTab === 'formation'
                  ? 'bg-[#bef264] text-slate-950 border-[#bef264]'
                  : 'text-slate-400 hover:text-white border-transparent hover:bg-slate-850'
              }`}
            >
              SƠ ĐỒ (4-4-2...)
            </button>

            <button
              onClick={() => setActiveSubTab('tactics')}
              className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
                activeSubTab === 'tactics'
                  ? 'bg-[#bef264] text-slate-950 border-[#bef264]'
                  : 'text-slate-400 hover:text-white border-transparent hover:bg-slate-850'
              }`}
            >
              TÊN ĐỘI
            </button>
          </div>

          {/* SubTab 1: Clean Player List (Only Name and Piece Types) */}
          {activeSubTab === 'player' && (
            <div className="flex-1 flex flex-col p-3">
              {/* Table Column Headers: Chỉ giữ Vị Trí, Tên Quân, Loại Quân, Chi Phí, Đổi */}
              <div className="grid grid-cols-12 gap-1 px-2 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 mb-1">
                <span className="col-span-2">VỊ TRÍ</span>
                <span className="col-span-5">TÊN QUÂN CỜ</span>
                <span className="col-span-3 text-center">LOẠI QUÂN</span>
                <span className="col-span-2 text-right">ĐỔI QUÂN</span>
              </div>

              {/* 11 Players Row List */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar max-h-[460px]">
                {currentRoster.pieces.map((pId, idx) => {
                  const def = getPieceDefinition(pId);
                  const pieceInstance = board.pieces.find(
                    (p) => p.team === activeTabTeam && p.formationIndex === idx
                  );
                  const isSelected = selectedPieceId === pieceInstance?.id;

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (pieceInstance) handleSelectPiece(pieceInstance.id);
                      }}
                      className={`grid grid-cols-12 gap-1 items-center px-2.5 py-2.5 rounded-xl transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-[#bef264]/20 border-[#bef264] ring-1 ring-[#bef264] text-white shadow-lg'
                          : 'bg-[#10172a]/70 border-slate-850 hover:bg-[#1e293b]/80 text-slate-300'
                      }`}
                    >
                      {/* Vị trí BP */}
                      <div className="col-span-2 flex items-center gap-1">
                        <span className="text-xs font-black text-lime-400 font-mono">
                          {POSITION_LABELS[idx]}
                        </span>
                      </div>

                      {/* Tên Quân Cờ + Symbol */}
                      <div className="col-span-5 flex items-center gap-2.5 overflow-hidden">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-lg shrink-0 shadow">
                          {def?.symbol || '♟'}
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-bold text-white truncate">
                            {def?.vietnameseName || def?.name}
                          </div>
                          <div className="text-[10px] text-amber-300/90 font-mono font-bold">
                            {def?.cost || 0} điểm
                          </div>
                        </div>
                      </div>

                      {/* Loại Quân (Role) */}
                      <div className="col-span-3 flex justify-center">
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                            def?.role === 'GK'
                              ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                              : def?.role === 'FWD'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : def?.role === 'MID'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {def?.role === 'GK'
                            ? 'Thủ Môn'
                            : def?.role === 'DEF'
                            ? 'Hậu Vệ'
                            : def?.role === 'MID'
                            ? 'Tiền Vệ'
                            : 'Tiền Đạo'}
                        </span>
                      </div>

                      {/* Nút Đổi Quân */}
                      <div className="col-span-2 flex items-center justify-end">
                        <button
                          type="button"
                          disabled={isReadOnly || isCurrentTeamReady}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSlotForPick(idx);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white font-bold text-[10px] border border-slate-700 transition-colors"
                        >
                          Đổi
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SubTab 2: Formations Presets */}
          {activeSubTab === 'formation' && (
            <div className="p-4 flex flex-col gap-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-lime-400 mb-1">
                LỰA CHỌN SƠ ĐỒ CHIẾN THUẬT:
              </h4>
              <div className="grid grid-cols-3 gap-2.5">
                {(['4-4-2', '4-3-3', '3-5-2'] as const).map((preset) => (
                  <button
                    key={preset}
                    disabled={isReadOnly || isCurrentTeamReady}
                    onClick={() => handleApplyPreset(preset)}
                    className="py-3 px-2 rounded-2xl bg-[#10172a] hover:bg-[#1e293b] border-2 border-slate-700 hover:border-lime-400 flex flex-col items-center justify-center gap-1 transition-all"
                  >
                    <span className="text-lg font-black text-white">{preset}</span>
                    <span className="text-[10px] text-slate-400">Đội hình chuẩn</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* SubTab 3: Team Name */}
          {activeSubTab === 'tactics' && (
            <div className="p-4 flex flex-col gap-3 text-xs text-slate-300">
              <div className="bg-[#10172a] p-3 rounded-2xl border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Tên Đội Bóng:</span>
                <input
                  type="text"
                  disabled={isReadOnly || isCurrentTeamReady}
                  value={currentRoster.teamName}
                  onChange={(e) => {
                    const next = { ...currentRoster, teamName: e.target.value };
                    if (isWhite) setWhiteRoster(next);
                    else setBlackRoster(next);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-sm font-bold text-white mt-1 outline-none focus:border-lime-400"
                />
              </div>
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

        {/* RIGHT COLUMN: Full Pitch Grass Canvas with Clean Player Cards (~ 55% width / 7 cols) */}
        <div className="lg:col-span-7 flex flex-col bg-[#141b2d] border border-slate-800 rounded-3xl p-3 sm:p-4 overflow-hidden shadow-2xl relative">
          {/* Pitch Top Bar: Info Badge */}
          <div className="flex items-center justify-between px-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-lime-400 animate-pulse" />
              <span className="text-xs font-black text-white uppercase tracking-wider">
                SƠ ĐỒ CHIẾN THUẬT: {isWhite ? 'ĐỘI TRẮNG (SÂN DƯỚI)' : 'ĐỘI ĐỎ (SÂN TRÊN)'}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 hidden sm:inline">
              👉 Nhấp vào thẻ quân cờ để hoán đổi hoặc nhấp ô trống để di dời
            </span>
          </div>

          {/* Grass Field Canvas with Clean Striped Turf & Grid */}
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

                      {/* CLEAN RECTANGULAR PIECE CARD (Symbol, Name & Role) */}
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
                          {/* Top part: Portrait Symbol */}
                          <div className="flex-1 flex items-center justify-center w-full pt-1">
                            <span className="text-xl sm:text-2xl md:text-3xl drop-shadow-md">
                              {getPieceDefinition(piece.typeId)?.symbol || '♟'}
                            </span>
                          </div>

                          {/* Bottom Dark Bar: Clean Vietnamese Piece Name & Role */}
                          <div className="w-full bg-[#0d1322] px-1 py-0.5 flex items-center justify-between border-t border-slate-700/80">
                            <span className="text-[8px] sm:text-[9px] font-black text-slate-200 truncate max-w-[42px] sm:max-w-[50px]">
                              {getPieceDefinition(piece.typeId)?.vietnameseName.split(' ')[0] || getPieceDefinition(piece.typeId)?.name}
                            </span>
                            <span className="text-[8px] sm:text-[9px] font-black text-lime-400 uppercase">
                              {getPieceDefinition(piece.typeId)?.role}
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

      {/* Piece Picker Popover Modal */}
      {selectedSlotForPick !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setSelectedSlotForPick(null)}
        >
          <div
            className="bg-[#141b2d] border-2 border-lime-400 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-[#0d121f] border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-lime-400 uppercase">
                  CHỌN QUÂN CỜ CHO: {POSITION_FULL_NAMES[selectedSlotForPick]}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {currentRoster.teamName} • Ngân sách còn lại:{' '}
                  <span className={remainingBudget < 0 ? 'text-red-400 font-bold' : 'text-lime-400 font-bold'}>
                    {remainingBudget} điểm
                  </span>
                </p>
              </div>
              <button
                onClick={() => setSelectedSlotForPick(null)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto max-h-[60vh]">
              {allAvailablePieces.map((p) => {
                const currentPieceInSlot = currentRoster.pieces[selectedSlotForPick];
                const currentSlotCost = getPieceDefinition(currentPieceInSlot)?.cost || 0;
                const costDiff = p.cost - currentSlotCost;
                const isAffordable = remainingBudget - costDiff >= 0;
                const isCurrent = currentPieceInSlot === p.id;

                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!isAffordable && !isCurrent}
                    onClick={() => handleSelectPieceForSlot(p.id)}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                      isCurrent
                        ? 'bg-lime-400/20 border-lime-400 ring-2 ring-lime-400/50 text-white'
                        : !isAffordable
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
                        {costDiff !== 0 && (
                          <span
                            className={`text-[9px] mt-0.5 font-bold ${
                              costDiff > 0 ? 'text-red-400' : 'text-lime-400'
                            }`}
                          >
                            {costDiff > 0 ? `+${costDiff}đ` : `${costDiff}đ`}
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
                onClick={() => setSelectedSlotForPick(null)}
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
