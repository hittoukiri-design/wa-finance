import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  Mail,
  MoreVertical,
  Plus,
  ReceiptText,
  Search,
  ShoppingCart,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { addExpense, deleteExpense, listExpenses } from '../lib/firestore';
import { getBackendSettings, listRecaps } from '../lib/whatsapp-api';

const currency = (amount) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(Number(amount || 0));

const today = () => dateInputValue(new Date());
const emptyForm = { merchant: '', category: '', amount: '', date: today(), payment_channel: 'Cash', type: 'expense' };

const CATEGORY_COLORS = {
  'Food & Drink': 'bg-violet-500/18 text-violet-200 border-violet-500/20',
  Makan: 'bg-violet-500/18 text-violet-200 border-violet-500/20',
  Transport: 'bg-emerald-500/16 text-emerald-200 border-emerald-500/20',
  Travel: 'bg-amber-500/16 text-amber-200 border-amber-500/20',
  Shopping: 'bg-blue-500/16 text-blue-200 border-blue-500/20',
  Software: 'bg-sky-500/16 text-sky-200 border-sky-500/20',
  Utilities: 'bg-yellow-500/16 text-yellow-200 border-yellow-500/20',
  'Office Supplies': 'bg-blue-500/16 text-blue-200 border-blue-500/20',
  Gaji: 'bg-emerald-500/18 text-emerald-200 border-emerald-500/20',
  Income: 'bg-emerald-500/18 text-emerald-200 border-emerald-500/20',
  Pemasukan: 'bg-emerald-500/18 text-emerald-200 border-emerald-500/20',
  Pembayaran: 'bg-emerald-500/18 text-emerald-200 border-emerald-500/20',
  Bonus: 'bg-emerald-500/18 text-emerald-200 border-emerald-500/20',
  Lainnya: 'bg-slate-500/16 text-slate-200 border-slate-500/20',
};

function getDate(item) {
  const value = item.createdAt || item.timestamp || item.date;
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
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

function dateOnly(value) {
  const date = value instanceof Date ? value : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
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

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a, b) {
  return !!a && !!b && startOfDay(a).getTime() === startOfDay(b).getTime();
}

function isBeforeDay(a, b) {
  return !!a && !!b && startOfDay(a).getTime() < startOfDay(b).getTime();
}

function isAfterDay(a, b) {
  return !!a && !!b && startOfDay(a).getTime() > startOfDay(b).getTime();
}

function isBetweenDays(date, start, end) {
  if (!date || !start || !end) return false;
  const value = startOfDay(date).getTime();
  return value > startOfDay(start).getTime() && value < startOfDay(end).getTime();
}

function monthTitle(date) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

function buildCalendarDays(monthDate) {
  const first = startOfMonth(monthDate);
  const totalDays = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const leadingBlanks = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: leadingBlanks }, (_, index) => ({ key: `blank-${index}`, date: null }));

  for (let day = 1; day <= totalDays; day += 1) {
    cells.push({
      key: `${first.getFullYear()}-${first.getMonth()}-${day}`,
      date: new Date(first.getFullYear(), first.getMonth(), day),
    });
  }

  while (cells.length % 7 !== 0) cells.push({ key: `tail-${cells.length}`, date: null });
  return cells;
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
  if (text.length <= 14) return text;
  return `${text.slice(0, 8)}…${text.slice(-6)}`;
}

function getStatus(item) {
  return item.status || item.review_status || (getSource(item).toLowerCase().includes('whatsapp') ? 'Approved' : 'Pending Review');
}

function getAccount(item) {
  return String(item.payment_channel || item.rekening || 'Cash').trim() || 'Cash';
}

function isCashAccount(item) {
  return ['cash', 'tunai'].includes(getAccount(item).toLowerCase());
}

function getType(item) {
  return String(item.type || 'expense').toLowerCase() === 'income' ? 'income' : 'expense';
}

function typeLabel(item) {
  return getType(item) === 'income' ? 'Pemasukan' : 'Pengeluaran';
}

function merchantInitial(merchant) {
  return String(merchant || '?').trim().slice(0, 1).toUpperCase();
}

