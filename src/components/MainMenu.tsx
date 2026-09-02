import React, { useState, useEffect } from 'react';
import RulesModal from './RulesModal';
import PieceRegistryModal from './PieceRegistryModal';
import OnlineLobbyModal from './OnlineLobbyModal';
import { TeamColor } from '@/engine/types';

interface MainMenuProps {
  onStartOffline: () => void;
  onStartOnline: (role: TeamColor, roomId: string) => void;
}

export default function MainMenu({ onStartOffline, onStartOnline }: MainMenuProps) {
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isRegistryOpen, setIsRegistryOpen] = useState(false);
  const [isOnlineLobbyOpen, setIsOnlineLobbyOpen] = useState(false);
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
      <div className="absolute bottom-10 right-1/4 w-[350px] h-[350px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 max-w-4xl w-full flex flex-col items-center text-center">
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
        <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto mb-10 leading-relaxed">
          Thay vì ăn quân, các quân cờ sẽ phối hợp chuyền bóng, tắc bóng và sút tung lưới đối phương theo quỹ đạo di chuyển đặc trưng.
        </p>

        {/* Primary Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-2xl mb-8">
          {/* OFFLINE CARD */}
          <button
            onClick={onStartOffline}
            className="group relative flex flex-col items-start p-6 rounded-3xl bg-gradient-to-br from-slate-900/90 to-slate-950/90 border-2 border-slate-700/80 hover:border-emerald-400 transition-all duration-300 shadow-xl hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:-translate-y-1 text-left overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
            
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-3xl mb-4 text-emerald-400 shadow-inner group-hover:scale-110 transition-transform">
              🎮
            </div>

            <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-400 mb-1">
              <span>●</span> 2 Người Cùng Máy (Local)
            </div>

            <h3 className="text-2xl font-black text-white group-hover:text-emerald-300 transition-colors mb-2">
              Chơi Offline
            </h3>

            <p className="text-xs text-slate-400 leading-relaxed">
              Tùy chỉnh 11 cầu thủ và sơ đồ chiến thuật FM cho cả 2 đội, sau đó so tài trực tiếp trên cùng một thiết bị.
            </p>

            <div className="mt-6 flex items-center gap-2 text-xs font-black text-emerald-400 group-hover:translate-x-1 transition-transform">
              <span>BẮT ĐẦU SẮP XẾP</span>
              <span>→</span>
            </div>
          </button>

          {/* ONLINE CARD */}
          <button
            onClick={() => setIsOnlineLobbyOpen(true)}
            className="group relative flex flex-col items-start p-6 rounded-3xl bg-gradient-to-br from-slate-900/90 to-slate-950/90 border-2 border-slate-700/80 hover:border-cyan-400 transition-all duration-300 shadow-xl hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] hover:-translate-y-1 text-left overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all pointer-events-none" />

            <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-3xl mb-4 text-cyan-400 shadow-inner group-hover:scale-110 transition-transform">
              🌐
            </div>

            <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-cyan-400 mb-1">
              <span>●</span> Multiplayer P2P
            </div>

            <h3 className="text-2xl font-black text-white group-hover:text-cyan-300 transition-colors mb-2">
              Chơi Online
            </h3>

            <p className="text-xs text-slate-400 leading-relaxed">
              Tạo phòng đấu hoặc nhập mã mời để so tài chiến thuật thời gian thực với bạn bè qua kết nối mạng P2P.
            </p>

            <div className="mt-6 flex items-center gap-2 text-xs font-black text-cyan-400 group-hover:translate-x-1 transition-transform">
              <span>MỞ SẢNH ĐẤU</span>
              <span>→</span>
            </div>
          </button>
        </div>

        {/* Secondary Auxiliary Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => setIsRulesOpen(true)}
            className="px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-400/50 text-xs font-bold text-slate-300 hover:text-white transition-all shadow-md flex items-center gap-2"
          >
            <span>📖</span> Hướng Dẫn & Luật Chơi
          </button>

          <button
            onClick={() => setIsRegistryOpen(true)}
            className="px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-400/50 text-xs font-bold text-slate-300 hover:text-white transition-all shadow-md flex items-center gap-2"
          >
            <span>📚</span> Bách Khoa Quân Cờ
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
