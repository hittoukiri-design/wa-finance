import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  Edit3,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  Mail,
  MoreVertical,
  Pencil,
  Plus,
  Receipt,
  ReceiptText,
  Search,
  ShoppingCart,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import Header from '../components/Header';
import { useAuth } from '../context/useAuth';
import { useFilter } from '../context/FilterContext';
import { addExpense, deleteExpense, listExpenses, updateExpense } from '../lib/firestore';
import { downloadExcelReport, getBackendSettings, listCategories as listBackendCategories, listRecaps } from '../lib/whatsapp-api';

const currency = (amount) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(Number(amount || 0));

const today = () => dateInputValue(new Date());
const emptyForm = { merchant: '', category: 'Lainnya', amount: '', date: today(), payment_channel: 'Cash', type: 'expense' };

const CATEGORY_ICONS = {
  Tabungan: '🏦',
  Investasi: '📈',
  Tagihan: '💳',
  Utilities: '💳',
  Belanja: '🛒',
  Shopping: '🛒',
  Makan: '🍜',
  'Food & Drink': '🍜',
  Snack: '🍟',
  Keluarga: '👥',
  Rumah: '🏠',
  Hiburan: '🎮',
  Transportasi: '🚗',
  Transport: '🚗',
  Travel: '🚗',
  Perawatan: '🐱',
  Sosial: '🤝',
  Kesehatan: '🏥',
  Gaji: '💰',
  Pemasukan: '💰',
  Lainnya: '🏷️',
};

const CATEGORIES_LIST = [
  'Tabungan',
  'Investasi',
  'Tagihan',
  'Belanja',
  'Makan',
  'Snack',
  'Keluarga',
  'Rumah',
  'Hiburan',
  'Transportasi',
  'Perawatan',
  'Sosial',
  'Kesehatan',
  'Gaji',
  'Lainnya',
];

const WALLET_OPTIONS = [
  'Bank',
  'BCA',
  'Utama',
  'SUPERBANK',
  'Cash',
  'GoPay',
  'QRIS',
  'Transfer',
];

function getCategoryIcon(cat, iconMap = {}) {
  return iconMap[cat] || CATEGORY_ICONS[cat] || '🏷️';
}

