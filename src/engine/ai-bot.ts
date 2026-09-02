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
 * Checks if a position is on the direct shooting corridor between ball and goal line.
 */
function isBlockingShootingLane(x: number, y: number, ballPos: Position, goalY: number): boolean {
  const minX = Math.min(ballPos.x, 5) - 1;
  const maxX = Math.max(ballPos.x, 5) + 1;
  const minY = Math.min(ballPos.y, goalY);
  const maxY = Math.max(ballPos.y, goalY);

  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

/**
 * Checks if an opponent Pawn is adjacent (4 directions) to a target position.
 */
function isPositionGuardedByEnemyPawn(board: BoardState, target: Position, botTeam: TeamColor): boolean {
  for (const dir of ORTHOGONAL_4) {
    const adjX = target.x + dir.dx;
    const adjY = target.y + dir.dy;
    const adjPiece = getPieceAt(board.pieces, adjX, adjY);
    if (adjPiece && adjPiece.team !== botTeam && !adjPiece.isStunned) {
      const adjDef = getPieceDefinition(adjPiece.typeId);
      if (adjDef.hasInterception || adjPiece.typeId === 'pawn') {
        return true;
      }
    }
  }
  return false;
}

/**
 * Grandmaster AI Decision Engine for Chess Football.
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
  const isBallLoose = !board.pieces.some((p) => hasBall(p, board.ballPosition));

  // Find piece closest to the loose ball
  let closestPieceId: string | null = null;
  let minDistanceToBall = Infinity;
  if (isBallLoose) {
    for (const p of myPieces) {
      if (p.typeId === 'king') continue; // GK does not leave goal to chase distant loose ball
      const d = Math.hypot(p.position.x - board.ballPosition.x, p.position.y - board.ballPosition.y);
      if (d < minDistanceToBall) {
        minDistanceToBall = d;
        closestPieceId = p.id;
      }
    }
  }

  const candidates: AIMoveDecision[] = [];

  // 1. Evaluate all active Bot pieces
  for (const piece of myPieces) {
    const def = getPieceDefinition(piece.typeId);
    const holdsBall = hasBall(piece, board.ballPosition);

    if (holdsBall) {
      // =======================================================================
      // A. BOT PIECE HOLDS THE BALL -> EXPLORE KICKS / PASSES / SHOTS
      // =======================================================================
      const validKicks = calculateValidKicks(board, piece.id);

      for (const target of validKicks) {
        let score = 0;
        let reason = 'Chuyền/Sút bóng chiến thuật';

        // 1.1 SÚT TRỰC TIẾP VÀO GÔN (Ghi bàn thắng - Ưu tiên tối thượng)
        if (isGoalCell(target.x, target.y, botTeam)) {
          score += 500000;
          if (piece.typeId === 'cannon') {
            reason = '💣 Pháo Thủ nã đại bác xuyên ngòi nổ tung lưới đối phương!';
          } else if (piece.typeId === 'knight') {
            reason = '♘ Mã tung siêu phẩm lốp bóng vượt qua đầu thủ môn vào góc chữ A!';
          } else {
            reason = '🎯 Sút tung nóc lưới ghi bàn thắng!';
          }
        } else {
          const receiver = getPieceAt(board.pieces, target.x, target.y);

          if (receiver && receiver.team === botTeam) {
            // 1.2 CHUYỀN CHO ĐỒNG ĐỘI
            const isGuardedByPawn = isPositionGuardedByEnemyPawn(board, target, botTeam);

            if (isGuardedByPawn) {
              // Bẫy Đánh Chặn của Tốt đối phương! Phạt điểm cực nặng để tuyệt đối né bẫy
              score -= 200000;
              reason = '⚠️ Cực nguy hiểm! Tốt đối phương đang giăng bẫy bắt bài (Né chuyền)';
            } else {
              score += 6000;
              reason = `👑 Chuyền bóng chuẩn xác cho ${getPieceDefinition(receiver.typeId).vietnameseName}`;

              // Ưu tiên chuyền cho Hậu (NẾU Hậu chưa dùng Hào quang trong lượt này)
              if (receiver.typeId === 'queen' || def.hasPlaymakerAura) {
                if (!receiver.abilityCooldown || receiver.abilityCooldown <= 0) {
                  score += 45000;
                  reason = '🌟 Chuyền bóng cho Hậu (Kích hoạt Hào Quang Nhạc Trưởng hồi 2 AP)!';
                } else {
                  // Hậu đã dùng Hào quang trong lượt này -> Phạt điểm để tránh lặp vô tận
                  score -= 40000;
                  reason = '🛑 Tránh chuyền ngược lại cho Hậu đã dùng Hào Quang';
                }
              }

              // Ưu tiên chuyền dọn cỗ cho Tiền Đạo (Pháo / Mã) ở tuyến trên
              if (receiver.typeId === 'cannon' || receiver.typeId === 'knight') {
                score += 35000;
                reason = `🎯 Chọc khe dọn cỗ cho ${getPieceDefinition(receiver.typeId).vietnameseName} dứt điểm!`;
              }

              // Thủ môn phát bóng bổng dài toàn sân cho tiền đạo cao nhất
              if (piece.typeId === 'king' || def.role === 'GK') {
                const distToEnemyGoal = Math.abs(target.y - targetGoalY);
                score += (14 - distToEnemyGoal) * 3000;
                reason = '🧤 Thủ Môn phất bóng bổng dài toàn sân phát động tấn công chớp nhoáng!';
              }

              // Thưởng điểm đậm khi đưa bóng tiến gần về phía khung thành đối phương
              const currentDist = Math.abs(piece.position.y - targetGoalY);
              const newDist = Math.abs(target.y - targetGoalY);
              if (newDist < currentDist) {
                score += (currentDist - newDist) * 1500;
              } else if (newDist > currentDist) {
                score -= 5000; // Phạt điểm nếu chuyền lùi về sân nhà không cần thiết
              }
            }
          } else if (receiver && receiver.team !== botTeam) {
            // Chuyền thẳng vào chân đối thủ -> Cực tệ!
            score -= 300000;
            reason = '🛑 Tuyệt đối không chuyền vào chân đối thủ';
          } else {
            // 1.3 SÚT BÓNG VÀO KHOẢNG TRỐNG / TẠT CÁNH / SÚT UY HIẾP
            const distToEnemyGoal = Math.abs(target.y - targetGoalY);
            const distToCenter = Math.abs(target.x - 5);

            if (distToEnemyGoal <= 3) {
              score += 25000 - distToCenter * 2000;
              reason = '🚀 Tung cú đại bác uy hiếp góc khung thành đối phương!';
            } else {
              score += (14 - distToEnemyGoal) * 800;
              reason = '🏃 Phất bóng chiến thuật vào khoảng trống phía trên';
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
      // =======================================================================
      // B. BOT PIECE DOES NOT HOLD BALL -> EXPLORE TACTICAL MOVES
      // =======================================================================
      const validMoves = calculateValidMoves(board, piece.id);

      for (const target of validMoves) {
        let score = 0;
        let reason = 'Di chuyển chiến thuật';
        const occupant = getPieceAt(board.pieces, target.x, target.y);

        // -------------------------------------------------------------------
        // 2.1 THỦ MÔN (KING GK) - KỶ LUẬT VỊ TRÍ TUYỆT ĐỐI
        // -------------------------------------------------------------------
        if (piece.typeId === 'king' || def.role === 'GK') {
          const isInsideGoalArea = target.y === (botTeam === 'black' ? 1 : 13) && target.x >= 4 && target.x <= 6;
          const isAtGoalCenter = target.y === (botTeam === 'black' ? 1 : 13) && target.x === 5;
          const isBallIn6YardBox = Math.abs(board.ballPosition.y - ownGoalY) <= 2 && Math.abs(board.ballPosition.x - 5) <= 2;

          if (isBallIn6YardBox && target.x === board.ballPosition.x && target.y === board.ballPosition.y) {
            // Bóng lăn vào sát vạch cầu môn -> Thủ môn lao ra ôm bóng cứu thua!
            score += 80000;
            reason = '🧤 Thủ Môn xuất tướng ôm gọn bóng cứu thua trước vạch vôi!';
          } else if (isAtGoalCenter) {
            score += 25000;
            reason = '🧤 Thủ Môn đứng vững tâm khung thành chỉ huy hàng thủ!';
          } else if (isInsideGoalArea) {
            const diffX = Math.abs(target.x - board.ballPosition.x);
            score += 20000 - diffX * 2000;
            reason = '🧤 Thủ Môn di chuyển khép góc sút tại vạch cầu môn!';
          } else {
            // Thủ môn bỏ gôn chạy ra ngoài sân -> Phạt điểm cực nặng!
            score -= 150000;
            reason = '⚠️ Thủ môn không được phép bỏ trống khung thành!';
          }

          candidates.push({ action: 'move', pieceId: piece.id, target, score, reason });
          continue;
        }

        // -------------------------------------------------------------------
        // 2.2 TẮC BÓNG TRỰC DIỆN NGƯỜI CẦM BÓNG
        // -------------------------------------------------------------------
        if (occupant && occupant.team !== botTeam && hasBall(occupant, board.ballPosition)) {
          score += 100000;
          reason = `⚔️ Lao vào tắc bóng cướp quyền kiểm soát của ${getPieceDefinition(occupant.typeId).vietnameseName}!`;

          // Xe (Bulldozer) húc cướp bóng không mất AP -> Ưu tiên số 1
          if (def.hasBulldozer || piece.typeId === 'rook') {
            score += 40000;
            reason = '🚜 Dùng Xe Húc Văng đối thủ cướp bóng không mất lượt!';
          }
        }
        // -------------------------------------------------------------------
        // 2.3 THU HỒI BÓNG TỰ DO
        // -------------------------------------------------------------------
        else if (target.x === board.ballPosition.x && target.y === board.ballPosition.y) {
          // Chỉ quân gần nhất hoặc Tượng mới được ưu tiên cao nhất
          const isClosest = piece.id === closestPieceId;
          const isBishop = def.hasMasterBallControl || piece.typeId === 'bishop';

          if (isBishop) {
            score += 90000;
            reason = '♗ Dùng Tượng thu hồi bóng (Khống Chế Thượng Thừa 0 AP)!';
          } else if (isClosest) {
            score += 70000;
            reason = '⚡ Cầu thủ gần nhất bứt tốc thu hồi bóng tự do!';
          } else {
            score += 20000; // Các quân khác không dẫm chân lên nhau
            reason = '🏃 Tiếp cận bóng tự do';
          }
        }
        // -------------------------------------------------------------------
        // 2.4 PHÒNG NGỰ CHIẾN THUẬT KHI ĐỐI THỦ CẦM BÓNG
        // -------------------------------------------------------------------
        else if (humanHasBall && enemyCarrier) {
          // A. BẪY ĐÁNH CHẶN 4 HƯỚNG CỦA TỐT (Pawn Interception Matrix):
          if (def.hasInterception || piece.typeId === 'pawn') {
            const dangerAttackers = enemyPieces.filter((p) => p.id !== enemyCarrier.id);
            for (const danger of dangerAttackers) {
              const dist = Math.hypot(target.x - danger.position.x, target.y - danger.position.y);
              if (dist === 1) {
                score += 55000;
                reason = `🛡️⚡ Tốt áp sát lập [BẪY ĐÁNH CHẶN] khóa chặt ${getPieceDefinition(danger.typeId).vietnameseName}!`;
                break;
              }
            }
          }

          // B. XE (ROOK) & HẬU VỆ LÙI BE GÓC SÚT & BẢO VỆ VÙNG CẤM
          if (isBlockingShootingLane(target.x, target.y, board.ballPosition, ownGoalY)) {
            score += 35000;
            reason = '🧱 Dựng bức tường thép bịt kín góc sút khung thành!';
          }

          // C. ÁP SÁT ÁP ĐẢO NGƯỜI CẦM BÓNG
          const distToCarrier = Math.hypot(target.x - enemyCarrier.position.x, target.y - enemyCarrier.position.y);
          if (distToCarrier <= 2) {
            score += (3 - distToCarrier) * 8000;
            reason = '🏃 Áp sát vây bắt đối thủ đang giữ bóng!';
          }

          // D. HẬU VỆ GIỮ CỰ LY PHÒNG NGỰ TRƯỚC VÒNG CẤM (y = 2, 3, 4)
          if (def.role === 'DEF') {
            const distToOwnGoal = Math.abs(target.y - ownGoalY);
            if (distToOwnGoal <= 4 && Math.abs(target.x - 5) <= 3) {
              score += 15000;
              reason = '🛡️ Giữ vị trí trung vệ thép bảo vệ vòng cấm địa';
            }
          }
        }
        // -------------------------------------------------------------------
        // 2.5 CHẠY CHỖ TẤN CÔNG & GIÃN ĐỘI HÌNH KHI BOT CẦM BÓNG / BÓNG Ở XA
        // -------------------------------------------------------------------
        else {
          // Tiền đạo dâng cao rình rập ở khu vực nguy hiểm (y = 6..10)
          if (def.role === 'FWD' || piece.typeId === 'cannon' || piece.typeId === 'knight') {
            const distToEnemyGoal = Math.abs(target.y - targetGoalY);
            const isGuarded = isPositionGuardedByEnemyPawn(board, target, botTeam);

            if (!isGuarded) {
              score += (14 - distToEnemyGoal) * 1500;
              reason = '🏃 Tiền đạo chạy chỗ vào khoảng trống thoáng chuẩn bị dứt điểm!';
            } else {
              score -= 10000; // Né chạy vào ô bị Tốt đối phương kèm
            }
          }

          // Tốt dâng sang sân khách để kích hoạt Bứt Phá Trẻ
          if (piece.typeId === 'pawn') {
            const isInEnemyHalf = botTeam === 'black' ? target.y >= 8 : target.y <= 6;
            if (isInEnemyHalf) {
              score += 12000;
              reason = '⚡ Tốt dâng cao kích hoạt [BỨT PHÁ TRẺ] uy hiếp sân đối phương!';
            }
          }

          // Duy trì cự ly đội hình tổng thể
          const distToBall = Math.hypot(target.x - board.ballPosition.x, target.y - board.ballPosition.y);
          score += Math.max(0, (15 - distToBall) * 400);
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
  // 3. 2-STEP LOOKAHEAD COMBO PLANNER (TÍNH TOÁN LIÊN HOÀN 2 NHỊP THÔNG MINH)
  // =========================================================================
  if (board.remainingAP === 2 && difficulty === 'hard') {
    for (const cand of candidates.slice(0, Math.min(12, candidates.length))) {
      try {
        let simBoard: BoardState;
        if (cand.action === 'move') {
          simBoard = executeMove(board, cand.pieceId, cand.target.x, cand.target.y);
        } else {
          simBoard = executeKick(board, cand.pieceId, cand.target.x, cand.target.y);
        }

        // Nếu sau nhịp 1 vẫn là lượt của Bot và còn AP:
        if (simBoard.currentTurn === botTeam && !simBoard.winner && simBoard.remainingAP > 0) {
          const followUpPieces = simBoard.pieces.filter((p) => p.team === botTeam && !p.isStunned);
          for (const followPiece of followUpPieces) {
            if (hasBall(followPiece, simBoard.ballPosition)) {
              const followKicks = calculateValidKicks(simBoard, followPiece.id);
              for (const fk of followKicks) {
                if (isGoalCell(fk.x, fk.y, botTeam)) {
                  cand.score += 250000; // Nhịp 1 dọn cỗ để Nhịp 2 sút tung lưới!
                  cand.reason = `🔥 [Combo Siêu Đẳng]: ${cand.reason} ➔ Mở đường sút tung lưới đối phương!`;
                  break;
                }
              }
            }
          }
        }
      } catch (err) {
        // Ignore edge cases
      }
    }
  }

  // Sắp xếp các phương án theo điểm số chiến thuật giảm dần
  candidates.sort((a, b) => b.score - a.score);

  // 4. Lựa chọn nước đi theo cấp độ khó
  if (difficulty === 'hard') {
    // Hard Mode: 100% chọn nước đi số 1 tối ưu nhất
    return candidates[0];
  } else if (difficulty === 'easy') {
    // Easy Mode: 30% chọn ngẫu nhiên nước đi hợp lệ
    if (Math.random() < 0.3) {
      const randomIndex = Math.floor(Math.random() * candidates.length);
      return candidates[randomIndex];
    }
    const pool = candidates.slice(0, Math.min(4, candidates.length));
    return pool[Math.floor(Math.random() * pool.length)];
  } else {
    // Normal Mode: 85% chọn top 1, 15% chọn top 2
    if (candidates.length > 1 && Math.random() < 0.15) {
      return candidates[1];
    }
    return candidates[0];
  }
}

