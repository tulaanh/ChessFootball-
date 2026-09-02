import React, { useState, useEffect } from 'react';
import { multiplayerService, NetworkPacket } from '@/services/multiplayer';
import { TeamColor } from '@/engine/types';

interface OnlineLobbyModalProps {
  onStartOnlineMatch: (role: TeamColor, roomId: string) => void;
  onClose: () => void;
  initialRoomCode?: string;
}

export default function OnlineLobbyModal({
  onStartOnlineMatch,
  onClose,
  initialRoomCode = '',
}: OnlineLobbyModalProps) {
  const [tab, setTab] = useState<'create' | 'join'>(() => (initialRoomCode ? 'join' : 'create'));
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState<string>(initialRoomCode);
  const [statusText, setStatusText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Đăng ký listener của multiplayerService khi Modal mở
  useEffect(() => {
    multiplayerService.init({
      onConnected: (peerId, role) => {
        setIsLoading(false);
        setErrorMessage('');
        setStatusText(`🟢 Kết nối thành công! Bạn là Đội ${role === 'white' ? 'Trắng' : 'Đỏ'}...`);
        setTimeout(() => {
          onStartOnlineMatch(role, peerId);
        }, 600);
      },
      onDisconnected: () => {
        setIsLoading(false);
        setErrorMessage('Đối thủ đã ngắt kết nối!');
      },
      onPacketReceived: (_packet: NetworkPacket) => {},
      onError: (errorMsg) => {
        setIsLoading(false);
        setErrorMessage(errorMsg);
        setStatusText('');
      },
      onStatusUpdate: (status) => {
        setStatusText(status);
      },
    });

    // Nếu có mã phòng truyền sẵn qua URL, tự điền
    if (initialRoomCode) {
      setJoinCodeInput(initialRoomCode);
      setTab('join');
    }

    return () => {
      // Khi đóng modal mà chưa vào trận đấu
      if (!multiplayerService.isConnectedToPeer) {
        multiplayerService.cleanup();
      }
    };
  }, [initialRoomCode, onStartOnlineMatch]);

  const handleCreateRoom = () => {
    setErrorMessage('');
    setIsLoading(true);
    setStatusText('Đang kết nối cổng máy chủ đám mây...');

    multiplayerService.createRoom((code) => {
      setCreatedRoomCode(code);
      setIsLoading(false);
      setStatusText('🟢 Phòng đã mở thành công! Hãy gửi mã phòng cho bạn bè...');
    });
  };

  const handleJoinRoom = () => {
    const cleanCode = joinCodeInput.trim();
    if (!cleanCode) {
      setErrorMessage('Vui lòng nhập mã phòng!');
      return;
    }

    setErrorMessage('');
    setIsLoading(true);
    setStatusText('Đang kết nối vào phòng...');

    multiplayerService.joinRoom(cleanCode);
  };

  const handleCopyLink = () => {
    if (!createdRoomCode) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${createdRoomCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCancelAndClose = () => {
    multiplayerService.cleanup();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border-2 border-cyan-500/80 rounded-3xl p-6 max-w-md w-full shadow-2xl relative">
        <button
          onClick={handleCancelAndClose}
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
            <p className="text-xs text-slate-400">Kết nối trực tiếp 2 người chơi qua mạng P2P</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-2xl border border-slate-800 mb-6">
          <button
            onClick={() => {
              if (isLoading) return;
              setTab('create');
              setErrorMessage('');
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
              if (isLoading) return;
              setTab('join');
              setErrorMessage('');
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
              <div className="text-center py-2">
                <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                  Bạn sẽ làm <strong>Chủ phòng (Host)</strong> điều khiển <strong>Đội Trắng (White)</strong>. Sau khi bấm tạo phòng, hệ thống sẽ cấp mã phòng để bạn gửi cho đối thủ.
                </p>
                <button
                  disabled={isLoading}
                  onClick={handleCreateRoom}
                  className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-slate-950 font-black text-sm rounded-xl shadow-xl uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <span className="animate-pulse">⏳ Đang khởi tạo...</span>
                  ) : (
                    <>
                      <span>⚡</span> Tạo Mã Phòng Ngay
                    </>
                  )}
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

                <div className="flex gap-2 w-full mt-1">
                  <button
                    onClick={handleCopyLink}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 rounded-xl border border-slate-700 flex items-center justify-center gap-1.5"
                  >
                    <span>{copied ? '✅' : '🔗'}</span>
                    <span>{copied ? 'Đã chép Link!' : 'Sao chép Link mời'}</span>
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(createdRoomCode);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-300 rounded-xl border border-slate-700"
                  >
                    Chép Mã
                  </button>
                </div>

                <div className="flex items-center gap-2 mt-2 text-xs text-amber-300/90 font-medium animate-pulse">
                  <span>⏳</span> Đang chờ đối thủ nhập mã và tham gia...
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab Content: JOIN ROOM */}
        {tab === 'join' && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              Bạn sẽ làm <strong>Khách (Guest)</strong> điều khiển <strong>Đội Đỏ (Black)</strong>. Nhập mã phòng do bạn bè gửi:
            </p>
            <div>
              <input
                type="text"
                disabled={isLoading}
                placeholder="Nhập mã phòng (VD: cf-123456)"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isLoading) {
                    handleJoinRoom();
                  }
                }}
                className="w-full bg-slate-950 border-2 border-slate-700 focus:border-amber-400 rounded-xl px-4 py-3 text-center text-lg font-mono font-bold text-white placeholder:text-slate-600 outline-none"
              />
            </div>
            <button
              disabled={isLoading || !joinCodeInput.trim()}
              onClick={handleJoinRoom}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-sm rounded-xl shadow-xl uppercase tracking-wider flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span className="animate-pulse">⏳ Đang kết nối...</span>
              ) : (
                <>
                  <span>🔑</span> Tham Gia Trận Đấu
                </>
              )}
            </button>
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div className="mt-4 p-3 bg-red-950/70 border border-red-500/50 rounded-xl text-center text-xs text-red-300">
            <p className="font-bold mb-1">❌ Không thể kết nối</p>
            <p>{errorMessage}</p>
          </div>
        )}

        {/* Status Text Notification */}
        {statusText && !errorMessage && (
          <p className="text-center text-xs mt-4 text-cyan-300 font-medium bg-cyan-950/40 p-2.5 rounded-xl border border-cyan-800/40 animate-fade-in">
            {statusText}
          </p>
        )}
      </div>
    </div>
  );
}
