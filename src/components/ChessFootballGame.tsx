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
  getPieceDefinition,
} from '@/engine/piece-registry';
import { getBestAIMove } from '@/engine/ai-bot';
import { multiplayerService, NetworkPacket } from '@/services/multiplayer';
import PitchBoard from './PitchBoard';
import GoalCelebration from './GoalCelebration';
import PieceRegistryModal from './PieceRegistryModal';
import RulesModal from './RulesModal';

interface ChessFootballGameProps {
  initialBoard?: BoardState;
  whiteRoster?: TeamRoster;
  blackRoster?: TeamRoster;
  multiplayerMode?: 'local' | 'online';
  gameMode?: GameMode;
  aiDifficulty?: AIDifficulty;
  onlineRole?: TeamColor | null;
  onlineRoomId?: string | null;
  onBackToMenu?: () => void;
  onBackToSetup?: (boardToAdjust?: BoardState) => void;
}

export default function ChessFootballGame({
  initialBoard,
  whiteRoster: initialWhiteRoster = DEFAULT_WHITE_ROSTER,
  blackRoster: initialBlackRoster = DEFAULT_BLACK_ROSTER,
  multiplayerMode: initialMultiplayerMode = 'local',
  gameMode = 'local',
  aiDifficulty = 'normal',
  onlineRole: initialOnlineRole = null,
  onlineRoomId: initialOnlineRoomId = null,
  onBackToMenu,
  onBackToSetup,
}: ChessFootballGameProps) {
  const [board, setBoard] = useState<BoardState>(
    () => initialBoard || createInitialBoard(initialWhiteRoster, initialBlackRoster)
  );
  const [whiteRoster, setWhiteRoster] = useState<TeamRoster>(initialWhiteRoster);
  const [blackRoster, setBlackRoster] = useState<TeamRoster>(initialBlackRoster);

  // Multiplayer Online states
  const [multiplayerMode, setMultiplayerMode] = useState<'local' | 'online'>(initialMultiplayerMode);
  const [onlineRole, setOnlineRole] = useState<TeamColor | null>(initialOnlineRole);
  const [onlineRoomId, setOnlineRoomId] = useState<string | null>(initialOnlineRoomId);
  const [floatingEmotes, setFloatingEmotes] = useState<{ id: string; emoji: string; team: TeamColor }[]>([]);
  const [isAIThinking, setIsAIThinking] = useState<boolean>(false);

  // Modals state
  const [registryModalOpen, setRegistryModalOpen] = useState<boolean>(false);
  const [rulesModalOpen, setRulesModalOpen] = useState<boolean>(false);
  const [showGoalBanner, setShowGoalBanner] = useState<boolean>(false);

  const selectedPiece = board.pieces.find((p) => p.id === board.selectedPieceId);
  const isHoldingBall = selectedPiece ? hasBall(selectedPiece, board.ballPosition) : false;

  // Initialize multiplayer listener
  useEffect(() => {
    if (multiplayerMode === 'online') {
      multiplayerService.init({
        onConnected: (peerId, role) => {
          setMultiplayerMode('online');
          setOnlineRole(role);
          setOnlineRoomId(peerId);
        },
        onDisconnected: () => {
          alert('Đối thủ đã ngắt kết nối khỏi phòng đấu!');
          if (onBackToMenu) onBackToMenu();
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
            handleRematch(false);
          }
        },
        onError: (err) => {
          alert(err);
        },
      });
    }

    return () => {
      // Don't kill service if navigating, but cleanup on unmount
    };
  }, [multiplayerMode, onBackToMenu, whiteRoster, blackRoster, board.targetScore]);

  // Keep board in window global
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

  // Automated turn execution for AI Bot
  useEffect(() => {
    if (gameMode !== 'ai' || board.currentTurn !== 'black' || board.winner) {
      return;
    }

    setIsAIThinking(true);

    const timer = setTimeout(() => {
      const bestMove = getBestAIMove(board, 'black', aiDifficulty);
      if (bestMove) {
        if (bestMove.action === 'move') {
          const nextBoard = executeMove(
            board,
            bestMove.pieceId,
            bestMove.target.x,
            bestMove.target.y
          );
          if (nextBoard.lastGoalScorer) {
            setShowGoalBanner(true);
          }
          updateAndSyncBoard(nextBoard);
        } else if (bestMove.action === 'kick') {
          const nextBoard = executeKick(
            board,
            bestMove.pieceId,
            bestMove.target.x,
            bestMove.target.y
          );
          if (nextBoard.lastGoalScorer) {
            setShowGoalBanner(true);
          }
          updateAndSyncBoard(nextBoard);
        }
      } else {
        const nextBoard = endTurn(board);
        updateAndSyncBoard(nextBoard);
      }
      setIsAIThinking(false);
    }, 650);

    return () => clearTimeout(timer);
  }, [board, gameMode, aiDifficulty]);

  // Check if player has permission to interact in Online Mode / AI Mode
  const isMyTurnInOnline = gameMode === 'ai'
    ? board.currentTurn === 'white'
    : (multiplayerMode === 'local' || onlineRole === board.currentTurn);

  // Calculate valid targets based on mode
  let validTargets: Position[] = [];
  if (selectedPiece && isMyTurnInOnline && !board.winner) {
    if (board.activeAction === 'move') {
      validTargets = calculateValidMoves(board, selectedPiece.id);
    } else if (board.activeAction === 'kick') {
      validTargets = calculateValidKicks(board, selectedPiece.id);
    }
  }

  const handleSelectPiece = (pieceId: string) => {
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

  const handleEndTurn = () => {
    if (board.winner || !isMyTurnInOnline) return;
    const nextBoard = endTurn(board);
    updateAndSyncBoard(nextBoard);
  };

  // Rematch / Reset match keeping the customized saved formations!
  const handleRematch = (showConfirm = false) => {
    if (showConfirm && !window.confirm('Bạn có chắc muốn thi đấu lại từ đầu (tỉ số 0 - 0) với đội hình hiện tại?')) {
      return;
    }

    const resetPieces = board.savedFormation
      ? board.savedFormation.map((p) => ({
          ...p,
          position: { ...p.position },
          isStunned: false,
          abilityCooldown: 0,
        }))
      : board.pieces.map((p) => ({
          ...p,
          position: { ...p.position },
          isStunned: false,
          abilityCooldown: 0,
        }));

    const nextBoard: BoardState = {
      ...board,
      phase: 'playing',
      pieces: resetPieces,
      ballPosition: { x: 5, y: 7 },
      score: { white: 0, black: 0 },
      winner: null,
      lastGoalScorer: undefined,
      currentTurn: 'white',
      remainingAP: 2,
      turnNumber: 1,
      selectedPieceId: null,
      activeAction: null,
      commentary: [
        {
          id: `c_${Date.now()}`,
          text: '🔄 Trận đấu tái đấu (Rematch) bắt đầu! Đội Trắng giao bóng.',
          type: 'whistle',
          timestamp: '00:00',
        },
      ],
    };

    updateAndSyncBoard(nextBoard);
  };

  const handleResetMatch = () => {
    handleRematch(true);
  };

  const isWhiteTurn = board.currentTurn === 'white';

  return (
    <div className="w-full max-w-[1600px] mx-auto flex flex-col items-center py-2 px-2 sm:px-4 md:px-6 text-slate-100 relative">
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

      {/* Top Global Navigation Bar */}
      <div className="w-full bg-slate-800/95 border border-slate-700 rounded-2xl p-2.5 mb-3 flex flex-wrap items-center justify-between gap-2 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-2">
          {onBackToMenu && (
            <button
              onClick={onBackToMenu}
              className="px-2.5 py-1 bg-slate-700/80 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-lg border border-slate-600 flex items-center gap-1"
            >
              <span>←</span> Menu
            </button>
          )}

          {onBackToSetup && (
            <button
              onClick={() => onBackToSetup(board)}
              className="px-2.5 py-1 bg-slate-700/80 hover:bg-slate-600 text-amber-300 text-xs font-bold rounded-lg border border-amber-500/40 flex items-center gap-1"
            >
              <span>⚙️</span> Xếp Đội Hình
            </button>
          )}

          <div className="h-4 w-[1px] bg-slate-700 mx-1 hidden sm:block" />

          {gameMode === 'ai' ? (
            <span className="text-xs bg-purple-900/60 text-purple-300 font-black px-2.5 py-0.5 rounded-full border border-purple-600 flex items-center gap-1.5">
              <span>🤖</span>
              <span>ĐẤU VỚI MÁY ({aiDifficulty === 'easy' ? 'DỄ' : aiDifficulty === 'hard' ? 'KHÓ' : 'VỪA'})</span>
            </span>
          ) : multiplayerMode === 'online' ? (
            <span className="text-xs bg-emerald-900/60 text-emerald-300 font-black px-2.5 py-0.5 rounded-full border border-emerald-600 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>ONLINE: {onlineRoomId} ({onlineRole === 'white' ? 'Trắng ♔' : 'Đỏ ♚'})</span>
            </span>
          ) : (
            <span className="text-xs bg-slate-700/80 text-slate-300 font-bold px-2.5 py-0.5 rounded-full border border-slate-600">
              Đá Cùng Máy (Local 2P)
            </span>
          )}
        </div>

        {/* Emote Quick Bar & Rules */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-700/80 px-2 py-0.5 rounded-xl border border-slate-600">
            <span className="text-[10px] text-slate-300 mr-1 hidden sm:inline">Emote:</span>
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

          <button
            onClick={() => setRulesModalOpen(true)}
            className="px-2.5 py-1 bg-slate-700/80 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl border border-slate-600"
          >
            📖 Luật
          </button>
        </div>
      </div>

      {/* Top Header & Scoreboard Banner */}
      <div className="w-full bg-slate-800/90 border-2 border-slate-700 rounded-3xl p-3 sm:p-5 mb-4 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Team White */}
          <div className="flex items-center gap-3 w-full md:w-1/3 justify-start">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-2xl font-black text-amber-300 shadow-lg">
              ♔
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-white">{whiteRoster.teamName}</h3>
              <p className="text-[11px] text-slate-300">Tấn công Khung thành Đỏ (trên)</p>
            </div>
          </div>

          {/* Electronic Scoreboard */}
          <div className="flex flex-col items-center justify-center w-full md:w-1/3 text-center">
            <div className="bg-slate-900/90 px-6 sm:px-8 py-1.5 rounded-2xl border-2 border-yellow-500/80 shadow-[0_0_20px_rgba(234,179,8,0.25)] inline-flex items-center justify-center gap-3 min-w-[150px]">
              <span className="w-10 sm:w-12 text-center text-3xl sm:text-5xl font-black text-amber-400 font-mono">
                {board.score.white}
              </span>
              <span className="text-xl sm:text-2xl text-slate-400 font-bold">:</span>
              <span className="w-10 sm:w-12 text-center text-3xl sm:text-5xl font-black text-rose-400 font-mono">
                {board.score.black}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-2 justify-center">
              <div
                className={`px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md ${
                  isWhiteTurn
                    ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300'
                    : 'bg-red-600 text-white ring-2 ring-red-400'
                }`}
              >
                <span>⚽ LƯỢT:</span>
                <span>{isWhiteTurn ? 'ĐỘI TRẮNG' : gameMode === 'ai' ? 'MÁY (AI BOT)' : 'ĐỘI ĐỎ'}</span>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-0.5 rounded-full border border-slate-700">
                <span className="text-xs font-black text-amber-400 animate-pulse">
                  ⚡ Còn {board.remainingAP}/2 Lượt
                </span>
              </div>
            </div>

            {gameMode === 'ai' && !isWhiteTurn && (
              <p className="text-[11px] text-purple-300 font-bold mt-1.5 animate-pulse flex items-center gap-1">
                <span>🤖</span> Máy (AI) đang tính toán chiến thuật...
              </p>
            )}

            {multiplayerMode === 'online' && !isMyTurnInOnline && (
              <p className="text-[11px] text-amber-300 font-bold mt-1 animate-pulse">
                ⏳ Đang chờ đối thủ thực hiện nước đi...
              </p>
            )}
          </div>

          {/* Team Black */}
          <div className="flex items-center gap-3 w-full md:w-1/3 justify-end">
            <div className="text-right">
              <h3 className="font-extrabold text-base sm:text-lg text-white">
                {gameMode === 'ai' ? `🤖 Bot AI (${aiDifficulty === 'easy' ? 'Dễ' : aiDifficulty === 'hard' ? 'Khó' : 'Vừa'})` : blackRoster.teamName}
              </h3>
              <p className="text-[11px] text-slate-300">Tấn công Khung thành Trắng (dưới)</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-red-600/20 border-2 border-red-500 flex items-center justify-center text-2xl font-black text-red-400 shadow-lg">
              {gameMode === 'ai' ? '🤖' : '♚'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Game Layout */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Action Control Panel */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 shadow-xl">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-2">
              <span>🎮</span> Thao Tác Điều Khiển
            </h4>

            {selectedPiece ? (
              <div className="flex flex-col gap-3">
                {(() => {
                  const def = getPieceDefinition(selectedPiece.typeId);
                  return (
                    <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-700 shadow-inner">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-600 flex items-center justify-center text-2xl shadow">
                          {def.symbol}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <div className="flex items-center justify-between">
                            <span className="text-xs sm:text-sm font-black text-white truncate">{def.vietnameseName}</span>
                            <span className="text-[9px] bg-cyan-900/60 text-cyan-300 font-bold px-1.5 py-0.2 rounded uppercase border border-cyan-700">
                              {def.role}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-300">
                            Vị trí: ({selectedPiece.position.x}, {selectedPiece.position.y})
                          </p>
                        </div>
                      </div>

                      {/* Special Ability Box */}
                      {def.specialAbilityDesc && (
                        <div className="mt-2.5 bg-gradient-to-r from-amber-950/50 via-slate-900 to-slate-900 border border-amber-500/40 rounded-xl p-2 shadow-sm">
                          <div className="flex items-center justify-between gap-1 text-[11px] font-black text-amber-300">
                            <div className="flex items-center gap-1">
                              <span>✨</span>
                              <span>KỸ NĂNG:</span>
                            </div>
                            {def.hasBulldozer && (
                              selectedPiece.abilityCooldown && selectedPiece.abilityCooldown > 0 ? (
                                <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded-full border border-amber-500/40 font-bold">
                                  Hồi chiêu: {selectedPiece.abilityCooldown}
                                </span>
                              ) : (
                                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded-full border border-emerald-500/40 font-bold">
                                  SẴN SÀNG
                                </span>
                              )
                            )}
                          </div>
                          <p className="text-[10px] text-amber-100/90 mt-1 font-medium leading-relaxed">
                            {def.specialAbilityDesc}
                          </p>
                        </div>
                      )}

                      <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">{def.description}</p>
                    </div>
                  );
                })()}

                {/* Mode Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={!isMyTurnInOnline}
                    onClick={() => setBoard((prev) => ({ ...prev, activeAction: 'move' }))}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${
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
                    onClick={() => setBoard((prev) => ({ ...prev, activeAction: 'kick' }))}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${
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
                  <p className="text-[10px] text-amber-400/80 bg-amber-950/30 p-2 rounded-lg border border-amber-500/20 leading-relaxed">
                    💡 Hãy di chuyển vào ô có bóng để kiểm soát bóng trước khi Sút/Chuyền!
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-6 px-3 bg-slate-950/60 rounded-xl border border-dashed border-slate-800">
                <div className="text-2xl mb-1">👆</div>
                <p className="text-xs text-slate-400">
                  Nhấp vào một <strong className="text-yellow-400">Quân cờ của bạn</strong> trên sân để ra lệnh di chuyển hoặc sút bóng.
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
                onClick={handleResetMatch}
                className="w-full py-1.5 text-xs text-slate-400 hover:text-red-400 transition-colors"
              >
                🔄 Đặt lại trận đấu
              </button>
            </div>
          </div>
        </div>

        {/* Center Column: Pitch Board */}
        <div className="lg:col-span-6 flex justify-center">
          <PitchBoard
            board={board}
            validTargets={validTargets}
            onSelectPiece={handleSelectPiece}
            onCellClick={handleCellClick}
            isSetupMode={false}
          />
        </div>

        {/* Right Column: Match Commentary & Rules */}
        <div className="lg:col-span-3 flex flex-col gap-3">
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
          <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3.5 text-xs text-slate-300">
            <h4 className="font-bold text-amber-400 mb-1.5 flex items-center gap-1">
              <span>⚡</span> Nhắc Nhở Chiến Thuật
            </h4>
            <ul className="space-y-1 list-disc pl-3.5 text-[11px] text-slate-300 leading-relaxed">
              <li>Mỗi lượt có <strong>2 Lượt Đi (2 AP)</strong>.</li>
              <li>Chuyền bóng trúng đồng đội hoặc Cướp bóng được <strong>giữ lượt</strong>.</li>
              <li>Quân Xe (♖) húc văng đối phương không mất lượt.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Goal Celebration Banner */}
      {showGoalBanner && board.lastGoalScorer && (
        <GoalCelebration
          team={board.lastGoalScorer.team}
          scorerName={board.lastGoalScorer.pieceName}
          onClose={() => {
            setShowGoalBanner(false);
            const boardToAdjust: BoardState = {
              ...board,
              lastGoalScorer: undefined,
              selectedPieceId: null,
              activeAction: null,
            };
            setBoard(boardToAdjust);
            if (!board.winner && onBackToSetup) {
              onBackToSetup(boardToAdjust);
            }
          }}
        />
      )}

      {/* Match Winner Popup */}
      {board.winner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-slate-900 border-4 border-yellow-400 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
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
                onClick={() => handleRematch(false)}
                className="py-3 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-sm shadow-xl"
              >
                🔄 Thi Đấu Lại (Rematch)
              </button>
              {onBackToMenu && (
                <button
                  onClick={onBackToMenu}
                  className="py-2.5 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm"
                >
                  Trở Về Menu Chính
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {registryModalOpen && (
        <PieceRegistryModal
          onClose={() => setRegistryModalOpen(false)}
          onPieceAdded={() => setBoard((prev) => ({ ...prev }))}
        />
      )}
      {rulesModalOpen && <RulesModal onClose={() => setRulesModalOpen(false)} />}
    </div>
  );
}
