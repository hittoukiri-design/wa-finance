import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Tag,
  X,
} from 'lucide-react';
import Header from '../components/Header';
import { useAuth } from '../context/useAuth';
import { getSettings, saveSettings } from '../lib/firestore';

const currency = (amount) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(Number(amount || 0));

const DEFAULT_CATEGORY_BUDGETS = [
  { id: 'makan', name: 'Makan', emoji: '🍜', budget: 1200000, threshold: '80%', is_active: true },
  { id: 'belanja', name: 'Belanja', emoji: '🛒', budget: 2000000, threshold: 'Rp 1.500.000', is_active: true },
  { id: 'transportasi', name: 'Transportasi', emoji: '🚗', budget: 700000, threshold: '80%', is_active: true },
  { id: 'tagihan', name: 'Tagihan', emoji: '💳', budget: 1500000, threshold: '80%', is_active: true },
  { id: 'rumah', name: 'Rumah', emoji: '🏠', budget: 900000, threshold: '80%', is_active: true },
  { id: 'kesehatan', name: 'Kesehatan', emoji: '🏥', budget: 800000, threshold: '80%', is_active: true },
  { id: 'pendidikan', name: 'Pendidikan', emoji: '🎓', budget: 1000000, threshold: '80%', is_active: true },
  { id: 'hiburan', name: 'Hiburan', emoji: '🎮', budget: 600000, threshold: '80%', is_active: true },
  { id: 'perawatan', name: 'Perawatan', emoji: '🐱', budget: 500000, threshold: '80%', is_active: true },
  { id: 'sosial', name: 'Sosial', emoji: '🤝', budget: 300000, threshold: '80%', is_active: true },
  { id: 'keluarga', name: 'Keluarga', emoji: '👥', budget: 800000, threshold: '80%', is_active: true },
  { id: 'lainnya', name: 'Lainnya', emoji: '🏷️', budget: 500000, threshold: '80%', is_active: true },
];

const CATEGORY_EMOJIS = {
  Makan: '🍜',
  Belanja: '🛒',
  Transportasi: '🚗',
  Tagihan: '💳',
  Rumah: '🏠',
  Kesehatan: '🏥',
  Pendidikan: '🎓',
  Hiburan: '🎮',
  Perawatan: '🐱',
  Sosial: '🤝',
  Keluarga: '👥',
  Gaji: '💰',
  Lainnya: '🏷️',
};

