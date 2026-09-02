import { PieceDefinition, TeamRoster } from './types';

// Registry storage
const PIECE_REGISTRY: Record<string, PieceDefinition> = {};

// Standard 8 directions vectors
const ORTHOGONAL_VECTORS = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
];

const DIAGONAL_VECTORS = [
  { dx: -1, dy: -1 },
  { dx: 1, dy: -1 },
  { dx: -1, dy: 1 },
  { dx: 1, dy: 1 },
];

const ALL_8_VECTORS = [...ORTHOGONAL_VECTORS, ...DIAGONAL_VECTORS];

const KNIGHT_VECTORS = [
  { dx: 1, dy: 2 },
  { dx: 2, dy: 1 },
  { dx: -1, dy: 2 },
  { dx: -2, dy: 1 },
  { dx: 1, dy: -2 },
  { dx: 2, dy: -1 },
  { dx: -1, dy: -2 },
  { dx: -2, dy: -1 },
];

const KNIGHT_CHIP_SHOT_VECTORS: { dx: number; dy: number }[] = [];
for (let dx = -3; dx <= 3; dx++) {
  for (let dy = -3; dy <= 3; dy++) {
    if (dx === 0 && dy === 0) continue;
    if (dx * dx + dy * dy <= 10) {
      KNIGHT_CHIP_SHOT_VECTORS.push({ dx, dy });
    }
  }
}

export const INITIAL_PIECES: PieceDefinition[] = [
  // 1. KING (Thủ Môn / Vua)
  {
    id: 'king',
    name: 'King',
    vietnameseName: 'Thủ Môn (Vua)',
    role: 'GK',
    cost: 0, // Mandatory GK, free
    symbol: '♔',
    description: 'Chốt chặn cuối cùng trong khung thành. Bước 1 ô mọi hướng, đặc biệt có thể phát bóng bổng tới bất kỳ đồng đội nào trên sân.',
    moveRule: {
      type: 'step',
      vectors: ALL_8_VECTORS.map((v) => ({ ...v, maxRange: 1 })),
    },
    kickRule: {
      type: 'step',
      vectors: ALL_8_VECTORS.map((v) => ({ ...v, maxRange: 2 })),
      power: 2,
    },
  },

  // 2. QUEEN (Nhạc Trưởng / Hậu)
  {
    id: 'queen',
    name: 'Queen',
    vietnameseName: 'Nhạc Trưởng (Hậu)',
    role: 'FWD',
    cost: 45,
    symbol: '♕',
    description: 'Ngôi sao toàn năng nhất sân. Di chuyển trượt xa 8 hướng, sút bóng uy lực. Sở hữu [HÀO QUANG NHẠC TRƯỞNG]: Đường chuyền dọn cỗ cho đồng đội mở ra các cơ hội tấn công bùng nổ!',
    moveRule: {
      type: 'slide',
      vectors: ALL_8_VECTORS,
    },
    kickRule: {
      type: 'slide',
      vectors: ALL_8_VECTORS,
      power: 5,
    },
    hasPlaymakerAura: true,
    specialAbilityDesc: 'Hào Quang Nhạc Trưởng: Chuyên gia kiến tạo dọn cỗ, chuyền bóng cho đồng đội hồi phục thế trận tấn công bùng nổ!',
  },

  // 3. ROOK (Hậu Vệ Quét / Xe)
  {
    id: 'rook',
    name: 'Rook',
    vietnameseName: 'Hậu Vệ Quét (Xe)',
    role: 'DEF',
    cost: 25,
    symbol: '♖',
    description: 'Lá chắn thép & Cỗ xe tăng càn quét. Di chuyển thẳng trượt xa không giới hạn, tung cú đại bác thẳng xuyên sân.',
    moveRule: {
      type: 'slide',
      vectors: ORTHOGONAL_VECTORS,
    },
    kickRule: {
      type: 'slide',
      vectors: ORTHOGONAL_VECTORS,
      power: 4,
    },
    hasBulldozer: true,
    specialAbilityDesc: 'Sự Trâu Bò: Khi cầm bóng đâm vào quân đối phương sẽ húc bay đối thủ mà KHÔNG MẤT LƯỢT!',
  },

  // 4. BISHOP (Tiền Vệ Kiến Thiết / Tượng)
  {
    id: 'bishop',
    name: 'Bishop',
    vietnameseName: 'Tiền Vệ Cánh (Tượng)',
    role: 'MID',
    cost: 20,
    symbol: '♗',
    description: 'Chuyên gia chọc khe biên. Di chuyển trượt chéo xa không giới hạn, sút xoáy chéo xé toang hàng phòng ngự đối phương.',
    moveRule: {
      type: 'slide',
      vectors: DIAGONAL_VECTORS,
    },
    kickRule: {
      type: 'slide',
      vectors: DIAGONAL_VECTORS,
      power: 4,
    },
    hasMasterBallControl: true,
    specialAbilityDesc: 'Khống Chế Thượng Thừa: Di chuyển vào ô có bóng để nhận bóng sẽ KHÔNG MẤT LƯỢT!',
  },

  // 5. KNIGHT (Tiền Đạo Lốp Bóng / Mã)
  {
    id: 'knight',
    name: 'Knight',
    vietnameseName: 'Tiền Đạo Lốp Bóng (Mã)',
    role: 'FWD',
    cost: 25,
    symbol: '♘',
    description: 'Sát thủ lốp bóng vòng cấm. Nhảy chữ L vượt qua mọi vật cản. Sở hữu kỹ năng đặc biệt [SIÊU PHẨM LỐP BÓNG]: Sút bóng bổng hình vòm tới bất kỳ ô nào trong bán kính 3 ô mọi hướng!',
    moveRule: {
      type: 'leap',
      vectors: KNIGHT_VECTORS,
    },
    kickRule: {
      type: 'leap',
      vectors: KNIGHT_CHIP_SHOT_VECTORS,
      isLob: true,
      power: 4,
    },
    specialAbilityDesc: 'Siêu Phẩm Lốp Bóng: Sút bóng bổng hình vòm vượt qua đầu mọi vật cản tới bất kỳ vị trí nào trong bán kính 3 ô!',
  },

  // 6. PAWN (Hậu Vệ Trẻ / Tốt)
  {
    id: 'pawn',
    name: 'Pawn',
    vietnameseName: 'Cầu Thủ Trẻ (Tốt)',
    role: 'DEF',
    cost: 5,
    symbol: '♙',
    description: 'Chuyên gia phòng ngự khu vực. Sở hữu kỹ năng [ĐÁNH CHẶN BẮT BÀI]: Đối thủ nhận bóng ở 4 hướng xung quanh sẽ bị Tốt cướp bóng, đẩy lùi, làm choáng và mất lượt ngay lập tức! Khi sang sân khách kích hoạt thêm [BỨT PHÁ TRẺ].',
    moveRule: {
      type: 'step',
      vectors: ALL_8_VECTORS.map((v) => ({ ...v, maxRange: 1 })),
    },
    kickRule: {
      type: 'step',
      vectors: ALL_8_VECTORS.map((v) => ({ ...v, maxRange: 2 })),
      power: 2,
    },
    hasPawnRush: true,
    hasInterception: true,
    specialAbilityDesc: 'Đánh Chặn 4 Hướng: Cướp bóng + làm choáng + cướp lượt khi đối phương nhận bóng bên cạnh! Khi sang sân khách: Sút xa 3 ô & tiến 2 ô!',
  },

  // --- QUÂN CỜ MỞ RỘNG (CUSTOM / EXPANSION PIECES) ---

  // 7. CANNON (Pháo Thủ - Cờ Tướng)
  {
    id: 'cannon',
    name: 'Cannon',
    vietnameseName: 'Pháo Thủ (Cờ Tướng)',
    role: 'MID',
    cost: 25,
    symbol: '💣',
    description: 'Nghệ thuật Cờ Tướng: Di chuyển thẳng trượt xa không giới hạn. Sút bóng: CẦN 1 CẦU THỦ LÀM NGÒI để nã đại bác bay qua đầu sang ô phía sau!',
    moveRule: {
      type: 'slide',
      vectors: ORTHOGONAL_VECTORS,
    },
    kickRule: {
      type: 'cannon',
      vectors: ORTHOGONAL_VECTORS,
      isLob: true,
      power: 5,
    },
    specialAbilityDesc: 'Bắn Qua Ngòi: Cần đúng 1 quân làm ngòi nổ để bắn bóng vượt qua đầu!',
  },
];

