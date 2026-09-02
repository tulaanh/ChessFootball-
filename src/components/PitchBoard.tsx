

import React from 'react';
import {
  BoardState,
  PieceInstance,
  Position,
  TeamColor,
} from '@/engine/types';
import { getPieceDefinition } from '@/engine/piece-registry';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  isGoalCell,
  isPieceAdjacentToBall,
} from '@/engine/engine';

interface PitchBoardProps {
  board: BoardState;
  validTargets: Position[];
  onSelectPiece: (pieceId: string) => void;
  onCellClick: (x: number, y: number) => void;
  isSetupMode?: boolean;
  setupTeam?: TeamColor;
  placingPieceType?: string | null;
}

export default function PitchBoard({
  board,
  validTargets,
  onSelectPiece,
  onCellClick,
  isSetupMode = false,
  setupTeam = 'white',
  placingPieceType = null,
}: PitchBoardProps) {
  const selectedPiece = board.pieces.find((p) => p.id === board.selectedPieceId);

  // Helper to check if a position is in valid targets
  const isValidTarget = (x: number, y: number) => {
    return validTargets.some((t) => t.x === x && t.y === y);
  };

  const getPieceAt = (x: number, y: number): PieceInstance | undefined => {
    return board.pieces.find((p) => p.position.x === x && p.position.y === y);
  };

  return (
    <div className="relative select-none flex flex-col items-center">
      {/* Top Goal Post Frame */}
      <div className="w-full flex justify-center mb-1.5">
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-800 border border-slate-600 rounded-t-xl text-xs font-bold text-slate-200 shadow-md">
          <span>🥅 Khung thành Đội Đỏ (Đội Trắng tấn công)</span>
        </div>
      </div>

      {/* Main Pitch Stadium */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-600 bg-slate-800 p-2 md:p-3">
        {/* Pitch Turf Grid */}
        <div
          className="grid gap-[2px] md:gap-1 relative bg-[#14532d] p-1.5 md:p-2 rounded-xl border border-slate-600/50 shadow-inner"
          style={{
            gridTemplateColumns: `repeat(${BOARD_WIDTH}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${BOARD_HEIGHT}, minmax(0, 1fr))`,
            width: 'min(94vw, 620px)',
            height: 'min(138vw, 820px)',
          }}
        >
          {Array.from({ length: BOARD_HEIGHT }).map((_, y) =>
            Array.from({ length: BOARD_WIDTH }).map((__, x) => {
              const piece = getPieceAt(x, y);
              const isBallHere = board.ballPosition.x === x && board.ballPosition.y === y;
              const isTarget = isValidTarget(x, y);
              const isSelected = selectedPiece?.position.x === x && selectedPiece?.position.y === y;

              // Turf pattern styling (Natural lush green lawn stripes)
              const isEvenRow = y % 2 === 0;
              const isEvenCell = (x + y) % 2 === 0;
              const isCenterLine = y === 7;
              const isTopGoalArea = y === 0 && x >= 4 && x <= 6;
              const isBottomGoalArea = y === 14 && x >= 4 && x <= 6;
              const isOutOfPitch = (y === 0 || y === 14) && (x < 4 || x > 6);
              const isTopBox = y <= 3 && x >= 2 && x <= 8 && y >= 1;
              const isBottomBox = y >= 11 && x >= 2 && x <= 8 && y <= 13;

              // Setup zone checks
              const isInWhiteSetupZone = y >= 8 && y <= 13 && !isOutOfPitch;
              const isInBlackSetupZone = y >= 1 && y <= 6 && !isOutOfPitch;
              const isInActiveSetupZone = isSetupMode && (setupTeam === 'white' ? isInWhiteSetupZone : isInBlackSetupZone);

              let cellBg = isEvenRow ? 'bg-[#15803d]' : 'bg-[#16a34a]';
              if (isEvenCell) cellBg += ' brightness-[0.96]';

              if (isTopGoalArea || isBottomGoalArea) {
                cellBg = 'bg-gradient-to-b from-amber-900/80 to-slate-800/90 border-2 border-amber-400 shadow-inner';
              } else if (isOutOfPitch) {
                cellBg = 'opacity-0 pointer-events-none';
              } else if (isInActiveSetupZone) {
                cellBg += ' ring-1 ring-amber-400/50';
              }

              const handleSquareClick = () => {
                if (isOutOfPitch) return;
                if (!isSetupMode && piece && piece.team === board.currentTurn && !isTarget) {
                  onSelectPiece(piece.id);
                } else {
                  onCellClick(x, y);
                }
              };

              return (
                <div
                  key={`${x}-${y}`}
                  onClick={handleSquareClick}
                  className={`relative flex items-center justify-center rounded-md transition-all duration-150 group overflow-hidden ${cellBg} ${
                    isOutOfPitch ? 'pointer-events-none' : 'cursor-pointer'
                  } ${
                    isSelected ? 'ring-2 md:ring-4 ring-yellow-400 z-20 scale-105' : ''
                  } ${isTarget ? 'hover:scale-105 ring-2 ring-cyan-400 z-10' : !isOutOfPitch ? 'hover:brightness-110' : ''}`}
                >
                  {/* Field Markings Overlay */}
                  {/* Top / Bottom Endlines on the pitch */}
                  {y === 1 && !isOutOfPitch && (
                    <div className="absolute inset-x-0 top-0 h-[2px] bg-white/60 pointer-events-none" />
                  )}
                  {y === 13 && !isOutOfPitch && (
                    <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/60 pointer-events-none" />
                  )}
                  {isCenterLine && (
                    <div className="absolute inset-x-0 top-1/2 h-[2px] bg-white/40 pointer-events-none" />
                  )}
                  {x === 5 && y === 7 && (
                    <div className="absolute w-5 h-5 rounded-full border-2 border-white/50 pointer-events-none" />
                  )}
                  {isTopBox && y === 3 && (
                    <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/30 pointer-events-none" />
                  )}
                  {isBottomBox && y === 11 && (
                    <div className="absolute inset-x-0 top-0 h-[2px] bg-white/30 pointer-events-none" />
                  )}

                  {/* Goal Post Marker */}
                  {(isTopGoalArea || isBottomGoalArea) && (
                    <div className="absolute inset-0 bg-yellow-500/10 flex items-center justify-center text-[10px] text-yellow-200 font-extrabold opacity-40 pointer-events-none">
                      GOAL
                    </div>
                  )}

                  {/* Target Highlight Indicator */}
                  {isTarget && (
                    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                      {board.activeAction === 'kick' ? (
                        <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-amber-400/30 border-2 border-yellow-300 animate-pulse flex items-center justify-center shadow-lg">
                          <span className="text-xs md:text-sm">🎯</span>
                        </div>
                      ) : piece && piece.team !== board.currentTurn ? (
                        <div className="w-7 h-7 md:w-9 md:h-9 rounded-full bg-red-600/50 border-2 border-red-400 animate-ping flex items-center justify-center">
                          <span className="text-xs">⚔️</span>
                        </div>
                      ) : (
                        <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-cyan-400/40 border-2 border-cyan-300 animate-bounce" />
                      )}
                    </div>
                  )}

                  {/* Piece Rendering */}
                  {piece && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSquareClick();
                      }}
                      className={`relative z-10 flex flex-col items-center justify-center w-full h-full p-0.5 transition-transform duration-200 ${
                        piece.team === board.currentTurn ? 'cursor-pointer hover:scale-110' : ''
                      } ${piece.isStunned ? 'opacity-50 grayscale' : ''}`}
                    >
                      {/* Player Token Disc */}
                      {(() => {
                        const def = getPieceDefinition(piece.typeId);
                        const isWhite = piece.team === 'white';
                        return (
                          <div
                            className={`w-7 h-7 sm:w-9 sm:h-9 md:w-11 md:h-11 rounded-full flex flex-col items-center justify-center shadow-lg border-2 ${
                              isWhite
                                ? 'bg-gradient-to-b from-slate-100 to-amber-100 border-amber-400 text-slate-900 ring-1 ring-amber-300'
                                : 'bg-gradient-to-b from-red-600 to-slate-900 border-red-400 text-white ring-1 ring-red-500'
                            }`}
                          >
                            <span className="text-sm sm:text-base md:text-xl font-bold leading-none">
                              {def.symbol}
                            </span>
                            <span
                              className={`text-[8px] sm:text-[9px] font-black uppercase leading-none px-1 rounded-sm mt-0.5 ${
                                def.role === 'GK'
                                  ? 'bg-yellow-500 text-black'
                                  : def.role === 'FWD'
                                  ? 'bg-rose-500 text-white'
                                  : def.role === 'MID'
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-emerald-600 text-white'
                              }`}
                            >
                              {def.role}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Ball Rendering */}
                  {isBallHere && (
                    <div className="absolute z-20 pointer-events-none flex items-center justify-center">
                      <div className="text-base sm:text-xl md:text-2xl drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] transform scale-110 animate-bounce">
                        ⚽
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom Goal Post Frame */}
      <div className="w-full flex justify-center mt-1.5">
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-800 border border-slate-600 rounded-b-xl text-xs font-bold text-slate-200 shadow-md">
          <span>🥅 Khung thành Đội Trắng (Đội Đỏ tấn công)</span>
        </div>
      </div>
    </div>
  );
}
