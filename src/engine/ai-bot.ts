import {
  BoardState,
  PieceInstance,
  Position,
  TeamColor,
  AIDifficulty,
} from './types';
import { getPieceDefinition } from './piece-registry';
import {
  calculateValidMoves,
  calculateValidKicks,
  hasBall,
  isGoalCell,
  getPieceAt,
} from './engine';

export interface AIMoveDecision {
  action: 'move' | 'kick';
  pieceId: string;
  target: Position;
  score: number;
  reason: string;
}

const ORTHOGONAL_4 = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
];

/**
 * Calculates the best move or kick for the AI Bot.
 */
export function getBestAIMove(
  board: BoardState,
  botTeam: TeamColor = 'black',
  difficulty: AIDifficulty = 'normal'
): AIMoveDecision | null {
  if (board.winner || board.currentTurn !== botTeam) return null;

  const myPieces = board.pieces.filter(
    (p) => p.team === botTeam && !p.isStunned
  );

  if (myPieces.length === 0) return null;

  const targetGoalY = botTeam === 'white' ? 0 : 14;
  const ownGoalY = botTeam === 'white' ? 14 : 0;
  const candidates: AIMoveDecision[] = [];

  // 1. Gather all candidates for all active pieces
  for (const piece of myPieces) {
    const def = getPieceDefinition(piece.typeId);
    const holdsBall = hasBall(piece, board.ballPosition);

    if (holdsBall) {
      // Piece holds ball -> Explore all valid Kicks / Passes
      const validKicks = calculateValidKicks(board, piece.id);

      for (const target of validKicks) {
        let score = 0;
        let reason = 'Chuyền/Sút bóng chiến thuật';

        // 1.1 SÚT VÀO GÔN (Ghi bàn thắng)
        if (isGoalCell(target.x, target.y, botTeam)) {
          score += 100000;
          reason = '🎯 Sút tung lưới ghi bàn!';
        } else {
          const receiver = getPieceAt(board.pieces, target.x, target.y);

          if (receiver && receiver.team === botTeam) {
            // 1.2 Chuyền cho đồng đội
            // Check danger: Có bị Tốt đối phương kèm ở 4 hướng xung quanh không?
            let isGuardedByPawn = false;
            for (const dir of ORTHOGONAL_4) {
              const adjPiece = getPieceAt(board.pieces, target.x + dir.dx, target.y + dir.dy);
              if (
                adjPiece &&
                adjPiece.team !== botTeam &&
                !adjPiece.isStunned
              ) {
                const adjDef = getPieceDefinition(adjPiece.typeId);
                if (adjDef.hasInterception || adjPiece.typeId === 'pawn') {
                  isGuardedByPawn = true;
                  break;
                }
              }
            }

            if (isGuardedByPawn) {
              // Bẫy Đánh Chặn của Tốt đối phương! Phạt điểm rất nặng để né
              score -= 15000;
              reason = '⚠️ Nguy hiểm! Bị Tốt đối phương kèm 4 hướng (Né bắt bài)';
            } else {
              // Chuyền an toàn
              score += 2000;
              reason = `👑 Chuyền bóng an toàn cho ${getPieceDefinition(receiver.typeId).vietnameseName}`;

              // Ưu tiên chuyền cho Hậu (được reset 2 AP nhờ Hào Quang Nhạc Trưởng)
              if (receiver.typeId === 'queen' || def.hasPlaymakerAura) {
                score += 1200;
                reason = '🌟 Chuyền bóng cho Hậu (Kích hoạt Hào Quang Nhạc Trưởng 2 AP)';
              }

              // Ưu tiên chuyền cho Tiền đạo ở tuyến trên
              if (receiver.typeId === 'cannon' || receiver.typeId === 'knight') {
                score += 600;
              }

              // Tiến bóng lại gần khung thành đối phương
              const distToOpponentGoal = Math.abs(target.y - targetGoalY);
              score += (14 - distToOpponentGoal) * 60;
            }
          } else if (receiver && receiver.team !== botTeam) {
            // Chuyền thẳng vào chân đối thủ -> Rất tệ!
            score -= 20000;
            reason = '🛑 Tránh chuyền thẳng vào chân đối thủ';
          } else {
            // Sút bóng vào khoảng trống / Tạt cánh
            const distToOpponentGoal = Math.abs(target.y - targetGoalY);
            score += (14 - distToOpponentGoal) * 40;
            reason = '🏃 Tạt bóng / Phất bóng vào khoảng trống phía trên';
          }
        }

        candidates.push({
          action: 'kick',
          pieceId: piece.id,
          target,
          score,
          reason,
        });
      }
    } else {
      // Piece does not hold ball -> Explore all valid Moves
      const validMoves = calculateValidMoves(board, piece.id);

      for (const target of validMoves) {
        let score = 0;
        let reason = 'Di chuyển chiến thuật';
        const occupant = getPieceAt(board.pieces, target.x, target.y);

        // 2.1 Tắc bóng đối phương đang giữ bóng
        if (
          occupant &&
          occupant.team !== botTeam &&
          hasBall(occupant, board.ballPosition)
        ) {
          score += 9000;
          reason = `⚔️ Lao vào tắc bóng cướp quyền kiểm soát của ${getPieceDefinition(occupant.typeId).vietnameseName}!`;

          // Nếu là Xe (Bulldozer) húc ngã không mất AP
          if (def.hasBulldozer || piece.typeId === 'rook') {
            score += 1500;
            reason = '🚜 Dùng Xe húc văng cướp bóng không mất lượt!';
          }
        }
        // 2.2 Chạy tới nhặt bóng tự do
        else if (
          target.x === board.ballPosition.x &&
          target.y === board.ballPosition.y
        ) {
          score += 6000;
          reason = '⚡ Lao tới thu hồi bóng tự do!';

          // Nếu là Tượng (Bishop) khống chế bóng 0 AP
          if (def.hasMasterBallControl || piece.typeId === 'bishop') {
            score += 2500;
            reason = '♗ Dùng Tượng thu hồi bóng (Khống Chế Thượng Thừa 0 AP)!';
          }
        }
        // 2.3 Di chuyển không bóng (Chạy chỗ / Đánh chặn / Phòng ngự)
        else {
          const distToBall = Math.hypot(
            target.x - board.ballPosition.x,
            target.y - board.ballPosition.y
          );
          score += Math.max(0, (16 - distToBall) * 25);

          // Hậu vệ / Thủ môn: Giữ cự ly bảo vệ khung thành
          if (def.role === 'GK' || def.role === 'DEF') {
            const distToOwnGoal = Math.abs(target.y - ownGoalY);
            if (distToOwnGoal <= 4 && Math.abs(target.x - 5) <= 3) {
              score += 400;
              reason = '🛡️ Lùi sâu be góc bảo vệ khung thành nhà';
            }
          }

          // Tiền đạo / Tiền vệ: Dâng cao đón bóng
          if (def.role === 'FWD' || def.role === 'MID') {
            const distToOppGoal = Math.abs(target.y - targetGoalY);
            score += (14 - distToOppGoal) * 30;
            reason = '🏃 Dâng cao chiếm lĩnh vị trí thuận lợi';
          }
        }

        candidates.push({
          action: 'move',
          pieceId: piece.id,
          target,
          score,
          reason,
        });
      }
    }
  }

  if (candidates.length === 0) return null;

  // Sort candidates by score descending
  candidates.sort((a, b) => b.score - a.score);

  // 3. Select decision based on difficulty level
  if (difficulty === 'hard') {
    // Hard Mode: Always pick top 1 optimal move
    return candidates[0];
  } else if (difficulty === 'easy') {
    // Easy Mode: 35% pick random valid move to allow human player comebacks
    if (Math.random() < 0.35) {
      const randomIndex = Math.floor(Math.random() * candidates.length);
      return candidates[randomIndex];
    }
    // Otherwise pick from top 4
    const pool = candidates.slice(0, Math.min(4, candidates.length));
    return pool[Math.floor(Math.random() * pool.length)];
  } else {
    // Normal Mode: Pick among top 2 moves (90% top 1, 10% top 2)
    if (candidates.length > 1 && Math.random() < 0.15) {
      return candidates[1];
    }
    return candidates[0];
  }
}
