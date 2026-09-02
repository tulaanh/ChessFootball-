import React, { useState, useEffect } from 'react';
import RulesModal from './RulesModal';
import PieceRegistryModal from './PieceRegistryModal';
import OnlineLobbyModal from './OnlineLobbyModal';
import { TeamColor, AIDifficulty } from '@/engine/types';

interface MainMenuProps {
  onStartOffline: () => void;
  onStartAI: (difficulty: AIDifficulty) => void;
  onStartOnline: (role: TeamColor, roomId: string) => void;
}

export default function MainMenu({ onStartOffline, onStartAI, onStartOnline }: MainMenuProps) {
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isRegistryOpen, setIsRegistryOpen] = useState(false);
  const [isOnlineLobbyOpen, setIsOnlineLobbyOpen] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<AIDifficulty>('normal');
  const [initialRoomFromUrl, setInitialRoomFromUrl] = useState<string>('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      setInitialRoomFromUrl(roomParam);
      setIsOnlineLobbyOpen(true);
    }
  }, []);

  return (
    <div className="relative min-h-[85vh] flex flex-col items-center justify-center text-slate-100 px-4 py-8 overflow-hidden select-none">
      {/* Cinematic Background Glow Elements */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 left-1/4 w-[350px] h-[350px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[350px] h-[350px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 max-w-5xl w-full flex flex-col items-center text-center">
        {/* Subtitle Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-300 text-xs font-black uppercase tracking-widest mb-4 shadow-lg backdrop-blur-md animate-pulse">
          <span>⚽</span> SIÊU PHẨM CHIẾN THUẬT THỂ THAO <span>♔</span>
        </div>

        {/* Big Game Title */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500 drop-shadow-[0_10px_30px_rgba(245,158,11,0.2)] mb-3">
          CỜ VUA BÓNG ĐÁ
        </h1>

        {/* English & Subtitle */}
        <p className="text-xs sm:text-sm font-semibold text-slate-400 uppercase tracking-widest mb-2">
          CHESS FOOTBALL TACTICS &bull; STRATEGY MEETS SOCCER
        </p>
        <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto mb-8 leading-relaxed">
          Thay vì ăn quân, các quân cờ sẽ phối hợp chuyền bóng, tắc bóng và sút tung lưới đối phương theo quỹ đạo di chuyển đặc trưng.
        </p>

        {/* Primary Action Cards - 3 Game Modes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-8">
          {/* 1. AI BOT MODE CARD */}
          <div className="group relative flex flex-col items-start p-5 rounded-3xl bg-slate-800/90 border-2 border-purple-500/50 hover:border-purple-400 transition-all duration-300 shadow-xl hover:shadow-[0_0_30px_rgba(168,85,247,0.3)] hover:-translate-y-1 text-left overflow-hidden">
            <div className="absolute top-0 right-0 w-28 h-28 bg-purple-500/15 rounded-full blur-2xl group-hover:bg-purple-500/25 transition-all pointer-events-none" />
            
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-400/50 flex items-center justify-center text-2xl mb-3 text-purple-300 shadow-inner group-hover:scale-110 transition-transform">
              🤖
            </div>

            <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-purple-400 mb-1">
              <span>●</span> Đơn đấu với Máy
            </div>

            <h3 className="text-xl font-black text-white group-hover:text-purple-300 transition-colors mb-1.5">
              Đấu Với Máy (AI)
            </h3>

            <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
              Luyện tập chiến thuật với Bot AI thông minh, tự động phán đoán và né bẫy Đánh Chặn.
            </p>

            {/* Difficulty Selector */}
            <div className="w-full bg-slate-900/90 p-1 rounded-xl border border-slate-700/80 mb-4 flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => setSelectedDifficulty('easy')}
                className={`flex-1 py-1 text-[10px] font-black rounded-lg transition-all ${
                  selectedDifficulty === 'easy'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Dễ
              </button>
              <button
                type="button"
                onClick={() => setSelectedDifficulty('normal')}
                className={`flex-1 py-1 text-[10px] font-black rounded-lg transition-all ${
                  selectedDifficulty === 'normal'
                    ? 'bg-amber-400 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Vừa
              </button>
              <button
                type="button"
                onClick={() => setSelectedDifficulty('hard')}
                className={`flex-1 py-1 text-[10px] font-black rounded-lg transition-all ${
                  selectedDifficulty === 'hard'
                    ? 'bg-rose-500 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Khó
              </button>
            </div>

            <button
              onClick={() => onStartAI(selectedDifficulty)}
              className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5 transition-all"
            >
              <span>VÀO ĐẤU VỚI BOT</span>
              <span>→</span>
            </button>
          </div>

          {/* 2. LOCAL 2P CARD */}
          <button
            onClick={onStartOffline}
            className="group relative flex flex-col items-start p-5 rounded-3xl bg-slate-800/90 border-2 border-slate-700 hover:border-emerald-400 transition-all duration-300 shadow-xl hover:shadow-[0_0_30px_rgba(16,185,129,0.25)] hover:-translate-y-1 text-left overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
            
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-2xl mb-3 text-emerald-400 shadow-inner group-hover:scale-110 transition-transform">
              🎮
            </div>

            <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-400 mb-1">
              <span>●</span> 2 Người Cùng Máy (Local)
            </div>

            <h3 className="text-xl font-black text-white group-hover:text-emerald-300 transition-colors mb-1.5">
              Chơi Offline
            </h3>

            <p className="text-[11px] text-slate-300 leading-relaxed mb-auto">
              Tùy chỉnh 11 cầu thủ và sơ đồ chiến thuật FM cho cả 2 đội, sau đó so tài trực tiếp trên cùng một thiết bị.
            </p>

            <div className="mt-4 w-full py-2.5 rounded-2xl bg-slate-700/80 group-hover:bg-emerald-500 group-hover:text-slate-950 text-emerald-400 font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5 transition-all">
              <span>BẮT ĐẦU SẮP XẾP</span>
              <span>→</span>
            </div>
          </button>

          {/* 3. ONLINE P2P CARD */}
          <button
            onClick={() => setIsOnlineLobbyOpen(true)}
            className="group relative flex flex-col items-start p-5 rounded-3xl bg-slate-800/90 border-2 border-slate-700 hover:border-cyan-400 transition-all duration-300 shadow-xl hover:shadow-[0_0_30px_rgba(6,182,212,0.25)] hover:-translate-y-1 text-left overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-28 h-28 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all pointer-events-none" />

            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-2xl mb-3 text-cyan-400 shadow-inner group-hover:scale-110 transition-transform">
              🌐
            </div>

            <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-cyan-400 mb-1">
              <span>●</span> Multiplayer P2P
            </div>

            <h3 className="text-xl font-black text-white group-hover:text-cyan-300 transition-colors mb-1.5">
              Chơi Online
            </h3>

            <p className="text-[11px] text-slate-300 leading-relaxed mb-auto">
              Tạo phòng đấu hoặc nhập ID phòng để thách đấu bạn bè qua mạng P2P thời gian thực với đồng bộ tức thì.
            </p>

            <div className="mt-4 w-full py-2.5 rounded-2xl bg-slate-700/80 group-hover:bg-cyan-400 group-hover:text-slate-950 text-cyan-400 font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5 transition-all">
              <span>VÀO SẢNH CHỜ</span>
              <span>→</span>
            </div>
          </button>
        </div>

        {/* Secondary Navigation Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => setIsRulesOpen(true)}
            className="px-5 py-2.5 rounded-2xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-2 transition-all shadow-md"
          >
            <span>📖</span>
            <span>Hướng Dẫn Luật Chơi</span>
          </button>

          <button
            onClick={() => setIsRegistryOpen(true)}
            className="px-5 py-2.5 rounded-2xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-cyan-300 flex items-center gap-2 transition-all shadow-md"
          >
            <span>🛡️</span>
            <span>Bách Khoa Quân Cờ</span>
          </button>
        </div>
      </div>

      {/* Modals */}
      {isRulesOpen && <RulesModal onClose={() => setIsRulesOpen(false)} />}
      {isRegistryOpen && <PieceRegistryModal onClose={() => setIsRegistryOpen(false)} />}
      {isOnlineLobbyOpen && (
        <OnlineLobbyModal
          initialRoomCode={initialRoomFromUrl}
          onStartOnlineMatch={(role, roomId) => {
            setIsOnlineLobbyOpen(false);
            onStartOnline(role, roomId);
          }}
          onClose={() => setIsOnlineLobbyOpen(false)}
        />
      )}
    </div>
  );
}