function getDate(item) {
  const value = item.createdAt || item.timestamp || item.date;
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value) {
  const date = value instanceof Date ? value : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function dateInputValue(value) {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromInput(value, endOfDay = false) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatPeriodRange(start, end) {
  const sDay = start.getDate();
  const sMonth = new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(start);
  const sYear = start.getFullYear();
  const eDay = end.getDate();
  const eMonth = new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(end);
  const eYear = end.getFullYear();

  return `${sDay} ${sMonth} ${sYear} - ${eDay} ${eMonth} ${eYear}`;
}

function getCategory(item) {
  return item.category || 'Lainnya';
}

function getMerchant(item) {
  return item.merchant || item.description || item.pesan || 'Transaksi WhatsApp';
}

function getSource(item) {
  return item.source || (item.source_message_id ? 'WhatsApp' : 'Manual');
}

function getMessageId(item) {
  return item.source_message_id || item.message_id || item.messageId || '';
}

function shortMessageId(id) {
  const text = String(id || '').trim();
  if (!text) return '';
  if (text.length <= 16) return text;
  return `${text.slice(0, 8)}…${text.slice(-6)}`;
}

function getStatus(item) {
  return item.status || item.review_status || (getSource(item).toLowerCase().includes('whatsapp') ? 'Approved' : 'Approved');
}

function getAccount(item) {
  return String(item.payment_channel || item.rekening || 'Cash').trim() || 'Cash';
}

function getType(item) {
  const t = String(item.type || 'expense').toLowerCase();
  if (t === 'income') return 'income';
  if (t === 'savings' || String(item.category || '').toLowerCase() === 'tabungan' || String(item.category || '').toLowerCase() === 'investasi') return 'savings';
  return 'expense';
}

function merchantInitial(merchant) {
  return String(merchant || '?').trim().slice(0, 1).toUpperCase();
}

export default function Expenses() {
  const { user } = useAuth();
  const {
    startDate: globalStart,
    endDate: globalEnd,
    wallet: globalWallet,
    category: globalCategory,
    isFiltered: globalIsFiltered,
    resetFilters: resetGlobalFilters,
  } = useFilter();

  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [startDate, setStartDate] = useState(() => globalStart || dateInputValue(startOfMonth()));
  const [endDate, setEndDate] = useState(() => globalEnd || dateInputValue(endOfMonth()));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState('');
  const [recaps, setRecaps] = useState([]);
  const [recapFilter, setRecapFilter] = useState('active');
  const [categories, setCategories] = useState([]);

  // Edit Transaction state
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({
    id: '',
    merchant: '',
    amount: '',
    date: today(),
    payment_channel: 'Bank',
    category: 'Lainnya',
    type: 'expense',
  });
  const [editBusy, setEditBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [nextExpenses, recapResult, settings, categoryResult] = await Promise.all([
        listExpenses(user.uid, { recapId: recapFilter }),
        listRecaps().catch(() => ({ recaps: [] })),
        getBackendSettings().catch(() => ({})),
        listBackendCategories().catch(() => ({ categories: [] })),
      ]);
      setExpenses(nextExpenses);
      setRecaps(recapResult.recaps || []);
      setCategories((categoryResult.categories || []).filter((category) => category.is_active));
      if (recapFilter === 'active' && settings.active_recap_start_date) {
        const activeStart = dateFromInput(settings.active_recap_start_date);
        if (activeStart) {
          setStartDate(dateInputValue(activeStart));
          setEndDate(dateInputValue(new Date()));
        }
      }
    } catch (error) {
      setNotice(error.message || 'Data Firestore belum dapat dibaca.');
    } finally {
      setBusy(false);
    }
  }, [user.uid, recapFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (globalStart) setStartDate(globalStart);
    if (globalEnd) setEndDate(globalEnd);
    if (globalCategory && globalCategory !== 'Semua kategori') setCategoryFilter(globalCategory);
  }, [globalStart, globalEnd, globalCategory]);

  const categoryIconMap = useMemo(() => Object.fromEntries(
    categories.map((category) => [category.name, category.emoji || '🏷️'])
  ), [categories]);

  const categoryOptions = useMemo(() => {
    const loaded = categories.map((category) => category.name);
    return loaded.length ? loaded : CATEGORIES_LIST;
  }, [categories]);

  // Period start & end for header subtitle
  const periodStartDate = useMemo(() => dateFromInput(startDate) || startOfMonth(new Date()), [startDate]);
  const periodEndDate = useMemo(() => dateFromInput(endDate, true) || endOfMonth(periodStartDate), [endDate, periodStartDate]);
  const periodString = useMemo(() => formatPeriodRange(periodStartDate, periodEndDate), [periodStartDate, periodEndDate]);

  // Statistics computations
  const expenseItems = useMemo(() => expenses.filter((item) => getType(item) !== 'income'), [expenses]);
  const incomeItems = useMemo(() => expenses.filter((item) => getType(item) === 'income'), [expenses]);

  const totalExpenseAmount = useMemo(() => expenseItems.reduce((sum, item) => sum + Number(item.amount || 0), 0), [expenseItems]);
  const averageExpense = useMemo(() => expenseItems.length ? Math.round(totalExpenseAmount / expenseItems.length) : 0, [expenseItems, totalExpenseAmount]);

  const activeDaysCount = useMemo(() => {
    const dates = new Set(expenses.map((item) => {
      const d = getDate(item);
      return d ? dateKey(d) : null;
    }).filter(Boolean));
    return dates.size;
  }, [expenses]);

  // Sparkline data for Card 2 (Expense Sparkline Area)
  const totalDaysInMonth = useMemo(() => {
    return Math.max(1, Math.ceil((periodEndDate - periodStartDate) / 86400000) + 1);
  }, [periodStartDate, periodEndDate]);

  const expenseSparkline = useMemo(() => {
    const byDay = {};
    expenseItems.forEach((e) => {
      const d = getDate(e);
      if (d) { const k = dateKey(d); byDay[k] = (byDay[k] || 0) + Number(e.amount || 0); }
    });
    const today = startOfDay(new Date());
    const daysSoFar = Math.max(1, Math.ceil((today - periodStartDate) / 86400000) + 1);
    return Array.from({ length: Math.min(daysSoFar, totalDaysInMonth) }, (_, i) => byDay[dateKey(addDays(periodStartDate, i))] || 0);
  }, [expenseItems, periodStartDate, totalDaysInMonth]);

  const maxExpSpark = Math.max(...expenseSparkline, 1);
  const totalSlots = Math.min(totalDaysInMonth, 31);
  const dataLen = expenseSparkline.length;

  const { expLinePoints, expAreaPoints } = useMemo(() => {
    const pts = [];
    for (let i = 0; i < totalSlots; i++) {
      const x = totalSlots <= 1 ? 50 : (i / (totalSlots - 1)) * 100;
      let y = 22;
      if (i < dataLen) {
        const val = expenseSparkline[i] || 0;
        y = 22 - (val / maxExpSpark) * 18;
      }
      pts.push({ x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) });
    }
    const lineStr = pts.map((p) => `${p.x},${p.y}`).join(' ');
    const areaStr = `0,24 ${lineStr} 100,24`;
    return { expLinePoints: lineStr, expAreaPoints: areaStr };
  }, [expenseSparkline, maxExpSpark, totalSlots, dataLen]);

  // Sparkline data for Card 3 (Transaction Count Bars)
  const txBarData = useMemo(() => {
    const byDay = {};
    expenseItems.forEach((e) => {
      const d = getDate(e);
      if (d) { const k = dateKey(d); byDay[k] = (byDay[k] || 0) + 1; }
    });
    const today = startOfDay(new Date());
    const daysSoFar = Math.max(1, Math.ceil((today - periodStartDate) / 86400000) + 1);
    return Array.from({ length: Math.min(daysSoFar, totalDaysInMonth) }, (_, i) => byDay[dateKey(addDays(periodStartDate, i))] || 0);
  }, [expenseItems, periodStartDate, totalDaysInMonth]);

  const maxTxBar = Math.max(...txBarData, 1);

  // Categories breakdown for grid cards
  const categoryStats = useMemo(() => {
    const grouped = {};
    expenseItems.forEach((item) => {
      const cat = getCategory(item);
      if (!grouped[cat]) {
        grouped[cat] = { name: cat, amount: 0, count: 0 };
      }
      grouped[cat].amount += Number(item.amount || 0);
      grouped[cat].count += 1;
    });

    const list = Object.values(grouped).sort((a, b) => b.amount - a.amount);
    const maxAmount = Math.max(...list.map((c) => c.amount), 1);

    return list.map((cat) => ({
      ...cat,
      percent: totalExpenseAmount ? Math.round((cat.amount / totalExpenseAmount) * 100) : 0,
      relativeWidth: Math.round((cat.amount / maxAmount) * 100),
    }));
  }, [expenseItems, totalExpenseAmount]);

  const totalCategoriesCount = useMemo(() => categoryStats.length, [categoryStats]);

  // Filtered transactions
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rangeStart = dateFromInput(startDate);
    const rangeEnd = dateFromInput(endDate, true);

    return expenses
      .filter((item) => {
        const itemDate = getDate(item);
        if ((rangeStart || rangeEnd) && !itemDate) return false;
        if (rangeStart && itemDate < rangeStart) return false;
        if (rangeEnd && itemDate > rangeEnd) return false;
        if (typeFilter !== 'all' && getType(item) !== typeFilter) return false;
        if (categoryFilter !== 'all' && getCategory(item) !== categoryFilter) return false;
        if (globalWallet && globalWallet !== 'Semua dompet') {
          const w = getAccount(item).toLowerCase();
          if (w !== globalWallet.toLowerCase()) return false;
        }
        if (!term) return true;
        return [
          getMerchant(item),
          getCategory(item),
          getSource(item),
          getStatus(item),
          getAccount(item),
          item.amount,
        ].join(' ').toLowerCase().includes(term);
      })
      .sort((a, b) => (getDate(b)?.getTime() || 0) - (getDate(a)?.getTime() || 0));
  }, [expenses, search, typeFilter, categoryFilter, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageStartIndex = filtered.length ? (page - 1) * pageSize : 0;
  const pageEndIndex = Math.min(pageStartIndex + pageSize, filtered.length);
  const visibleExpenses = filtered.slice(pageStartIndex, pageEndIndex);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
    if (page <= 3) return [1, 2, 3, 4];
    if (page >= totalPages - 2) return [totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [page - 1, page, page + 1];
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, categoryFilter, startDate, endDate, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const openEditModal = (item) => {
    const itemDate = getDate(item);
    setEditingItem(item);
    setEditForm({
      id: item.id,
      merchant: getMerchant(item),
      amount: item.amount || '',
      date: itemDate ? dateInputValue(itemDate) : today(),
      payment_channel: getAccount(item) || 'Bank',
      category: getCategory(item) || 'Lainnya',
      type: getType(item),
    });
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!editForm.merchant.trim() || !editForm.amount || Number(editForm.amount) <= 0) {
      setNotice('Deskripsi transaksi dan nominal wajib diisi.');
      return;
    }
    setEditBusy(true);
    try {
      await updateExpense(user.uid, editForm.id, {
        merchant: editForm.merchant.trim(),
        amount: Number(editForm.amount),
        date: editForm.date,
        payment_channel: editForm.payment_channel.trim() || 'Bank',
        category: editForm.category.trim() || 'Lainnya',
        type: editForm.type,
      });

      // Update state locally for instantaneous response
      setExpenses((current) => current.map((item) => {
        if (item.id === editForm.id) {
          return {
            ...item,
            merchant: editForm.merchant.trim(),
            description: editForm.merchant.trim(),
            amount: Number(editForm.amount),
            date: editForm.date,
            payment_channel: editForm.payment_channel.trim() || 'Bank',
            rekening: editForm.payment_channel.trim() || 'Bank',
            category: editForm.category.trim() || 'Lainnya',
            type: editForm.type,
          };
        }
        return item;
      }));

      setEditingItem(null);
      setNotice('Transaksi berhasil diperbarui.');
    } catch (error) {
      setNotice(error.message || 'Gagal memperbarui transaksi.');
    } finally {
      setEditBusy(false);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.merchant.trim() || !form.amount || Number(form.amount) <= 0) {
      setNotice('Merchant dan nominal wajib diisi.');
      return;
    }
    setBusy(true);
    try {
      await addExpense(user.uid, form);
      setForm({ ...emptyForm, date: today() });
      setShowForm(false);
      setNotice('Transaksi tersimpan di Firestore.');
      await load();
    } catch (error) {
      setNotice(error.message || 'Transaksi gagal disimpan.');
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Hapus transaksi ini?')) return;
    try {
      await deleteExpense(user.uid, id);
      setExpenses((current) => current.filter((item) => item.id !== id));
      setNotice('Transaksi berhasil dihapus.');
    } catch (error) {
      setNotice(error.message || 'Transaksi gagal dihapus.');
    }
  };

  const exportExcel = async () => {
    setNotice('');
    try {
      const blob = await downloadExcelReport({
        recapId: recapFilter,
        startDate,
        endDate,
        type: typeFilter,
        category: categoryFilter,
        search,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${dateInputValue(new Date())} - WA Finance Report.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setNotice(error.message || 'Laporan Excel gagal dibuat.');
    }
  };

  const exportPdf = () => {
    window.print();
  };

  return (
    <div className="mx-auto w-full max-w-[1450px]">
      <Header title="Transaksi" subtitle="Daftar seluruh aktivitas transaksi dan kategori keuangan." />

      {notice && (
        <div className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
          {notice}
        </div>
      )}

      {/* ════ 1. TOP THREE CARDS ROW (SIDE BY SIDE 3-COLUMNS) ════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-4 w-full">
        
        {/* Card 1: Banner Card (Arus Kas - Daftar Transaksi) */}
        <div className="relative overflow-hidden rounded-[22px] bg-[#c3ef92] p-5 shadow-md flex flex-col justify-between min-h-[145px] text-[#0d2207] border border-[#74d32a]">
          {/* Decorative background shapes */}
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full border-[8px] border-white/20" />
          <div className="pointer-events-none absolute right-10 -bottom-8 h-20 w-36 rounded-full border-[6px] border-white/15" />
          
          <div className="relative z-10">
            <div className="text-[10px] font-black uppercase tracking-wider text-[#1e4d0d]">
              ARUS KAS
            </div>
            <div className="text-xl font-black text-[#0a1c05] mt-0.5">
              Daftar transaksi
            </div>
            <div className="text-[11px] font-bold text-[#235610] mt-0.5">
              {periodString}
            </div>
          </div>

          <div className="relative z-10 mt-3 flex items-center gap-2">
            <button
              onClick={exportPdf}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/80 px-3.5 py-1.5 text-xs font-black text-[#0d2207] shadow-sm backdrop-blur-sm transition hover:bg-white"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              PDF
            </button>
            <button
              onClick={exportExcel}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/80 px-3.5 py-1.5 text-xs font-black text-[#0d2207] shadow-sm backdrop-blur-sm transition hover:bg-white"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Excel
            </button>
          </div>
        </div>

        {/* Card 2: Total Pengeluaran */}
        <div className="rounded-[22px] border border-[#d6e4be] bg-[#eaf2da] p-5 shadow-sm flex flex-col justify-between min-h-[145px] dark:border-[#243e1c] dark:bg-[#121e14]">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#1a5611] dark:text-[#76d446]">
                TOTAL PENGELUARAN
              </span>
            </div>
            <div className="text-2xl font-black text-[#0e2a07] dark:text-[#f3ffe9] mt-1">
              {busy ? '...' : currency(totalExpenseAmount)}
            </div>
          </div>

          <div className="h-8 my-1">
            <svg viewBox="0 0 100 24" width="100%" height="24" preserveAspectRatio="none">
              <defs>
                <linearGradient id="txExpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#245c10" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#245c10" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <polygon points={expAreaPoints} fill="url(#txExpGrad)" />
              <polyline points={expLinePoints} fill="none" stroke="#245c10" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          </div>

          <div className="text-[11px] font-semibold text-[#436d32] dark:text-[#8bb37a]">
            Rata-rata {currency(averageExpense)} per catatan
          </div>
        </div>

        {/* Card 3: Jumlah Transaksi */}
        <div className="rounded-[22px] border border-[#d6e4be] bg-[#eaf2da] p-5 shadow-sm flex flex-col justify-between min-h-[145px] dark:border-[#243e1c] dark:bg-[#121e14]">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#1a5611] dark:text-[#76d446]">
                JUMLAH TRANSAKSI
              </span>
            </div>
            <div className="text-2xl font-black text-[#0e2a07] dark:text-[#f3ffe9] mt-1">
              {busy ? '...' : expenseItems.length}
            </div>
          </div>

          <div className="h-8 my-1 flex items-end">
            <svg viewBox="0 0 100 24" width="100%" height="24" preserveAspectRatio="none">
              {txBarData.map((v, i, arr) => {
                const bw = Math.max(2.2, 88 / Math.max(arr.length, 1) - 1.2);
                const x = arr.length < 2 ? (i * 20) : (i / (arr.length - 1)) * (94 - bw);
                const bh = v > 0 ? Math.max(4, (v / maxTxBar) * 20) : 2;
                return <rect key={i} x={x} y={22 - bh} width={bw} height={bh} rx="1" fill={i === arr.length - 1 ? '#1a5611' : '#4a8c2c'} opacity={v > 0 ? 0.95 : 0.35} />;
              })}
              {/* Dotted horizontal future line */}
              <line x1="65" y1="21" x2="98" y2="21" stroke="#245c10" strokeWidth="1.5" strokeDasharray="2 3" opacity="0.4" />
            </svg>
          </div>

          <div className="text-[11px] font-semibold text-[#436d32] dark:text-[#8bb37a]">
            {activeDaysCount} hari aktif • {totalCategoriesCount} kategori
          </div>
        </div>

      </div>

      {/* ════ 2. CATEGORY SUMMARY CARDS GRID (5-COLUMNS x 2-ROWS) ════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4 w-full">
        {categoryStats.slice(0, 10).map((cat) => {
          const isActive = categoryFilter === cat.name;
          return (
            <div
              key={cat.name}
              className={`tx-cat-card-box ${isActive ? 'active' : ''}`}
              onClick={() => setCategoryFilter(isActive ? 'all' : cat.name)}
              title={`Klik untuk filter kategori ${cat.name}`}
            >
              <span className="tx-cat-pct-tag">{cat.percent}%</span>
              <div className="tx-cat-icon">{getCategoryIcon(cat.name, categoryIconMap)}</div>
              <div className="tx-cat-name truncate">{cat.name}</div>
              <div className="tx-cat-nominal truncate">{currency(cat.amount)}</div>
              <div className="tx-cat-count">{cat.count} transaksi</div>
              <div className="tx-cat-progress-track">
                <div className="tx-cat-progress-fill" style={{ width: `${cat.percent}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ════ 3. FULL ACTIVITY TABLE CARD ════ */}
      <div className="tx-table-card">
        <div className="tx-table-head-bar">
          <div className="tx-table-left-titles">
            <span className="tx-table-eyebrow">AKTIVITAS</span>
            <span className="tx-table-title-bold">Daftar transaksi</span>
            <span className="tx-table-subtitle-small">
              {filtered.length ? `Menampilkan ${pageStartIndex + 1} sampai ${pageEndIndex} dari ${filtered.length} catatan.` : 'Belum ada transaksi.'}
            </span>
          </div>

          <div className="tx-table-actions-right">
            {categoryFilter !== 'all' && (
              <button
                onClick={() => setCategoryFilter('all')}
                className="flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/60 dark:text-emerald-300"
              >
                <span>{categoryFilter}</span>
                <X width="12" height="12" />
              </button>
            )}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input-pill"
              placeholder="🔍 Cari transaksi..."
            />
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rows-select-pill"
            >
              <option value={10}>10 baris</option>
              <option value={25}>25 baris</option>
              <option value={50}>50 baris</option>
            </select>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#1a5611] px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-[#123d0c] dark:bg-[#76d446] dark:text-[#0d170a]"
            >
              <Plus width="13" height="13" />
              Tambah
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="full-data-table">
            <thead>
              <tr>
                <th>MERCHANT</th>
                <th>KATEGORI</th>
                <th>TYPE</th>
                <th style={{ textAlign: 'right' }}>NOMINAL</th>
                <th>DATE</th>
                <th>SOURCE</th>
                <th>STATUS</th>
                <th style={{ textAlign: 'right', width: '90px' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {visibleExpenses.map((item) => {
                const date = getDate(item);
                const isIncome = getType(item) === 'income';
                const merchant = getMerchant(item);
                const initial = merchantInitial(merchant);
                const account = getAccount(item);
                const msgId = getMessageId(item);

                return (
                  <tr key={item.id}>
                    <td>
                      <div className="merchant-avatar-row">
                        <div className="merchant-initial-circle">{initial}</div>
                        <div>
                          <div className="merchant-name-bold">{merchant}</div>
                          <div className="merchant-account-sub">{account}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge-category-green">{getCategory(item)}</span>
                    </td>
                    <td>
                      {getType(item) === 'income' ? (
                        <span className="badge-type-green">
                          <ArrowUp width="11" height="11" /> Pemasukan
                        </span>
                      ) : getType(item) === 'savings' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                          🏦 Tabungan
                        </span>
                      ) : (
                        <span className="badge-type-red">
                          <ArrowDown width="11" height="11" /> Pengeluaran
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>
                      <span className={getType(item) === 'income' ? 'text-[#2d7a18] dark:text-[#76d446]' : getType(item) === 'savings' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-slate-100'}>
                        {getType(item) === 'income' ? `+ ${currency(item.amount)}` : `- ${currency(item.amount)}`}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-light)', fontSize: '11px', whiteSpace: 'nowrap' }}>
                      {formatDateTime(date)}
                    </td>
                    <td>
                      <div className="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
                        {getSource(item).toLowerCase().includes('whatsapp') && (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="#25d366"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-5.46-4.45-9.92-9.91-9.92z"/></svg>
                        )}
                        <span>{getSource(item)}</span>
                      </div>
                      {msgId && (
                        <div style={{ fontSize: '9.5px', color: 'var(--text-light)' }}>
                          ID: {shortMessageId(msgId)}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge-approved-green">
                        <span className="approved-dot"></span> Approved
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          className="table-action-icon text-slate-400 hover:text-slate-200 dark:text-slate-400 dark:hover:text-white"
                          title="Edit transaksi"
                          onClick={() => openEditModal(item)}
                        >
                          <Pencil width="14" height="14" />
                        </button>
                        <button
                          className="table-action-icon text-red-400 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                          title="Hapus transaksi"
                          onClick={() => remove(item.id)}
                        >
                          <Trash2 width="14" height="14" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!busy && !visibleExpenses.length && (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-xs text-slate-500">
                    Tidak ada transaksi yang cocok dengan filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#e5eedc] px-5 py-3.5 text-xs dark:border-[#263e1d]">
            <span className="text-slate-500">
              Halaman {page} dari {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 px-3 py-1 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                « Sebelumnya
              </button>
              {pageNumbers.map((num) => (
                <button
                  key={num}
                  onClick={() => setPage(num)}
                  className={`h-7 w-7 rounded-lg text-xs font-bold transition ${
                    page === num
                      ? 'bg-[#1a5611] text-white dark:bg-[#76d446] dark:text-[#0d170a]'
                      : 'border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {num}
                </button>
              ))}
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-slate-200 px-3 py-1 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Selanjutnya »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ════ EDIT TRANSAKSI MODAL (AS IN USER REFERENCE SCREENSHOT) ════ */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-[22px] border border-[#263e1d] bg-[#101b12] p-6 shadow-2xl dark:border-[#263e1d] dark:bg-[#101b12]">
            <div className="flex items-center justify-between border-b border-[#243a1a] pb-4">
              <h2 className="text-lg font-bold text-white">Edit transaksi</h2>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X width="18" height="18" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="mt-4 space-y-4">
              {/* Field 0: Tipe Transaksi */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">Tipe Transaksi</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditForm((c) => ({ ...c, type: 'expense' }))}
                    className={`rounded-xl py-2 text-xs font-bold transition ${
                      editForm.type === 'expense'
                        ? 'bg-red-500 text-white'
                        : 'border border-slate-700 text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    ↘ Pengeluaran
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditForm((c) => ({ ...c, type: 'income' }))}
                    className={`rounded-xl py-2 text-xs font-bold transition ${
                      editForm.type === 'income'
                        ? 'bg-emerald-600 text-white'
                        : 'border border-slate-700 text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    ↗ Pemasukan
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditForm((c) => ({ ...c, type: 'savings', category: 'Tabungan' }))}
                    className={`rounded-xl py-2 text-xs font-bold transition ${
                      editForm.type === 'savings'
                        ? 'bg-indigo-600 text-white'
                        : 'border border-slate-700 text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    🏦 Tabungan
                  </button>
                </div>
              </div>

              {/* Field 1: Transaksi (Merchant / Deskripsi) */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">Transaksi</label>
                <input
                  required
                  value={editForm.merchant}
                  onChange={(e) => setEditForm((c) => ({ ...c, merchant: e.target.value }))}
                  placeholder="Contoh: patungan kado, bensin"
                  className="w-full rounded-xl border border-[#2b4421] bg-[#162519] px-4 py-2.5 text-sm font-medium text-white outline-none transition focus:border-[#76d446]"
                />
              </div>

              {/* Field 2: Nominal */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">Nominal</label>
                <input
                  required
                  type="number"
                  value={editForm.amount}
                  onChange={(e) => setEditForm((c) => ({ ...c, amount: e.target.value }))}
                  placeholder="Contoh: 42500"
                  className="w-full rounded-xl border border-[#2b4421] bg-[#162519] px-4 py-2.5 text-sm font-medium text-white outline-none transition focus:border-[#76d446]"
                />
              </div>

              {/* Field 3: Tanggal */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-400">Tanggal</label>
                <div className="relative">
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={(e) => setEditForm((c) => ({ ...c, date: e.target.value }))}
                    className="w-full rounded-xl border border-[#2b4421] bg-[#162519] px-4 py-2.5 text-sm font-medium text-white outline-none transition focus:border-[#76d446]"
                  />
                  <Calendar className="pointer-events-none absolute right-4 top-3 h-4 w-4 text-slate-400" />
                </div>
              </div>

              {/* Field 4 (Grid 2 cols): Dompet & Kategori */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-400">Dompet</label>
                  <select
                    value={editForm.payment_channel}
                    onChange={(e) => setEditForm((c) => ({ ...c, payment_channel: e.target.value }))}
                    className="w-full rounded-xl border border-[#2b4421] bg-[#162519] px-3.5 py-2.5 text-sm font-medium text-white outline-none transition focus:border-[#76d446]"
                  >
                    {WALLET_OPTIONS.map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-400">Kategori</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm((c) => ({ ...c, category: e.target.value }))}
                    className="w-full rounded-xl border border-[#2b4421] bg-[#162519] px-3.5 py-2.5 text-sm font-medium text-white outline-none transition focus:border-[#76d446]"
                  >
                    {categoryOptions.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="rounded-full border border-slate-700 bg-transparent px-6 py-2 text-xs font-bold text-slate-300 hover:bg-white/5"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editBusy}
                  className="rounded-full bg-[#76d446] px-7 py-2 text-xs font-black text-[#0d170a] shadow-lg transition hover:bg-[#64be36] disabled:opacity-50"
                >
                  {editBusy ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Add Transaction Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <form onSubmit={save} className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-[#0b141c]">
            <div className="flex items-center justify-between border-b pb-4 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Tambah Transaksi Manual</h2>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X width="18" height="18" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Tipe Transaksi</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((c) => ({ ...c, type: 'expense' }))}
                    className={`rounded-xl py-2 text-xs font-bold transition ${
                      form.type === 'expense'
                        ? 'bg-red-500 text-white'
                        : 'border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    ↘ Pengeluaran
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((c) => ({ ...c, type: 'income', category: c.category === 'Lainnya' ? 'Gaji' : c.category }))}
                    className={`rounded-xl py-2 text-xs font-bold transition ${
                      form.type === 'income'
                        ? 'bg-emerald-600 text-white'
                        : 'border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    ↗ Pemasukan
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((c) => ({ ...c, type: 'savings', category: 'Tabungan' }))}
                    className={`rounded-xl py-2 text-xs font-bold transition ${
                      form.type === 'savings'
                        ? 'bg-indigo-600 text-white'
                        : 'border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    🏦 Tabungan
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Deskripsi / Merchant</label>
                <input
                  required
                  value={form.merchant}
                  onChange={(e) => setForm((c) => ({ ...c, merchant: e.target.value }))}
                  placeholder="Contoh: Beli kopi, Bayar listrik"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Nominal (Rp)</label>
                  <input
                    required
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm((c) => ({ ...c, amount: e.target.value }))}
                    placeholder="Contoh: 50000"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Kategori</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    {categoryOptions.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Rekening / Dompet</label>
                  <input
                    value={form.payment_channel}
                    onChange={(e) => setForm((c) => ({ ...c, payment_channel: e.target.value }))}
                    placeholder="BCA, Cash, GoPay..."
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Tanggal</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((c) => ({ ...c, date: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-[#1a5611] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#123d0c] disabled:opacity-50 dark:bg-[#76d446] dark:text-[#0d170a]"
              >
                Simpan Transaksi
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
