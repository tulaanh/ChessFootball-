import React from 'react';
import { BoardState, PieceInstance, Position, TeamColor } from '@/engine/types';
import { getPieceDefinition } from '@/engine/piece-registry';
import { BOARD_WIDTH } from '@/engine/engine';

interface HalfPitchBoardProps {
  team: TeamColor;
  board: BoardState;
  validTargets?: Position[];
  onSelectPiece?: (pieceId: string) => void;
  onCellClick?: (x: number, y: number) => void;
  isReady?: boolean;
}

export default function HalfPitchBoard({
  team,
  board,
  validTargets = [],
  onSelectPiece,
  onCellClick,
  isReady = false,
}: HalfPitchBoardProps) {
  const isWhite = team === 'white';
  const selectedPiece = board.pieces.find((p) => p.id === board.selectedPieceId);

  // White team half: rows y = 7 to y = 14 (8 rows, bottom half)
  // Black team half: rows y = 0 to y = 7 (8 rows, top half)
  const startY = isWhite ? 7 : 0;
  const endY = isWhite ? 14 : 7;
  const rowIndices = Array.from({ length: endY - startY + 1 }, (_, i) => startY + i);

  const isValidTarget = (x: number, y: number) => {
    return validTargets.some((t) => t.x === x && t.y === y);
  };

  const getPieceAt = (x: number, y: number): PieceInstance | undefined => {
    return board.pieces.find((p) => p.position.x === x && p.position.y === y && p.team === team);
  };

  return (
    <div className={`relative select-none flex flex-col items-center justify-center p-2 rounded-2xl border-2 transition-all ${
      isReady
        ? 'border-emerald-500/60 bg-emerald-950/20'
        : isWhite
        ? 'border-amber-500/40 bg-slate-950/60'
        : 'border-red-500/40 bg-slate-950/60'
    }`}>
      {/* Pitch Header / Goal indicator */}
      <div className="w-full flex items-center justify-between px-2 mb-1.5 text-[11px] font-bold">
        <span className={isWhite ? 'text-amber-400' : 'text-red-400'}>
          {isWhite ? '🥅 Khung thành Đội Trắng (Bảo vệ)' : '🥅 Khung thành Đội Đỏ (Bảo vệ)'}
        </span>
        <span className="text-[10px] text-slate-400">
          {isReady ? '🔒 Đã chốt vị trí' : '👉 Kéo/Click chọn & dời ô'}
        </span>
      </div>

      {/* Half Pitch Stadium */}
      <div className="relative rounded-xl overflow-hidden shadow-xl border-2 border-slate-700 bg-emerald-800 p-1.5 md:p-2 w-full max-w-[540px]">
        <div
          className="grid gap-[2px] relative bg-emerald-950 p-1 rounded-lg"
          style={{
            gridTemplateColumns: `repeat(${BOARD_WIDTH}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rowIndices.length}, minmax(0, 1fr))`,
            aspectRatio: '11 / 7.5',
          }}
        >
          {rowIndices.map((y) =>
            Array.from({ length: BOARD_WIDTH }).map((_, x) => {
              const piece = getPieceAt(x, y);
              const isTarget = isValidTarget(x, y);
              const isSelected = selectedPiece?.position.x === x && selectedPiece?.position.y === y;

              // Turf pattern styling
              const isEvenRow = y % 2 === 0;
              const isEvenCell = (x + y) % 2 === 0;
              const isCenterLine = y === 7;
              const isTopGoalArea = y === 0 && x >= 4 && x <= 6;
              const isBottomGoalArea = y === 14 && x >= 4 && x <= 6;
              const isOutOfPitch = (y === 0 || y === 14) && (x < 4 || x > 6);
              const isTopBox = y <= 3 && x >= 2 && x <= 8 && y >= 1;
              const isBottomBox = y >= 11 && x >= 2 && x <= 8 && y <= 13;

              let cellBg = isEvenRow ? 'bg-emerald-700/80' : 'bg-emerald-600/80';
              if (isEvenCell) cellBg += ' brightness-95';

              if (isTopGoalArea || isBottomGoalArea) {
                cellBg = 'bg-gradient-to-b from-yellow-950/90 to-slate-950/90 border border-yellow-400 shadow-inner';
              } else if (isOutOfPitch) {
                cellBg = 'opacity-0 pointer-events-none';
              }

              const handleCellClicked = () => {
                if (isReady || isOutOfPitch) return;
                if (piece && onSelectPiece) {
                  onSelectPiece(piece.id);
                } else if (onCellClick) {
                  onCellClick(x, y);
                }
              };

              return (
                <div
                  key={`${x}-${y}`}
                  onClick={handleCellClicked}
                  className={`relative flex items-center justify-center rounded transition-all group overflow-hidden ${cellBg} ${
                    isOutOfPitch || isReady ? '' : 'cursor-pointer hover:brightness-110'
                  } ${isSelected ? 'ring-2 ring-yellow-400 z-20 scale-105' : ''} ${
                    isTarget ? 'ring-2 ring-cyan-400 z-10' : ''
                  }`}
                >
                  {/* Field Markings */}
                  {y === 1 && !isOutOfPitch && (
                    <div className="absolute inset-x-0 top-0 h-[1.5px] bg-white/60 pointer-events-none" />
                  )}
                  {y === 13 && !isOutOfPitch && (
                    <div className="absolute inset-x-0 bottom-0 h-[1.5px] bg-white/60 pointer-events-none" />
                  )}
                  {isCenterLine && (
                    <div className={`absolute inset-x-0 ${isWhite ? 'top-0' : 'bottom-0'} h-[2px] bg-white/50 pointer-events-none`} />
                  )}
                  {x === 5 && y === 7 && (
                    <div className="absolute w-4 h-4 rounded-full border border-white/60 pointer-events-none" />
                  )}
                  {isTopBox && y === 3 && (
                    <div className="absolute inset-x-0 bottom-0 h-[1.5px] bg-white/30 pointer-events-none" />
                  )}
                  {isBottomBox && y === 11 && (
                    <div className="absolute inset-x-0 top-0 h-[1.5px] bg-white/30 pointer-events-none" />
                  )}

                  {/* Goal Post Marker */}
                  {(isTopGoalArea || isBottomGoalArea) && (
                    <div className="absolute inset-0 bg-yellow-500/10 flex items-center justify-center text-[8px] md:text-[9px] text-yellow-200 font-black opacity-60 pointer-events-none">
                      GOAL
                    </div>
                  )}

                  {/* Target Highlight */}
                  {isTarget && !isReady && (
                    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                      <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-cyan-400/40 border border-cyan-300 animate-bounce" />
                    </div>
                  )}

                  {/* Piece Rendering */}
                  {piece && (
                    <div
                      className={`relative z-10 flex flex-col items-center justify-center w-full h-full p-0.5 transition-transform ${
                        isReady ? '' : 'cursor-pointer hover:scale-110'
                      }`}
                    >
                      {(() => {
                        const def = getPieceDefinition(piece.typeId);
                        return (
                          <div
                            className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex flex-col items-center justify-center shadow-md border ${
                              isWhite
                                ? 'bg-gradient-to-b from-slate-100 to-amber-100 border-amber-400 text-slate-950'
                                : 'bg-gradient-to-b from-red-600 to-slate-950 border-red-400 text-white'
                            }`}
                          >
                            <span className="text-xs sm:text-sm font-bold leading-none">
                              {def?.symbol || '♟'}
                            </span>
                            <span
                              className={`text-[6px] sm:text-[7px] font-black uppercase leading-none px-0.5 rounded-sm mt-0.5 ${
                                def?.role === 'GK'
                                  ? 'bg-yellow-500 text-black'
                                  : def?.role === 'FWD'
                                  ? 'bg-rose-500 text-white'
                                  : def?.role === 'MID'
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-emerald-600 text-white'
                              }`}
                            >
                              {def?.role || 'DEF'}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
