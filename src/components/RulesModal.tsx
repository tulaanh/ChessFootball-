import React from 'react';

interface RulesModalProps {
  onClose: () => void;
}

export default function RulesModal({ onClose }: RulesModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto animate-fade-in">
      <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl text-white">
        {/* Header */}
        <div className="p-5 flex items-center justify-between border-b border-slate-800 bg-gradient-to-r from-amber-600/30 to-slate-900">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📖</span>
            <div>
              <h2 className="text-xl font-black text-amber-400">LUẬT CHƠI CỜ VUA BÓNG ĐÁ</h2>
              <p className="text-xs text-slate-300">Cơ chế kết hợp độc đáo giữa chiến thuật Cờ Vua và Bóng Đá sân cỏ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-sm text-slate-300 leading-relaxed">
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-2">
            <h3 className="font-bold text-amber-400 text-base flex items-center gap-2">
              <span>⚡</span> 1. Lượt đi & Điểm hành động (Action Points)
            </h3>
            <p>
              • Mỗi đội khi tới lượt sẽ có <strong>2 Lượt Đi (2 AP)</strong> để điều khiển các cầu thủ di chuyển hoặc chuyền / sút bóng.
            </p>
            <p>
              • Bạn có thể dùng cả 2 lượt cho cùng 1 quân cờ hoặc chia ra cho 2 quân cờ khác nhau.
            </p>
          </div>

          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-2">
            <h3 className="font-bold text-cyan-400 text-base flex items-center gap-2">
              <span>⚽</span> 2. Khống Chế, Chuyền & Cướp Bóng
            </h3>
            <p>
              • <strong>Kiểm soát bóng:</strong> Di chuyển quân cờ vào đúng ô có bóng để kiểm soát bóng (tiêu tốn 1 lượt AP).
            </p>
            <p>
              • <strong>Tắc bóng / Cướp bóng:</strong> Đâm vào quân đối phương đang giữ bóng để cướp bóng và làm choáng đối thủ trong 1 lượt (Cướp bóng thành công được <em>giữ nguyên lượt đi!</em>).
            </p>
            <p>
              • <strong>Chuyền bóng:</strong> Chuyền chính xác tới vị trí của đồng đội sẽ <em>không tiêu tốn lượt đi</em>, giúp tạo ra các pha phối hợp tiki-taka đẹp mắt!
            </p>
          </div>

          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-2">
            <h3 className="font-bold text-emerald-400 text-base flex items-center gap-2">
              <span>🎯</span> 3. Ghi Bàn Thắng
            </h3>
            <p>
              • Sút bóng vào ô <strong>GOAL (Khung thành)</strong> của đối phương để ghi bàn thắng.
            </p>
            <p>
              • Khi có bàn thắng, trận đấu sẽ ăn mừng và reset lại về đội hình ban đầu với quả bóng ở giữa sân. Đội vừa thủng lưới sẽ được quyền giao bóng trước.
            </p>
          </div>

          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-2">
            <h3 className="font-bold text-rose-400 text-base flex items-center gap-2">
              <span>🦬</span> 4. Kỹ Năng Đặc Biệt Của Các Quân Cờ
            </h3>
            <p>
              • <strong>Quân Hậu (♕) - Hào Quang Nhạc Trưởng:</strong> Nhạc trưởng tối thượng! Mỗi khi Hậu chuyền bóng dọn cỗ cho đồng đội sẽ lập tức <em>hồi phục trọn vẹn 2 lượt tấn công</em> cho đội nhà.
            </p>
            <p>
              • <strong>Quân Tượng (♗) - Khống Chế Thượng Thừa:</strong> Chuyên gia hãm bóng chéo! Mỗi khi di chuyển vào ô có bóng để nhận bóng sẽ <em>hoàn toàn KHÔNG MẤT LƯỢT ĐI</em>.
            </p>
            <p>
              • <strong>Quân Xe (♖) - Sự Trâu Bò:</strong> Khi cầm bóng đâm vào đối thủ sẽ húc văng đối phương ra xa và tiếp tục giữ bóng mà không mất lượt (Hồi chiêu 1 lượt).
            </p>
            <p>
              • <strong>Quân Tốt (♙) - Đánh Chặn Bắt Bài & Bứt Phá:</strong>
              <br />
              - <em>Phòng ngự (Đánh Chặn 4 Hướng):</em> Khi đối thủ nhận bóng ở 4 ô liền kề (Trên, Dưới, Trái, Phải), Tốt sẽ lập tức <strong>cướp bóng, đẩy lùi, làm choáng đối thủ và khiến đối phương MẤT LƯỢT ngay lập tức</strong>!
              <br />
              - <em>Tấn công (Bứt Phá Trẻ):</em> Khi sang nửa sân đối phương, tăng tầm sút lên <strong>3 ô</strong> và có thể <strong>bứt tốc tiến 2 ô thẳng</strong>!
            </p>
            <p>
              • <strong>Quỹ Lương (Salary Cap):</strong> Mỗi đội có tối đa <strong>150 điểm</strong> để chiêu mộ tối đa 11 quân cờ.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-slate-950 font-black rounded-xl text-sm shadow-md"
          >
            Đã Hiểu
          </button>
        </div>
      </div>
    </div>
  );
}
