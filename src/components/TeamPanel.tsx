import React, { useState } from 'react';
import { TeamColor, TeamRoster } from '@/engine/types';
import { getAllPieces, getPieceDefinition } from '@/engine/piece-registry';

interface TeamPanelProps {
  team: TeamColor;
  roster: TeamRoster;
  onRosterChange: (newRoster: TeamRoster) => void;
  onApplyPresetFormation?: (preset: '4-4-2' | '4-3-3' | '3-5-2') => void;
  isReady: boolean;
  onToggleReady: () => void;
  readOnly?: boolean;
}

const POSITION_NAMES = [
  'GK (Thủ môn)',
  'LB (Hậu vệ trái)',
  'LCB (Trung vệ trái)',
  'RCB (Trung vệ phải)',
  'RB (Hậu vệ phải)',
  'LM (Tiền vệ trái)',
  'LCM (Tiền vệ TT)',
  'RCM (Tiền vệ TT)',
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
  isReady,
  onToggleReady,
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
    if (selectedSlotForPick === null || readOnly || isReady) return;
    const nextPieces = [...roster.pieces];
    nextPieces[selectedSlotForPick] = pieceId;
    onRosterChange({
      ...roster,
      pieces: nextPieces,
    });
    setSelectedSlotForPick(null);
  };

  const handleNameChange = (newName: string) => {
    if (readOnly || isReady) return;
    onRosterChange({
      ...roster,
      teamName: newName,
    });
  };

  return (
    <div
      className={`flex flex-col h-full bg-slate-900/95 border-2 rounded-2xl p-3 shadow-xl transition-all ${
        isReady
          ? 'border-emerald-500 ring-2 ring-emerald-500/30'
          : isWhite
          ? 'border-amber-500/50'
          : 'border-red-500/50'
      }`}
    >
      {/* Team Header & Salary Cap Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 mb-2.5">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold border shadow ${
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
              disabled={readOnly || isReady}
              value={roster.teamName}
              onChange={(e) => handleNameChange(e.target.value)}
              className="bg-transparent font-black text-xs sm:text-sm text-white focus:bg-slate-800 px-1 py-0.5 rounded border border-transparent focus:border-slate-600 outline-none w-32 truncate"
            />
          </div>
        </div>

        {/* Budget Bar */}
        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="text-[10px] text-slate-400">Lương: </span>
            <span className={`text-xs font-mono font-black ${isOverBudget ? 'text-red-400' : 'text-emerald-400'}`}>
              {totalCost}/{SALARY_CAP}đ
            </span>
          </div>
          <div
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              isOverBudget ? 'bg-red-500/20 text-red-300 border border-red-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            }`}
          >
            {isOverBudget ? `Vượt ${Math.abs(remainingBudget)}` : `Dư ${remainingBudget}`}
          </div>
        </div>
      </div>

      {/* Preset Formation Buttons */}
      {onApplyPresetFormation && (
        <div className="flex items-center justify-between gap-1.5 mb-2 px-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Sơ đồ:</span>
          <div className="flex gap-1">
            {(['4-4-2', '4-3-3', '3-5-2'] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={readOnly || isReady}
                onClick={() => onApplyPresetFormation(preset)}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-[10px] font-bold text-slate-200 rounded border border-slate-700"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* FM-style 11 Slots Table */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-1 max-h-[220px] custom-scrollbar mb-2.5">
        {roster.pieces.map((pId, idx) => {
          const def = getPieceDefinition(pId);
          const isEditingThisSlot = selectedSlotForPick === idx;

          return (
            <button
              key={idx}
              type="button"
              disabled={readOnly || isReady}
              onClick={() => setSelectedSlotForPick(isEditingThisSlot ? null : idx)}
              className={`w-full flex items-center justify-between p-1 rounded-lg text-left border transition-all text-xs ${
                isEditingThisSlot
                  ? 'bg-amber-500/20 border-amber-400 text-white'
                  : 'bg-slate-950/70 border-slate-800/80 text-slate-300 hover:bg-slate-800/80'
              }`}
            >
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="text-sm w-4 text-center shrink-0">
                  {def?.symbol || '♟'}
                </span>
                <div className="truncate">
                  <span className="text-[10px] font-bold text-slate-300 mr-1.5">
                    {POSITION_NAMES[idx].split(' ')[0]}
                  </span>
                  <span className="text-[10px] text-amber-300/90 font-medium truncate">
                    {def?.vietnameseName || pId}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <span
                  className={`text-[8px] px-1 py-0.2 rounded font-black uppercase ${
                    def?.role === 'GK'
                      ? 'bg-yellow-500/20 text-yellow-300'
                      : def?.role === 'FWD'
                      ? 'bg-rose-500/20 text-rose-300'
                      : def?.role === 'MID'
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  {def?.role}
                </span>
                <span className="text-[9px] font-bold px-1 py-0.2 bg-slate-900 rounded border border-slate-700 text-amber-300 font-mono">
                  {def?.cost || 0}đ
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Ready Button */}
      {!readOnly && (
        <button
          type="button"
          onClick={onToggleReady}
          className={`w-full py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md ${
            isReady
              ? 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/40'
              : isOverBudget
              ? 'bg-red-500/20 text-red-300 border border-red-500/50 cursor-not-allowed opacity-60'
              : 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-slate-950 shadow-emerald-500/20'
          }`}
        >
          {isReady ? (
            <>
              <span>🔓</span> Hủy Sẵn Sàng (Chỉnh lại)
            </>
          ) : (
            <>
              <span>✅</span> Xác Nhận Đội Hình (Sẵn sàng)
            </>
          )}
        </button>
      )}

      {/* Piece Picker Popover Modal */}
      {selectedSlotForPick !== null && !isReady && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setSelectedSlotForPick(null)}
        >
          <div
            className="bg-slate-900 border-2 border-amber-400/80 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-amber-400">
                  CHỌN QUÂN CHO: {POSITION_NAMES[selectedSlotForPick]}
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
