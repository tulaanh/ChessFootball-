# ⚽ Cờ Vua Bóng Đá (Chess Football) – Standalone Edition

Dự án game chiến thuật **Cờ Vua Bóng Đá** hoàn chỉnh, độc lập được xuất ra tại thư mục: `D:\ChessFootball`.

---

## 🚀 2 Cách Chạy Game:

### Cách 1: Chạy trực tiếp KHÔNG CẦN CÀI ĐẶT (Nhanh nhất)
- Mở file: `D:\ChessFootball\index-standalone.html` bằng bất kỳ trình duyệt web nào (Google Chrome, Microsoft Edge, Firefox, Cốc Cốc).
- Bạn có thể chơi ngay lập tức mà không cần cài Node.js hay npm!

---

### Cách 2: Chạy phiên bản Vite + React + TypeScript (Dành cho Lập trình viên)
1. Mở PowerShell hoặc Terminal tại `D:\ChessFootball`:
   ```bash
   cd D:\ChessFootball
   npm install
   npm run dev
   ```
2. Mở trình duyệt tại địa chỉ: `http://localhost:5173`

---

## 📁 Cấu Trúc Thư Mục `D:\ChessFootball`:

```
D:\ChessFootball/
├── index-standalone.html      # Bản web độc lập, nhấp đúp là chơi ngay
├── package.json              # Quản lý dependencies (React, Vite, Tailwind)
├── vite.config.ts            # Cấu hình Vite & Alias @/
├── tsconfig.json             # Cấu hình TypeScript
├── tailwind.config.js        # Cấu hình Tailwind CSS
├── index.html                # Entry point cho Vite
├── src/
│   ├── main.tsx              # React Root Render
│   ├── App.tsx               # App Shell
│   ├── index.css             # Tailwind Styles
│   ├── engine/               # Logic Game Engine & Primitives
│   │   ├── types.ts          # Định nghĩa kiểu dữ liệu & interfaces
│   │   ├── piece-registry.ts # Bách khoa & Registry quân cờ mở rộng
│   │   └── engine.ts         # Match Engine (AP, Tackle, Sút, Goal)
│   └── components/           # UI Components
│       ├── ChessFootballGame.tsx # Game Orchestrator & Scoreboard
│       ├── PitchBoard.tsx        # Bàn cờ sân cỏ 9x13 ô tương tác
│       ├── GoalCelebration.tsx   # Hiệu ứng bàn thắng GOAL!
│       ├── TeamBuilderModal.tsx  # Quản lý đội hình Salary Cap 150đ
│       └── PieceRegistryModal.tsx# Bách khoa & Form tự tạo quân cờ mới
```

---

## 🎮 Hướng Dẫn Luật Chơi:
- **2 AP / Lượt:** Người chơi có 2 điểm hành động mỗi lượt (Di chuyển / Sút bóng).
- **Tắc bóng (Tackle):** Di chuyển vào ô của quân đối phương để cướp bóng và đẩy lùi đối thủ 1 ô.
- **Sút / Chuyền:**
  - **Xe:** Sút thẳng xa.
  - **Tượng:** Sút chéo góc.
  - **Mã:** Sút bổng lốp bóng qua đầu hàng rào.
  - **Pháo:** Bắn đại bác qua 1 quân làm ngòi.
  - **Hậu:** Sút toàn diện 8 hướng.
- **Ghi bàn:** Sút bóng vào khung thành 3 ô ở đầu sân đối phương. Đội ghi 2 bàn trước sẽ chiến thắng!
