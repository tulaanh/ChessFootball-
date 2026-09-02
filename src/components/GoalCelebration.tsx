

import React, { useEffect, useState } from 'react';
import { TeamColor } from '@/engine/types';

interface GoalCelebrationProps {
  team: TeamColor;
  scorerName: string;
  onClose: () => void;
}

export default function GoalCelebration({ team, scorerName, onClose }: GoalCelebrationProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onClose();
    }, 3200);
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!visible) return null;

  const isWhite = team === 'white';
  const teamLabel = isWhite ? 'ĐỘI TRẮNG (WHITE ROYALS)' : 'ĐỘI ĐỎ (RED STRIKERS)';
  const bgColor = isWhite
    ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 text-black'
    : 'bg-gradient-to-r from-red-600 via-rose-500 to-red-700 text-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md animate-fade-in pointer-events-auto">
      <div className="relative text-center px-8 py-10 rounded-3xl shadow-2xl border-4 border-yellow-300 max-w-lg mx-4 transform animate-bounce">
        <div className="text-6xl md:text-8xl mb-2 animate-spin">⚽</div>
        <h1 className={`text-4xl md:text-6xl font-black tracking-widest uppercase py-3 px-6 rounded-2xl shadow-xl ${bgColor}`}>
          VÀOOOOOO!
        </h1>
        <div className="mt-4 bg-slate-900/90 text-white p-4 rounded-xl border border-yellow-400/40 space-y-2">
          <p className="text-sm font-semibold tracking-wider text-yellow-300 uppercase">
            {teamLabel}
          </p>
          <p className="text-xl md:text-2xl font-bold mt-1">
            Ghi bàn bởi: <span className="text-yellow-400">{scorerName}</span>
          </p>
          <p className="text-xs text-lime-300 font-bold">
            📋 Sau bàn thắng: 2 đội có quyền tái bố trí vị trí các quân cờ!
          </p>
        </div>

        <button
          onClick={onClose}
          className="mt-4 px-6 py-2 bg-gradient-to-r from-lime-400 to-emerald-400 hover:from-lime-300 hover:to-emerald-300 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider shadow-lg"
        >
          📋 Bố Trí Lại Đội Hình Ngay ➔
        </button>
      </div>
    </div>
  );
}
