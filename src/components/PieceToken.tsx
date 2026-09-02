import React from 'react';
import { PieceInstance, TeamColor } from '@/engine/types';
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

  // --- Visual Hierarchy & Tier System ---
  // Tier S: Queen (35đ) & King (GK 0đ)
  // Tier A: Rook (25đ), Cannon (20đ), Knight (20đ)
  // Tier B: Bishop (15đ)
  // Tier C: Pawn (5đ)

  // Position color coding for accent elements
  const getRoleAccent = (role: string) => {
    switch (role) {
      case 'GK':
        return {
          barBg: 'bg-amber-400 text-slate-950 border-amber-300',
          glow: 'rgba(251, 191, 36, 0.5)',
          name: 'GK',
        };
      case 'DEF':
        return {
          barBg: 'bg-blue-600 text-white border-blue-400',
          glow: 'rgba(59, 130, 246, 0.4)',
          name: 'HV',
        };
      case 'MID':
        return {
          barBg: 'bg-emerald-500 text-slate-950 font-black border-emerald-300',
          glow: 'rgba(16, 185, 129, 0.4)',
          name: 'TV',
        };
      case 'FWD':
      default:
        return {
          barBg: 'bg-rose-600 text-white border-rose-400',
          glow: 'rgba(244, 63, 94, 0.4)',
          name: 'TĐ',
        };
    }
  };

  const roleAccent = getRoleAccent(def.role);

  // Border & Ring hierarchy
  let tierBorder = 'border-[2.5px] border-slate-900';
  let tierRing = '';
  let tokenScale = 'w-[94%] h-[94%]';

  if (isQueen) {
    // Queen: Double Gold Ring & Crown Radiance
    tierBorder = isWhite
      ? 'border-[3px] border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)]'
      : 'border-[3px] border-yellow-300 shadow-[0_0_15px_rgba(253,224,71,0.6)]';
    tierRing = 'ring-2 ring-amber-400/80';
  } else if (isKing) {
    // King / Goalkeeper: Royal Gold Guard Border
    tierBorder = isWhite
      ? 'border-[3px] border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
      : 'border-[3px] border-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.5)]';
    tierRing = 'ring-2 ring-amber-500/60';
  } else if (isRook) {
    // Rook: Armored Steel Blue
    tierBorder = isWhite
      ? 'border-[3px] border-blue-500 shadow-[0_4px_10px_rgba(59,130,246,0.35)]'
      : 'border-[3px] border-blue-300 shadow-[0_4px_10px_rgba(147,197,253,0.35)]';
  } else if (isCannon) {
    // Cannon: Blast Fire Orange
    tierBorder = isWhite
      ? 'border-[3px] border-orange-500 shadow-[0_4px_10px_rgba(249,115,22,0.35)]'
      : 'border-[3px] border-orange-300 shadow-[0_4px_10px_rgba(253,186,116,0.35)]';
  } else if (isKnight) {
    // Knight: Emerald Speed
    tierBorder = isWhite
      ? 'border-[3px] border-emerald-500 shadow-[0_4px_10px_rgba(16,185,129,0.35)]'
      : 'border-[3px] border-emerald-300 shadow-[0_4px_10px_rgba(110,231,183,0.35)]';
  } else if (isPawn) {
    // Pawn: Subtle & Clean
    tierBorder = isWhite ? 'border-[2px] border-slate-700' : 'border-[2px] border-rose-300/80';
    tokenScale = 'w-[88%] h-[88%]';
  }

  // Base background
  const baseBg = isWhite
    ? 'bg-gradient-to-b from-white via-slate-100 to-slate-200 text-slate-950'
    : 'bg-gradient-to-b from-red-500 via-red-600 to-rose-800 text-white';

  return (
    <div
      onClick={onClick}
      className={`relative z-20 ${tokenScale} rounded-2xl flex flex-col items-center justify-between p-1 cursor-pointer transition-all duration-200 select-none shadow-xl ${
        isSelected
          ? 'ring-4 ring-yellow-400 scale-110 shadow-[0_0_25px_rgba(250,204,21,1)] z-30 animate-pulse'
          : `hover:scale-105 ${tierRing}`
      } ${tierBorder} ${baseBg} ${piece.isStunned ? 'opacity-40 grayscale' : ''} ${className}`}
    >
      {/* TOP HEADER: Subtle, Integrated Position Marker & Cooldown Badge */}
      <div className="w-full flex items-center justify-between px-0.5 pointer-events-none">
        {/* Refined Integrated Position Marker */}
        <span
          className={`px-1.5 sm:px-2 py-[1px] sm:py-0.5 rounded-full text-[8px] sm:text-[10px] md:text-[11px] font-black uppercase tracking-wider border shadow-sm flex items-center gap-0.5 leading-none ${roleAccent.barBg}`}
        >
          {def.role === 'GK' && '🧤'}
          {def.role}
        </span>

        {/* Cooldown or Stun Status */}
        {showCooldown && piece.abilityCooldown && piece.abilityCooldown > 0 ? (
          <span className="px-1.5 py-[1px] rounded-full text-[8px] sm:text-[10px] font-black bg-slate-950 text-amber-300 border border-amber-400/80 shadow leading-none animate-pulse">
            ⏳ {piece.abilityCooldown}
          </span>
        ) : null}
      </div>

      {/* CENTER: Prominent, Sharp 3D Chess Symbol with Character */}
      <div className="flex-1 flex items-center justify-center my-0.5 pointer-events-none">
        <span
          className={`font-black leading-none drop-shadow-lg transition-transform ${
            isQueen
              ? 'text-3xl sm:text-4xl md:text-5xl lg:text-6xl scale-110'
              : isKing
              ? 'text-3xl sm:text-4xl md:text-5xl lg:text-6xl'
              : isRook || isCannon || isKnight
              ? 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl'
              : 'text-2xl sm:text-3xl md:text-4xl'
          } ${isWhite ? 'text-slate-950' : 'text-white'}`}
        >
          {def.symbol}
        </span>
      </div>

      {/* BOTTOM FOOTER: High-Contrast Monetary Badge (Gold Coin + Bold Number) or Name */}
      <div className="w-full flex items-center justify-center pointer-events-none">
        {showCost ? (
          <div
            className={`px-2 py-0.5 rounded-full font-mono font-black flex items-center gap-1 shadow-md border leading-none ${
              isQueen
                ? 'bg-amber-400 text-slate-950 border-amber-300 text-[10px] sm:text-xs md:text-sm ring-2 ring-amber-300'
                : isKing
                ? 'bg-slate-900 text-amber-300 border-amber-500/80 text-[9px] sm:text-[11px] md:text-xs'
                : def.cost >= 20
                ? 'bg-slate-950 text-lime-300 border-lime-400/80 text-[9px] sm:text-[11px] md:text-xs'
                : 'bg-slate-900/90 text-slate-200 border-slate-700 text-[8px] sm:text-[10px]'
            }`}
          >
            <span className="text-[10px] sm:text-xs">{def.cost > 0 ? '🪙' : '👑'}</span>
            <span>{def.cost}đ</span>
          </div>
        ) : (
          <span
            className={`text-[8px] sm:text-[10px] md:text-[11px] font-black truncate px-1 rounded block leading-tight max-w-[95%] text-center ${
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
