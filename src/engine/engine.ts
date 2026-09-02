import {
  BoardState,
  CommentaryLog,
  PieceInstance,
  Position,
  TeamColor,
  TeamRoster,
  VectorRule,
} from './types';
import {
  DEFAULT_BLACK_ROSTER,
  DEFAULT_WHITE_ROSTER,
  getPieceDefinition,
} from './piece-registry';

export const BOARD_WIDTH = 11;
export const BOARD_HEIGHT = 15;
export const TOP_GOAL_CELLS: Position[] = [
  { x: 4, y: 0 },
  { x: 5, y: 0 },
  { x: 6, y: 0 },
];
export const BOTTOM_GOAL_CELLS: Position[] = [
  { x: 4, y: 14 },
  { x: 5, y: 14 },
  { x: 6, y: 14 },
];

export const INITIAL_POSITIONS_WHITE: Position[] = [
  { x: 5, y: 13 }, // 0: GK (Trước khung thành 1 ô)
  { x: 1, y: 11 }, // 1: LB
  { x: 3, y: 11 }, // 2: CB
  { x: 7, y: 11 }, // 3: CB
  { x: 9, y: 11 }, // 4: RB
  { x: 1, y: 9 },  // 5: LM
  { x: 4, y: 9 },  // 6: CM
  { x: 6, y: 9 },  // 7: CM
  { x: 9, y: 9 },  // 8: RM
  { x: 4, y: 8 },  // 9: ST
  { x: 6, y: 8 },  // 10: ST
];

export const INITIAL_POSITIONS_BLACK: Position[] = [
  { x: 5, y: 1 },  // 0: GK (Trước khung thành 1 ô)
  { x: 1, y: 3 },  // 1: LB
  { x: 3, y: 3 },  // 2: CB
  { x: 7, y: 3 },  // 3: CB
  { x: 9, y: 3 },  // 4: RB
  { x: 1, y: 5 },  // 5: LM
  { x: 4, y: 5 },  // 6: CM
  { x: 6, y: 5 },  // 7: CM
  { x: 9, y: 5 },  // 8: RM
  { x: 4, y: 6 },  // 9: ST
  { x: 6, y: 6 },  // 10: ST
];

export function isInsideBoard(x: number, y: number): boolean {
  // Sân thi đấu chính: hàng 1 đến 13, cột 0 đến 10
  if (x >= 0 && x < BOARD_WIDTH && y >= 1 && y <= 13) return true;
  // Cầu gôn thụt lùi ra sau: chỉ có 3 ô khung thành ở hàng 0 và hàng 14 (cột 4, 5, 6)
  if ((y === 0 || y === 14) && x >= 4 && x <= 6) return true;
  return false;
}

export function isGoalCell(
  x: number,
  y: number,
  teamAttacking: TeamColor
): boolean {
  if (teamAttacking === 'white') {
    // Đội Trắng ghi bàn vào gôn trên (hàng 0, cột 4, 5, 6)
    return y === 0 && x >= 4 && x <= 6;
  } else {
    // Đội Đỏ ghi bàn vào gôn dưới (hàng 14, cột 4, 5, 6)
    return y === 14 && x >= 4 && x <= 6;
  }
}

export function createInitialBoard(
  whiteRoster: TeamRoster = DEFAULT_WHITE_ROSTER,
  blackRoster: TeamRoster = DEFAULT_BLACK_ROSTER,
  targetScore: number = 2
): BoardState {
  const pieces: PieceInstance[] = [];

  // White pieces
  whiteRoster.pieces.forEach((typeId, index) => {
    pieces.push({
      id: `w_${index}_${typeId}`,
      typeId,
      team: 'white',
      position: { ...INITIAL_POSITIONS_WHITE[index] },
      formationIndex: index,
    });
  });

  // Black pieces
  blackRoster.pieces.forEach((typeId, index) => {
    pieces.push({
      id: `b_${index}_${typeId}`,
      typeId,
      team: 'black',
      position: { ...INITIAL_POSITIONS_BLACK[index] },
      formationIndex: index,
    });
  });

  return {
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    pieces,
    ballPosition: { x: 5, y: 7 },
    currentTurn: 'white',
    remainingAP: 2, // 2 lượt mỗi vòng đấu
    score: { white: 0, black: 0 },
    targetScore,
    turnNumber: 1,
    selectedPieceId: null,
    activeAction: null,
    winner: null,
    whiteRoster,
    blackRoster,
    phase: 'setup',
    commentary: [
      {
        id: 'c_0',
        text: '🛠️ Giai đoạn Bố trí Đội hình & Chiến thuật. Hãy sắp xếp vị trí và chọn cầu thủ ưng ý trước khi Bắt đầu!',
        type: 'whistle',
        timestamp: '00:00',
      },
    ],
  };
}

