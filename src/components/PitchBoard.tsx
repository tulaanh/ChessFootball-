

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
      <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-600 bg-slate-900 p-2 md:p-3 flex items-center justify-center">
        {/* Pitch Turf Grid: Strictly constrained to 11/15 aspect ratio for 1:1 square cells on all devices */}
        <div
          className="grid gap-1 sm:gap-1.5 relative bg-[#14532d] p-2 sm:p-3 rounded-2xl border-2 border-emerald-500/40 shadow-2xl"
          style={{
            gridTemplateColumns: `repeat(${BOARD_WIDTH}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${BOARD_HEIGHT}, minmax(0, 1fr))`,
            aspectRatio: '11 / 15',
            width: 'min(96vw, calc(88vh * 11 / 15), 720px)',
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
                cellBg = 'bg-slate-900/85 border-2 border-white/90 shadow-[0_0_15px_rgba(255,255,255,0.4)] backdrop-blur-sm';
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
                  className={`relative aspect-square flex items-center justify-center rounded-md sm:rounded-lg transition-all duration-150 group overflow-visible ${cellBg} ${
                    isOutOfPitch ? 'pointer-events-none' : 'cursor-pointer'
                  } ${
                    isSelected ? 'ring-4 ring-yellow-400 z-30 scale-110 shadow-[0_0_20px_rgba(250,204,21,0.9)]' : ''
                  } ${isTarget ? 'hover:scale-105 ring-2 ring-cyan-300 z-20 shadow-lg' : !isOutOfPitch ? 'hover:brightness-110' : ''}`}
                >
                  {/* Field Markings Overlay */}
                  {y === 1 && !isOutOfPitch && (
                    <div className="absolute inset-x-0 top-0 h-[2px] bg-white/70 pointer-events-none" />
                  )}
                  {y === 13 && !isOutOfPitch && (
                    <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/70 pointer-events-none" />
                  )}
                  {isCenterLine && (
                    <div className="absolute inset-x-0 top-1/2 h-[2px] bg-white/70 pointer-events-none" />
                  )}
                  {x === 5 && y === 7 && (
                    <div className="absolute w-4 h-4 sm:w-6 sm:h-6 rounded-full border-2 border-white/70 pointer-events-none" />
                  )}
                  {isTopBox && y === 3 && (
                    <div className="absolute inset-x-0 bottom-0 h-[1.5px] bg-white/40 pointer-events-none" />
                  )}
                  {isBottomBox && y === 11 && (
                    <div className="absolute inset-x-0 top-0 h-[1.5px] bg-white/40 pointer-events-none" />
                  )}

                  {/* Goal Post Mesh Marker */}
                  {(isTopGoalArea || isBottomGoalArea) && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
                      <span className="text-[8px] sm:text-[10px] font-black text-white tracking-widest">GOAL</span>
                    </div>
                  )}

                  {/* Target Highlight Indicator */}
                  {isTarget && (
                    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                      {board.activeAction === 'kick' ? (
                        <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-amber-400/40 border-2 border-yellow-300 animate-pulse flex items-center justify-center shadow-lg">
                          <span className="text-[10px] sm:text-xs">🎯</span>
                        </div>
                      ) : piece && piece.team !== board.currentTurn ? (
                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-red-600/60 border-2 border-red-400 animate-ping flex items-center justify-center">
                          <span className="text-[10px]">⚔️</span>
                        </div>
                      ) : (
                        <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-cyan-400/50 border-2 border-cyan-300 animate-bounce" />
                      )}
                    </div>
                  )}

                  {/* 3D Piece Rendering */}
                  {piece && (() => {
                    const def = getPieceDefinition(piece.typeId);
                    const isWhiteTeam = piece.team === 'white';
                    return (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSquareClick();
                        }}
                        className={`relative z-10 w-[92%] h-[92%] rounded-lg sm:rounded-xl flex flex-col items-center justify-between p-0.5 transition-all duration-200 shadow-xl ${
                          piece.team === board.currentTurn ? 'cursor-pointer hover:scale-105' : ''
                        } ${piece.isStunned ? 'opacity-40 grayscale' : ''} ${
                          isWhiteTeam
                            ? 'bg-gradient-to-b from-white via-slate-100 to-slate-200 border-2 border-amber-400 text-slate-950 shadow-[0_3px_8px_rgba(0,0,0,0.35)]'
                            : 'bg-gradient-to-b from-rose-500 via-red-600 to-red-800 border-2 border-rose-300 text-white shadow-[0_3px_8px_rgba(0,0,0,0.4)]'
                        }`}
                      >
                        {/* Top: Role Tag */}
                        <div className="w-full flex items-center justify-between px-0.5 leading-none">
                          <span
                            className={`text-[6px] sm:text-[8px] font-black uppercase px-0.5 rounded leading-none ${
                              def.role === 'GK'
                                ? 'bg-yellow-400 text-slate-950'
                                : def.role === 'FWD'
                                ? 'bg-rose-500 text-white'
                                : def.role === 'MID'
                                ? 'bg-blue-600 text-white'
                                : 'bg-emerald-600 text-white'
                            }`}
                          >
                            {def.role}
                          </span>
                          {piece.abilityCooldown && piece.abilityCooldown > 0 ? (
                            <span className="text-[6px] sm:text-[7px] text-amber-300 bg-slate-950 px-0.5 rounded font-black">
                              ⏳
                            </span>
                          ) : null}
                        </div>

                        {/* Center: Big Chess Symbol */}
                        <div className="flex-1 flex items-center justify-center leading-none">
                          <span
                            className={`text-sm sm:text-lg md:text-xl font-black leading-none drop-shadow-md ${
                              isWhiteTeam ? 'text-amber-950' : 'text-white'
                            }`}
                          >
                            {def.symbol}
                          </span>
                        </div>

                        {/* Bottom: Name */}
                        <div className="w-full text-center leading-none">
                          <span
                            className={`text-[6px] sm:text-[8px] font-extrabold truncate block px-0.5 leading-none ${
                              isWhiteTeam ? 'text-slate-800' : 'text-slate-100'
                            }`}
                          >
                            {def.vietnameseName.split(' ')[0]}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Ball Rendering */}
                  {isBallHere && (
                    <div className="absolute z-30 pointer-events-none flex items-center justify-center">
                      <div className="text-base sm:text-xl md:text-2xl drop-shadow-[0_4px_10px_rgba(0,0,0,0.9)] transform scale-110 animate-bounce">
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
