import React from 'react';
import { PieceInstance } from '@/engine/types';
import { getPieceDefinition } from '@/engine/piece-registry';

interface PieceTokenProps {
  piece: PieceInstance;
  isSelected?: boolean;
  showCost?: boolean;
  showCooldown?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

export default function PieceToken({
  piece,
  isSelected = false,
  showCost = false,
  showCooldown = true,
  onClick,
  className = '',
}: PieceTokenProps) {
  const def = getPieceDefinition(piece.typeId);
  const isWhite = piece.team === 'white';
  const isKing = piece.typeId === 'king';
  const isQueen = piece.typeId === 'queen';
  const isRook = piece.typeId === 'rook';
  const isKnight = piece.typeId === 'knight';
  const isCannon = piece.typeId === 'cannon';
  const isPawn = piece.typeId === 'pawn';

  // Border & Ring hierarchy
  let tierBorder = 'border-2 border-slate-900';
  let tierRing = '';

  if (isQueen) {
    tierBorder = isWhite
      ? 'border-[3.5px] border-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.7)]'
      : 'border-[3.5px] border-yellow-300 shadow-[0_0_18px_rgba(253,224,71,0.7)]';
    tierRing = 'ring-2 ring-amber-400';
  } else if (isKing) {
    tierBorder = isWhite
      ? 'border-[3.5px] border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.6)]'
      : 'border-[3.5px] border-amber-300 shadow-[0_0_15px_rgba(252,211,77,0.6)]';
    tierRing = 'ring-2 ring-amber-500';
  } else if (isRook) {
    tierBorder = isWhite
      ? 'border-[2.5px] border-blue-500 shadow-lg'
      : 'border-[2.5px] border-blue-300 shadow-lg';
  } else if (isCannon) {
    tierBorder = isWhite
      ? 'border-[2.5px] border-orange-500 shadow-lg'
      : 'border-[2.5px] border-orange-300 shadow-lg';
  } else if (isKnight) {
    tierBorder = isWhite
      ? 'border-[2.5px] border-emerald-500 shadow-lg'
      : 'border-[2.5px] border-emerald-300 shadow-lg';
  } else if (isPawn) {
    tierBorder = isWhite ? 'border-2 border-slate-700' : 'border-2 border-rose-300/80';
  }

  // Base background (Clean high contrast)
  const baseBg = isWhite
    ? 'bg-gradient-to-br from-white via-slate-100 to-slate-200 text-slate-950 shadow-[0_6px_14px_rgba(0,0,0,0.4)]'
    : 'bg-gradient-to-br from-red-500 via-red-600 to-rose-700 text-white shadow-[0_6px_14px_rgba(0,0,0,0.5)]';

  return (
    <div
      onClick={onClick}
      className={`relative z-20 w-[96%] h-[96%] max-w-full max-h-full rounded-2xl flex items-center justify-center cursor-pointer transition-all duration-200 select-none shadow-xl overflow-hidden ${
        isSelected
          ? 'ring-4 ring-yellow-400 scale-105 shadow-[0_0_25px_rgba(250,204,21,1)] z-30 animate-pulse'
          : `hover:scale-105 ${tierRing}`
      } ${tierBorder} ${baseBg} ${piece.isStunned ? 'opacity-40 grayscale' : ''} ${className}`}
    >
      {/* Top Right Cooldown Status (If active) */}
      {showCooldown && piece.abilityCooldown && piece.abilityCooldown > 0 ? (
        <span className="absolute top-1 right-1 px-1.5 py-[0.5px] rounded-full text-[9px] sm:text-[10px] font-black bg-slate-950 text-amber-300 border border-amber-400 shadow-md leading-none animate-pulse z-10">
          ⏳ {piece.abilityCooldown}
        </span>
      ) : null}

      {/* FULL-SIZE GIANT CHESS SYMBOL (Fills the entire token) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span
          className={`font-black leading-none drop-shadow-md select-none transition-transform ${
            isQueen || isKing
              ? 'text-4xl sm:text-5xl md:text-6xl scale-110'
              : isRook || isCannon || isKnight
              ? 'text-3xl sm:text-4xl md:text-5xl'
              : 'text-2xl sm:text-3xl md:text-4xl'
          } ${isWhite ? 'text-slate-950' : 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]'}`}
        >
          {def.symbol}
        </span>
      </div>

      {/* FLOATING CORNER: Monetary Badge (In Setup Screen) */}
      {showCost && (
        <div className="absolute bottom-1 right-1 pointer-events-none z-10 leading-none">
          <div
            className={`px-1.5 py-[1px] rounded-full font-mono font-black flex items-center gap-0.5 shadow-md border leading-none ${
              isQueen
                ? 'bg-amber-400 text-slate-950 border-amber-300 text-[9px] sm:text-[10px] md:text-[11px] ring-1 ring-amber-300'
                : 'bg-slate-950/90 text-amber-300 border-amber-400/80 text-[8px] sm:text-[9px] md:text-[10px]'
            }`}
          >
            <span className="text-[8px] sm:text-[9px]">{def.cost > 0 ? '🪙' : '👑'}</span>
            <span>{def.cost}đ</span>
          </div>
        </div>
      )}
    </div>
  );
}