export function getPieceAt(pieces: PieceInstance[], x: number, y: number): PieceInstance | undefined {
  return pieces.find((p) => p.position.x === x && p.position.y === y);
}

export function isPieceAdjacentToBall(piece: PieceInstance, ball: Position): boolean {
  const dx = Math.abs(piece.position.x - ball.x);
  const dy = Math.abs(piece.position.y - ball.y);
  return (dx <= 1 && dy <= 1);
}

export function hasBall(piece: PieceInstance, ball: Position): boolean {
  return piece.position.x === ball.x && piece.position.y === ball.y;
}

/**
 * Calculate all valid movement squares for a piece.
 * COMBINED MECHANISM: Every piece has its chess moves (slide, leap) + can step 1 square in all 8 surrounding directions!
 */
export function calculateValidMoves(board: BoardState, pieceId: string): Position[] {
  const piece = board.pieces.find((p) => p.id === pieceId);
  if (!piece) return [];
  if (piece.isStunned) return [];

  const def = getPieceDefinition(piece.typeId);
  const movesMap = new Map<string, Position>();

  const addMove = (targetX: number, targetY: number): boolean => {
    if (!isInsideBoard(targetX, targetY)) return false;
    const occupant = getPieceAt(board.pieces, targetX, targetY);
    if (!occupant) {
      movesMap.set(`${targetX},${targetY}`, { x: targetX, y: targetY });
      return true; // Can continue sliding
    } else {
      if (occupant.team !== piece.team) {
        // Can tackle / challenge opponent!
        movesMap.set(`${targetX},${targetY}`, { x: targetX, y: targetY });
      }
      return false; // Blocked by piece
    }
  };

  // 1. Primary Chess Move Rule (Slide / Leap / Step)
  const { type, vectors } = def.moveRule;

  if (type === 'slide') {
    for (const v of vectors) {
      let step = 1;
      while (true) {
        const targetX = piece.position.x + v.dx * step;
        const targetY = piece.position.y + v.dy * step;
        const canContinue = addMove(targetX, targetY);
        if (!canContinue) break;
        step++;
      }
    }
  } else if (type === 'step') {
    for (const v of vectors) {
      const maxRange = v.maxRange || 1;
      for (let r = 1; r <= maxRange; r++) {
        const targetX = piece.position.x + v.dx * r;
        const targetY = piece.position.y + v.dy * r;
        const canContinue = addMove(targetX, targetY);
        if (!canContinue) break;
      }
    }
  } else if (type === 'leap') {
    for (const v of vectors) {
      const targetX = piece.position.x + v.dx;
      const targetY = piece.position.y + v.dy;
      addMove(targetX, targetY);
    }
  }

  // 2. Universal 1-step Surrounding Move for ALL pieces (8 directions, 1 step)
  const ALL_SURROUNDING = [
    { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
    { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: 1, dy: 1 }
  ];
  for (const v of ALL_SURROUNDING) {
    const targetX = piece.position.x + v.dx;
    const targetY = piece.position.y + v.dy;
    addMove(targetX, targetY);
  }

  return Array.from(movesMap.values());
}

/**
 * Calculate all valid kick/pass target squares for a piece from the BALL position.
 */
export function calculateValidKicks(board: BoardState, pieceId: string): Position[] {
  const piece = board.pieces.find((p) => p.id === pieceId);
  if (!piece) return [];
  if (piece.isStunned) return [];
  if (!hasBall(piece, board.ballPosition)) return [];

  const def = getPieceDefinition(piece.typeId);
  const { type, vectors } = def.kickRule;
  const ball = board.ballPosition;
  const validKicks: Position[] = [];

  // Đặc quyền Thủ Môn (Vua): Có thể phát bóng bổng chuẩn xác tới bất kỳ đồng đội nào trên sân!
  if (piece.typeId === 'king' || def.role === 'GK') {
    board.pieces.forEach((p) => {
      if (p.team === piece.team && p.id !== piece.id) {
        if (!validKicks.some((k) => k.x === p.position.x && k.y === p.position.y)) {
          validKicks.push({ x: p.position.x, y: p.position.y });
        }
      }
    });
  }

  if (type === 'slide') {
    for (const v of vectors) {
      let step = 1;
      while (true) {
        const targetX = ball.x + v.dx * step;
        const targetY = ball.y + v.dy * step;

        // Check if aiming towards top/bottom goal
        if (isGoalCell(targetX, targetY, piece.team)) {
          validKicks.push({ x: targetX, y: targetY });
          break;
        }

        if (!isInsideBoard(targetX, targetY)) break;

        const occupant = getPieceAt(board.pieces, targetX, targetY);
        if (!occupant) {
          validKicks.push({ x: targetX, y: targetY });
        } else {
          // Can pass to teammate or kick directly to opponent's feet
          validKicks.push({ x: targetX, y: targetY });
          break;
        }
        step++;
      }
    }
  } else if (type === 'step') {
    for (const v of vectors) {
      const maxRange = v.maxRange || 1;
      for (let r = 1; r <= maxRange; r++) {
        const targetX = ball.x + v.dx * r;
        const targetY = ball.y + v.dy * r;

        if (isGoalCell(targetX, targetY, piece.team)) {
          validKicks.push({ x: targetX, y: targetY });
          break;
        }

        if (!isInsideBoard(targetX, targetY)) break;

        const occupant = getPieceAt(board.pieces, targetX, targetY);
        if (!occupant) {
          validKicks.push({ x: targetX, y: targetY });
        } else {
          validKicks.push({ x: targetX, y: targetY });
          break;
        }
      }
    }
  } else if (type === 'leap') {
    // Lob shot (Sút bổng qua đầu đối thủ / L-shape or jump)
    for (const v of vectors) {
      const targetX = ball.x + v.dx;
      const targetY = ball.y + v.dy;

      if (isGoalCell(targetX, targetY, piece.team)) {
        validKicks.push({ x: targetX, y: targetY });
        continue;
      }

      if (isInsideBoard(targetX, targetY)) {
        validKicks.push({ x: targetX, y: targetY });
      }
    }
  } else if (type === 'cannon') {
    // Cannon shot: MUST hop over exactly 1 piece to shoot!
    for (const v of vectors) {
      let step = 1;
      let pieceCount = 0;
      while (true) {
        const targetX = ball.x + v.dx * step;
        const targetY = ball.y + v.dy * step;

        if (!isInsideBoard(targetX, targetY) && !isGoalCell(targetX, targetY, piece.team)) {
          break;
        }

        const occupant = getPieceAt(board.pieces, targetX, targetY);
        if (occupant) {
          pieceCount++;
          if (pieceCount === 1) {
            // Found the cannon mount (ngòi nổ), keep searching beyond it!
            step++;
            continue;
          } else if (pieceCount > 1) {
            // Can't shoot past second obstacle, but can shoot at second piece
            validKicks.push({ x: targetX, y: targetY });
            break;
          }
        }

        if (pieceCount === 1) {
          // After jumping 1 piece, any empty cell or goal is a valid cannon strike!
          validKicks.push({ x: targetX, y: targetY });
        }

        step++;
      }
    }
  }

  return validKicks;
}

/**
 /**
 * Push an opponent piece away when tackled to guarantee it never overlaps with tackler.
 */
function pushOpponent(
  pieces: PieceInstance[],
  tackler: PieceInstance,
  target: PieceInstance
): void {
  const dx = target.position.x - tackler.position.x;
  const dy = target.position.y - tackler.position.y;

  // Normalized push direction
  const pushDx = Math.sign(dx) || 0;
  const pushDy = Math.sign(dy) || (target.team === 'white' ? 1 : -1);

  // Helper to check if a square is free for the target to be pushed into.
  // Note: tackler's current position (tackler.position) will be vacated by tackler,
  // so it is considered a valid empty landing spot!
  const isCellAvailable = (x: number, y: number): boolean => {
    if (!isInsideBoard(x, y)) return false;
    // Cannot land on target's current position (where tackler is moving to)
    if (x === target.position.x && y === target.position.y) return false;
    const occupant = pieces.find(
      (p) => p.position.x === x && p.position.y === y && p.id !== target.id
    );
    if (!occupant) return true;
    if (occupant.id === tackler.id) return true; // Tackler is moving away from this spot
    return false;
  };

  // 1. Try preferred straight push
  const desiredX = target.position.x + pushDx;
  const desiredY = target.position.y + pushDy;
  if (isCellAvailable(desiredX, desiredY)) {
    target.position = { x: desiredX, y: desiredY };
    target.isStunned = true;
    return;
  }

  // 2. Try all surrounding neighbors
  const allNeighbors = [
    { x: target.position.x + pushDx, y: target.position.y },
    { x: target.position.x, y: target.position.y + pushDy },
    { x: target.position.x + 1, y: target.position.y },
    { x: target.position.x - 1, y: target.position.y },
    { x: target.position.x, y: target.position.y + 1 },
    { x: target.position.x, y: target.position.y - 1 },
    { x: target.position.x + 1, y: target.position.y + 1 },
    { x: target.position.x + 1, y: target.position.y - 1 },
    { x: target.position.x - 1, y: target.position.y + 1 },
    { x: target.position.x - 1, y: target.position.y - 1 },
  ];

  for (const n of allNeighbors) {
    if (isCellAvailable(n.x, n.y)) {
      target.position = { x: n.x, y: n.y };
      target.isStunned = true;
      return;
    }
  }

  // 3. Fallback: Tackler's vacated spot
  if (isInsideBoard(tackler.position.x, tackler.position.y)) {
    target.position = { x: tackler.position.x, y: tackler.position.y };
    target.isStunned = true;
    return;
  }

  // 4. Ultimate fallback: find any closest empty cell on the entire board
  for (let dist = 2; dist < Math.max(BOARD_WIDTH, BOARD_HEIGHT); dist++) {
    for (let ox = -dist; ox <= dist; ox++) {
      for (let oy = -dist; oy <= dist; oy++) {
        const nx = target.position.x + ox;
        const ny = target.position.y + oy;
        if (isCellAvailable(nx, ny)) {
          target.position = { x: nx, y: ny };
          target.isStunned = true;
          return;
        }
      }
    }
  }

  target.isStunned = true;
}

/**
 * Execute Move Action (costs 1 AP).
 */
export function executeMove(
  board: BoardState,
  pieceId: string,
  targetX: number,
  targetY: number
): BoardState {
  if (board.winner) return board;

  const pieceIndex = board.pieces.findIndex((p) => p.id === pieceId);
  if (pieceIndex === -1) return board;

  const piece = board.pieces[pieceIndex];
  const def = getPieceDefinition(piece.typeId);
  const newPieces: PieceInstance[] = board.pieces.map((p) => ({
    ...p,
    position: { ...p.position },
  }));

  const isCarryingBall =
    piece.position.x === board.ballPosition.x && piece.position.y === board.ballPosition.y;
  const newBallPosition: Position = isCarryingBall ? { x: targetX, y: targetY } : board.ballPosition;

  const opponentIndex = newPieces.findIndex(
    (p) => p.position.x === targetX && p.position.y === targetY && p.team !== piece.team
  );

  const commentary: CommentaryLog[] = [...board.commentary];
  const timeStr = `${board.turnNumber * 3}'`;

  // Check if player dribbles the ball into the opponent's goal!
  const isGoal = isCarryingBall && isGoalCell(targetX, targetY, piece.team);

  if (isGoal) {
    const newScore = {
      ...board.score,
      [piece.team]: board.score[piece.team] + 1,
    };

    const teamLabel = piece.team === 'white' ? 'ĐỘI TRẮNG' : 'ĐỘI ĐỎ';
    commentary.unshift({
      id: `c_${Date.now()}_goal`,
      text: `⚽⚽⚽ VÀOOOOOO! [${teamLabel}] ${def.vietnameseName} đã solo dẫn bóng dũng mãnh dắt bóng thẳng vào lưới! (${newScore.white} - ${newScore.black})`,
      type: 'goal',
      team: piece.team,
      timestamp: timeStr,
    });

    const isMatchWon = newScore[piece.team] >= board.targetScore;

    // Reset ball to center & reset pieces back to customized setup formation
    const resetPieces: PieceInstance[] = board.savedFormation
      ? board.savedFormation.map((p) => ({
          ...p,
          position: { ...p.position },
          isStunned: false,
          abilityCooldown: 0,
        }))
      : board.pieces.map((p) => ({
          ...p,
          position: { ...p.position },
          isStunned: false,
          abilityCooldown: 0,
        }));

    const concedingTeam: TeamColor = piece.team === 'white' ? 'black' : 'white';

    return {
      ...board,
      pieces: resetPieces,
      ballPosition: { x: 5, y: 7 },
      score: newScore,
      winner: isMatchWon ? piece.team : null,
      lastGoalScorer: { team: piece.team, pieceName: def.vietnameseName },
      remainingAP: 2, // Giao bóng 2 lượt cơ bản
      currentTurn: concedingTeam,
      turnNumber: board.turnNumber + 1,
      selectedPieceId: null,
      activeAction: null,
      commentary,
    };
  }

  let isBallSteal = false;
  const isCollectingBall = !isCarryingBall && board.ballPosition.x === targetX && board.ballPosition.y === targetY;
  const isBulldozeReady = isCarryingBall && opponentIndex !== -1 && Boolean(def.hasBulldozer) && (!piece.abilityCooldown || piece.abilityCooldown === 0);
  const isBulldozeOnCooldown = isCarryingBall && opponentIndex !== -1 && Boolean(def.hasBulldozer) && Boolean(piece.abilityCooldown && piece.abilityCooldown > 0);
  const isBulldoze = isBulldozeReady;

  if (opponentIndex !== -1) {
    // TACKLE / DISPOSSESS / BULLDOZE!
    const opponent = newPieces[opponentIndex];
    const oppDef = getPieceDefinition(opponent.typeId);
    
    // Check if opponent was holding the ball
    isBallSteal =
      opponent.position.x === board.ballPosition.x &&
      opponent.position.y === board.ballPosition.y;

    pushOpponent(newPieces, piece, opponent);

    commentary.unshift({
      id: `c_${Date.now()}`,
      text: isBulldoze
        ? `🦬 [${piece.team === 'white' ? 'Trắng' : 'Đỏ'}] ${def.vietnameseName} kích hoạt nội tại [SỰ TRÂU BÒ]! Húc văng ${oppDef.vietnameseName} ra xa mà không mất lượt! (Bắt đầu hồi chiêu: 1 lượt)`
        : isBulldozeOnCooldown
        ? `⚔️ [${piece.team === 'white' ? 'Trắng' : 'Đỏ'}] ${def.vietnameseName} dẫn bóng tì đè ${oppDef.vietnameseName} ([SỰ TRÂU BÒ] đang trong thời gian hồi chiêu!)`
        : isBallSteal
        ? `⚡ [${piece.team === 'white' ? 'Trắng' : 'Đỏ'}] ${def.vietnameseName} đã cướp bóng thành công từ chân ${oppDef.vietnameseName}! (Cướp bóng thành công - Giữ lượt!)`
        : isCarryingBall
        ? `⚔️ [${piece.team === 'white' ? 'Trắng' : 'Đỏ'}] ${def.vietnameseName} vừa dẫn bóng vừa tì đè dũng mãnh, đẩy lùi ${oppDef.vietnameseName}!`
        : `⚔️ [${piece.team === 'white' ? 'Trắng' : 'Đỏ'}] ${def.vietnameseName} đã tắc bóng dũng mãnh, đẩy lùi ${oppDef.vietnameseName}!`,
      type: 'tackle',
      team: piece.team,
      timestamp: timeStr,
    });
  } else {
    commentary.unshift({
      id: `c_${Date.now()}`,
      text: isCollectingBall
        ? `⚡ [${piece.team === 'white' ? 'Trắng' : 'Đỏ'}] ${def.vietnameseName} đã di chuyển khống chế bóng thành công.`
        : isCarryingBall
        ? `🏃 [${piece.team === 'white' ? 'Trắng' : 'Đỏ'}] ${def.vietnameseName} dẫn bóng tới vị trí (${targetX}, ${targetY}).`
        : `🏃 [${piece.team === 'white' ? 'Trắng' : 'Đỏ'}] ${def.vietnameseName} di chuyển tới vị trí (${targetX}, ${targetY}).`,
      type: 'move',
      team: piece.team,
      timestamp: timeStr,
    });
  }

  // Update piece position & ability cooldown
  newPieces[pieceIndex] = {
    ...newPieces[pieceIndex],
    position: { x: targetX, y: targetY },
    abilityCooldown: isBulldoze ? 1 : newPieces[pieceIndex].abilityCooldown,
  };

  // Giữ lượt khi: Cướp bóng thành công hoặc Thể hiện [SỰ TRÂU BÒ] (Xe dẫn bóng đâm đối thủ)
  // Di chuyển đến nhận bóng tiêu tốn 1 AP bình thường
  let isTurnOver = false;
  let remainingAP = board.remainingAP;

  if (isBallSteal || isBulldoze) {
    isTurnOver = false;
    remainingAP = board.remainingAP;
  } else {
    const nextAP = board.remainingAP - 1;
    isTurnOver = nextAP <= 0;
    remainingAP = isTurnOver ? 2 : nextAP;
  }

  const nextTurn: TeamColor = isTurnOver ? (board.currentTurn === 'white' ? 'black' : 'white') : board.currentTurn;

  if (isTurnOver) {
    // Decrease cooldowns for current team when their turn ends
    newPieces.forEach((p) => {
      if (p.team === board.currentTurn && p.abilityCooldown && p.abilityCooldown > 0) {
        p.abilityCooldown -= 1;
      }
      if (p.team === nextTurn) p.isStunned = false;
    });
  }

  return {
    ...board,
    pieces: newPieces,
    ballPosition: newBallPosition,
    remainingAP,
    currentTurn: nextTurn,
    turnNumber: isTurnOver ? board.turnNumber + 1 : board.turnNumber,
    selectedPieceId: null,
    activeAction: null,
    lastGoalScorer: undefined,
    commentary,
  };
}

/**
 * Execute Kick/Pass Action (costs 1 AP).
 */
export function executeKick(
  board: BoardState,
  pieceId: string,
  targetX: number,
  targetY: number
): BoardState {
  if (board.winner) return board;

  const piece = board.pieces.find((p) => p.id === pieceId);
  if (!piece) return board;

  const def = getPieceDefinition(piece.typeId);
  const newPieces: PieceInstance[] = board.pieces.map((p) => ({
    ...p,
    position: { ...p.position },
  }));
  const commentary: CommentaryLog[] = [...board.commentary];
  const timeStr = `${board.turnNumber * 3}'`;

  // Check Goal!
  const isGoal = isGoalCell(targetX, targetY, piece.team);

  if (isGoal) {
    // GOAL SCORED!
    const newScore = {
      ...board.score,
      [piece.team]: board.score[piece.team] + 1,
    };

    const teamLabel = piece.team === 'white' ? 'ĐỘI TRẮNG' : 'ĐỘI ĐỎ';
    commentary.unshift({
      id: `c_${Date.now()}_goal`,
      text: `⚽⚽⚽ VÀOOOOOO! [${teamLabel}] ${def.vietnameseName} đã tung cú sút tuyệt hảo ghi bàn thắng quý hơn vàng! (${newScore.white} - ${newScore.black})`,
      type: 'goal',
      team: piece.team,
      timestamp: timeStr,
    });

    const isMatchWon = newScore[piece.team] >= board.targetScore;

    // Reset ball to center & reset pieces back to customized setup formation
    const resetPieces: PieceInstance[] = board.savedFormation
      ? board.savedFormation.map((p) => ({
          ...p,
          position: { ...p.position },
          isStunned: false,
          abilityCooldown: 0,
        }))
      : board.pieces.map((p) => ({
          ...p,
          position: { ...p.position },
          isStunned: false,
          abilityCooldown: 0,
        }));

    const concedingTeam: TeamColor = piece.team === 'white' ? 'black' : 'white';

    return {
      ...board,
      pieces: resetPieces,
      ballPosition: { x: 5, y: 7 },
      score: newScore,
      winner: isMatchWon ? piece.team : null,
      lastGoalScorer: { team: piece.team, pieceName: def.vietnameseName },
      remainingAP: 2, // Giao bóng 2 lượt cơ bản
      currentTurn: concedingTeam, // Conceding team gets kick-off
      turnNumber: board.turnNumber + 1,
      selectedPieceId: null,
      activeAction: null,
      commentary,
    };
  }

  // Normal pass/shot within board
  const newBallPos: Position = { x: targetX, y: targetY };
  const receiver = getPieceAt(newPieces, targetX, targetY);
  const isPassToTeammate = Boolean(receiver && receiver.team === piece.team);
  const isPassToOpponent = Boolean(receiver && receiver.team !== piece.team);

  if (isPassToTeammate && receiver) {
    const recvDef = getPieceDefinition(receiver.typeId);
    commentary.unshift({
      id: `c_${Date.now()}`,
      text: `🎯 [${piece.team === 'white' ? 'Trắng' : 'Đỏ'}] ${def.vietnameseName} chuyền bóng chuẩn xác cho đồng đội ${recvDef.vietnameseName}! (Chuyền thành công - Giữ lượt!)`,
      type: 'pass',
      team: piece.team,
      timestamp: timeStr,
    });
  } else if (isPassToOpponent && receiver) {
    const recvDef = getPieceDefinition(receiver.typeId);
    commentary.unshift({
      id: `c_${Date.now()}`,
      text: `😱 [${piece.team === 'white' ? 'Trắng' : 'Đỏ'}] ${def.vietnameseName} chuyền bóng thẳng vào chân đối thủ ${recvDef.vietnameseName}! (Mất quyền kiểm soát - Mất lượt!)`,
      type: 'tackle',
      team: piece.team,
      timestamp: timeStr,
    });
  } else {
    commentary.unshift({
      id: `c_${Date.now()}`,
      text: `🚀 [${piece.team === 'white' ? 'Trắng' : 'Đỏ'}] ${def.vietnameseName} tung cú sút bóng tới toạ độ (${targetX}, ${targetY}).`,
      type: 'shoot',
      team: piece.team,
      timestamp: timeStr,
    });
  }

  // Chuyền cho đồng đội -> Giữ lượt
  // Chuyền cho đối thủ -> MẤT LƯỢT NGAY LẬP TỨC
  // Sút vào khoảng trống -> Trừ 1 AP
  let isTurnOver = false;
  let remainingAP = board.remainingAP;

  if (isPassToTeammate) {
    isTurnOver = false;
    remainingAP = board.remainingAP;
  } else if (isPassToOpponent) {
    isTurnOver = true;
    remainingAP = 2;
  } else {
    const nextAP = board.remainingAP - 1;
    isTurnOver = nextAP <= 0;
    remainingAP = isTurnOver ? 2 : nextAP;
  }

  const nextTurn: TeamColor = isTurnOver ? (board.currentTurn === 'white' ? 'black' : 'white') : board.currentTurn;

  if (isTurnOver) {
    // Decrease cooldowns for current team when their turn ends
    newPieces.forEach((p) => {
      if (p.team === board.currentTurn && p.abilityCooldown && p.abilityCooldown > 0) {
        p.abilityCooldown -= 1;
      }
      if (p.team === nextTurn) p.isStunned = false;
    });
  }

  return {
    ...board,
    pieces: newPieces,
    ballPosition: newBallPos,
    remainingAP,
    currentTurn: nextTurn,
    turnNumber: isTurnOver ? board.turnNumber + 1 : board.turnNumber,
    selectedPieceId: null,
    activeAction: null,
    lastGoalScorer: undefined,
    commentary,
  };
}

/**
 * Manually end turn to pass AP.
 */
export function endTurn(board: BoardState): BoardState {
  if (board.winner) return board;

  const nextTurn: TeamColor = board.currentTurn === 'white' ? 'black' : 'white';
  const newPieces = board.pieces.map((p) => {
    let abilityCooldown = p.abilityCooldown;
    if (p.team === board.currentTurn && abilityCooldown && abilityCooldown > 0) {
      abilityCooldown -= 1;
    }
    return {
      ...p,
      isStunned: p.team === nextTurn ? false : p.isStunned,
      abilityCooldown,
    };
  });

  return {
    ...board,
    pieces: newPieces,
    currentTurn: nextTurn,
    remainingAP: 2,
    turnNumber: board.turnNumber + 1,
    selectedPieceId: null,
    activeAction: null,
    lastGoalScorer: undefined,
    commentary: [
      {
        id: `c_${Date.now()}`,
        text: `⏱️ [${board.currentTurn === 'white' ? 'Trắng' : 'Đỏ'}] kết thúc lượt. Quyền điều khiển chuyển sang [${nextTurn === 'white' ? 'Trắng' : 'Đỏ'}].`,
        type: 'system',
        timestamp: `${board.turnNumber * 3}'`,
      },
      ...board.commentary,
    ],
  };
}
