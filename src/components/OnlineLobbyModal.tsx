import React, { useState } from 'react';
import { multiplayerService } from '@/services/multiplayer';
import { TeamColor } from '@/engine/types';

interface OnlineLobbyModalProps {
  onStartOnlineMatch: (role: TeamColor, roomId: string) => void;
  onClose: () => void;
}

export default function OnlineLobbyModal({
  onStartOnlineMatch,
  onClose,
}: OnlineLobbyModalProps) {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [statusText, setStatusText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const handleCreateRoom = () => {
    setIsLoading(true);
    setStatusText('Đang khởi tạo máy chủ phòng...');

    multiplayerService.createRoom((code) => {
      setCreatedRoomCode(code);
      setIsLoading(false);
      setStatusText('🟢 Phòng đã sẵn sàng! Đang chờ đối thủ tham gia...');
    });
  };

  const handleJoinRoom = () => {
    if (!joinCodeInput.trim()) {
      alert('Vui lòng nhập mã phòng!');
      return;
    }

    setIsLoading(true);
    setStatusText('Đang kết nối vào phòng...');

    multiplayerService.joinRoom(joinCodeInput.trim(), () => {
      setIsLoading(false);
      setStatusText('🟢 Kết nối thành công! Đang vào trận đấu...');
      setTimeout(() => {
        onStartOnlineMatch('black', joinCodeInput.trim());
      }, 500);
    });
  };

  const handleCopyLink = () => {
    if (!createdRoomCode) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${createdRoomCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border-2 border-cyan-500/80 rounded-3xl p-6 max-w-md w-full shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center"
        >
          ✕
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center text-2xl shadow-lg">
            🌐
          </div>
          <div>
            <h3 className="text-xl font-black text-white">Đá Online (P2P Real-time)</h3>
            <p className="text-xs text-slate-400">Thi đấu trực tiếp giữa 2 thiết bị không cần server</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-2xl border border-slate-800 mb-6">
          <button
            onClick={() => {
              setTab('create');
              setStatusText('');
            }}
            className={`py-2 rounded-xl text-xs font-bold transition-all ${
              tab === 'create'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🏠 Tạo Phòng Mới (Host)
          </button>
          <button
            onClick={() => {
              setTab('join');
              setStatusText('');
            }}
            className={`py-2 rounded-xl text-xs font-bold transition-all ${
              tab === 'join'
                ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🔑 Tham Gia Phòng (Guest)
          </button>
        </div>

        {/* Tab Content: CREATE ROOM */}
        {tab === 'create' && (
          <div className="flex flex-col gap-4">
            {!createdRoomCode ? (
              <div className="text-center py-4">
                <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                  Bạn sẽ làm <strong>Chủ phòng (Host)</strong> điều khiển <strong>Đội Trắng (White)</strong>. Sau khi tạo phòng, gửi mã phòng hoặc link cho bạn bè để bắt đầu!
                </p>
                <button
                  disabled={isLoading}
                  onClick={handleCreateRoom}
                  className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-sm rounded-xl shadow-xl uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <span>⚡</span> Tạo Mã Phòng Ngay
                </button>
              </div>
            ) : (
              <div className="bg-slate-950 p-4 rounded-2xl border border-cyan-500/40 text-center flex flex-col items-center gap-3">
                <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">
                  MÃ PHÒNG THI ĐẤU CỦA BẠN:
                </span>
                <div className="bg-slate-900 border-2 border-dashed border-cyan-400 px-6 py-2 rounded-xl text-2xl font-mono font-black text-amber-400 tracking-widest shadow-inner">
                  {createdRoomCode}
                </div>

                <div className="flex gap-2 w-full mt-2">
                  <button
                    onClick={handleCopyLink}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 rounded-xl border border-slate-700 flex items-center justify-center gap-1.5"
                  >
                    <span>{copied ? '✅' : '🔗'}</span>
                    <span>{copied ? 'Đã sao chép Link!' : 'Sao chép Link mời'}</span>
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(createdRoomCode);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-300 rounded-xl border border-slate-700"
                  >
                    Mã
                  </button>
                </div>

                <div className="flex items-center gap-2 mt-2 text-xs text-amber-300/90 font-medium animate-pulse">
                  <span>⏳</span> Đang chờ đối thủ kết nối vào phòng...
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab Content: JOIN ROOM */}
        {tab === 'join' && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              Bạn sẽ làm <strong>Khách (Guest)</strong> điều khiển <strong>Đội Đỏ (Black)</strong>. Nhập mã phòng 6 chữ số do bạn bè gửi:
            </p>
            <div>
              <input
                type="text"
                placeholder="Nhập mã phòng (VD: cf-123456)"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value)}
                className="w-full bg-slate-950 border-2 border-slate-700 focus:border-amber-400 rounded-xl px-4 py-3 text-center text-lg font-mono font-bold text-white placeholder:text-slate-600 outline-none"
              />
            </div>
            <button
              disabled={isLoading || !joinCodeInput.trim()}
              onClick={handleJoinRoom}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-sm rounded-xl shadow-xl uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <span>🔑</span> Tham Gia Trận Đấu
            </button>
          </div>
        )}

        {/* Status Text */}
        {statusText && (
          <p className="text-center text-xs mt-4 text-cyan-300 font-medium bg-cyan-950/40 p-2 rounded-xl border border-cyan-800/40">
            {statusText}
          </p>
        )}
      </div>
    </div>
  );
}
