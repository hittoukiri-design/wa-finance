import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  Landmark,
  Pencil,
  Plus,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import Header from '../components/Header';
import { useAuth } from '../context/useAuth';
import { getSettings, listExpenses, saveSettings } from '../lib/firestore';

const currency = (amount) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(Number(amount || 0));

const DEFAULT_WALLETS = [
  { id: 'bank', name: 'Bank', threshold: '15%', balance: 387000, is_active: true, icon: 'landmark' },
  { id: 'cash', name: 'Cash', threshold: '30%', balance: 712500, is_active: true, icon: 'banknote' },
  { id: 'utama', name: 'Utama', threshold: '20%', balance: 8795000, is_active: true, icon: 'credit-card' },
];

export default function Dompet() {
  const { user } = useAuth();
  const [wallets, setWallets] = useState(DEFAULT_WALLETS);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState('');

  // Modals state
  const [editingWallet, setEditingWallet] = useState(null);
  const [walletForm, setWalletForm] = useState({ id: '', name: '', balance: '', threshold: '20%' });
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const [walletPageSize, setWalletPageSize] = useState(10);

  // Load from Firestore
  const loadData = useCallback(async () => {
    setBusy(true);
    try {
      const [settings, expenses] = await Promise.all([
        getSettings(user.uid).catch(() => ({})),
        listExpenses(user.uid).catch(() => []),
      ]);

      const walletExpenseMap = {};
      const walletIncomeMap = {};
      expenses.forEach((e) => {
        const wName = String(e.payment_channel || e.rekening || 'Cash').trim();
        const amt = Number(e.amount || 0);
        if (String(e.type || '').toLowerCase() === 'income') {
          walletIncomeMap[wName] = (walletIncomeMap[wName] || 0) + amt;
        } else {
          walletExpenseMap[wName] = (walletExpenseMap[wName] || 0) + amt;
        }
      });

      if (settings.wallets && Array.isArray(settings.wallets) && settings.wallets.length) {
        setWallets(settings.wallets);
      } else {
        const merged = DEFAULT_WALLETS.map((w) => {
          const inc = walletIncomeMap[w.name] || 0;
          const exp = walletExpenseMap[w.name] || 0;
          const liveBal = inc - exp;
          return {
            ...w,
            balance: liveBal > 0 ? liveBal : w.balance,
          };
        });
        setWallets(merged);
      }
    } catch (err) {
      setNotice(err.message || 'Gagal memuat data dompet.');
    } finally {
      setBusy(false);
    }
  }, [user.uid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenEditWallet = (w) => {
    setIsCreatingWallet(false);
    setEditingWallet(w);
    setWalletForm({
      id: w.id,
      name: w.name,
      balance: w.balance || '',
      threshold: w.threshold || '20%',
    });
  };

  const handleOpenCreateWallet = () => {
    setIsCreatingWallet(true);
    setEditingWallet({ id: '', name: '', balance: '', threshold: '20%' });
    setWalletForm({
      id: `w-${Date.now()}`,
      name: '',
      balance: '',
      threshold: '20%',
    });
  };

  const handleSaveWallet = async (e) => {
    e.preventDefault();
    if (!walletForm.name.trim()) {
      setNotice('Nama dompet wajib diisi.');
      return;
    }

    let updated;
    if (isCreatingWallet) {
      const newWallet = {
        id: walletForm.id || `w-${Date.now()}`,
        name: walletForm.name.trim(),
        balance: Number(walletForm.balance || 0),
        threshold: walletForm.threshold.trim() || '20%',
        is_active: true,
        icon: 'wallet',
      };
      updated = [...wallets, newWallet];
    } else {
      updated = wallets.map((w) => {
        if (w.id === walletForm.id) {
          return {
            ...w,
            name: walletForm.name.trim(),
            balance: Number(walletForm.balance || 0),
            threshold: walletForm.threshold.trim() || '20%',
          };
        }
        return w;
      });
    }

    setWallets(updated);
    setEditingWallet(null);
    try {
      await saveSettings(user.uid, { wallets: updated });
      setNotice('Dompet berhasil disimpan.');
    } catch (err) {
      setNotice(err.message || 'Gagal menyimpan dompet ke cloud.');
    }
  };

  const handleToggleWallet = async (w) => {
    const updated = wallets.map((item) => {
      if (item.id === w.id) {
        return { ...item, is_active: !item.is_active };
      }
      return item;
    });
    setWallets(updated);
    try {
      await saveSettings(user.uid, { wallets: updated });
      setNotice(`Dompet ${w.name} ${w.is_active ? 'dinonaktifkan' : 'diaktifkan'}.`);
    } catch (err) {
      setNotice('Gagal memperbarui status dompet.');
    }
  };

  const visibleWallets = wallets.slice(0, walletPageSize);

  return (
    <div className="mx-auto w-full max-w-[1450px] space-y-6">
      <Header title="Dompet" subtitle="Kelola sumber dana, rekening bank, saldo saat ini, dan peringatan saldo minimum." />

      {notice && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
          {notice}
        </div>
      )}

      {/* ════ SECTION: SUMBER DANA / DOMPET ════ */}
      <div className="rounded-[22px] border border-[#dcebd0] bg-[#f7fbf3] p-6 shadow-sm dark:border-[#244618] dark:bg-[#0c180e]">
        
        {/* Header Bar */}
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-[#358219] dark:text-[#76d446]">
              SUMBER DANA
            </div>
            <h2 className="text-xl font-black text-[#0e2a07] dark:text-[#f3ffe9]">
              Dompet
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Menampilkan 1–{visibleWallets.length} dari {wallets.length} dompet.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={walletPageSize}
              onChange={(e) => setWalletPageSize(Number(e.target.value))}
              className="rounded-full border border-[#dcebd0] bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 outline-none dark:border-[#263e1d] dark:bg-[#122214] dark:text-slate-200"
            >
              <option value={10}>10 baris</option>
              <option value={25}>25 baris</option>
              <option value={50}>50 baris</option>
            </select>

            <button
              onClick={handleOpenCreateWallet}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#1a5611] px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-[#123d0c] dark:bg-[#76d446] dark:text-[#0d170a]"
            >
              <Plus width="14" height="14" />
              Buat dompet
            </button>
          </div>
        </div>

        {/* Wallets List Rows */}
        <div className="mt-5 space-y-2.5">
          {visibleWallets.map((w) => {
            const isInactive = !w.is_active;
            return (
              <div
                key={w.id}
                className={`flex items-center justify-between rounded-2xl border border-[#dcebd0] px-5 py-4 transition ${
                  isInactive
                    ? 'bg-[#f0f5ec]/50 opacity-60 dark:bg-[#111f13]/40'
                    : 'bg-[#eaf4e2] hover:border-[#b8dc9f] dark:bg-[#142616] dark:border-[#263e1d] dark:hover:border-[#38642a]'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80 text-[#245c10] shadow-sm dark:bg-[#1c3520] dark:text-[#76d446]">
                    <Wallet width="19" height="19" />
                  </div>
                  <div>
                    <div className="font-black text-[#0e2a07] dark:text-[#f3ffe9]">
                      {w.name}
                    </div>
                    <div className="text-xs text-[#436d32] dark:text-[#a8cf93]">
                      Ingatkan di {w.threshold || '20%'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right font-black text-[#0e2a07] dark:text-[#f3ffe9]">
                    {currency(w.balance)}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditWallet(w)}
                      title="Edit dompet"
                      className="rounded-lg p-2 text-slate-600 transition hover:bg-white/60 hover:text-black dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                    >
                      <Pencil width="16" height="16" />
                    </button>
                    <button
                      onClick={() => handleToggleWallet(w)}
                      title={w.is_active ? 'Nonaktifkan dompet' : 'Aktifkan dompet'}
                      className={`rounded-lg p-2 transition ${
                        w.is_active
                          ? 'text-slate-500 hover:bg-red-500/10 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400'
                          : 'text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400'
                      }`}
                    >
                      {w.is_active ? <EyeOff width="16" height="16" /> : <Eye width="16" height="16" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* ════ MODAL: EDIT / CREATE DOMPET ════ */}
      {editingWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-[22px] border border-[#263e1d] bg-[#101b12] p-6 shadow-2xl dark:border-[#263e1d] dark:bg-[#101b12]">
            <div className="flex items-center justify-between border-b border-[#243a1a] pb-4">
              <h2 className="text-lg font-bold text-white">
                {isCreatingWallet ? 'Buat Dompet Baru' : 'Edit Dompet'}
              </h2>
              <button
                type="button"
                onClick={() => setEditingWallet(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X width="18" height="18" />
              </button>
            </div>

            <form onSubmit={handleSaveWallet} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">Nama Dompet</label>
                <input
                  required
                  value={walletForm.name}
                  onChange={(e) => setWalletForm((c) => ({ ...c, name: e.target.value }))}
                  placeholder="Contoh: Bank, Cash, BCA, Utama"
                  className="w-full rounded-xl border border-[#2b4421] bg-[#162519] px-4 py-2.5 text-sm font-medium text-white outline-none transition focus:border-[#76d446]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">Saldo (Rp)</label>
                <input
                  required
                  type="number"
                  value={walletForm.balance}
                  onChange={(e) => setWalletForm((c) => ({ ...c, balance: e.target.value }))}
                  placeholder="Contoh: 500000"
                  className="w-full rounded-xl border border-[#2b4421] bg-[#162519] px-4 py-2.5 text-sm font-medium text-white outline-none transition focus:border-[#76d446]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">Pengingat Saldo Minimum</label>
                <input
                  value={walletForm.threshold}
                  onChange={(e) => setWalletForm((c) => ({ ...c, threshold: e.target.value }))}
                  placeholder="Contoh: 15%, 20%, 30%"
                  className="w-full rounded-xl border border-[#2b4421] bg-[#162519] px-4 py-2.5 text-sm font-medium text-white outline-none transition focus:border-[#76d446]"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingWallet(null)}
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