export default function Categories() {
  const { user } = useAuth();
  const [categoryBudgets, setCategoryBudgets] = useState(DEFAULT_CATEGORY_BUDGETS);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState('');

  // Modals state
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ id: '', name: '', emoji: '🏷️', budget: '', threshold: '80%' });
  const [categoryPageSize, setCategoryPageSize] = useState(10);

  // Load from Firestore
  const loadData = useCallback(async () => {
    setBusy(true);
    try {
      const settings = await getSettings(user.uid).catch(() => ({}));
      if (settings.category_budgets && Array.isArray(settings.category_budgets) && settings.category_budgets.length) {
        setCategoryBudgets(settings.category_budgets);
      }
    } catch (err) {
      setNotice(err.message || 'Gagal memuat data kategori.');
    } finally {
      setBusy(false);
    }
  }, [user.uid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenEditCategory = (cat) => {
    setEditingCategory(cat);
    setCategoryForm({
      id: cat.id,
      name: cat.name,
      emoji: cat.emoji || CATEGORY_EMOJIS[cat.name] || '🏷️',
      budget: cat.budget || '',
      threshold: cat.threshold || '80%',
    });
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!categoryForm.budget || Number(categoryForm.budget) <= 0) {
      setNotice('Budget bulanan wajib diisi.');
      return;
    }

    const updated = categoryBudgets.map((cat) => {
      if (cat.id === categoryForm.id) {
        return {
          ...cat,
          budget: Number(categoryForm.budget),
          threshold: categoryForm.threshold.trim() || '80%',
        };
      }
      return cat;
    });

    setCategoryBudgets(updated);
    setEditingCategory(null);
    try {
      await saveSettings(user.uid, { category_budgets: updated });
      setNotice('Budget kategori berhasil disimpan.');
    } catch (err) {
      setNotice(err.message || 'Gagal menyimpan budget kategori.');
    }
  };

  const handleToggleCategory = async (cat) => {
    const updated = categoryBudgets.map((item) => {
      if (item.id === cat.id) {
        return { ...item, is_active: !item.is_active };
      }
      return item;
    });
    setCategoryBudgets(updated);
    try {
      await saveSettings(user.uid, { category_budgets: updated });
      setNotice(`Kategori ${cat.name} ${cat.is_active ? 'dinonaktifkan' : 'diaktifkan'}.`);
    } catch (err) {
      setNotice('Gagal memperbarui status kategori.');
    }
  };

  const visibleCategories = categoryBudgets.slice(0, categoryPageSize);

  return (
    <div className="mx-auto w-full max-w-[1450px] space-y-6">
      <Header title="Kategori & Proteksi Budget" subtitle="Kelola kategori keuangan, batas budget bulanan, dan ambang batas peringatan WhatsApp." />

      {notice && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
          {notice}
        </div>
      )}

      {/* ════ SECTION: PROTEKSI BUDGET / KATEGORI ════ */}
      <div className="rounded-[22px] border border-[#dcebd0] bg-[#f7fbf3] p-6 shadow-sm dark:border-[#244618] dark:bg-[#0c180e]">
        
        {/* Header Bar */}
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-[#358219] dark:text-[#76d446]">
              PROTEKSI BUDGET
            </div>
            <h2 className="text-xl font-black text-[#0e2a07] dark:text-[#f3ffe9]">
              Kategori
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Menampilkan 1–{visibleCategories.length} dari {categoryBudgets.length} kategori.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={categoryPageSize}
              onChange={(e) => setCategoryPageSize(Number(e.target.value))}
              className="rounded-full border border-[#dcebd0] bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 outline-none dark:border-[#263e1d] dark:bg-[#122214] dark:text-slate-200"
            >
              <option value={10}>10 baris</option>
              <option value={25}>25 baris</option>
              <option value={50}>50 baris</option>
            </select>
          </div>
        </div>

        {/* Categories List Rows */}
        <div className="mt-5 space-y-2.5">
          {visibleCategories.map((cat) => {
            const isInactive = !cat.is_active;
            const emoji = cat.emoji || CATEGORY_EMOJIS[cat.name] || '🏷️';
            return (
              <div
                key={cat.id}
                className={`flex items-center justify-between rounded-2xl border border-[#dcebd0] px-5 py-4 transition ${
                  isInactive
                    ? 'bg-[#f0f5ec]/50 opacity-60 dark:bg-[#111f13]/40'
                    : 'bg-[#eaf4e2] hover:border-[#b8dc9f] dark:bg-[#142616] dark:border-[#263e1d] dark:hover:border-[#38642a]'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80 text-xl shadow-sm dark:bg-[#1c3520]">
                    {emoji}
                  </div>
                  <div>
                    <div className="font-black text-[#0e2a07] dark:text-[#f3ffe9]">
                      {cat.name}
                    </div>
                    <div className="text-xs text-[#436d32] dark:text-[#a8cf93]">
                      Budget {currency(cat.budget)} / bulanan · Ingatkan di {cat.threshold || '80%'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEditCategory(cat)}
                    title="Edit budget kategori"
                    className="rounded-lg p-2 text-slate-600 transition hover:bg-white/60 hover:text-black dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    <Pencil width="16" height="16" />
                  </button>
                  <button
                    onClick={() => handleToggleCategory(cat)}
                    title={cat.is_active ? 'Nonaktifkan limit kategori' : 'Aktifkan limit kategori'}
                    className={`rounded-lg p-2 transition ${
                      cat.is_active
                        ? 'text-slate-500 hover:bg-red-500/10 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400'
                        : 'text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400'
                    }`}
                  >
                    {cat.is_active ? <EyeOff width="16" height="16" /> : <Eye width="16" height="16" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* ════ MODAL: EDIT BUDGET KATEGORI ════ */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-[22px] border border-[#263e1d] bg-[#101b12] p-6 shadow-2xl dark:border-[#263e1d] dark:bg-[#101b12]">
            <div className="flex items-center justify-between border-b border-[#243a1a] pb-4">
              <h2 className="text-lg font-bold text-white">
                Edit Budget: {editingCategory.name}
              </h2>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X width="18" height="18" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">Budget Bulanan (Rp)</label>
                <input
                  required
                  type="number"
                  value={categoryForm.budget}
                  onChange={(e) => setCategoryForm((c) => ({ ...c, budget: e.target.value }))}
                  placeholder="Contoh: 1200000"
                  className="w-full rounded-xl border border-[#2b4421] bg-[#162519] px-4 py-2.5 text-sm font-medium text-white outline-none transition focus:border-[#76d446]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">Ambang Pengingat (WhatsApp Alert)</label>
                <input
                  value={categoryForm.threshold}
                  onChange={(e) => setCategoryForm((c) => ({ ...c, threshold: e.target.value }))}
                  placeholder="Contoh: 80% atau Rp 1.500.000"
                  className="w-full rounded-xl border border-[#2b4421] bg-[#162519] px-4 py-2.5 text-sm font-medium text-white outline-none transition focus:border-[#76d446]"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="rounded-full border border-slate-700 bg-transparent px-6 py-2 text-xs font-bold text-slate-300 hover:bg-white/5"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-[#76d446] px-7 py-2 text-xs font-black text-[#0d170a] shadow-lg transition hover:bg-[#64be36]"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
