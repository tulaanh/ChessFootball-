import React, { useState } from 'react';
import { TeamColor, TeamRoster } from '@/engine/types';
import { getAllPieces, getPieceDefinition } from '@/engine/piece-registry';

interface TeamPanelProps {
  team: TeamColor;
  roster: TeamRoster;
  onRosterChange: (newRoster: TeamRoster) => void;
  onApplyPresetFormation?: (preset: '4-4-2' | '4-3-3' | '3-5-2') => void;
  isActiveTeam: boolean;
  onSelectAsActive: () => void;
  readOnly?: boolean;
}

const POSITION_NAMES = [
  'GK (Thủ môn)',
  'LB (Hậu vệ trái)',
  'LCB (Trung vệ trái)',
  'RCB (Trung vệ phải)',
  'RB (Hậu vệ phải)',
  'LM (Tiền vệ trái)',
  'LCM (Tiền vệ trung tâm)',
  'RCM (Tiền vệ trung tâm)',
  'RM (Tiền vệ phải)',
  'LST (Tiền đạo 1)',
  'RST (Tiền đạo 2)',
];

const SALARY_CAP = 150;

export default function TeamPanel({
  team,
  roster,
  onRosterChange,
  onApplyPresetFormation,
  isActiveTeam,
  onSelectAsActive,
  readOnly = false,
}: TeamPanelProps) {
  const [selectedSlotForPick, setSelectedSlotForPick] = useState<number | null>(null);
  const isWhite = team === 'white';
  const allAvailablePieces = getAllPieces();

  // Tính toán tổng ngân sách lương
  const totalCost = roster.pieces.reduce((sum, pId) => {
    const def = getPieceDefinition(pId);
    return sum + (def?.cost || 0);
  }, 0);

  const remainingBudget = SALARY_CAP - totalCost;
  const isOverBudget = remainingBudget < 0;

  const handleSelectPieceForSlot = (pieceId: string) => {
    if (selectedSlotForPick === null || readOnly) return;
    const nextPieces = [...roster.pieces];
    nextPieces[selectedSlotForPick] = pieceId;
    onRosterChange({
      ...roster,
      pieces: nextPieces,
    });
    setSelectedSlotForPick(null);
  };

  const handleNameChange = (newName: string) => {
    if (readOnly) return;
    onRosterChange({
      ...roster,
      teamName: newName,
    });
  };

  return (
    <div
      onClick={onSelectAsActive}
      className={`flex flex-col h-full bg-slate-900/95 border-2 rounded-2xl p-3.5 shadow-2xl transition-all duration-200 ${
        isActiveTeam
          ? isWhite
            ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-amber-500/10'
            : 'border-red-500 ring-2 ring-red-500/40 shadow-red-500/10'
          : 'border-slate-800 opacity-90 hover:opacity-100'
      }`}
    >
      {/* Team Header */}
      <div
        className={`p-3 rounded-xl mb-3 flex items-center justify-between border ${
          isWhite
            ? 'bg-gradient-to-r from-amber-950/60 to-slate-900 border-amber-500/30'
            : 'bg-gradient-to-r from-red-950/60 to-slate-900 border-red-500/30'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-xl font-bold border shadow ${
              isWhite
                ? 'bg-amber-400 text-slate-950 border-amber-300'
                : 'bg-red-600 text-white border-red-400'
            }`}
          >
            {isWhite ? '♔' : '♚'}
          </div>
          <div>
            <input
              type="text"
              disabled={readOnly}
              value={roster.teamName}
              onChange={(e) => handleNameChange(e.target.value)}
              className="bg-transparent font-black text-sm text-white focus:bg-slate-800/80 px-1.5 py-0.5 rounded border border-transparent focus:border-slate-600 outline-none w-36 truncate"
            />
            <div className="text-[10px] text-slate-400 font-medium px-1">
              {isWhite ? 'Khởi đầu: Sân dưới' : 'Khởi đầu: Sân trên'}
            </div>
          </div>
        </div>

        {isActiveTeam && (
          <span
            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
              isWhite
                ? 'bg-amber-400/20 text-amber-300 border-amber-400/50 animate-pulse'
                : 'bg-red-600/20 text-red-300 border-red-500/50 animate-pulse'
            }`}
          >
            Đang Chọn
          </span>
        )}
      </div>

      {/* Salary Cap Budget Bar */}
      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-[11px] font-bold text-slate-400">Quỹ Lương:</span>
          <span
            className={`font-mono font-black ${
              isOverBudget ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {totalCost} / {SALARY_CAP}đ
          </span>
        </div>
        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isOverBudget
                ? 'bg-red-500'
                : totalCost > 130
                ? 'bg-amber-400'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, (totalCost / SALARY_CAP) * 100)}%` }}
          />
        </div>
        <div className="flex justify-between items-center mt-1 text-[10px]">
          <span className="text-slate-500">Giới hạn {SALARY_CAP}đ</span>
          <span
            className={`font-semibold ${
              isOverBudget ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {isOverBudget ? `Vượt ${Math.abs(remainingBudget)}đ` : `Còn dư ${remainingBudget}đ`}
          </span>
        </div>
      </div>

      {/* Formation Quick Presets */}
      {onApplyPresetFormation && (
        <div className="mb-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            ⚡ Sơ đồ chiến thuật:
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(['4-4-2', '4-3-3', '3-5-2'] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={readOnly}
                onClick={(e) => {
                  e.stopPropagation();
                  onApplyPresetFormation(preset);
                }}
                className="py-1 bg-slate-800/90 hover:bg-slate-700 disabled:opacity-40 text-[11px] font-bold text-slate-200 rounded-lg border border-slate-700 transition-colors"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 11 Slots List */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
          <span>📋 11 Cầu thủ ra sân:</span>
          <span className="text-amber-400">Nhấp để đổi quân</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar max-h-[340px]">
          {roster.pieces.map((pId, idx) => {
            const def = getPieceDefinition(pId);
            const isEditingThisSlot = selectedSlotForPick === idx;

            return (
              <div key={idx} className="relative">
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSlotForPick(isEditingThisSlot ? null : idx);
                  }}
                  className={`w-full flex items-center justify-between p-1.5 rounded-lg text-left border transition-all text-xs ${
                    isEditingThisSlot
                      ? 'bg-amber-500/20 border-amber-400 ring-1 ring-amber-400 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/70 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-base w-5 text-center shrink-0">
                      {def?.symbol || '♟'}
                    </span>
                    <div className="truncate">
                      <div className="text-[11px] font-bold text-slate-200 truncate">
                        {POSITION_NAMES[idx]}
                      </div>
                      <div className="text-[10px] text-amber-300/90 truncate">
                        {def?.vietnameseName || pId}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-black uppercase ${
                        def?.role === 'GK'
                          ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                          : def?.role === 'FWD'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : def?.role === 'MID'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {def?.role}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-900 rounded border border-slate-700 text-amber-300">
                      {def?.cost || 0}đ
                    </span>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Piece Picker Popover Modal when a slot is clicked */}
      {selectedSlotForPick !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setSelectedSlotForPick(null)}
        >
          <div
            className="bg-slate-900 border-2 border-amber-400/80 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-amber-400">
                  CHỌN QUÂN CHO VỊ TRÍ: {POSITION_NAMES[selectedSlotForPick]}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {roster.teamName} • Ngân sách còn lại:{' '}
                  <span className={remainingBudget < 0 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                    {remainingBudget}đ
                  </span>
                </p>
              </div>
              <button
                onClick={() => setSelectedSlotForPick(null)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Pieces Grid */}
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto max-h-[60vh]">
              {allAvailablePieces.map((p) => {
                const currentPieceInSlot = roster.pieces[selectedSlotForPick];
                const currentSlotCost = getPieceDefinition(currentPieceInSlot)?.cost || 0;
                const costDiff = p.cost - currentSlotCost;
                const isAffordable = remainingBudget - costDiff >= 0;
                const isCurrent = currentPieceInSlot === p.id;

                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!isAffordable && !isCurrent}
                    onClick={() => handleSelectPieceForSlot(p.id)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      isCurrent
                        ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/50 text-white'
                        : !isAffordable
                        ? 'opacity-40 bg-slate-950 border-slate-800 cursor-not-allowed text-slate-500'
                        : 'bg-slate-800/80 border-slate-700 hover:border-amber-400/60 hover:bg-slate-800 text-white'
                    }`}
                  >
                    <div className="flex items-start justify-between w-full">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{p.symbol}</span>
                        <div>
                          <div className="text-xs font-black text-white">{p.vietnameseName}</div>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-900 text-slate-300 font-bold uppercase">
                            {p.role}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-black text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                          {p.cost}đ
                        </span>
                        {costDiff !== 0 && (
                          <span
                            className={`text-[9px] mt-0.5 font-bold ${
                              costDiff > 0 ? 'text-red-400' : 'text-emerald-400'
                            }`}
                          >
                            {costDiff > 0 ? `+${costDiff}đ` : `${costDiff}đ`}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-300 mt-2 line-clamp-2 leading-relaxed">
                      {p.description}
                    </p>

                    {p.specialAbilityDesc && (
                      <div className="mt-2 text-[10px] text-cyan-300 bg-cyan-950/50 p-1.5 rounded-lg border border-cyan-500/30">
                        ⚡ {p.specialAbilityDesc}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedSlotForPick(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