// Initialize registry
INITIAL_PIECES.forEach((p) => {
  PIECE_REGISTRY[p.id] = p;
});

export function getPieceDefinition(typeId: string): PieceDefinition {
  return PIECE_REGISTRY[typeId] || PIECE_REGISTRY['pawn'];
}

export function getAllPieces(): PieceDefinition[] {
  return Object.values(PIECE_REGISTRY);
}

export function registerPiece(piece: PieceDefinition): boolean {
  if (!piece.id || !piece.name) return false;
  PIECE_REGISTRY[piece.id] = piece;
  return true;
}

// Default 4-4-2 standard lineup
export const DEFAULT_WHITE_ROSTER: TeamRoster = {
  teamName: 'Đội Trắng (White Royals)',
  pieces: [
    'king',   // 0: GK
    'pawn',   // 1: LB
    'pawn',   // 2: CB
    'pawn',   // 3: CB
    'pawn',   // 4: RB
    'rook',   // 5: LM
    'bishop', // 6: CM
    'bishop', // 7: CM
    'rook',   // 8: RM
    'knight', // 9: ST
    'queen',  // 10: ST
  ],
};

export const DEFAULT_BLACK_ROSTER: TeamRoster = {
  teamName: 'Đội Đỏ Đen (Red Strikers)',
  pieces: [
    'king',   // 0: GK
    'pawn',   // 1: LB
    'pawn',   // 2: CB
    'pawn',   // 3: CB
    'pawn',   // 4: RB
    'cannon', // 5: LM (Special Cannon!)
    'bishop', // 6: CM
    'bishop', // 7: CM
    'rook',   // 8: RM
    'knight', // 9: ST (Replaced Ninja with Knight)
    'queen',  // 10: ST
  ],
};
