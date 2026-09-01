import React from 'react';
import ChessFootballGame from './components/ChessFootballGame';

export default function App() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="mb-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
            <span>⚽</span> Game Chiến Thuật Thể Thao Độc Đáo <span>♔</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500">
            CỜ VUA BÓNG ĐÁ (CHESS FOOTBALL)
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl mx-auto">
            Thay vì ăn quân, các quân cờ sẽ phối hợp chuyền bóng, tắc bóng và sút tung lưới đối phương theo quỹ đạo đặc trưng của từng quân cờ.
          </p>
        </div>

        <ChessFootballGame />
      </div>
    </main>
  );
}
