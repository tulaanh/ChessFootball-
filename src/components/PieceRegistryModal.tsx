

import React, { useState } from 'react';
import {
  PieceDefinition,
  PieceRole,
  PrimitiveType,
} from '@/engine/types';
import {
  getAllPieces,
  registerPiece,
} from '@/engine/piece-registry';

interface PieceRegistryModalProps {
  onClose: () => void;
  onPieceAdded?: () => void;
}

export default function PieceRegistryModal({
  onClose,
  onPieceAdded,
}: PieceRegistryModalProps) {
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [pieces, setPieces] = useState<PieceDefinition[]>(getAllPieces());

  // Form State for creating custom piece
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [vietnameseName, setVietnameseName] = useState('');
  const [role, setRole] = useState<PieceRole>('MID');
  const [cost, setCost] = useState<number>(25);
  const [symbol, setSymbol] = useState('🧙‍♂️');
  const [description, setDescription] = useState('');
  const [specialAbility, setSpecialAbility] = useState('');
  const [moveType, setMoveType] = useState<PrimitiveType>('step');
  const [moveRange, setMoveRange] = useState<number>(2);
  const [kickType, setKickType] = useState<PrimitiveType>('step');
  const [kickRange, setKickRange] = useState<number>(3);
  const [isLob, setIsLob] = useState<boolean>(false);

  const handleCreatePiece = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !vietnameseName) {
      alert('Vui lòng nhập Mã ID và Tên quân cờ!');
      return;
    }

    const vectorsAll8 = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
      { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: 1, dy: 1 },
    ];

    const newDef: PieceDefinition = {
      id: id.toLowerCase().trim().replace(/\s+/g, '_'),
      name: name || vietnameseName,
      vietnameseName,
      role,
      cost: Number(cost) || 20,
      symbol: symbol || '⭐',
      description: description || `Quân cờ tùy chỉnh ${vietnameseName}`,
      specialAbilityDesc: specialAbility,
      moveRule: {
        type: moveType,
        vectors: vectorsAll8.map((v) => ({ ...v, maxRange: moveType === 'slide' ? undefined : moveRange })),
      },
      kickRule: {
        type: kickType,
        vectors: vectorsAll8.map((v) => ({ ...v, maxRange: kickType === 'slide' ? undefined : kickRange })),
        isLob,
        power: 4,
      },
    };

    registerPiece(newDef);
    setPieces(getAllPieces());
    setActiveTab('list');
    if (onPieceAdded) onPieceAdded();
    alert(`Đã đăng ký quân cờ mới "${vietnameseName}" thành công!`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-slate-900 border-2 border-cyan-400/60 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl text-white">
        {/* Header */}
        <div className="p-5 flex items-center justify-between border-b border-slate-700 bg-slate-950">
          <div>
            <h2 className="text-2xl font-black flex items-center gap-2">
              <span>📚</span> Bách Khoa Quân Cờ & Khả Năng Mở Rộng
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Xem danh sách chi tiết các quân cờ hoặc tự tạo quân cờ mới vào game engine.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-lg"
          >
            ✕
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-5 pt-3 gap-3">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-5 py-2.5 rounded-t-xl text-sm font-bold border-b-2 transition-all ${
              activeTab === 'list'
                ? 'border-cyan-400 text-cyan-300 bg-slate-800/80'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            📖 Danh Sách Quân Cờ ({pieces.length})
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-5 py-2.5 rounded-t-xl text-sm font-bold border-b-2 transition-all ${
              activeTab === 'create'
                ? 'border-emerald-400 text-emerald-300 bg-slate-800/80'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            ➕ Tạo Quân Cờ Mới
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-5 overflow-y-auto">
          {activeTab === 'list' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pieces.map((p) => (
                <div
                  key={p.id}
                  className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 flex flex-col justify-between hover:border-cyan-400/60 transition-all shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl bg-slate-900 p-2 rounded-xl border border-slate-700">
                          {p.symbol}
                        </span>
                        <div>
                          <h4 className="text-base font-bold text-white">{p.vietnameseName}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-bold uppercase border border-cyan-500/30">
                              Vị trí: {p.role}
                            </span>
                            <span className="text-[10px] text-slate-400">ID: {p.id}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-yellow-400 bg-yellow-950 px-2.5 py-1 rounded-lg border border-yellow-500/40">
                          {p.cost}đ
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 my-2">{p.description}</p>

                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/80 p-2.5 rounded-xl border border-slate-700/60 text-slate-300">
                      <div>
                        <span className="text-cyan-400 font-semibold">Di chuyển:</span>{' '}
                        {p.moveRule.type.toUpperCase()}
                      </div>
                      <div>
                        <span className="text-amber-400 font-semibold">Sút/Chuyền:</span>{' '}
                        {p.kickRule.type.toUpperCase()} {p.kickRule.isLob ? '(Lốp bổng)' : ''}
                      </div>
                    </div>
                  </div>

                  {p.specialAbilityDesc && (
                    <div className="mt-3 text-xs text-emerald-300 bg-emerald-950/40 p-2 rounded-xl border border-emerald-500/20">
                      ✨ <strong>Đặc biệt:</strong> {p.specialAbilityDesc}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <form onSubmit={handleCreatePiece} className="max-w-2xl mx-auto flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300">Mã Định Danh (ID unique)</label>
                  <input
                    type="text"
                    required
                    placeholder="ví dụ: wizard, striker_x"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300">Tên Quân Cờ (Tiếng Việt)</label>
                  <input
                    type="text"
                    required
                    placeholder="ví dụ: Phù Thủy Tuyến Giữa"
                    value={vietnameseName}
                    onChange={(e) => setVietnameseName(e.target.value)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300">Biểu Tượng / Emoji</label>
                  <input
                    type="text"
                    required
                    placeholder="ví dụ: 🧙‍♂️, 🦅, 🚀, 🛡️"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300">Vị Trí Sở Trường</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as PieceRole)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="GK">GK (Thủ Môn)</option>
                    <option value="DEF">DEF (Hậu Vệ)</option>
                    <option value="MID">MID (Tiền Vệ)</option>
                    <option value="FWD">FWD (Tiền Đạo)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300">Chi Phí Lương (Cost 1-50đ)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={cost}
                    onChange={(e) => setCost(Number(e.target.value))}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300">Kiểu Di Chuyển (Primitive)</label>
                  <select
                    value={moveType}
                    onChange={(e) => setMoveType(e.target.value as PrimitiveType)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="step">Step (Bước ngắn N ô)</option>
                    <option value="slide">Slide (Trượt xa vô hạn đến khi cản)</option>
                    <option value="leap">Leap (Nhảy cóc vượt cản)</option>
                    <option value="cannon">Cannon (Trượt thẳng)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300">Kiểu Sút / Chuyền Bóng</label>
                  <select
                    value={kickType}
                    onChange={(e) => setKickType(e.target.value as PrimitiveType)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="step">Step (Sút ngắn N ô)</option>
                    <option value="slide">Slide (Sút xa xuyên tuyến)</option>
                    <option value="leap">Leap (Lốp bóng bổng qua đầu)</option>
                    <option value="cannon">Cannon (Bắn qua 1 quân làm ngòi)</option>
                  </select>
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={isLob}
                      onChange={(e) => setIsLob(e.target.checked)}
                      className="w-4 h-4 rounded text-cyan-500"
                    />
                    <span>Sút bổng qua đầu (Lob Shot)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">Mô Tả Quân Cờ</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả phong cách thi đấu..."
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">Kỹ Năng Đặc Biệt (Passive / Skill)</label>
                <input
                  type="text"
                  value={specialAbility}
                  onChange={(e) => setSpecialAbility(e.target.value)}
                  placeholder="ví dụ: Sút đại bác uy lực xé gió..."
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-slate-300"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-sm font-bold shadow-lg hover:from-emerald-400 hover:to-teal-300"
                >
                  🚀 Đăng Ký Quân Cờ Mới
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
