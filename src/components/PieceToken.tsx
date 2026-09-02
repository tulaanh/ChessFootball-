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
      ? 'border-[3px] border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)]'
      : 'border-[3px] border-yellow-300 shadow-[0_0_15px_rgba(253,224,71,0.6)]';
    tierRing = 'ring-2 ring-amber-400/80';
  } else if (isKing) {
    tierBorder = isWhite
      ? 'border-[3px] border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
      : 'border-[3px] border-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.5)]';
    tierRing = 'ring-2 ring-amber-500/60';
  } else if (isRook) {
    tierBorder = isWhite
      ? 'border-2 border-blue-500 shadow-md'
      : 'border-2 border-blue-300 shadow-md';
  } else if (isCannon) {
    tierBorder = isWhite
      ? 'border-2 border-orange-500 shadow-md'
      : 'border-2 border-orange-300 shadow-md';
  } else if (isKnight) {
    tierBorder = isWhite
      ? 'border-2 border-emerald-500 shadow-md'
      : 'border-2 border-emerald-300 shadow-md';
  } else if (isPawn) {
    tierBorder = isWhite ? 'border border-slate-700' : 'border border-rose-300/80';
  }

  // Base background
  const baseBg = isWhite
    ? 'bg-gradient-to-b from-white via-slate-100 to-slate-200 text-slate-950 shadow-[0_4px_10px_rgba(0,0,0,0.35)]'
    : 'bg-gradient-to-b from-red-500 via-red-600 to-rose-800 text-white shadow-[0_4px_10px_rgba(0,0,0,0.4)]';

  return (
    <div
      onClick={onClick}
      className={`relative z-20 w-[94%] h-[94%] max-w-full max-h-full rounded-2xl flex flex-col items-center justify-between p-1 cursor-pointer transition-all duration-200 select-none shadow-xl overflow-hidden ${
        isSelected
          ? 'ring-4 ring-yellow-400 scale-105 shadow-[0_0_20px_rgba(250,204,21,1)] z-30 animate-pulse'
          : `hover:scale-105 ${tierRing}`
      } ${tierBorder} ${baseBg} ${piece.isStunned ? 'opacity-40 grayscale' : ''} ${className}`}
    >
      {/* Top Right Cooldown Status (If active) */}
      {showCooldown && piece.abilityCooldown && piece.abilityCooldown > 0 ? (
        <span className="absolute top-1 right-1 px-1.5 py-[0.5px] rounded-full text-[8px] sm:text-[9px] font-black bg-slate-950 text-amber-300 border border-amber-400/80 leading-none animate-pulse z-10">
          ⏳ {piece.abilityCooldown}
        </span>
      ) : null}

      {/* CENTER: GIANT PROMINENT CHESS SYMBOL (No DEF/MID text taking space!) */}
      <div className="flex-1 min-h-0 w-full flex items-center justify-center pointer-events-none my-auto">
        <span
          className={`font-black leading-none drop-shadow-md select-none transition-transform ${
            isQueen || isKing
              ? 'text-2xl sm:text-3xl md:text-4xl scale-110'
              : isRook || isCannon || isKnight
              ? 'text-xl sm:text-2xl md:text-3xl'
              : 'text-lg sm:text-xl md:text-2xl'
          } ${isWhite ? 'text-slate-950' : 'text-white'}`}
        >
          {def.symbol}
        </span>
      </div>

      {/* BOTTOM: High-Contrast Monetary Badge or Short Name */}
      <div className="w-full flex items-center justify-center shrink-0 pointer-events-none pb-0.5 leading-none">
        {showCost ? (
          <div
            className={`px-1.5 sm:px-2 py-[1px] rounded-full font-mono font-black flex items-center gap-0.5 shadow-md border leading-none ${
              isQueen
                ? 'bg-amber-400 text-slate-950 border-amber-300 text-[8px] sm:text-[9px] md:text-[10px] ring-1 ring-amber-300'
                : isKing
                ? 'bg-slate-900 text-amber-300 border-amber-500/80 text-[7px] sm:text-[8px] md:text-[9px]'
                : def.cost >= 20
                ? 'bg-slate-950 text-lime-300 border-lime-400/80 text-[7px] sm:text-[8px] md:text-[9px]'
                : 'bg-slate-900/90 text-slate-200 border-slate-700 text-[7px] sm:text-[8px]'
            }`}
          >
            <span className="text-[7px] sm:text-[8px]">{def.cost > 0 ? '🪙' : '👑'}</span>
            <span>{def.cost}đ</span>
          </div>
        ) : (
          <span
            className={`text-[7px] sm:text-[8px] md:text-[9px] font-black truncate px-1 rounded block leading-none max-w-full text-center ${
              isWhite ? 'text-slate-900' : 'text-slate-100'
            }`}
          >
            {def.vietnameseName.split(' ')[0]}
          </span>
        )}
      </div>
    </div>
  );
}
