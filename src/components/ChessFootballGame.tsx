

import React, { useState, useEffect } from 'react';
import {
  BoardState,
  PieceInstance,
  Position,
  TeamColor,
  TeamRoster,
} from '@/engine/types';
import {
  calculateValidKicks,
  calculateValidMoves,
  createInitialBoard,
  endTurn,
  executeKick,
  executeMove,
  hasBall,
} from '@/engine/engine';
import {
  DEFAULT_BLACK_ROSTER,
  DEFAULT_WHITE_ROSTER,
  INITIAL_PIECES,
  getPieceDefinition,
} from '@/engine/piece-registry';
import { multiplayerService, NetworkPacket } from '@/services/multiplayer';
import PitchBoard from './PitchBoard';
import GoalCelebration from './GoalCelebration';
import TeamBuilderModal from './TeamBuilderModal';
import PieceRegistryModal from './PieceRegistryModal';
import OnlineLobbyModal from './OnlineLobbyModal';

export default function ChessFootballGame() {
  const [board, setBoard] = useState<BoardState>(() => createInitialBoard());
  const [whiteRoster, setWhiteRoster] = useState<TeamRoster>(DEFAULT_WHITE_ROSTER);
  const [blackRoster, setBlackRoster] = useState<TeamRoster>(DEFAULT_BLACK_ROSTER);

  // Setup mode states
  const [setupTeam, setSetupTeam] = useState<TeamColor>('white');
  const [placingTypeId, setPlacingTypeId] = useState<string | null>(null);

  // Multiplayer Online states
  const [multiplayerMode, setMultiplayerMode] = useState<'local' | 'online'>('local');
  const [onlineRole, setOnlineRole] = useState<TeamColor | null>(null);
  const [onlineRoomId, setOnlineRoomId] = useState<string | null>(null);
  const [isOnlineModalOpen, setIsOnlineModalOpen] = useState<boolean>(false);
  const [floatingEmotes, setFloatingEmotes] = useState<{ id: string; emoji: string; team: TeamColor }[]>([]);

  // Modals state
  const [teamBuilderOpen, setTeamBuilderOpen] = useState<TeamColor | null>(null);
  const [registryModalOpen, setRegistryModalOpen] = useState<boolean>(false);
  const [showGoalBanner, setShowGoalBanner] = useState<boolean>(false);

  const isSetupPhase = board.phase === 'setup';
  const selectedPiece = board.pieces.find((p) => p.id === board.selectedPieceId);
  const isHoldingBall = selectedPiece
    ? hasBall(selectedPiece, board.ballPosition)
    : false;

  // Initialize multiplayer listener and check URL params
  useEffect(() => {
    multiplayerService.init({
      onConnected: (peerId, role) => {
        setMultiplayerMode('online');
        setOnlineRole(role);
        setOnlineRoomId(peerId);
        setIsOnlineModalOpen(false);
        if (role === 'white') {
          // Host syncs initial state to guest
          multiplayerService.sendPacket({ type: 'SYNC_STATE', board, senderId: '' });
        }
      },
      onDisconnected: () => {
        alert('Đối thủ đã ngắt kết nối khỏi phòng đấu!');
        setMultiplayerMode('local');
        setOnlineRole(null);
        setOnlineRoomId(null);
      },
      onPacketReceived: (packet: NetworkPacket) => {
        if (packet.type === 'SYNC_STATE') {
          const isGoalScored =
            Boolean(packet.board.lastGoalScorer) &&
            (packet.board.score.white !== (window as any).__CHESS_FOOTBALL_BOARD_STATE__?.score?.white ||
              packet.board.score.black !== (window as any).__CHESS_FOOTBALL_BOARD_STATE__?.score?.black);

          setBoard(packet.board);
          (window as any).__CHESS_FOOTBALL_BOARD_STATE__ = packet.board;

          if (isGoalScored) {
            setShowGoalBanner(true);
          }
        } else if (packet.type === 'EMOTE') {
          const newEmote = { id: String(Date.now()), emoji: packet.emoji, team: packet.team };
          setFloatingEmotes((prev) => [...prev, newEmote]);
          setTimeout(() => {
            setFloatingEmotes((prev) => prev.filter((e) => e.id !== newEmote.id));
          }, 3000);
        } else if (packet.type === 'RESET_REQUEST') {
          setBoard(createInitialBoard(whiteRoster, blackRoster, board.targetScore));
        }
      },
      onError: (err) => {
        alert(err);
      },
    });

    // Check if ?room=XXX is in URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) {
      setIsOnlineModalOpen(true);
    }

    return () => {
      multiplayerService.cleanup();
    };
  }, []);

  // Keep board in window global for host join replies
  useEffect(() => {
    (window as any).__CHESS_FOOTBALL_BOARD_STATE__ = board;
  }, [board]);

  // Sync state helper for multiplayer
  const updateAndSyncBoard = (nextBoard: BoardState) => {
    setBoard(nextBoard);
    (window as any).__CHESS_FOOTBALL_BOARD_STATE__ = nextBoard;
    if (multiplayerMode === 'online') {
      multiplayerService.sendPacket({ type: 'SYNC_STATE', board: nextBoard, senderId: '' });
    }
  };

  const handleSendEmote = (emoji: string) => {
    const myTeam = onlineRole || board.currentTurn;
    const newEmote = { id: String(Date.now()), emoji, team: myTeam };
    setFloatingEmotes((prev) => [...prev, newEmote]);
    setTimeout(() => {
      setFloatingEmotes((prev) => prev.filter((e) => e.id !== newEmote.id));
    }, 3000);

    if (multiplayerMode === 'online') {
      multiplayerService.sendPacket({ type: 'EMOTE', emoji, team: myTeam, senderId: '' });
    }
  };

  // Calculate team stats for setup
  const currentTeamPieces = board.pieces.filter((p) => p.team === setupTeam);
  const currentTeamCost = currentTeamPieces.reduce(
    (sum, p) => sum + (getPieceDefinition(p.typeId)?.cost || 0),
    0
  );
  const MAX_BUDGET = 150;

  // Check if player has permission to interact in Online Mode
  const isMyTurnInOnline = multiplayerMode === 'local' || onlineRole === board.currentTurn;
  const isMyTeamInSetup = multiplayerMode === 'local' || onlineRole === setupTeam;

  // Calculate valid targets based on mode
  let validTargets: Position[] = [];
  if (isSetupPhase) {
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
  } else {
    if (selectedPiece && isMyTurnInOnline) {
      if (board.activeAction === 'move') {
        validTargets = calculateValidMoves(board, selectedPiece.id);
      } else if (board.activeAction === 'kick') {
        validTargets = calculateValidKicks(board, selectedPiece.id);
      }
    }
  }

  const handleSelectPiece = (pieceId: string) => {
    if (isSetupPhase) {
      if (!isMyTeamInSetup) return;
      const piece = board.pieces.find((p) => p.id === pieceId);
      if (!piece) return;

      if (piece.team !== setupTeam) {
        setSetupTeam(piece.team);
        setBoard((prev) => ({ ...prev, selectedPieceId: pieceId }));
        setPlacingTypeId(null);
        return;
      }

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
        updateAndSyncBoard(nextBoard);
        return;
      }

      setBoard((prev) => ({
        ...prev,
        selectedPieceId: prev.selectedPieceId === pieceId ? null : pieceId,
      }));
      setPlacingTypeId(null);
      return;
    }

    // PLAYING MODE
    if (board.winner || !isMyTurnInOnline) return;
    const piece = board.pieces.find((p) => p.id === pieceId);
    if (!piece || piece.team !== board.currentTurn) return;

    if (board.selectedPieceId === pieceId) return;

    const holdsBall = hasBall(piece, board.ballPosition);
    setBoard((prev) => ({
      ...prev,
      selectedPieceId: pieceId,
      activeAction: holdsBall ? 'kick' : 'move',
    }));
  };

  const handleCellClick = (x: number, y: number) => {
    if (isSetupPhase) {
      if (!isMyTeamInSetup) return;
      const isWhite = setupTeam === 'white';
      const isInHalf = isWhite ? y >= 8 && y <= 13 : y >= 1 && y <= 6;
      if (!isInHalf) return;

      const existingPiece = board.pieces.find(
        (p) => p.position.x === x && p.position.y === y
      );

      if (placingTypeId) {
        if (existingPiece) return;
        const def = getPieceDefinition(placingTypeId);
        if (currentTeamPieces.length >= 11) {
          alert('Đội hình đã đủ tối đa 11 cầu thủ!');
          return;
        }
        if (currentTeamCost + def.cost > MAX_BUDGET) {
          alert(`Vượt quá quỹ lương! (Tối đa ${MAX_BUDGET} điểm)`);
          return;
        }

        const newPiece: PieceInstance = {
          id: `p_${Date.now()}_${Math.random()}`,
          typeId: placingTypeId,
          team: setupTeam,
          position: { x, y },
          formationIndex: currentTeamPieces.length,
        };

        const nextBoard: BoardState = {
          ...board,
          pieces: [...board.pieces, newPiece],
        };
        updateAndSyncBoard(nextBoard);
        setPlacingTypeId(null);
        return;
      }

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
        updateAndSyncBoard(nextBoard);
      }
      return;
    }

    // PLAYING MODE
    if (board.winner || !isMyTurnInOnline) return;

    const clickedPiece = board.pieces.find(
      (p) => p.position.x === x && p.position.y === y
    );
    const isTarget = validTargets.some((t) => t.x === x && t.y === y);

    if (clickedPiece && clickedPiece.team === board.currentTurn && !isTarget) {
      handleSelectPiece(clickedPiece.id);
      return;
    }

    if (!selectedPiece || !board.activeAction) {
      if (clickedPiece && clickedPiece.team === board.currentTurn) {
        handleSelectPiece(clickedPiece.id);
      }
      return;
    }

    if (!isTarget) {
      if (clickedPiece && clickedPiece.team === board.currentTurn) {
        handleSelectPiece(clickedPiece.id);
      } else {
        setBoard((prev) => ({ ...prev, selectedPieceId: null, activeAction: null }));
      }
      return;
    }

    if (board.activeAction === 'move') {
      const nextBoard = executeMove(board, selectedPiece.id, x, y);
      if (nextBoard.lastGoalScorer) {
        setShowGoalBanner(true);
      }
      updateAndSyncBoard(nextBoard);
    } else if (board.activeAction === 'kick') {
      const nextBoard = executeKick(board, selectedPiece.id, x, y);
      if (nextBoard.lastGoalScorer) {
        setShowGoalBanner(true);
      }
      updateAndSyncBoard(nextBoard);
    }
  };

  const handleDeletePiece = (pieceId: string) => {
    if (!isMyTeamInSetup) return;
    const piece = board.pieces.find((p) => p.id === pieceId);
    if (!piece) return;

    const teamPieces = board.pieces.filter((p) => p.team === piece.team);
    if (piece.typeId === 'king') {
      const kingCount = teamPieces.filter((p) => p.typeId === 'king').length;
      if (kingCount <= 1) {
        alert('Mỗi đội bắt buộc phải có ít nhất 1 Thủ Môn (Vua)!');
        return;
      }
    }

    const nextBoard: BoardState = {
      ...board,
      pieces: board.pieces.filter((p) => p.id !== pieceId),
      selectedPieceId: null,
    };
    updateAndSyncBoard(nextBoard);
  };

  const handleApplyPreset = (preset: '4-4-2' | '4-3-3' | '3-5-2') => {
    if (!isMyTeamInSetup) return;
    const isWhite = setupTeam === 'white';
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

    const otherPieces = board.pieces.filter((p) => p.team !== setupTeam);
    const updatedTeamPieces = currentTeamPieces.map((p, idx) => ({
      ...p,
      position: positions[idx] || p.position,
    }));

    const nextBoard: BoardState = {
      ...board,
      pieces: [...otherPieces, ...updatedTeamPieces],
      selectedPieceId: null,
    };
    updateAndSyncBoard(nextBoard);
  };

  const handleStartMatch = () => {
    const whitePieces = board.pieces.filter((p) => p.team === 'white');
    const blackPieces = board.pieces.filter((p) => p.team === 'black');

    const whiteKings = whitePieces.filter((p) => p.typeId === 'king').length;
    const blackKings = blackPieces.filter((p) => p.typeId === 'king').length;

    if (whiteKings < 1 || blackKings < 1) {
      alert('Cả 2 đội đều phải có ít nhất 1 Thủ Môn (Vua)!');
      return;
    }
    if (whitePieces.length < 5 || blackPieces.length < 5) {
      alert('Mỗi đội cần có tối thiểu 5 cầu thủ để bắt đầu trận đấu!');
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
      commentary: [
        {
          id: `c_${Date.now()}`,
          text: '🔔 Trọng tài đã nổi còi bắt đầu trận đấu! Đội Trắng giao bóng (2 lượt/vòng đấu).',
          type: 'whistle',
          timestamp: '00:00',
        },
        ...board.commentary,
      ],
    };
    updateAndSyncBoard(nextBoard);
  };

  const handleEndTurn = () => {
    if (board.winner || !isMyTurnInOnline) return;
    const nextBoard = endTurn(board);
    updateAndSyncBoard(nextBoard);
  };

  const handleResetMatch = () => {
    if (window.confirm('Bạn có chắc muốn đặt lại toàn bộ trận đấu và trở về giai đoạn Bố trí?')) {
      const nextBoard = createInitialBoard(whiteRoster, blackRoster, board.targetScore);
      updateAndSyncBoard(nextBoard);
      setPlacingTypeId(null);
    }
  };

  const isWhiteTurn = board.currentTurn === 'white';

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-center py-4 px-2 sm:px-4 text-slate-100 relative">
      {/* Floating Emote Display Overlay */}
      {floatingEmotes.map((e) => (
        <div
          key={e.id}
          className="fixed top-24 z-50 animate-bounce text-6xl drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] pointer-events-none"
          style={{
            left: e.team === 'white' ? '25%' : '75%',
          }}
        >
          {e.emoji}
        </div>
      ))}

      {/* Top Global Multiplayer Bar */}
      <div className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-2.5 mb-3 flex flex-wrap items-center justify-between gap-2 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm">🌐</span>
          <span className="text-xs font-bold text-slate-300">Chế độ:</span>
          {multiplayerMode === 'online' ? (
            <span className="text-xs bg-emerald-950 text-emerald-400 font-black px-2.5 py-0.5 rounded-full border border-emerald-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>ĐÁ ONLINE (Phòng: {onlineRoomId})</span>
            </span>
          ) : (
            <span className="text-xs bg-slate-800 text-slate-300 font-bold px-2.5 py-0.5 rounded-full border border-slate-700">
              Chơi Cùng Máy (Local 2P)
            </span>
          )}

          {multiplayerMode === 'online' && (
            <span className="text-xs bg-slate-900 text-amber-300 font-extrabold px-2.5 py-0.5 rounded-full border border-amber-500/40">
              Bạn là: Đội {onlineRole === 'white' ? 'Trắng ♔' : 'Đỏ ♚'}
            </span>
          )}
        </div>

        {/* Emote Quick Bar & Online Lobby Button */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 mr-1 hidden sm:inline">Thả Emote:</span>
            {['⚽', '🔥', '😱', '👏', '🏆', '🤣'].map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleSendEmote(emoji)}
                className="hover:scale-125 transition-transform text-sm px-1 py-0.5"
              >
                {emoji}
              </button>
            ))}
          </div>

          {multiplayerMode === 'online' ? (
            <button
              onClick={() => {
                if (window.confirm('Bạn có muốn thoát khỏi phòng Online này không?')) {
                  multiplayerService.cleanup();
                  setMultiplayerMode('local');
                  setOnlineRole(null);
                  setOnlineRoomId(null);
                }
              }}
              className="px-3 py-1 bg-red-600/30 hover:bg-red-600 text-red-300 hover:text-white text-xs font-bold rounded-xl border border-red-500/50"
            >
              🚪 Rời Phòng
            </button>
          ) : (
            <button
              onClick={() => setIsOnlineModalOpen(true)}
              className="px-3.5 py-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-slate-950 font-black text-xs rounded-xl shadow-md uppercase tracking-wider flex items-center gap-1"
            >
              <span>🌐</span> Đá Online P2P
            </button>
          )}
        </div>
      </div>

      {/* Top Header & Scoreboard Banner */}
      <div className="w-full bg-slate-900 border-2 border-slate-700 rounded-3xl p-4 sm:p-6 mb-6 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Team White */}
          <div className="flex items-center gap-3 w-full md:w-1/3 justify-start">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-2xl font-black text-amber-300 shadow-lg">
              ♔
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg text-white">{whiteRoster.teamName}</h3>
                {isSetupPhase && (
                  <button
                    onClick={() => isMyTeamInSetup && setSetupTeam('white')}
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold border transition-all ${
                      setupTeam === 'white'
                        ? 'bg-amber-400 text-black border-amber-300 ring-2 ring-amber-400'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    🛠️ Đang xếp
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400">Tấn công Khung thành Đỏ (ở trên)</p>
            </div>
          </div>

          {/* Electronic Scoreboard / Mode Banner */}
          <div className="flex flex-col items-center justify-center w-full md:w-1/3 text-center">
            {isSetupPhase ? (
              <div className="flex flex-col items-center gap-2">
                <div className="bg-amber-500/20 border-2 border-amber-400/80 px-6 py-1.5 rounded-2xl shadow-lg">
                  <span className="text-sm sm:text-base font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🛠️ BỐ TRÍ CHIẾN THUẬT TIỀN TRẬN</span>
                  </span>
                </div>
                <button
                  onClick={handleStartMatch}
                  className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-slate-950 font-black text-sm rounded-xl shadow-xl uppercase tracking-wider animate-bounce flex items-center gap-2"
                >
                  <span>🟢 BẮT ĐẦU TRẬN ĐẤU</span>
                </button>
              </div>
            ) : (
              <div>
                <div className="bg-black/90 px-8 py-2 rounded-2xl border-2 border-yellow-500/80 shadow-[0_0_20px_rgba(234,179,8,0.3)] inline-flex items-center justify-center gap-3 min-w-[160px]">
                  <span className="w-12 text-center text-4xl sm:text-5xl font-black text-amber-400 font-mono">
                    {board.score.white}
                  </span>
                  <span className="text-2xl text-slate-500 font-bold">:</span>
                  <span className="w-12 text-center text-4xl sm:text-5xl font-black text-red-500 font-mono">
                    {board.score.black}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-2 justify-center">
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md ${
                      isWhiteTurn
                        ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300'
                        : 'bg-red-600 text-white ring-2 ring-red-400'
                    }`}
                  >
                    <span>⚽ LƯỢT ĐI:</span>
                    <span>{isWhiteTurn ? 'ĐỘI TRẮNG' : 'ĐỘI ĐỎ'}</span>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1 rounded-full border border-slate-700">
                    <span className="text-xs font-black text-amber-400 animate-pulse">
                      ⚡ Còn {board.remainingAP}/2 Lượt
                    </span>
                  </div>
                </div>

                {multiplayerMode === 'online' && !isMyTurnInOnline && (
                  <p className="text-[11px] text-amber-300/90 font-bold mt-1.5 animate-pulse">
                    ⏳ Đang chờ đối thủ thực hiện lượt đi...
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Team Black */}
          <div className="flex items-center gap-3 w-full md:w-1/3 justify-end">
            <div className="text-right">
              <div className="flex items-center justify-end gap-2">
                {isSetupPhase && (
                  <button
                    onClick={() => isMyTeamInSetup && setSetupTeam('black')}
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold border transition-all ${
                      setupTeam === 'black'
                        ? 'bg-red-600 text-white border-red-400 ring-2 ring-red-500'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    🛠️ Đang xếp
                  </button>
                )}
                <h3 className="font-extrabold text-lg text-white">{blackRoster.teamName}</h3>
              </div>
              <p className="text-xs text-slate-400">Tấn công Khung thành Trắng (ở dưới)</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-red-600/20 border-2 border-red-500 flex items-center justify-center text-2xl font-black text-red-400 shadow-lg">
              ♚
            </div>
          </div>
        </div>
      </div>

      {/* Main Game Layout */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Tactical Setup Panel OR Action Control Panel */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {isSetupPhase ? (
            /* SETUP PHASE CONTROL PANEL */
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <span>🛠️</span> XẾP ĐỘI HÌNH & VỊ TRÍ
                </h4>
                <div className="flex gap-1">
                  <button
                    onClick={() => isMyTeamInSetup && setSetupTeam('white')}
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                      setupTeam === 'white' ? 'bg-amber-400 text-black' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    Trắng
                  </button>
                  <button
                    onClick={() => isMyTeamInSetup && setSetupTeam('black')}
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                      setupTeam === 'black' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    Đỏ
                  </button>
                </div>
              </div>

              {/* Team Budget & Stats */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-medium">💰 Quỹ Lương:</span>
                  <p className="text-sm font-black text-amber-400">
                    {currentTeamCost} / {MAX_BUDGET}đ
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-medium">👥 Cầu thủ:</span>
                  <p className="text-sm font-black text-cyan-400">
                    {currentTeamPieces.length} / 11
                  </p>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">⚡ Đội hình mẫu:</span>
                <div className="grid grid-cols-3 gap-1.5 mt-1">
                  <button
                    disabled={!isMyTeamInSetup}
                    onClick={() => handleApplyPreset('4-4-2')}
                    className="py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-bold rounded-lg border border-slate-700 text-slate-200"
                  >
                    4-4-2
                  </button>
                  <button
                    disabled={!isMyTeamInSetup}
                    onClick={() => handleApplyPreset('4-3-3')}
                    className="py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-bold rounded-lg border border-slate-700 text-slate-200"
                  >
                    4-3-3
                  </button>
                  <button
                    disabled={!isMyTeamInSetup}
                    onClick={() => handleApplyPreset('3-5-2')}
                    className="py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-bold rounded-lg border border-slate-700 text-slate-200"
                  >
                    3-5-2
                  </button>
                </div>
              </div>

              {/* Add Pieces Palette */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">➕ Thêm cầu thủ mới:</span>
                <div className="grid grid-cols-2 gap-1.5 mt-1 max-h-48 overflow-y-auto pr-1">
                  {INITIAL_PIECES.map((def) => {
                    const isPlacing = placingTypeId === def.id;
                    const canAfford = currentTeamCost + def.cost <= MAX_BUDGET && currentTeamPieces.length < 11;
                    return (
                      <button
                        key={def.id}
                        disabled={(!canAfford && !isPlacing) || !isMyTeamInSetup}
                        onClick={() => {
                          setPlacingTypeId(isPlacing ? null : def.id);
                          setBoard((prev) => ({ ...prev, selectedPieceId: null }));
                        }}
                        className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all ${
                          isPlacing
                            ? 'bg-cyan-500 text-black border-cyan-300 ring-2 ring-cyan-300'
                            : !canAfford || !isMyTeamInSetup
                            ? 'opacity-40 bg-slate-900 border-slate-800 cursor-not-allowed text-slate-500'
                            : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-white'
                        }`}
                      >
                        <span className="text-xl">{def.symbol}</span>
                        <div className="flex-1 overflow-hidden">
                          <p className="text-[11px] font-black truncate">{def.vietnameseName.split(' ')[0]}</p>
                          <span className="text-[9px] text-amber-300 font-bold">{def.cost}đ</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Piece Actions in Setup */}
              {selectedPiece && selectedPiece.team === setupTeam && isMyTeamInSetup && (
                <div className="bg-slate-950 p-3 rounded-xl border border-amber-500/40">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{getPieceDefinition(selectedPiece.typeId).symbol}</span>
                      <div>
                        <p className="text-xs font-bold text-white">{getPieceDefinition(selectedPiece.typeId).vietnameseName}</p>
                        <p className="text-[10px] text-slate-400">Vị trí: ({selectedPiece.position.x}, {selectedPiece.position.y})</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeletePiece(selectedPiece.id)}
                      className="px-2 py-1 bg-red-600/30 hover:bg-red-600 text-red-300 hover:text-white text-xs font-bold rounded-lg border border-red-500/50 flex items-center gap-1"
                    >
                      <span>🗑️</span> Xóa
                    </button>
                  </div>
                  <p className="text-[10px] text-amber-300/90 font-medium">
                    👉 Nhấp vào <strong>ô trống</strong> trên sân để di chuyển tới, hoặc nhấp vào <strong>cầu thủ khác</strong> để hoán đổi vị trí!
                  </p>
                </div>
              )}

              {/* Start Match Big Button */}
              <button
                onClick={handleStartMatch}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-slate-950 font-black text-xs rounded-xl shadow-xl uppercase tracking-wider flex items-center justify-center gap-1.5"
              >
                <span>🟢</span> BẮT ĐẦU TRẬN ĐẤU (Giao bóng)
              </button>
            </div>
          ) : (
            /* PLAYING PHASE ACTION CONTROL PANEL */
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-xl">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-2">
                <span>🎮</span> Thao Tác Điều Khiển
              </h4>

              {selectedPiece ? (
                <div className="flex flex-col gap-3">
                  {(() => {
                    const def = getPieceDefinition(selectedPiece.typeId);
                    return (
                      <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 shadow-inner">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-2xl shadow">
                            {def.symbol}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-black text-white">{def.vietnameseName}</span>
                              <span className="text-[10px] bg-cyan-950 text-cyan-400 font-bold px-2 py-0.5 rounded-full border border-cyan-800/60 uppercase">
                                {def.role}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium">
                              Vị trí: ({selectedPiece.position.x}, {selectedPiece.position.y})
                            </p>
                          </div>
                        </div>

                        {/* Special Ability Feature Box */}
                        {def.specialAbilityDesc && (
                          <div className="mt-3 bg-gradient-to-r from-amber-950/50 via-slate-900 to-slate-900 border border-amber-500/40 rounded-xl p-2.5 shadow-sm">
                            <div className="flex items-center justify-between gap-1 text-xs font-black text-amber-300">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm">✨</span>
                                <span>KỸ NĂNG:</span>
                                {def.hasBulldozer && (
                                  <span className="text-[9px] bg-red-500/30 text-amber-200 px-1.5 py-0.2 rounded border border-amber-500/50 font-bold">
                                    🦬 SỰ TRÂU BÒ
                                  </span>
                                )}
                              </div>
                              {def.hasBulldozer && (
                                selectedPiece.abilityCooldown && selectedPiece.abilityCooldown > 0 ? (
                                  <span className="text-[9px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/40 font-bold animate-pulse">
                                    ⏳ Hồi chiêu: {selectedPiece.abilityCooldown} lượt
                                  </span>
                                ) : (
                                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40 font-bold">
                                    ⚡ SẴN SÀNG
                                  </span>
                                )
                              )}
                            </div>
                            <p className="text-[11px] text-amber-100/90 mt-1 font-medium leading-relaxed">
                              {def.specialAbilityDesc}
                            </p>
                          </div>
                        )}

                        <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed">{def.description}</p>
                      </div>
                    );
                  })()}

                  {/* Mode Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={!isMyTurnInOnline}
                      onClick={() =>
                        setBoard((prev) => ({ ...prev, activeAction: 'move' }))
                      }
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        !isMyTurnInOnline
                          ? 'opacity-40 cursor-not-allowed bg-slate-800'
                          : board.activeAction === 'move'
                          ? 'bg-cyan-500 text-slate-950 ring-2 ring-cyan-300 shadow-lg'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <span>🏃</span> Di Chuyển
                    </button>

                    <button
                      disabled={!isHoldingBall || !isMyTurnInOnline}
                      onClick={() =>
                        setBoard((prev) => ({ ...prev, activeAction: 'kick' }))
                      }
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        !isHoldingBall || !isMyTurnInOnline
                          ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500'
                          : board.activeAction === 'kick'
                          ? 'bg-amber-400 text-slate-950 ring-2 ring-yellow-300 shadow-lg'
                          : 'bg-slate-800 text-amber-300 hover:bg-slate-700'
                      }`}
                    >
                      <span>⚽</span> Sút / Chuyền
                    </button>
                  </div>

                  {!isHoldingBall && (
                    <p className="text-[11px] text-amber-400/80 bg-amber-950/30 p-2 rounded-lg border border-amber-500/20">
                      💡 Cầu thủ này không giữ bóng. Hãy di chuyển đến vị trí quả bóng để kiểm soát bóng trước khi Sút/Chuyền!
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 px-3 bg-slate-950/60 rounded-xl border border-dashed border-slate-800">
                  <div className="text-3xl mb-2">👆</div>
                  <p className="text-xs text-slate-400">
                    Nhấp vào một <strong className="text-yellow-400">Quân cờ của bạn</strong> trên sân để di chuyển hoặc sút bóng.
                  </p>
                </div>
              )}

              {/* End Turn & Options */}
              <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col gap-2">
                <button
                  disabled={!isMyTurnInOnline}
                  onClick={handleEndTurn}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs rounded-xl shadow-lg uppercase tracking-wider"
                >
                  ⏱️ Kết Thúc Lượt (Đổi bên)
                </button>

                <button
                  onClick={() => updateAndSyncBoard({ ...board, phase: 'setup' })}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold text-xs rounded-xl border border-amber-500/30 flex items-center justify-center gap-1.5"
                >
                  <span>⚙️</span> Xếp Lại Đội Hình & Vị Trí
                </button>

                <button
                  onClick={() => setRegistryModalOpen(true)}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold text-xs rounded-xl border border-cyan-500/30 flex items-center justify-center gap-1.5"
                >
                  <span>📚</span> Bách Khoa & Thêm Quân Mới
                </button>

                <button
                  onClick={handleResetMatch}
                  className="w-full py-1.5 text-xs text-slate-400 hover:text-red-400 transition-colors"
                >
                  🔄 Đặt lại trận đấu
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Center Column: Pitch Board */}
        <div className="lg:col-span-6 flex justify-center">
          <PitchBoard
            board={board}
            validTargets={validTargets}
            onSelectPiece={handleSelectPiece}
            onCellClick={handleCellClick}
            isSetupMode={isSetupPhase}
            setupTeam={setupTeam}
            placingPieceType={placingTypeId}
          />
        </div>

        {/* Right Column: Match Commentary & Rules */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {/* Match Commentary Feed */}
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-xl flex flex-col h-[420px]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2 flex items-center gap-2">
              <span>🎙️</span> Tường Thuật Trực Tiếp
            </h4>
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2">
              {board.commentary.map((log) => (
                <div
                  key={log.id}
                  className={`p-2 rounded-xl text-xs border ${
                    log.type === 'goal'
                      ? 'bg-amber-500/20 border-amber-400 text-yellow-200 font-bold'
                      : log.type === 'tackle'
                      ? 'bg-red-500/10 border-red-500/30 text-rose-200'
                      : log.type === 'pass'
                      ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-200'
                      : 'bg-slate-950/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <span className="text-[10px] font-mono text-slate-400 mr-1.5">
                    [{log.timestamp}]
                  </span>
                  <span>{log.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Rules Mini Guide */}
          <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 text-xs text-slate-300">
            <h4 className="font-bold text-amber-400 mb-2 flex items-center gap-1">
              <span>⚡</span> Luật Chơi Cốt Lõi
            </h4>
            <ul className="space-y-1.5 list-disc pl-4 text-slate-300">
              <li><strong>2 Lượt Đi / Lần:</strong> Mỗi vòng đấu có 2 lượt hành động.</li>
              <li><strong>Khống Chế & Cướp Bóng (Giữ Lượt):</strong> Băng vào nhặt bóng hoặc tắc bóng thành công được <strong>giữ nguyên lượt</strong>!</li>
              <li><strong>Chuyền Bóng Đồng Đội:</strong> Chuyền chuẩn xác cho đồng đội được giữ lượt.</li>
              <li><strong>🦬 SỰ TRÂU BÒ (Quân Xe ♖):</strong> Cầm bóng đâm vào đối thủ sẽ húc văng ra xa và giữ lượt (Hồi chiêu 1 lượt).</li>
              <li><strong>Bố Trí Tiền Trận:</strong> Tự do kéo xếp vị trí, thêm bớt quân theo quỹ lương 150đ trước khi bắt đầu!</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Goal Celebration Overlay */}
      {showGoalBanner && board.lastGoalScorer && (
        <GoalCelebration
          team={board.lastGoalScorer.team}
          scorerName={board.lastGoalScorer.pieceName}
          onClose={() => {
            setShowGoalBanner(false);
            setBoard((prev) => ({ ...prev, lastGoalScorer: undefined }));
          }}
        />
      )}

      {/* Match Winner Popup */}
      {board.winner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-slate-900 border-4 border-yellow-400 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl animate-fade-in">
            <div className="text-6xl mb-3">🏆</div>
            <h2 className="text-3xl font-black text-yellow-400 uppercase tracking-wider">
              VÔ ĐỊCH TRẬN ĐẤU!
            </h2>
            <p className="text-xl font-bold text-white mt-2">
              {board.winner === 'white' ? whiteRoster.teamName : blackRoster.teamName}
            </p>
            <p className="text-sm text-slate-300 mt-2">
              Tỉ số chung cuộc: <strong className="text-yellow-400">{board.score.white} - {board.score.black}</strong>
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                onClick={() =>
                  setBoard(createInitialBoard(whiteRoster, blackRoster, board.targetScore))
                }
                className="py-3 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-sm shadow-xl"
              >
                🔄 Thi Đấu Lại (Rematch)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Builder Modals */}
      {teamBuilderOpen && (
        <TeamBuilderModal
          team={teamBuilderOpen}
          currentRoster={teamBuilderOpen === 'white' ? whiteRoster : blackRoster}
          onSave={(roster) => {
            if (teamBuilderOpen === 'white') {
              setWhiteRoster(roster);
              setBoard(createInitialBoard(roster, blackRoster, board.targetScore));
            } else {
              setBlackRoster(roster);
              setBoard(createInitialBoard(whiteRoster, roster, board.targetScore));
            }
          }}
          onClose={() => setTeamBuilderOpen(null)}
        />
      )}

      {/* Piece Registry Modal */}
      {registryModalOpen && (
        <PieceRegistryModal
          onClose={() => setRegistryModalOpen(false)}
          onPieceAdded={() => {
            setBoard((prev) => ({ ...prev }));
          }}
        />
      )}

      {/* Online Lobby Modal */}
      {isOnlineModalOpen && (
        <OnlineLobbyModal
          onStartOnlineMatch={(role, roomId) => {
            setMultiplayerMode('online');
            setOnlineRole(role);
            setOnlineRoomId(roomId);
            setIsOnlineModalOpen(false);
          }}
          onClose={() => setIsOnlineModalOpen(false)}
        />
      )}
    </div>
  );
}
