

import React, { useState } from 'react';
import { TeamColor, TeamRoster } from '@/engine/types';
import {
  getAllPieces,
  getPieceDefinition,
} from '@/engine/piece-registry';

interface TeamBuilderModalProps {
  team: TeamColor;
  currentRoster: TeamRoster;
  onSave: (roster: TeamRoster) => void;
  onClose: () => void;
}

const POSITION_NAMES = [
  '0. GK (Thủ môn)',
  '1. LB (Hậu vệ cánh trái)',
  '2. LCB (Trung vệ trái)',
  '3. RCB (Trung vệ phải)',
  '4. RB (Hậu vệ cánh phải)',
  '5. LM (Tiền vệ cánh trái)',
  '6. LCM (Tiền vệ trung tâm)',
  '7. RCM (Tiền vệ trung tâm)',
  '8. RM (Tiền vệ cánh phải)',
  '9. LST (Tiền đạo 1)',
  '10. RST (Tiền đạo 2)',
];

const SALARY_CAP = 150;

export default function TeamBuilderModal({
  team,
  currentRoster,
  onSave,
  onClose,
}: TeamBuilderModalProps) {
  const [teamName, setTeamName] = useState(currentRoster.teamName);
  const [pieces, setPieces] = useState<string[]>([...currentRoster.pieces]);
  const [selectedSlot, setSelectedSlot] = useState<number>(0);

  const allAvailablePieces = getAllPieces();

  // Calculate total squad cost
  const totalCost = pieces.reduce((sum, pId) => {
    const def = getPieceDefinition(pId);
    return sum + def.cost;
  }, 0);

  const remainingBudget = SALARY_CAP - totalCost;

  const handleSelectPieceForSlot = (pieceId: string) => {
    const nextPieces = [...pieces];
    nextPieces[selectedSlot] = pieceId;
    setPieces(nextPieces);
  };

  const handleSave = () => {
    if (remainingBudget < 0) {
      alert(`Đội hình vượt quá ngân sách lương quy định (${SALARY_CAP} điểm)! Vui lòng điều chỉnh.`);
      return;
    }
    onSave({
      teamName,
      pieces,
    });
    onClose();
  };

  const isWhite = team === 'white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-slate-900 border-2 border-amber-400/60 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl text-white">
        {/* Header */}
        <div className={`p-5 flex items-center justify-between border-b border-slate-700 ${
          isWhite ? 'bg-gradient-to-r from-amber-600/30 to-slate-800' : 'bg-gradient-to-r from-red-600/30 to-slate-800'
        }`}>
          <div>
            <h2 className="text-2xl font-black flex items-center gap-2">
              <span>📋</span> Quản Lý Đội Hình: {isWhite ? 'Đội Trắng' : 'Đội Đỏ'}
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Tuyển chọn 11 quân cờ chiến thuật ra sân. Giới hạn ngân sách lương:{' '}
              <strong className="text-yellow-400">{SALARY_CAP} Điểm</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-lg"
          >
            ✕
          </button>
        </div>

        {/* Budget Bar */}
        <div className="bg-slate-950 px-6 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">Tên Đội:</span>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-sm font-semibold text-white focus:outline-none focus:border-amber-400"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm">
              Tổng chi phí:{' '}
              <span className={`font-bold ${totalCost > SALARY_CAP ? 'text-red-400' : 'text-emerald-400'}`}>
                {totalCost}/{SALARY_CAP}đ
              </span>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold ${
              remainingBudget >= 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-red-500/20 text-red-300 border border-red-500/40'
            }`}>
              {remainingBudget >= 0 ? `Còn dư: ${remainingBudget}đ` : `Vượt mức: ${Math.abs(remainingBudget)}đ`}
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 p-5 overflow-y-auto">
          {/* Left: 11 Slots Lineup */}
          <div className="md:col-span-5 flex flex-col gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1">
              11 Vị Trí Ra Sân
            </h3>
            <div className="flex flex-col gap-1.5 max-h-[480px] overflow-y-auto pr-1">
              {pieces.map((pId, idx) => {
                const def = getPieceDefinition(pId);
                const isSelected = selectedSlot === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedSlot(idx)}
                    className={`flex items-center justify-between p-2.5 rounded-xl text-left border transition-all ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400 text-white ring-1 ring-amber-400'
                        : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-750'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{def.symbol}</span>
                      <div>
                        <div className="text-xs font-bold text-slate-200">
                          {POSITION_NAMES[idx]}
                        </div>
                        <div className="text-[11px] text-amber-300">{def.vietnameseName}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold px-2 py-0.5 bg-slate-900 rounded-md border border-slate-700">
                        {def.cost}đ
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Available Pieces to Pick */}
          <div className="md:col-span-7 flex flex-col">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2">
              Kho Quân Cờ Có Thể Chọn Cho: <span className="text-white font-extrabold">{POSITION_NAMES[selectedSlot]}</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto max-h-[480px] pr-1">
              {allAvailablePieces.map((p) => {
                const isCurrent = pieces[selectedSlot] === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPieceForSlot(p.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      isCurrent
                        ? 'bg-cyan-500/20 border-cyan-400 ring-1 ring-cyan-400'
                        : 'bg-slate-800/60 border-slate-700 hover:border-cyan-500/50 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{p.symbol}</span>
                        <div>
                          <div className="text-sm font-bold text-white">{p.vietnameseName}</div>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 text-slate-300 font-semibold uppercase">
                            {p.role}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-yellow-400 bg-yellow-950/60 px-2 py-0.5 rounded border border-yellow-500/30">
                        {p.cost}đ
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-2 line-clamp-2">{p.description}</p>
                    {p.specialAbilityDesc && (
                      <div className="mt-2 text-[10px] text-cyan-300 bg-cyan-950/40 p-1.5 rounded border border-cyan-500/20">
                        ⚡ {p.specialAbilityDesc}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-slate-300"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 text-sm font-bold shadow-lg"
          >
            Áp Dụng Đội Hình
          </button>
        </div>
      </div>
    </div>
  );
}