function CategoryPill({ category }) {
  const cls = CATEGORY_COLORS[category] || CATEGORY_COLORS.Lainnya;
  return <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold ${cls}`}>{category}</span>;
}

function StatusPill({ status }) {
  const normalized = String(status || '').toLowerCase();
  const isApproved = normalized.includes('approved') || normalized.includes('new') || normalized.includes('saved');
  const isFlagged = normalized.includes('flag');
  const cls = isFlagged
    ? 'border-red-500/30 bg-red-500/14 text-red-300'
    : isApproved
      ? 'border-emerald-500/25 bg-emerald-500/14 text-emerald-300'
      : 'border-amber-500/25 bg-amber-500/14 text-amber-300';

  return (
    <span className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold ${cls}`}>
      <span className="h-2 w-2 rounded-full bg-current" />
      {isApproved ? 'Approved' : isFlagged ? 'Flagged' : 'Pending Review'}
    </span>
  );
}

function TypePill({ type }) {
  const isIncome = String(type || '').toLowerCase() === 'income';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${
      isIncome
        ? 'border-emerald-500/25 bg-emerald-500/14 text-emerald-300'
        : 'border-red-500/25 bg-red-500/12 text-red-300'
    }`}
    >
      {isIncome ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
      {isIncome ? 'Pemasukan' : 'Pengeluaran'}
    </span>
  );
}

function SourceLabel({ source }) {
  const value = source || 'Manual';
  const lower = value.toLowerCase();
  const Icon = lower.includes('whatsapp') ? MessageIcon : lower.includes('email') ? Mail : CreditCard;
  const color = lower.includes('whatsapp') ? 'text-emerald-400' : lower.includes('email') ? 'text-slate-300' : 'text-blue-300';
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-300">
      <Icon className={`h-4 w-4 ${color}`} />
      {value}
    </span>
  );
}

function MessageIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 11.5a8.5 8.5 0 0 1-12.7 7.4L3 20l1.2-4.1A8.5 8.5 0 1 1 20 11.5Z" />
      <path d="M8 10.5c.7 2 2.1 3.4 4 4l1.3-1.1c.3-.3.7-.3 1.1-.1.6.3 1.2.5 1.9.6" />
    </svg>
  );
}

function Metric({ icon: Icon, label, value, detail, tone = 'emerald', action }) {
  const tones = {
    emerald: 'bg-emerald-500/18 text-emerald-300',
    violet: 'bg-violet-500/18 text-violet-300',
    blue: 'bg-blue-500/18 text-blue-300',
    amber: 'bg-amber-500/18 text-amber-300',
  };
  return (
    <div className="flex min-w-0 items-center gap-3 border-slate-800/90 px-5 py-3 xl:border-r last:border-r-0">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tones[tone] || tones.emerald}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <p className="text-xs font-semibold text-slate-400">{label}</p>
        <p className="mt-0.5 truncate text-xl font-bold tracking-tight text-white">{value}</p>
        {action ? (
          <button type="button" onClick={action.onClick} className="mt-1 inline-flex items-center gap-2 text-xs font-bold text-emerald-400">
            {action.label} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <p className="mt-1 text-xs text-slate-500">{detail}</p>
        )}
      </span>
    </div>
  );
}

function RangeCalendarMonth({ month, rangeStart, rangeEnd, onSelect }) {
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const days = buildCalendarDays(month);
  const currentDay = startOfDay(new Date());

  return (
    <div className="min-w-0 flex-1">
      <h3 className="mb-3 text-sm font-black text-white">{monthTitle(month)}</h3>
      <div className="grid grid-cols-7 border-b border-slate-700/70 pb-2 text-center text-[11px] font-semibold text-slate-400">
        {weekdays.map((day) => (
          <span key={day} className={day === 'Sun' ? 'text-red-300' : ''}>{day}</span>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-y-1 text-center text-sm">
        {days.map(({ key, date }) => {
          if (!date) return <span key={key} className="h-9" />;
          const isStart = sameDay(date, rangeStart);
          const isEnd = sameDay(date, rangeEnd);
          const isMiddle = isBetweenDays(date, rangeStart, rangeEnd);
          const isToday = sameDay(date, currentDay);
          const isSunday = date.getDay() === 0;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(date)}
              className={`relative h-9 text-sm transition ${
                isMiddle ? 'bg-emerald-500/25 text-white' : isSunday ? 'text-red-300' : 'text-slate-100'
              } ${isStart && rangeEnd ? 'rounded-l-full' : ''} ${isEnd && rangeStart ? 'rounded-r-full' : ''}`}
            >
              <span
                className={`relative z-10 mx-auto flex h-8 w-8 items-center justify-center rounded-full ${
                  isStart || isEnd
                    ? 'bg-emerald-400 font-black text-[#04130d] shadow-lg shadow-emerald-500/25'
                    : isToday
                      ? 'border border-emerald-400/70 text-emerald-200'
                      : 'hover:bg-slate-800'
                }`}
              >
                {date.getDate()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Expenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState(() => dateInputValue(startOfMonth()));
  const [endDate, setEndDate] = useState(() => dateInputValue(endOfMonth()));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth());
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState('');
  const [recaps, setRecaps] = useState([]);
  const [recapFilter, setRecapFilter] = useState('active');

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [nextExpenses, recapResult, settings] = await Promise.all([
        listExpenses(user.uid, { recapId: recapFilter }),
        listRecaps().catch(() => ({ recaps: [] })),
        getBackendSettings().catch(() => ({})),
      ]);
      setExpenses(nextExpenses);
      setRecaps(recapResult.recaps || []);
      if (recapFilter === 'active' && settings.active_recap_start_date) {
        const activeStart = dateFromInput(settings.active_recap_start_date);
        if (activeStart) {
          setStartDate(dateInputValue(activeStart));
          setEndDate(dateInputValue(new Date()));
          setCalendarMonth(startOfMonth(activeStart));
        }
      }
    } catch (error) {
      setNotice(error.message || 'Data Firestore belum dapat dibaca.');
    } finally {
      setBusy(false);
    }
  }, [user.uid, recapFilter]);

  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() => [...new Set(expenses.map(getCategory).filter(Boolean))].sort(), [expenses]);
  const accounts = useMemo(() => {
    const preferred = ['BCA', 'GOPAY', 'QRIS', 'SUPERBANK', 'Transfer', 'Cash'];
    const existing = new Set(expenses.map(getAccount).filter(Boolean));
    preferred.forEach((item) => existing.add(item));
    return [...existing].sort((a, b) => {
      const ai = preferred.indexOf(a);
      const bi = preferred.indexOf(b);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return a.localeCompare(b);
    });
  }, [expenses]);

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
        if (accountFilter !== 'all' && getAccount(item) !== accountFilter) return false;
        if (categoryFilter !== 'all' && getCategory(item) !== categoryFilter) return false;
        if (statusFilter !== 'all') {
          const status = getStatus(item).toLowerCase();
          if (statusFilter === 'approved' && !(status.includes('approved') || status.includes('new') || status.includes('saved'))) return false;
          if (statusFilter === 'pending' && !status.includes('pending')) return false;
          if (statusFilter === 'flagged' && !status.includes('flag')) return false;
        }
        if (!term) return true;
        return [
          getMerchant(item),
          getCategory(item),
          getSource(item),
          getStatus(item),
          typeLabel(item),
          getAccount(item),
          item.amount,
        ].join(' ').toLowerCase().includes(term);
      })
      .sort((a, b) => (getDate(b)?.getTime() || 0) - (getDate(a)?.getTime() || 0));
  }, [expenses, search, typeFilter, accountFilter, categoryFilter, statusFilter, startDate, endDate]);

  const pageSize = 10;
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
  }, [search, typeFilter, accountFilter, categoryFilter, statusFilter, startDate, endDate]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const incomeItems = filtered.filter((item) => getType(item) === 'income');
  const expenseItems = filtered.filter((item) => getType(item) !== 'income');
  const bankIncomeItems = incomeItems.filter((item) => !isCashAccount(item));
  const bankExpenseItems = expenseItems.filter((item) => !isCashAccount(item));
  const cashExpenseItems = expenseItems.filter(isCashAccount);
  const bankIncome = bankIncomeItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const bankExpense = bankExpenseItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const cashExpense = cashExpenseItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const bankBalance = bankIncome - bankExpense;
  const averageExpense = expenseItems.length ? expenseItems.reduce((sum, item) => sum + Number(item.amount || 0), 0) / expenseItems.length : 0;
  const selectedStart = dateFromInput(startDate);
  const selectedEnd = dateFromInput(endDate);

  const selectRangeDate = (date) => {
    if (!selectedStart || (selectedStart && selectedEnd)) {
      setStartDate(dateInputValue(date));
      setEndDate('');
      return;
    }

    if (isBeforeDay(date, selectedStart)) {
      setStartDate(dateInputValue(date));
      setEndDate(dateInputValue(selectedStart));
    } else {
      setEndDate(dateInputValue(date));
    }
    setShowDatePicker(false);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.merchant.trim() || !form.amount || Number(form.amount) <= 0) {
      setNotice('Merchant dan jumlah wajib diisi.');
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
      setNotice('Transaksi dihapus.');
    } catch (error) {
      setNotice(error.message || 'Transaksi gagal dihapus.');
    }
  };

  const exportCsv = () => {
    const header = ['Tanggal', 'Deskripsi', 'Kategori', 'Tipe', 'Jumlah', 'Rekening', 'Sumber', 'Status'];
    const rows = filtered.map((item) => [
      formatDate(getDate(item)),
      getMerchant(item),
      getCategory(item),
      typeLabel(item),
      item.amount || 0,
      item.payment_channel || item.rekening || 'Cash',
      getSource(item),
      getStatus(item),
    ]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'wa-finance-expenses.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto w-full max-w-[1450px] space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Transaksi</h1>
          <p className="mt-1 text-sm text-slate-400">
            Lacak pemasukan dan pengeluaran dari WhatsApp, input manual, dan sumber lainnya.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="relative">
            <select
              value={recapFilter}
              onChange={(event) => setRecapFilter(event.target.value)}
              className="h-full min-h-[38px] min-w-[220px] appearance-none rounded-lg border border-slate-700 bg-[#101b26] px-4 py-2 pr-9 text-sm text-slate-300 outline-none transition hover:border-slate-600 focus:border-emerald-500"
              title="Pilih periode/arsip transaksi"
            >
              <option value="active">Periode aktif</option>
              {recaps.map((recap) => (
                <option key={recap.id} value={recap.id}>
                  {recap.name || recap.id}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          </label>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!filtered.length}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#101b26] px-4 py-2 text-sm text-slate-300 transition hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button
            type="button"
            onClick={() => setShowForm((value) => !value)}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-[#06120b] transition hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4" /> Add Transaction
          </button>
        </div>
      </header>

      {notice && (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {notice}
        </div>
      )}

      {showForm && (
        <form onSubmit={save} className="grid gap-4 rounded-2xl border border-slate-800 bg-[#0b141c] p-5 md:grid-cols-2 xl:grid-cols-8">
          <input required placeholder="Merchant / deskripsi" value={form.merchant} onChange={(event) => setForm({ ...form, merchant: event.target.value })} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400 xl:col-span-2" />
          <input placeholder="Kategori" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400" />
          <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400">
            <option value="expense">Pengeluaran</option>
            <option value="income">Pemasukan</option>
          </select>
          <select value={form.payment_channel} onChange={(event) => setForm({ ...form, payment_channel: event.target.value })} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400">
            <option value="BCA">BCA</option>
            <option value="GOPAY">GOPAY</option>
            <option value="QRIS">QRIS</option>
            <option value="SUPERBANK">SUPERBANK</option>
            <option value="Transfer">Transfer</option>
            <option value="Cash">Cash</option>
          </select>
          <input required type="number" min="1" placeholder="Jumlah" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400" />
          <input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400" />
          <button disabled={busy} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-[#06120b] hover:bg-emerald-400 disabled:opacity-50">{busy ? 'Menyimpan...' : 'Simpan'}</button>
        </form>
      )}

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.72fr_0.85fr_0.85fr_0.8fr_1.45fr]">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowDatePicker((value) => !value)}
            className="flex min-h-[46px] w-full items-center justify-between rounded-xl border border-slate-800 bg-[#0b141c] px-4 py-2.5 text-left text-sm text-slate-200 transition hover:border-slate-700 focus:border-emerald-500 focus:outline-none"
          >
            <span className="inline-flex min-w-0 items-center gap-2 truncate">
              <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
              {dateOnly(selectedStart)} - {selectedEnd ? dateOnly(selectedEnd) : 'Pilih tanggal akhir'}
            </span>
            <ChevronDown className={`h-4 w-4 text-slate-500 transition ${showDatePicker ? 'rotate-180' : ''}`} />
          </button>
          {showDatePicker && (
            <div className="absolute left-0 top-[calc(100%+8px)] z-30 w-[min(720px,calc(100vw-2rem))] rounded-2xl border border-slate-700 bg-[#0b141c] p-4 shadow-2xl shadow-black/40">
              <div className="mb-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setCalendarMonth((value) => addMonths(value, -1))}
                  className="rounded-full border border-slate-700 p-2 text-slate-400 transition hover:border-emerald-500/50 hover:text-emerald-300"
                  aria-label="Bulan sebelumnya"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="text-center text-xs text-slate-400">
                  <p className="font-bold uppercase tracking-[0.18em] text-slate-500">Pilih periode transaksi</p>
                  <p className="mt-1">
                    {dateOnly(selectedStart)} - {selectedEnd ? dateOnly(selectedEnd) : 'pilih tanggal akhir'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCalendarMonth((value) => addMonths(value, 1))}
                  className="rounded-full border border-slate-700 p-2 text-slate-400 transition hover:border-emerald-500/50 hover:text-emerald-300"
                  aria-label="Bulan berikutnya"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <RangeCalendarMonth
                  month={calendarMonth}
                  rangeStart={selectedStart}
                  rangeEnd={selectedEnd}
                  onSelect={selectRangeDate}
                />
                <RangeCalendarMonth
                  month={addMonths(calendarMonth, 1)}
                  rangeStart={selectedStart}
                  rangeEnd={selectedEnd}
                  onSelect={selectRangeDate}
                />
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3 text-xs text-slate-500">
                <span>Klik tanggal awal, lalu tanggal akhir.</span>
                <button
                  type="button"
                  onClick={() => setShowDatePicker(false)}
                  className="rounded-lg border border-slate-700 px-3 py-2 font-bold text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300"
                >
                  Selesai
                </button>
              </div>
            </div>
          )}
        </div>
        <label className="relative">
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="min-h-[46px] w-full appearance-none rounded-xl border border-slate-800 bg-[#0b141c] px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-emerald-500">
            <option value="all">Semua Tipe</option>
            <option value="income">Pemasukan</option>
            <option value="expense">Pengeluaran</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        </label>
        <label className="relative">
          <select value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)} className="min-h-[46px] w-full appearance-none rounded-xl border border-slate-800 bg-[#0b141c] px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-emerald-500">
            <option value="all">Semua Rekening</option>
            {accounts.map((account) => <option key={account} value={account}>{account}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        </label>
        <label className="relative">
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="min-h-[46px] w-full appearance-none rounded-xl border border-slate-800 bg-[#0b141c] px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-emerald-500">
            <option value="all">All Categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        </label>
        <label className="relative">
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-[46px] w-full appearance-none rounded-xl border border-slate-800 bg-[#0b141c] px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-emerald-500">
            <option value="all">All Statuses</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending Review</option>
            <option value="flagged">Flagged</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        </label>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search merchant, notes, category, source, or amount..."
            className="min-h-[46px] w-full rounded-xl border border-slate-800 bg-[#0b141c] py-2.5 pl-11 pr-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-500"
          />
        </div>
      </section>

      <section className="grid overflow-hidden rounded-xl border border-slate-800 bg-[#0b141c] shadow-[0_18px_50px_rgba(0,0,0,0.16)] xl:grid-cols-5">
        <Metric icon={ArrowUp} label="Pemasukan Bank" value={currency(bankIncome)} detail={`${bankIncomeItems.length} transaksi masuk bank`} tone="emerald" />
        <Metric icon={CreditCard} label="Pengeluaran Bank" value={currency(bankExpense)} detail={`${bankExpenseItems.length} transaksi keluar bank`} tone="blue" />
        <Metric icon={ArrowDown} label="Pengeluaran Cash" value={currency(cashExpense)} detail={`${cashExpenseItems.length} transaksi cash`} tone="amber" />
        <Metric icon={Wallet} label="Saldo Bank" value={currency(bankBalance)} detail="Pemasukan bank - keluar bank" tone={bankBalance >= 0 ? 'emerald' : 'amber'} />
        <Metric icon={ReceiptText} label="Total Transaksi" value={String(filtered.length)} detail={busy ? 'Memuat Firestore...' : `Rata-rata keluar ${currency(averageExpense)}`} tone="violet" />
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-800 bg-[#0b141c] shadow-[0_18px_50px_rgba(0,0,0,0.16)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-slate-800 bg-[#101b26]/60 text-slate-400">
              <tr>
                <th className="px-5 py-4 font-semibold">Merchant</th>
                <th className="py-4 font-semibold">Category</th>
                <th className="py-4 font-semibold">Type</th>
                <th className="px-4 py-4 text-right font-semibold">Amount</th>
                <th className="px-4 py-4 font-semibold">Date <ArrowDown className="ml-1 inline h-4 w-4" /></th>
                <th className="py-4 font-semibold">Source</th>
                <th className="py-4 font-semibold">Status</th>
                <th className="px-5 py-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleExpenses.map((item) => {
                const merchant = getMerchant(item);
                const category = getCategory(item);
                const source = getSource(item);
                const status = getStatus(item);
                const messageId = getMessageId(item);
                const isIncome = getType(item) === 'income';
                return (
                  <tr key={item.id} className="border-b border-slate-800/70 transition last:border-0 hover:bg-slate-900/30">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-sm font-black text-white">
                          {merchantInitial(merchant)}
                        </span>
                        <span className="min-w-0">
                          <strong className="block truncate text-slate-100">{merchant}</strong>
                          <small className="mt-0.5 block truncate text-xs text-slate-500">{item.payment_channel || item.rekening || 'Cash'}</small>
                        </span>
                      </div>
                    </td>
                    <td className="py-4"><CategoryPill category={category} /></td>
                    <td className="py-4"><TypePill type={item.type} /></td>
                    <td className={`px-4 py-4 text-right font-semibold ${isIncome ? 'text-emerald-300' : 'text-red-200'}`}>
                      {isIncome ? '+' : '-'} {currency(item.amount)}
                    </td>
                    <td className="px-4 py-4 text-slate-300">{formatDate(getDate(item))}</td>
                    <td className="py-4">
                      <SourceLabel source={source} />
                      {messageId ? (
                        <small className="mt-1 block max-w-[150px] truncate font-mono text-[10px] text-slate-500" title={messageId}>
                          ID {shortMessageId(messageId)}
                        </small>
                      ) : null}
                    </td>
                    <td className="py-4"><StatusPill status={status} /></td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-slate-200" title="More actions"><MoreVertical className="h-4 w-4" /></button>
                        <button type="button" onClick={() => remove(item.id)} className="rounded-lg p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-300" title="Hapus transaksi"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!busy && filtered.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-5 py-16 text-center text-slate-500">
                    <ShoppingCart className="mx-auto mb-3 h-9 w-9 text-slate-700" />
                    <p>Belum ada transaksi.</p>
                    <p className="mt-1 text-xs">Tambah manual atau hubungkan WhatsApp.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-800 px-5 py-4 text-sm text-slate-400 md:flex-row">
          <span>
            {filtered.length
              ? `Showing ${pageStartIndex + 1} to ${pageEndIndex} of ${filtered.length} results`
              : 'Showing 0 results'}
          </span>
          {filtered.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={page === 1}
                className="rounded-lg border border-slate-800 bg-[#101b26] p-2 text-slate-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {pageNumbers[0] > 1 && (
                <>
                  <button type="button" onClick={() => setPage(1)} className="rounded-lg border border-slate-800 bg-[#101b26] px-3 py-1.5">1</button>
                  <span className="px-1">...</span>
                </>
              )}
              {pageNumbers.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  className={`rounded-lg border px-3 py-1.5 ${
                    pageNumber === page
                      ? 'border-emerald-500/40 bg-emerald-500/15 font-bold text-emerald-300'
                      : 'border-slate-800 bg-[#101b26]'
                  }`}
                >
                  {pageNumber}
                </button>
              ))}
              {pageNumbers[pageNumbers.length - 1] < totalPages && (
                <>
                  <span className="px-1">...</span>
                  <button type="button" onClick={() => setPage(totalPages)} className="rounded-lg border border-slate-800 bg-[#101b26] px-3 py-1.5">{totalPages}</button>
                </>
              )}
              <button
                type="button"
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-slate-800 bg-[#101b26] p-2 text-slate-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
