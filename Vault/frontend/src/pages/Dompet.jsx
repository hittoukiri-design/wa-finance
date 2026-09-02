import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Star,
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

const BASE_CATEGORIES = [
  { id: 'tabungan', name: 'Tabungan', emoji: '🏦', defaultBudget: 0, threshold: '80%' },
  { id: 'investasi', name: 'Investasi', emoji: '📈', defaultBudget: 0, threshold: '80%' },
  { id: 'makan', name: 'Makan', emoji: '🍜', defaultBudget: 0, threshold: '80%' },
  { id: 'belanja', name: 'Belanja', emoji: '🛒', defaultBudget: 0, threshold: '80%' },
  { id: 'transportasi', name: 'Transportasi', emoji: '🚗', defaultBudget: 0, threshold: '80%' },
  { id: 'tagihan', name: 'Tagihan', emoji: '💳', defaultBudget: 0, threshold: '80%' },
  { id: 'rumah', name: 'Rumah', emoji: '🏠', defaultBudget: 0, threshold: '80%' },
  { id: 'kesehatan', name: 'Kesehatan', emoji: '🏥', defaultBudget: 0, threshold: '80%' },
  { id: 'pendidikan', name: 'Pendidikan', emoji: '🎓', defaultBudget: 0, threshold: '80%' },
  { id: 'hiburan', name: 'Hiburan', emoji: '🎮', defaultBudget: 0, threshold: '80%' },
  { id: 'perawatan', name: 'Perawatan', emoji: '🐱', defaultBudget: 0, threshold: '80%' },
  { id: 'sosial', name: 'Sosial', emoji: '🤝', defaultBudget: 0, threshold: '80%' },
  { id: 'keluarga', name: 'Keluarga', emoji: '👥', defaultBudget: 0, threshold: '80%' },
  { id: 'lainnya', name: 'Lainnya', emoji: '🏷️', defaultBudget: 0, threshold: '80%' },
];

