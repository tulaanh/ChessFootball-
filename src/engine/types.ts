export type TeamColor = 'white' | 'black';

export type PieceRole = 'GK' | 'DEF' | 'MID' | 'FWD';

export type PrimitiveType = 'step' | 'slide' | 'leap' | 'cannon';

export interface VectorRule {
  dx: number;
  dy: number;
  maxRange?: number; // default infinity for slide, 1 for step/leap
}

export interface PieceDefinition {
  id: string;
  name: string;
  vietnameseName: string;
  role: PieceRole;
  cost: number;
  symbol: string; // e.g. ♔, ♕, ♖, ♗, ♘, ♙, 💣, 🥷, 🏹, ⭐
  description: string;
  moveRule: {
    type: PrimitiveType;
    vectors: VectorRule[];
  };
  kickRule: {
    type: PrimitiveType;
    vectors: VectorRule[];
    isLob?: boolean; // Can jump over blocking pieces (like Knight/L-shape)
    power?: number; // visual power rating 1-5
  };
  hasBulldozer?: boolean; // Skill: Sự Trâu Bò (khi cầm bóng đâm vào quân đối phương sẽ không mất lượt)
  hasMasterBallControl?: boolean; // Skill: Khống Chế Thượng Thừa (di chuyển nhận bóng không mất lượt)
  specialAbilityDesc?: string;
}

export interface Position {
  x: number; // 0 to 8 (9 columns)
  y: number; // 0 to 12 (13 rows)
}

export interface PieceInstance {
  id: string;
  typeId: string;
  team: TeamColor;
  position: Position;
  isStunned?: boolean; // Stunned for 1 turn after being tackled
  abilityCooldown?: number; // Cooldown turns for special skills (e.g., Sự Trâu Bò)
  formationIndex: number; // 0 to 10
}

export interface MatchScore {
  white: number;
  black: number;
}

export interface CommentaryLog {
  id: string;
  text: string;
  team?: TeamColor;
  type: 'move' | 'pass' | 'shoot' | 'tackle' | 'goal' | 'whistle' | 'system';
  timestamp: string;
}

export interface TeamRoster {
  teamName: string;
  pieces: string[]; // 11 typeIds
}

export interface BoardState {
  width: number; // 11
  height: number; // 15
  pieces: PieceInstance[];
  ballPosition: Position;
  currentTurn: TeamColor;
  remainingAP: number; // Max 2 per turn
  score: MatchScore;
  targetScore: number; // e.g. 2 or 3 goals
  turnNumber: number;
  selectedPieceId: string | null;
  activeAction: 'move' | 'kick' | null;
  winner: TeamColor | null;
  lastGoalScorer?: { team: TeamColor; pieceName: string };
  savedFormation?: PieceInstance[];
  commentary: CommentaryLog[];
  whiteRoster: TeamRoster;
  blackRoster: TeamRoster;
  phase: 'setup' | 'playing' | 'ended';
}
