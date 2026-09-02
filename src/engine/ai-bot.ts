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
  executeMove,
  executeKick,
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
 * Checks if a point lies on the direct shooting lane between ball and goal center.
 */
function isBetweenBallAndGoal(x: number, y: number, ballPos: Position, goalY: number): boolean {
  const minX = Math.min(ballPos.x, 5);
  const maxX = Math.max(ballPos.x, 5);
  const minY = Math.min(ballPos.y, goalY);
  const maxY = Math.max(ballPos.y, goalY);

  return x >= minX - 1 && x <= maxX + 1 && y >= minY && y <= maxY;
}

/**
 * Calculates the best move or kick for the AI Bot with tactical defense & offense.
 */
export function getBestAIMove(
  board: BoardState,
  botTeam: TeamColor = 'black',
  difficulty: AIDifficulty = 'normal'
): AIMoveDecision | null {
  if (board.winner || board.currentTurn !== botTeam) return null;

  const myPieces = board.pieces.filter((p) => p.team === botTeam && !p.isStunned);
  const enemyPieces = board.pieces.filter((p) => p.team !== botTeam && !p.isStunned);

  if (myPieces.length === 0) return null;

  const targetGoalY = botTeam === 'white' ? 0 : 14;
  const ownGoalY = botTeam === 'white' ? 14 : 0;
  const enemyCarrier = enemyPieces.find((p) => hasBall(p, board.ballPosition));
  const humanHasBall = Boolean(enemyCarrier);
  const isLooseBall = !board.pieces.some((p) => hasBall(p, board.ballPosition));

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

        // 1.1 SÚT VÀO GÔN (Ghi bàn thắng - Ưu tiên tuyệt đối)
        if (isGoalCell(target.x, target.y, botTeam)) {
          score += 200000;
          reason = '🎯 Sút tung nóc lưới ghi bàn thắng!';
        } else {
          const receiver = getPieceAt(board.pieces, target.x, target.y);

          if (receiver && receiver.team === botTeam) {
            // 1.2 Chuyền cho đồng đội
            // Check danger: Có bị Tốt đối phương kèm ở 4 hướng xung quanh không?
            let isGuardedByPawn = false;
            for (const dir of ORTHOGONAL_4) {
              const adjPiece = getPieceAt(board.pieces, target.x + dir.dx, target.y + dir.dy);
              if (adjPiece && adjPiece.team !== botTeam && !adjPiece.isStunned) {
                const adjDef = getPieceDefinition(adjPiece.typeId);
                if (adjDef.hasInterception || adjPiece.typeId === 'pawn') {
                  isGuardedByPawn = true;
                  break;
                }
              }
            }

            if (isGuardedByPawn) {
              // Bẫy Đánh Chặn của Tốt đối phương! Phạt điểm cực nặng để né
              score -= 50000;
              reason = '⚠️ Nguy hiểm! Bị Tốt đối phương kèm 4 hướng (Né bẫy bắt bài)';
            } else {
              // Chuyền an toàn
              score += 3500;
              reason = `👑 Chuyền bóng an toàn cho ${getPieceDefinition(receiver.typeId).vietnameseName}`;

              // Ưu tiên chuyền cho Hậu (NẾU Hậu chưa dùng Hào quang trong lượt này)
              if (
                (receiver.typeId === 'queen' || def.hasPlaymakerAura) &&
                (!receiver.abilityCooldown || receiver.abilityCooldown <= 0)
              ) {
                score += 8000;
                reason = '🌟 Chuyền bóng cho Hậu (Kích hoạt Hào Quang Nhạc Trưởng hồi 2 AP)';
              }

              // Ưu tiên chuyền cho Tiền đạo / Pháo / Mã ở tuyến trên
              if (receiver.typeId === 'cannon' || receiver.typeId === 'knight') {
                score += 3000;
              }

              // Phát bóng bổng của Thủ Môn (Vua) lên cho Tiền đạo cao nhất
              if (piece.typeId === 'king' || def.role === 'GK') {
                score += 4500;
                reason = '🧤 Thủ môn phất bóng bổng dài phát động tấn công!';
              }

              // Tiến bóng lại gần khung thành đối phương
              const currentDist = Math.abs(piece.position.y - targetGoalY);
              const newDist = Math.abs(target.y - targetGoalY);
              if (newDist < currentDist) {
                score += (currentDist - newDist) * 300; // Thưởng điểm đậm khi chuyền tiến lên
              } else if (newDist > currentDist) {
                score -= 1000; // Phạt điểm nếu chuyền lùi về sân nhà
              }
            }
          } else if (receiver && receiver.team !== botTeam) {
            // Chuyền thẳng vào chân đối thủ -> Cực tệ!
            score -= 60000;
            reason = '🛑 Tránh chuyền thẳng vào chân đối thủ';
          } else {
            // Sút bóng vào khoảng trống / Tạt cánh / Sút xa uy hiếp khung thành
            const distToOpponentGoal = Math.abs(target.y - targetGoalY);
            score += (14 - distToOpponentGoal) * 120;

            if (distToOpponentGoal <= 4) {
              score += 5000;
              reason = '🚀 Tung cú dứt điểm hiểm hóc về phía góc khung thành!';
            } else {
              reason = '🏃 Tạt bóng / Phất bóng vào khoảng trống phía trên';
            }
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

        // ==========================================
        // 2.1 TẮC BÓNG ĐỐI PHƯƠNG ĐANG GIỮ BÓNG
        // ==========================================
        if (
          occupant &&
          occupant.team !== botTeam &&
          hasBall(occupant, board.ballPosition)
        ) {
          score += 35000;
          reason = `⚔️ Lao vào tắc bóng cướp quyền kiểm soát của ${getPieceDefinition(occupant.typeId).vietnameseName}!`;

          // Nếu là Xe (Bulldozer) húc ngã không mất AP
          if (def.hasBulldozer || piece.typeId === 'rook') {
            score += 15000;
            reason = '🚜 Dùng Xe húc văng cướp bóng không mất lượt!';
          }
        }
        // ==========================================
        // 2.2 CHẠY TỚI NHẶT BÓNG TỰ DO
        // ==========================================
        else if (
          target.x === board.ballPosition.x &&
          target.y === board.ballPosition.y
        ) {
          score += 25000;
          reason = '⚡ Lao tới thu hồi bóng tự do!';

          // Nếu là Tượng (Bishop) khống chế bóng 0 AP
          if (def.hasMasterBallControl || piece.typeId === 'bishop') {
            score += 12000;
            reason = '♗ Dùng Tượng thu hồi bóng (Khống Chế Thượng Thừa 0 AP)!';
          }
        }
        // ==========================================
        // 2.3 PHÒNG NGỰ CHIẾN THUẬT KHI ĐỐI PHƯƠNG CẦM BÓNG
        // ==========================================
        else if (humanHasBall && enemyCarrier) {
          // A. BẪY ĐÁNH CHẶN CỦA TỐT (Pawn Zone Interception Trap):
          // Nếu quân này là Tốt (hoặc có hasInterception), điều Tốt tới đứng sát 4 hướng quanh tiền đạo/Hậu đối phương!
          if (def.hasInterception || piece.typeId === 'pawn') {
            const dangerReceivers = enemyPieces.filter((p) => p.id !== enemyCarrier.id);
            for (const dangerPiece of dangerReceivers) {
              const distToDanger = Math.hypot(target.x - dangerPiece.position.x, target.y - dangerPiece.position.y);
              if (distToDanger === 1) {
                // Đứng sát 4 hướng cạnh tiền đạo đối phương
                score += 12000;
                reason = `🛡️⚡ Tốt di chuyển lập [BẪY ĐÁNH CHẶN] khóa chặt ${getPieceDefinition(dangerPiece.typeId).vietnameseName}!`;
                break;
              }
            }
          }

          // B. BE GÓC SÚT KHUNG THÀNH (Block Shooting Lane):
          // Di chuyển vào đường thẳng giữa Người Cầm Bóng và Khung Thành Nhà
          if (isBetweenBallAndGoal(target.x, target.y, board.ballPosition, ownGoalY)) {
            score += 7000;
            reason = '🧱 Di chuyển bịt kín góc sút bảo vệ khung thành nhà!';
          }

          // C. ÁP SÁT ÁP ĐẢO NGƯỜI CẦM BÓNG (Pressure the ball carrier):
          const distToCarrier = Math.hypot(target.x - enemyCarrier.position.x, target.y - enemyCarrier.position.y);
          if (distToCarrier <= 2) {
            score += (4 - distToCarrier) * 2000;
            reason = '🏃 Áp sát tranh cướp bóng đối thủ!';
          }

          // D. THỦ MÔN KHÉP GÓC (GK Positioning):
          if (def.role === 'GK' || piece.typeId === 'king') {
            // Thủ môn luôn di chuyển theo trục ngang của bóng ở vạch cầu môn
            if (target.y === ownGoalY && target.x >= 4 && target.x <= 6) {
              const diffX = Math.abs(target.x - board.ballPosition.x);
              score += (5 - diffX) * 3000;
              reason = '🧤 Thủ Môn di chuyển khép góc sút tại vạch cầu môn!';
            }
          }

          // E. HẬU VỆ LÙI SÂU TRƯỚC VÙNG CẤM ĐỊA (Zone Defense):
          if (def.role === 'DEF') {
            const distToOwnGoal = Math.abs(target.y - ownGoalY);
            if (distToOwnGoal <= 4 && Math.abs(target.x - 5) <= 3) {
              score += 4500;
              reason = '🛡️ Hậu vệ lùi sâu tạo bức tường thép trước vùng cấm địa';
            }
          }
        }
        // ==========================================
        // 2.4 CHẠY CHỖ TẤN CÔNG KHI BÓNG TỰ DO HOẶC BOT ĐANG CẦM BÓNG
        // ==========================================
        else {
          const distToBall = Math.hypot(
            target.x - board.ballPosition.x,
            target.y - board.ballPosition.y
          );
          score += Math.max(0, (16 - distToBall) * 120);

          // Tiền đạo / Tiền vệ: Dâng cao chiếm lĩnh khoảng trống
          if (def.role === 'FWD' || def.role === 'MID') {
            const distToOppGoal = Math.abs(target.y - targetGoalY);
            score += (14 - distToOppGoal) * 150;
            reason = '🏃 Tiền đạo dâng cao chạy chỗ đón đường chuyền';
          }

          // Tốt dâng sang nửa sân đối phương để kích hoạt Bứt Phá Trẻ
          if (piece.typeId === 'pawn') {
            const isInOpponentHalf = botTeam === 'black' ? target.y >= 8 : target.y <= 6;
            if (isInOpponentHalf) {
              score += 2500;
              reason = '⚡ Tốt dâng sang sân đối phương kích hoạt [BỨT PHÁ TRẺ]!';
            }
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

  // =========================================================================
  // 3. 2-STEP LOOKAHEAD COMBO PLANNER (TÍNH TOÁN CHUỖI 2 NHỊP THÔNG MINH)
  // =========================================================================
  if (board.remainingAP === 2 && difficulty === 'hard') {
    for (const cand of candidates.slice(0, Math.min(10, candidates.length))) {
      try {
        let simBoard: BoardState;
        if (cand.action === 'move') {
          simBoard = executeMove(board, cand.pieceId, cand.target.x, cand.target.y);
        } else {
          simBoard = executeKick(board, cand.pieceId, cand.target.x, cand.target.y);
        }

        // Nếu sau nhịp 1 vẫn là lượt của Bot và còn AP:
        if (simBoard.currentTurn === botTeam && !simBoard.winner && simBoard.remainingAP > 0) {
          // Tìm hành động nhịp 2 tốt nhất
          const followUpPieces = simBoard.pieces.filter((p) => p.team === botTeam && !p.isStunned);
          for (const followPiece of followUpPieces) {
            if (hasBall(followPiece, simBoard.ballPosition)) {
              const followKicks = calculateValidKicks(simBoard, followPiece.id);
              for (const fk of followKicks) {
                if (isGoalCell(fk.x, fk.y, botTeam)) {
                  cand.score += 80000; // Nhịp 1 tạo tiền đề để Nhịp 2 sút ghi bàn!
                  cand.reason = `🔥 [Combo 2 Nhịp]: ${cand.reason} ➔ Dọn cỗ để sút tung lưới!`;
                  break;
                }
              }
            }
          }
        }
      } catch (err) {
        // Ignore simulation edge cases
      }
    }
  }

  // Sort candidates by score descending
  candidates.sort((a, b) => b.score - a.score);

  // 4. Select decision based on difficulty level
  if (difficulty === 'hard') {
    // Hard Mode: Always pick top 1 optimal tactical move
    return candidates[0];
  } else if (difficulty === 'easy') {
    // Easy Mode: 35% pick random valid move to allow human player comebacks
    if (Math.random() < 0.35) {
      const randomIndex = Math.floor(Math.random() * candidates.length);
      return candidates[randomIndex];
    }
    const pool = candidates.slice(0, Math.min(4, candidates.length));
    return pool[Math.floor(Math.random() * pool.length)];
  } else {
    // Normal Mode: 85% pick top 1, 15% pick top 2
    if (candidates.length > 1 && Math.random() < 0.15) {
      return candidates[1];
    }
    return candidates[0];
  }
}