const CATEGORY_EMOJIS = {
  Tabungan: '🏦',
  Investasi: '📈',
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

const COMMON_EMOJIS = ['🍜', '🛒', '🚗', '💳', '🏠', '🏥', '🎓', '🎮', '🐱', '🤝', '👥', '💰', '☕', '📈', '✈️', '🎁', '⚡', '🏷️'];

function getCategoryIcon(name) {
  return CATEGORY_EMOJIS[name] || '🏷️';
}

export default function Dompet() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [savedSettings, setSavedSettings] = useState({});
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState('');

  // Wallet Modal state
  const [editingWallet, setEditingWallet] = useState(null);
  const [walletForm, setWalletForm] = useState({ id: '', name: '', initial_balance: '', account_number: '', threshold: '20%' });
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const [deletingWallet, setDeletingWallet] = useState(null);

  // Category Modal state
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ id: '', name: '', emoji: '🏷️', budget: '', threshold: '80%' });
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState(null);

  // Rows state
  const [walletPageSize, setWalletPageSize] = useState(10);
  const [categoryPageSize, setCategoryPageSize] = useState(10);

  // Load from Firestore
  const loadData = useCallback(async () => {
    setBusy(true);
    try {
      const [settings, fetchedExpenses] = await Promise.all([
        getSettings(user.uid).catch(() => ({})),
        listExpenses(user.uid).catch(() => []),
      ]);
      setSavedSettings(settings || {});
      setExpenses(fetchedExpenses || []);
    } catch (err) {
      setNotice(err.message || 'Gagal memuat data dompet.');
    } finally {
      setBusy(false);
    }
  }, [user.uid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Calculate Real Wallets & Balances from User Expenses ──
  const computedWallets = useMemo(() => {
    const walletExpenseMap = {};
    const walletIncomeMap = {};
    const displayNameMap = {};
    const uniqueKeys = new Set();
    const deletedWallets = new Set((savedSettings.deleted_wallets || []).map((w) => String(w).toLowerCase()));

    expenses.forEach((e) => {
      const raw = String(e.payment_channel || e.rekening || '').trim();
      if (!raw) return;
      const key = raw.toLowerCase();
      uniqueKeys.add(key);
      if (!displayNameMap[key]) displayNameMap[key] = raw;
      const amt = Number(e.amount || 0);
      if (String(e.type || '').toLowerCase() === 'income') {
        walletIncomeMap[key] = (walletIncomeMap[key] || 0) + amt;
      } else {
        walletExpenseMap[key] = (walletExpenseMap[key] || 0) + amt;
      }
    });

    const savedWalletsList = savedSettings.wallets && Array.isArray(savedSettings.wallets) ? savedSettings.wallets : [];
    const savedMap = {};
    savedWalletsList.forEach((sw) => {
      if (sw.name) {
        const key = sw.name.toLowerCase();
        savedMap[key] = sw;
        uniqueKeys.add(key);
        displayNameMap[key] = sw.name; // Display name dari savedSettings
      }
    });

    if (uniqueKeys.size === 0) {
      uniqueKeys.add('cash');
      displayNameMap['cash'] = 'Cash';
    }

    return Array.from(uniqueKeys)
      .filter((key) => !deletedWallets.has(key))
      .map((key) => {
        const sw = savedMap[key];
        const displayName = sw?.name || displayNameMap[key] || key;
        const totalIncome = walletIncomeMap[key] || 0;
        const totalExpense = walletExpenseMap[key] || 0;
        const initialBal = sw && sw.initial_balance !== undefined ? Number(sw.initial_balance) : (sw?.balance || 0);
        const liveBal = initialBal + totalIncome - totalExpense;

        return {
          id: sw?.id || `w-${key.replace(/\s+/g, '-')}`,
          name: displayName,
          threshold: sw?.threshold || '20%',
          balance: liveBal,
          initial_balance: initialBal,
          account_number: sw?.account_number || '',
          is_active: sw ? sw.is_active !== false : true,
        };
      });
  }, [expenses, savedSettings]);

  // ── Calculate Real Category Spending vs Budget Limits ──
  const computedCategories = useMemo(() => {
    const catSpentMap = {};
    const displayNameMap = {};
    const uniqueKeys = new Set();
    BASE_CATEGORIES.forEach((b) => {
      const key = b.name.toLowerCase();
      uniqueKeys.add(key);
      displayNameMap[key] = b.name;
    });
    const deletedCategories = new Set((savedSettings.deleted_categories || []).map((c) => String(c).toLowerCase()));

    expenses.forEach((e) => {
      if (String(e.type || '').toLowerCase() !== 'income') {
        const raw = String(e.category || 'Lainnya').trim();
        const key = raw.toLowerCase();
        uniqueKeys.add(key);
        if (!displayNameMap[key]) displayNameMap[key] = raw;
        catSpentMap[key] = (catSpentMap[key] || 0) + Number(e.amount || 0);
      }
    });

    const savedCategoryBudgets = savedSettings.category_budgets && Array.isArray(savedSettings.category_budgets)
      ? savedSettings.category_budgets
      : [];
    const savedCatMap = {};
    savedCategoryBudgets.forEach((sc) => {
      if (sc.name) {
        const key = sc.name.toLowerCase();
        savedCatMap[key] = sc;
        uniqueKeys.add(key);
        displayNameMap[key] = sc.name;
      }
    });

    return Array.from(uniqueKeys)
      .filter((key) => !deletedCategories.has(key))
      .map((key) => {
        const sc = savedCatMap[key];
        const base = BASE_CATEGORIES.find((b) => b.name.toLowerCase() === key);
        const displayName = sc?.name || displayNameMap[key] || key;
        const spent = catSpentMap[key] || 0;
        const budget = sc?.budget !== undefined ? Number(sc.budget) : (base?.defaultBudget || 0);
        const threshold = sc?.threshold || base?.threshold || '80%';
        const emoji = sc?.emoji || base?.emoji || getCategoryIcon(displayName);
        const is_active = sc ? sc.is_active !== false : true;

        return {
          id: sc?.id || base?.id || `cat-${key.replace(/\s+/g, '-')}`,
          name: displayName,
          emoji,
          budget,
          spent,
          threshold,
          is_active,
        };
      });
  }, [expenses, savedSettings]);

  // ── Handlers for Wallet ──
  const handleOpenEditWallet = (w) => {
    setIsCreatingWallet(false);
    setEditingWallet(w);
    setWalletForm({
      id: w.id,
      name: w.name,
      initial_balance: w.initial_balance !== undefined ? String(w.initial_balance) : String(w.balance || 0),
      account_number: w.account_number || '',
      threshold: w.threshold || '20%',
    });
  };

  const handleOpenCreateWallet = () => {
    setIsCreatingWallet(true);
    setEditingWallet({ id: '', name: '', initial_balance: '0', account_number: '', threshold: '20%' });
    setWalletForm({
      id: `w-${Date.now()}`,
      name: '',
      initial_balance: '0',
      account_number: '',
      threshold: '20%',
    });
  };

  const handleSaveWallet = async (e) => {
    e.preventDefault();
    if (!walletForm.name.trim()) {
      setNotice('Nama dompet wajib diisi.');
      return;
    }

    const currentSaved = savedSettings.wallets && Array.isArray(savedSettings.wallets) ? savedSettings.wallets : [];
    let updated;
    if (isCreatingWallet) {
      const newWallet = {
        id: walletForm.id || `w-${Date.now()}`,
        name: walletForm.name.trim(),
        initial_balance: Number(walletForm.initial_balance || 0),
        account_number: (walletForm.account_number || '').trim(),
        threshold: walletForm.threshold.trim() || '20%',
        is_active: true,
      };
      // remove from deleted_wallets if previously deleted
      const nextDeleted = (savedSettings.deleted_wallets || []).filter((name) => name.toLowerCase() !== newWallet.name.toLowerCase());
      updated = [...currentSaved.filter((w) => w.name.toLowerCase() !== newWallet.name.toLowerCase()), newWallet];
      setSavedSettings((prev) => ({ ...prev, wallets: updated, deleted_wallets: nextDeleted }));
      try {
        await saveSettings(user.uid, { wallets: updated, deleted_wallets: nextDeleted });
        setNotice(`Dompet ${newWallet.name} berhasil ditambahkan.`);
      } catch (err) {
        setNotice(err.message || 'Gagal menyimpan dompet.');
      }
    } else {
      const baseList = savedSettings.wallets && Array.isArray(savedSettings.wallets) ? savedSettings.wallets : [];
      let found = false;
      const targetNameLower = walletForm.name.trim().toLowerCase();
      updated = baseList.map((w) => {
        if (w.id === walletForm.id || (w.name && w.name.toLowerCase() === targetNameLower)) {
          found = true;
          return {
            id: w.id || walletForm.id || `w-${Date.now()}`,
            name: walletForm.name.trim(),
            initial_balance: Number(walletForm.initial_balance || 0),
            account_number: (walletForm.account_number || '').trim(),
            threshold: walletForm.threshold.trim() || '20%',
            is_active: w.is_active !== false,
          };
        }
        return {
          id: w.id,
          name: w.name,
          initial_balance: Number(w.initial_balance || 0),
          account_number: (w.account_number || '').trim(),
          threshold: w.threshold || '20%',
          is_active: w.is_active !== false,
        };
      });
      if (!found) {
        updated.push({
          id: walletForm.id || `w-${Date.now()}`,
          name: walletForm.name.trim(),
          initial_balance: Number(walletForm.initial_balance || 0),
          account_number: (walletForm.account_number || '').trim(),
          threshold: walletForm.threshold.trim() || '20%',
          is_active: true,
        });
      }
      setSavedSettings((prev) => ({ ...prev, wallets: updated }));
      try {
        await saveSettings(user.uid, { wallets: updated });
        setNotice('Perubahan dompet berhasil disimpan.');
      } catch (err) {
        setNotice(err.message || 'Gagal menyimpan dompet.');
      }
    }

    setEditingWallet(null);
  };

  const handleDeleteWallet = async () => {
    if (!deletingWallet) return;
    const wName = deletingWallet.name;
    const nextSaved = (savedSettings.wallets || []).filter((w) => w.name.toLowerCase() !== wName.toLowerCase());
    const nextDeleted = Array.from(new Set([...(savedSettings.deleted_wallets || []), wName]));

    setSavedSettings((prev) => ({ ...prev, wallets: nextSaved, deleted_wallets: nextDeleted }));
    setDeletingWallet(null);
    try {
      await saveSettings(user.uid, { wallets: nextSaved, deleted_wallets: nextDeleted });
      setNotice(`Dompet ${wName} berhasil dihapus.`);
    } catch (err) {
      setNotice('Gagal menghapus dompet dari server.');
    }
  };

  const handleToggleWallet = async (w) => {
    const updated = computedWallets.map((item) => {
      if (item.id === w.id) {
        return { ...item, is_active: !item.is_active };
      }
      return item;
    });
    setSavedSettings((prev) => ({ ...prev, wallets: updated }));
    try {
      await saveSettings(user.uid, { wallets: updated });
      setNotice(`Dompet ${w.name} ${w.is_active ? 'dinonaktifkan' : 'diaktifkan'}.`);
    } catch (err) {
      setNotice('Gagal memperbarui status dompet.');
    }
  };

  const handleSetPrimaryWallet = async (walletName) => {
    setSavedSettings((prev) => ({ ...prev, primary_wallet: walletName }));
    try {
      await saveSettings(user.uid, { primary_wallet: walletName });
      setNotice(`Dompet ${walletName} berhasil dijadikan Dompet Utama.`);
    } catch (err) {
      setNotice('Gagal menyimpan dompet utama.');
    }
  };

  const primaryWalletName = savedSettings.primary_wallet || (computedWallets.some((w) => w.name.toLowerCase() === 'bca') ? 'BCA' : computedWallets[0]?.name || 'Cash');

  // ── Handlers for Category ──
  const handleOpenCreateCategory = () => {
    setIsCreatingCategory(true);
    setEditingCategory({ id: '', name: '', emoji: '🏷️', budget: '', threshold: '80%' });
    setCategoryForm({
      id: `cat-${Date.now()}`,
      name: '',
      emoji: '🏷️',
      budget: '',
      threshold: '80%',
    });
  };

  const handleOpenEditCategory = (cat) => {
    setIsCreatingCategory(false);
    setEditingCategory(cat);
    setCategoryForm({
      id: cat.id,
      name: cat.name,
      emoji: cat.emoji || '🏷️',
      budget: cat.budget !== undefined ? String(cat.budget) : '0',
      threshold: cat.threshold || '80%',
    });
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      setNotice('Nama kategori wajib diisi.');
      return;
    }

    const currentSaved = savedSettings.category_budgets && Array.isArray(savedSettings.category_budgets)
      ? savedSettings.category_budgets
      : [];

    let updated;
    if (isCreatingCategory) {
      const newCat = {
        id: categoryForm.id || `cat-${Date.now()}`,
        name: categoryForm.name.trim(),
        emoji: categoryForm.emoji || '🏷️',
        budget: Number(categoryForm.budget || 0),
        threshold: categoryForm.threshold.trim() || '80%',
        is_active: true,
      };
      const nextDeleted = (savedSettings.deleted_categories || []).filter((name) => name.toLowerCase() !== newCat.name.toLowerCase());
      updated = [...currentSaved.filter((c) => c.name.toLowerCase() !== newCat.name.toLowerCase()), newCat];
      setSavedSettings((prev) => ({ ...prev, category_budgets: updated, deleted_categories: nextDeleted }));
      try {
        await saveSettings(user.uid, { category_budgets: updated, deleted_categories: nextDeleted });
        setNotice(`Kategori ${newCat.name} berhasil ditambahkan.`);
      } catch (err) {
        setNotice(err.message || 'Gagal menyimpan kategori.');
      }
    } else {
      updated = computedCategories.map((cat) => {
        if (cat.id === categoryForm.id || cat.name.toLowerCase() === categoryForm.name.trim().toLowerCase()) {
          return {
            ...cat,
            name: categoryForm.name.trim(),
            emoji: categoryForm.emoji || '🏷️',
            budget: Number(categoryForm.budget || 0),
            threshold: categoryForm.threshold.trim() || '80%',
          };
        }
        return cat;
      });
      setSavedSettings((prev) => ({ ...prev, category_budgets: updated }));
      try {
        await saveSettings(user.uid, { category_budgets: updated });
        setNotice('Perubahan kategori berhasil disimpan.');
      } catch (err) {
        setNotice(err.message || 'Gagal menyimpan kategori.');
      }
    }

    setEditingCategory(null);
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return;
    const catName = deletingCategory.name;
    const nextSaved = (savedSettings.category_budgets || []).filter((c) => c.name.toLowerCase() !== catName.toLowerCase());
    const nextDeleted = Array.from(new Set([...(savedSettings.deleted_categories || []), catName]));

    setSavedSettings((prev) => ({ ...prev, category_budgets: nextSaved, deleted_categories: nextDeleted }));
    setDeletingCategory(null);
    try {
      await saveSettings(user.uid, { category_budgets: nextSaved, deleted_categories: nextDeleted });
      setNotice(`Kategori ${catName} berhasil dihapus.`);
    } catch (err) {
      setNotice('Gagal menghapus kategori dari server.');
    }
  };

  const handleToggleCategory = async (cat) => {
    const updated = computedCategories.map((item) => {
      if (item.id === cat.id) {
        return { ...item, is_active: !item.is_active };
      }
      return item;
    });
    setSavedSettings((prev) => ({ ...prev, category_budgets: updated }));
    try {
      await saveSettings(user.uid, { category_budgets: updated });
      setNotice(`Limit kategori ${cat.name} ${cat.is_active ? 'dinonaktifkan' : 'diaktifkan'}.`);
    } catch (err) {
      setNotice('Gagal memperbarui status limit kategori.');
    }
  };

  const visibleWallets = computedWallets.slice(0, walletPageSize);
  const visibleCategories = computedCategories.slice(0, categoryPageSize);

  return (
    <div className="mx-auto w-full max-w-[1450px] space-y-6">
      <Header title="Dompet & Proteksi Budget" subtitle="Kelola sumber dana, saldo real-time, dan proteksi budget bulanan per kategori." />

      {notice && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
          {notice}
        </div>
      )}

      {/* ════ SECTION 1: SUMBER DANA / DOMPET ════ */}
      <div className="rounded-[22px] border border-[#d6e4be] bg-[#eaf2da] p-6 shadow-sm dark:border-[#244618] dark:bg-[#0c180e]">
        
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
              Menampilkan 1–{visibleWallets.length} dari {computedWallets.length} dompet aktif.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={walletPageSize}
              onChange={(e) => setWalletPageSize(Number(e.target.value))}
              className="rounded-full border border-[#d6e4be] bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 outline-none dark:border-[#263e1d] dark:bg-[#122214] dark:text-slate-200"
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
            const isPrimary = w.name.toLowerCase() === primaryWalletName.toLowerCase();
            return (
              <div
                key={w.id}
                className={`flex items-center justify-between rounded-2xl border border-[#d6e4be] px-5 py-4 transition ${
                  isInactive
                    ? 'bg-[#f0f5ec]/50 opacity-60 dark:bg-[#111f13]/40'
                    : 'bg-[#f5faeb] hover:border-[#b8dc9f] dark:bg-[#142616] dark:border-[#263e1d] dark:hover:border-[#38642a]'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80 text-[#245c10] shadow-sm dark:bg-[#1c3520] dark:text-[#76d446]">
                    <Wallet width="19" height="19" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-[#0e2a07] dark:text-[#f3ffe9]">
                        {w.name}
                      </span>
                      {isPrimary && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[9.5px] font-black text-amber-700 dark:text-amber-300">
                          <Star width="10" height="10" fill="currentColor" /> UTAMA
                        </span>
                      )}
                      {w.account_number && (
                        <span className="rounded-md border border-[#d6e4be] bg-white px-1.5 py-0.5 text-[9.5px] font-bold text-slate-600 dark:border-[#263e1d] dark:bg-[#162519] dark:text-slate-300">
                          •••• {w.account_number.slice(-4)}
                        </span>
                      )}
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
                      onClick={() => handleSetPrimaryWallet(w.name)}
                      title={isPrimary ? 'Dompet Utama saat ini' : 'Jadikan Dompet Utama'}
                      className={`rounded-lg p-2 transition ${
                        isPrimary
                          ? 'text-amber-500 bg-amber-500/10 dark:text-amber-400'
                          : 'text-slate-400 hover:text-amber-500 hover:bg-amber-500/10'
                      }`}
                    >
                      <Star width="16" height="16" fill={isPrimary ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={() => handleOpenEditWallet(w)}
                      title="Edit saldo / pengaturan dompet"
                      className="rounded-lg p-2 text-slate-600 transition hover:bg-white/60 hover:text-black dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                    >
                      <Pencil width="16" height="16" />
                    </button>
                    <button
                      onClick={() => setDeletingWallet(w)}
                      title="Hapus dompet"
                      className="rounded-lg p-2 text-red-500 transition hover:bg-red-500/10 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/20"
                    >
                      <Trash2 width="16" height="16" />
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

      {/* ════ SECTION 2: PROTEKSI BUDGET / KATEGORI ════ */}
      <div className="rounded-[22px] border border-[#d6e4be] bg-[#eaf2da] p-6 shadow-sm dark:border-[#244618] dark:bg-[#0c180e]">
        
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
              Menampilkan 1–{visibleCategories.length} dari {computedCategories.length} kategori keuangan.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={categoryPageSize}
              onChange={(e) => setCategoryPageSize(Number(e.target.value))}
              className="rounded-full border border-[#d6e4be] bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 outline-none dark:border-[#263e1d] dark:bg-[#122214] dark:text-slate-200"
            >
              <option value={10}>10 baris</option>
              <option value={25}>25 baris</option>
              <option value={50}>50 baris</option>
            </select>

            <button
              onClick={handleOpenCreateCategory}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#1a5611] px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-[#123d0c] dark:bg-[#76d446] dark:text-[#0d170a]"
            >
              <Plus width="14" height="14" />
              Tambah kategori
            </button>
          </div>
        </div>

        {/* Categories List Rows */}
        <div className="mt-5 space-y-2.5">
          {visibleCategories.map((cat) => {
            const isInactive = !cat.is_active;
            const hasBudget = cat.budget > 0;
            return (
              <div
                key={cat.id}
                className={`flex items-center justify-between rounded-2xl border border-[#d6e4be] px-5 py-4 transition ${
                  isInactive
                    ? 'bg-[#f0f5ec]/50 opacity-60 dark:bg-[#111f13]/40'
                    : 'bg-[#f5faeb] hover:border-[#b8dc9f] dark:bg-[#142616] dark:border-[#263e1d] dark:hover:border-[#38642a]'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80 text-xl shadow-sm dark:bg-[#1c3520]">
                    {cat.emoji}
                  </div>
                  <div>
                    <div className="font-black text-[#0e2a07] dark:text-[#f3ffe9]">
                      {cat.name}
                    </div>
                    <div className="text-xs text-[#436d32] dark:text-[#a8cf93]">
                      {hasBudget
                        ? `Budget ${currency(cat.budget)} / bulanan · Terpakai ${currency(cat.spent)} (${Math.round((cat.spent / cat.budget) * 100)}%) · Ingatkan di ${cat.threshold || '80%'}`
                        : `Terpakai ${currency(cat.spent)} (Budget belum diatur)`}
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
                    onClick={() => setDeletingCategory(cat)}
                    title="Hapus kategori"
                    className="rounded-lg p-2 text-red-500 transition hover:bg-red-500/10 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/20"
                  >
                    <Trash2 width="16" height="16" />
                  </button>
                  <button
                    onClick={() => handleToggleCategory(cat)}
                    title={cat.is_active ? 'Nonaktifkan proteksi' : 'Aktifkan proteksi'}
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
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">Saldo Awal / Penyesuaian Saldo (Rp)</label>
                <input
                  required
                  type="number"
                  value={walletForm.initial_balance}
                  onChange={(e) => setWalletForm((c) => ({ ...c, initial_balance: e.target.value }))}
                  placeholder="Contoh: 0 atau nominal saldo awal"
                  className="w-full rounded-xl border border-[#2b4421] bg-[#162519] px-4 py-2.5 text-sm font-medium text-white outline-none transition focus:border-[#76d446]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">Peringatan Saldo Minimum</label>
                <input
                  value={walletForm.threshold}
                  onChange={(e) => setWalletForm((c) => ({ ...c, threshold: e.target.value }))}
                  placeholder="Contoh: 15%, 20%, 30%"
                  className="w-full rounded-xl border border-[#2b4421] bg-[#162519] px-4 py-2.5 text-sm font-medium text-white outline-none transition focus:border-[#76d446]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">Nomor Rekening / No. E-Wallet (Opsional)</label>
                <input
                  value={walletForm.account_number}
                  onChange={(e) => setWalletForm((c) => ({ ...c, account_number: e.target.value }))}
                  placeholder="Contoh: 1234567890 atau 08123456789"
                  className="w-full rounded-xl border border-[#2b4421] bg-[#162519] px-4 py-2.5 text-sm font-medium text-white outline-none transition focus:border-[#76d446]"
                />
                <p className="mt-1 text-[10px] text-slate-500">4 digit terakhir akan ditampilkan di kartu ATM Dashboard (contoh: •••• •••• •••• 7890)</p>
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

      {/* ════ MODAL: DELETE CONFIRMATION WALLET ════ */}
      {deletingWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-[22px] border border-red-500/30 bg-[#141d16] p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20 text-red-400">
                <Trash2 width="20" height="20" />
              </div>
              <div>
                <h3 className="font-bold text-white">Hapus Dompet?</h3>
                <p className="text-xs text-slate-400">Dompet <strong className="text-white">{deletingWallet.name}</strong> akan dihapus dari daftar.</p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingWallet(null)}
                className="rounded-full border border-slate-700 px-5 py-2 text-xs font-bold text-slate-300 hover:bg-white/5"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteWallet}
                className="rounded-full bg-red-600 px-6 py-2 text-xs font-black text-white hover:bg-red-500"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL: EDIT / CREATE CATEGORY ════ */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-[22px] border border-[#263e1d] bg-[#101b12] p-6 shadow-2xl dark:border-[#263e1d] dark:bg-[#101b12]">
            <div className="flex items-center justify-between border-b border-[#243a1a] pb-4">
              <h2 className="text-lg font-bold text-white">
                {isCreatingCategory ? 'Tambah Kategori Baru' : `Edit Budget: ${editingCategory.name}`}
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
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">Nama Kategori</label>
                <input
                  required
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm((c) => ({ ...c, name: e.target.value }))}
                  placeholder="Contoh: Kopi, Hobi, Investasi"
                  className="w-full rounded-xl border border-[#2b4421] bg-[#162519] px-4 py-2.5 text-sm font-medium text-white outline-none transition focus:border-[#76d446]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">Pilih Emoji</label>
                <div className="flex flex-wrap gap-2 rounded-xl border border-[#2b4421] bg-[#162519] p-3">
                  {COMMON_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setCategoryForm((c) => ({ ...c, emoji }))}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg transition ${
                        categoryForm.emoji === emoji ? 'bg-[#76d446]/30 ring-2 ring-[#76d446]' : 'hover:bg-white/10'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">Budget Bulanan (Rp)</label>
                <input
                  type="number"
                  value={categoryForm.budget}
                  onChange={(e) => setCategoryForm((c) => ({ ...c, budget: e.target.value }))}
                  placeholder="Contoh: 1200000 (kosongkan jika tidak dibatasi)"
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

      {/* ════ MODAL: DELETE CONFIRMATION CATEGORY ════ */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-[22px] border border-red-500/30 bg-[#141d16] p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20 text-red-400">
                <Trash2 width="20" height="20" />
              </div>
              <div>
                <h3 className="font-bold text-white">Hapus Kategori?</h3>
                <p className="text-xs text-slate-400">Kategori <strong className="text-white">{deletingCategory.emoji} {deletingCategory.name}</strong> akan dihapus dari daftar.</p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingCategory(null)}
                className="rounded-full border border-slate-700 px-5 py-2 text-xs font-bold text-slate-300 hover:bg-white/5"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteCategory}
                className="rounded-full bg-red-600 px-6 py-2 text-xs font-black text-white hover:bg-red-500"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
