import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Archive,
  BarChart3,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Edit3,
  FileSpreadsheet,
  FileText,
  MessageSquare,
  PieChart as PieChartIcon,
  Plus,
  Save,
  Settings2,
  Sparkles,
  TrendingUp,
  Wallet,
  Wifi,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../context/useAuth';
import { listConversations, listExpenses } from '../lib/firestore';
import { createNewRecap, getBackendSettings, whatsappApi } from '../lib/whatsapp-api';

const CATEGORY_COLORS = ['#22c55e', '#8b5cf6', '#3b82f6', '#f59e0b', '#fb7185', '#94a3b8'];
const DEFAULT_BUDGET_THRESHOLDS = [80, 90, 95, 100];

const currency = (amount) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(Number(amount || 0));

const shortCurrency = (amount) => {
  const value = Number(amount || 0);
  if (Math.abs(value) >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(value % 1_000_000 ? 1 : 0)}jt`;
  if (Math.abs(value) >= 1_000) return `Rp ${(value / 1_000).toFixed(0)}rb`;
  return currency(value);
};

const formatDateTime = (date) => {
  if (!date || Number.isNaN(date.getTime())) return 'Tanggal belum diisi';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const formatDay = (date) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' }).format(date);
const formatMonth = (date) => new Intl.DateTimeFormat('id-ID', { month: 'short', year: '2-digit' }).format(date);
const formatLongDate = (date) => new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(date);

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const startOfWeek = (date) => {
  const copy = startOfDay(date);
  const day = copy.getDay() || 7;
  copy.setDate(copy.getDate() - day + 1);
  return copy;
};
const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
const addDays = (date, amount) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
const addMonths = (date, amount) => new Date(date.getFullYear(), date.getMonth() + amount, 1);
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

function dateFromInput(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function getExpenseDate(item) {
  const value = item.createdAt || item.timestamp || item.date;
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSalaryIncome(item) {
  if (String(item.type || '').toLowerCase() !== 'income') return false;
  const text = [
    item.category,
    item.merchant,
    item.description,
    item.pesan,
    item.message,
  ].filter(Boolean).join(' ').toLowerCase();
  return /\b(gaji|salary|upah|payroll)\b/.test(text);
}

function isInRange(item, range, activeStart = null) {
  const date = getExpenseDate(item);
  if (!date) return range === 'month';
  const now = new Date();
  const calendarStart = range === 'day'
    ? startOfDay(now)
    : range === 'week'
      ? startOfWeek(now)
      : activeStart || startOfMonth(now);
  const start = activeStart && activeStart > calendarStart ? activeStart : calendarStart;
  return date >= start;
}

function Panel({ children, className = '' }) {
  return (
    <section className={`rounded-xl border border-slate-800/90 bg-[#0b141c] shadow-[0_18px_50px_rgba(0,0,0,0.16)] ${className}`}>
      {children}
    </section>
  );
}

function MetricCard({ icon: Icon, title, value, detail, accent = 'emerald', progress }) {
  const accents = {
    emerald: 'bg-emerald-500/15 text-emerald-400',
    violet: 'bg-violet-500/15 text-violet-300',
    blue: 'bg-blue-500/15 text-blue-300',
    amber: 'bg-amber-500/15 text-amber-300',
  };

  return (
    <Panel className="group min-h-[126px] overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5 hover:border-emerald-500/35">
      <div className="flex items-start gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${accents[accent] || accents.emerald}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-slate-500">{title}</p>
          <p className="mt-2 truncate text-[26px] font-bold leading-none tracking-tight text-slate-50">{value}</p>
          <p className="mt-3 text-xs text-slate-400">{detail}</p>
          {typeof progress === 'number' && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

function RangeSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-lg border border-slate-800 bg-[#101b26] px-3 py-1.5 text-xs font-medium text-slate-300 outline-none transition hover:border-slate-700 focus:border-emerald-500"
    >
      <option value="day">This Day</option>
      <option value="week">This Week</option>
      <option value="month">This Month</option>
    </select>
  );
}

function TrendRangeSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-lg border border-slate-800 bg-[#101b26] px-3 py-1.5 text-xs font-medium text-slate-300 outline-none transition hover:border-slate-700 focus:border-emerald-500"
    >
      <option value="daily">Harian</option>
      <option value="weekly">Mingguan</option>
      <option value="monthly">Bulanan</option>
    </select>
  );
}

function CategoryBadge({ children, color }) {
  return (
    <span
      className="inline-flex rounded-full px-2 py-1 text-[11px] font-bold text-slate-950"
      style={{ backgroundColor: color || '#22c55e' }}
    >
      {children}
    </span>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

function firstName(user) {
  const source = user?.displayName || user?.email || 'teman';
  return source.split('@')[0].split(/\s+/)[0] || 'teman';
}

function WelcomeHero({ user, startDate, endDate, onTransactions, onRecap }) {
  return (
    <section className="relative isolate mb-6 overflow-hidden rounded-[32px] border border-lime-200/80 bg-[#c9f598] px-7 py-7 text-[#123008] shadow-[0_24px_70px_rgba(63,98,18,0.16)] dark:border-lime-300/10 dark:bg-[#a9ed62] md:px-9 md:py-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-lime-600/20" />
        <span className="absolute left-[45%] top-[-88px] h-64 w-64 rounded-full bg-lime-600/20" />
        <span className="absolute bottom-[-110px] right-[8%] h-56 w-56 rounded-full bg-lime-700/18" />
        <span className="absolute bottom-5 left-[35%] h-28 w-12 rounded-full bg-lime-600/25" />
        <span className="absolute right-[34%] top-8 h-20 w-72 rounded-full border-[7px] border-white/85" />
        <span className="absolute right-[24%] top-8 h-20 w-20 rounded-full border-[7px] border-white/85" />
        <span className="absolute bottom-10 right-[28%] h-28 w-20 rounded-t-full border-l-[7px] border-t-[7px] border-[#226c13]" />
        <span className="absolute left-[16%] bottom-0 h-28 w-36 rounded-t-full bg-lime-600/25" />
      </div>

      <div className="relative z-10 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-3 rounded-full bg-[#123008]/8 px-3 py-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#123008] text-xs font-black text-lime-200">
              WA
            </span>
            <span className="text-xs font-black uppercase tracking-[0.16em] text-[#21490f]">
              WA Finance
            </span>
          </div>
          <h2 className="text-[34px] font-semibold leading-tight tracking-tight text-[#102a08] md:text-[46px]">
            {getGreeting()}, {firstName(user)}
          </h2>
          <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-[#31591d] md:text-base">
            Mulai hari dengan catatan yang rapi. Periode aktif: {formatLongDate(startDate)} - {formatLongDate(endDate)}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onTransactions}
            className="inline-flex items-center gap-2 rounded-full bg-[#135400] px-5 py-3 text-sm font-bold text-lime-50 shadow-[0_12px_30px_rgba(19,84,0,0.22)] transition hover:-translate-y-0.5 hover:bg-[#0d3d00]"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Transaksi
          </button>
          <button
            type="button"
            onClick={onRecap}
            className="inline-flex items-center gap-2 rounded-full bg-[#135400] px-5 py-3 text-sm font-bold text-lime-50 shadow-[0_12px_30px_rgba(19,84,0,0.22)] transition hover:-translate-y-0.5 hover:bg-[#0d3d00]"
          >
            <FileText className="h-4 w-4" />
            New Recap
          </button>
        </div>
      </div>
    </section>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [trendRange, setTrendRange] = useState('daily');
  const [categoryRange, setCategoryRange] = useState('month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [monthlyBudget, setMonthlyBudget] = useState(0);
  const [budgetInput, setBudgetInput] = useState('');
  const [budgetEditing, setBudgetEditing] = useState(false);
  const [budgetBusy, setBudgetBusy] = useState(false);
  const [budgetNotice, setBudgetNotice] = useState('');
  const [activeRecapStartDate, setActiveRecapStartDate] = useState('');
  const [showRecapModal, setShowRecapModal] = useState(false);
  const [recapBusy, setRecapBusy] = useState(false);
  const [recapForm, setRecapForm] = useState(() => ({
    name: `Periode ${new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date())}`,
    start_date: dateKey(new Date()),
  }));

  useEffect(() => {
    let active = true;
    Promise.all([listExpenses(user.uid), listConversations(user.uid), getBackendSettings()])
      .then(([nextExpenses, nextConversations, settings]) => {
        if (!active) return;
        setExpenses(nextExpenses.filter((item) => item.type !== 'income'));
        setIncomes(nextExpenses.filter((item) => item.type === 'income'));
        setConversations(nextConversations);
        const savedBudget = Number(settings.monthly_budget || 0);
        setMonthlyBudget(savedBudget);
        setBudgetInput(savedBudget ? String(savedBudget) : '');
        setActiveRecapStartDate(settings.active_recap_start_date || '');
      })
      .catch((reason) => {
        if (active) setError(reason.message || 'Data Firestore belum dapat dibaca.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [user.uid]);

  const activePeriodStart = useMemo(() => dateFromInput(activeRecapStartDate) || startOfMonth(new Date()), [activeRecapStartDate]);
  const activePeriodEnd = useMemo(() => endOfMonth(activePeriodStart), [activePeriodStart]);
  const activePeriodExpenses = useMemo(() => expenses.filter((item) => {
    const date = getExpenseDate(item);
    return date ? date >= activePeriodStart : false;
  }), [expenses, activePeriodStart]);
  const activePeriodIncomes = useMemo(() => incomes.filter((item) => {
    const date = getExpenseDate(item);
    return date ? date >= activePeriodStart : false;
  }), [incomes, activePeriodStart]);
  const filteredCategoryExpenses = useMemo(() => (
    expenses.filter((item) => isInRange(item, categoryRange, activePeriodStart))
  ), [expenses, categoryRange, activePeriodStart]);
  const totalMonth = activePeriodExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const salaryIncomePeriod = activePeriodIncomes
    .filter((item) => isSalaryIncome(item))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const extraIncomePeriod = activePeriodIncomes
    .filter((item) => !isSalaryIncome(item))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const budgetUsed = monthlyBudget ? (totalMonth / monthlyBudget) * 100 : 0;
  const budgetBase = monthlyBudget || salaryIncomePeriod;
  const budgetRemaining = budgetBase + extraIncomePeriod - totalMonth;
  const activeConversationCount = useMemo(() => {
    const unique = new Set(conversations.map((item) => item.phone_number || item.from).filter(Boolean));
    return unique.size || conversations.length;
  }, [conversations]);
  const successRate = conversations.length
    ? Math.round((expenses.length / Math.max(conversations.length, expenses.length)) * 1000) / 10
    : expenses.length ? 100 : 0;

  const trend = useMemo(() => {
    const now = new Date();

    if (trendRange === 'weekly') {
      const currentWeek = startOfWeek(now);
      const weeks = [...Array(8)].map((_, index) => {
        const start = addDays(currentWeek, (index - 7) * 7);
        const end = addDays(start, 6);
        return {
          key: dateKey(start),
          start,
          end: new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999),
          label: `${formatDay(start)} - ${formatDay(end)}`,
          amount: 0,
        };
      });

      activePeriodExpenses.forEach((item) => {
        const date = getExpenseDate(item);
        if (!date) return;
        const bucket = weeks.find((week) => date >= week.start && date <= week.end);
        if (bucket) bucket.amount += Number(item.amount || 0);
      });

      return weeks;
    }

    if (trendRange === 'monthly') {
      const currentMonth = startOfMonth(now);
      const months = [...Array(6)].map((_, index) => {
        const date = addMonths(currentMonth, index - 5);
        return {
          key: monthKey(date),
          date,
          label: formatMonth(date),
          amount: 0,
        };
      });
      const byMonth = new Map(months.map((item) => [item.key, item]));

      activePeriodExpenses.forEach((item) => {
        const date = getExpenseDate(item);
        if (!date) return;
        const key = monthKey(date);
        if (byMonth.has(key)) byMonth.get(key).amount += Number(item.amount || 0);
      });

      return months;
    }

    const today = startOfDay(now);
    const days = [...Array(7)].map((_, index) => {
      const date = addDays(today, index - 6);
      return {
        key: dateKey(date),
        date,
        label: formatDay(date),
        amount: 0,
      };
    });
    const byKey = new Map(days.map((item) => [item.key, item]));

    activePeriodExpenses.forEach((item) => {
      const date = getExpenseDate(item);
      if (!date) return;
      const key = dateKey(startOfDay(date));
      if (byKey.has(key)) byKey.get(key).amount += Number(item.amount || 0);
    });

    return days;
  }, [activePeriodExpenses, trendRange]);

  const categories = useMemo(() => {
    const grouped = {};
    filteredCategoryExpenses.forEach((item) => {
      const name = item.category || 'Lainnya';
      grouped[name] = (grouped[name] || 0) + Number(item.amount || 0);
    });
    const total = Object.values(grouped).reduce((sum, value) => sum + value, 0);
    return Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, amount], index) => ({
        name,
        amount,
        percent: total ? Math.round((amount / total) * 1000) / 10 : 0,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      }));
  }, [filteredCategoryExpenses]);

  const recentTransactions = useMemo(() => (
    [...expenses]
      .sort((a, b) => (getExpenseDate(b)?.getTime() || 0) - (getExpenseDate(a)?.getTime() || 0))
      .slice(0, 5)
  ), [expenses]);

  const topCategory = categories[0];
  const insights = [
    {
      icon: TrendingUp,
      title: topCategory ? `${topCategory.name} kategori tertinggi` : 'Belum ada kategori dominan',
      detail: topCategory ? `${topCategory.percent}% dari pengeluaran periode terpilih.` : 'Insight muncul setelah transaksi tersimpan.',
    },
    {
      icon: Zap,
      title: budgetUsed > 80 ? 'Budget mendekati limit' : 'Budget masih terkendali',
      detail: monthlyBudget
        ? `${budgetUsed.toFixed(1)}% dari budget bulanan ${currency(monthlyBudget)}.`
        : 'Atur monthly budget untuk mengaktifkan alert WhatsApp.',
    },
    {
      icon: CheckCircle2,
      title: 'Automation health',
      detail: conversations.length ? `${successRate}% estimasi transaksi berhasil diproses.` : 'Hubungkan WhatsApp untuk mulai tracking otomatis.',
    },
  ];

  const saveBudget = async () => {
    const parsed = Math.max(0, Math.round(Number(String(budgetInput || '').replace(/[^0-9]/g, ''))));
    setBudgetBusy(true);
    setBudgetNotice('');
    try {
      const result = await whatsappApi('/api/settings/budget', {
        method: 'PUT',
        body: JSON.stringify({
          monthly_budget: parsed,
          budget_alert_thresholds: DEFAULT_BUDGET_THRESHOLDS,
        }),
      });
      const nextBudget = Number(result.settings?.monthly_budget || parsed);
      setMonthlyBudget(nextBudget);
      setBudgetInput(nextBudget ? String(nextBudget) : '');
      setBudgetEditing(false);
      setBudgetNotice(nextBudget ? 'Monthly budget tersimpan. Alert WA aktif di 80/90/95/100%.' : 'Monthly budget dinonaktifkan.');
    } catch (reason) {
      setBudgetNotice(reason.message || 'Budget gagal disimpan.');
    } finally {
      setBudgetBusy(false);
    }
  };

  const submitNewRecap = async (event) => {
    event.preventDefault();
    if (!window.confirm('Tutup periode sekarang? Data lama akan diarsipkan, Sheet dibackup, lalu dashboard aktif mulai dari 0.')) return;
    setRecapBusy(true);
    setBudgetNotice('');
    try {
      const result = await createNewRecap(recapForm);
      setShowRecapModal(false);
      setExpenses([]);
      setIncomes([]);
      setConversations([]);
      setActiveRecapStartDate(result.settings?.active_recap_start_date || recapForm.start_date);
      setBudgetNotice(`New Recap berhasil. Arsip: ${result.recap?.name || 'periode lama'}. Periode baru siap dipakai.`);
    } catch (reason) {
      setBudgetNotice(reason.message || 'New Recap gagal. Data belum diubah.');
    } finally {
      setRecapBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1450px]">
      <Header title="Dashboard" subtitle="Overview of your finance operations and AI insights." />

      <WelcomeHero
        user={user}
        startDate={activePeriodStart}
        endDate={activePeriodEnd}
        onTransactions={() => navigate('/expenses')}
        onRecap={() => setShowRecapModal(true)}
      />

      {error && (
        <div className="mb-5 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </div>
      )}
      {budgetNotice && (
        <div className="mb-5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {budgetNotice}
        </div>
      )}

      {showRecapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <form onSubmit={submitNewRecap} className="w-full max-w-lg rounded-2xl border border-slate-700 bg-[#0b141c] p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                <Archive className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-xl font-bold text-white">New Recap / Tutup Periode</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Sistem akan backup tab Google Sheet lama, arsipkan data aktif di webapp, lalu mulai periode baru dari kosong.
                  Data lama tetap bisa dipanggil dari riwayat recap.
                </p>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Nama periode baru</span>
                <input
                  required
                  value={recapForm.name}
                  onChange={(event) => setRecapForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
                  placeholder="Contoh: Gaji Agustus 2026"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Tanggal mulai periode baru</span>
                <input
                  required
                  type="date"
                  value={recapForm.start_date}
                  onChange={(event) => setRecapForm((current) => ({ ...current, start_date: event.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
                />
              </label>
              <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-100/80">
                Data tidak dihapus. Yang terjadi: tab Sheet lama dicopy ke arsip, tab aktif dikosongkan, lalu data webapp lama diberi label arsip.
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowRecapModal(false)}
                disabled={recapBusy}
                className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={recapBusy}
                className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-[#06120b] transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {recapBusy ? 'Memproses backup...' : 'Backup & Mulai Baru'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Wallet}
            title="Total Expenses"
            value={loading ? '...' : currency(totalMonth)}
            detail={activePeriodExpenses.length ? `Periode aktif sejak ${formatDay(activePeriodStart)}` : `Belum ada transaksi sejak ${formatDay(activePeriodStart)}`}
            accent="emerald"
          />
          <Panel className="group min-h-[126px] overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5 hover:border-emerald-500/35">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
                <CalendarDays className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-slate-500">Monthly Budget</p>
                  <button
                    type="button"
                    onClick={() => setBudgetEditing((value) => !value)}
                    className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
                    title="Edit monthly budget"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                </div>
                {budgetEditing ? (
                  <div className="mt-2 flex gap-2">
                    <input
                      value={budgetInput}
                      onChange={(event) => setBudgetInput(event.target.value)}
                      inputMode="numeric"
                      placeholder="Contoh 5000000"
                      className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm font-semibold text-slate-100 outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      disabled={budgetBusy}
                      onClick={saveBudget}
                      className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-3 py-2 text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
                      title="Save monthly budget"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 truncate text-[26px] font-bold leading-none tracking-tight text-slate-50">
                    {monthlyBudget ? currency(monthlyBudget) : 'Belum diset'}
                  </p>
                )}
                <p className="mt-3 text-xs text-slate-400">
                  {monthlyBudget
                    ? `${budgetUsed.toFixed(1)}% utilized · sisa ${currency(budgetRemaining)}`
                    : 'Klik edit untuk mengaktifkan alert WA.'}
                </p>
                {monthlyBudget ? (
                  <p className="mt-1 text-[10px] text-slate-500">
                    Masuk {currency(extraIncomePeriod)} · Keluar {currency(totalMonth)}
                  </p>
                ) : null}
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full ${budgetUsed >= 100 ? 'bg-red-400' : budgetUsed >= 95 ? 'bg-amber-400' : 'bg-gradient-to-r from-emerald-400 to-emerald-500'}`}
                    style={{ width: `${Math.min(Math.max(budgetUsed, 0), 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-[10px] text-slate-500">Alert: 80% · 90% · 95% · 100%</p>
              </div>
            </div>
          </Panel>
          <MetricCard
            icon={MessageSquare}
            title="Active Conversations"
            value={loading ? '...' : String(activeConversationCount)}
            detail={conversations.length ? `${conversations.length} pesan tersimpan` : 'Menunggu chat WhatsApp'}
            accent="violet"
          />
          <MetricCard
            icon={Bot}
            title="Automation Success Rate"
            value={loading ? '...' : `${successRate}%`}
            detail={expenses.length ? 'Berdasarkan data transaksi' : 'Belum ada data otomatis'}
            accent="amber"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.95fr]">
          <Panel className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-bold text-slate-100">Expense Trend</h2>
              <TrendRangeSelect value={trendRange} onChange={setTrendRange} />
            </div>
            <div className="h-[250px]">
              {trend.some((item) => item.amount > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend} margin={{ top: 20, right: 18, bottom: 0, left: -8 }}>
                    <defs>
                      <linearGradient id="expenseTrendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.42} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#22303b" strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="label" stroke="#8a97a4" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#8a97a4" fontSize={11} tickLine={false} axisLine={false} tickFormatter={shortCurrency} />
                    <Tooltip
                      contentStyle={{ background: '#101b26', border: '1px solid #334555', borderRadius: 10, color: '#fff' }}
                      formatter={(value) => [currency(value), 'Pengeluaran']}
                    />
                    <Area type="monotone" dataKey="amount" stroke="#42d865" strokeWidth={2.5} fill="url(#expenseTrendFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 text-center">
                  <BarChart3 className="h-10 w-10 text-slate-700" />
                  <p className="mt-3 text-sm text-slate-500">Trend muncul setelah transaksi masuk.</p>
                </div>
              )}
            </div>
          </Panel>

          <Panel className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-bold text-slate-100">Top Expense Categories</h2>
              <RangeSelect value={categoryRange} onChange={setCategoryRange} />
            </div>
            {categories.length ? (
              <div className="grid min-h-[250px] grid-cols-1 items-center gap-5 lg:grid-cols-[190px_1fr]">
                <div className="relative h-[190px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categories} innerRadius={56} outerRadius={88} paddingAngle={2} dataKey="amount" stroke="none">
                        {categories.map((item) => <Cell key={item.name} fill={item.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <strong className="text-lg text-white">{shortCurrency(categories.reduce((sum, item) => sum + item.amount, 0))}</strong>
                    <span className="text-xs text-slate-500">Total</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {categories.map((item) => (
                    <div key={item.name} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="truncate text-slate-300">{item.name}</span>
                      </div>
                      <span className="font-medium text-slate-200">{currency(item.amount)}</span>
                      <span className="w-12 text-right text-xs text-slate-500">{item.percent}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex min-h-[250px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 text-center">
                <PieChartIcon className="h-10 w-10 text-slate-700" />
                <p className="mt-3 text-sm text-slate-500">Kategori akan muncul sesuai filter periode.</p>
              </div>
            )}
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.85fr]">
          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 px-5 py-4">
              <h2 className="text-[15px] font-bold text-slate-100">Recent Transactions</h2>
              <button
                type="button"
                onClick={() => navigate('/expenses')}
                className="rounded-lg border border-slate-800 bg-[#101b26] px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-emerald-500/40 hover:text-white"
              >
                View all transactions
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="text-slate-500">
                  <tr className="border-b border-slate-800/80">
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="py-3 font-semibold">Description</th>
                    <th className="py-3 font-semibold">Category</th>
                    <th className="py-3 text-right font-semibold">Amount</th>
                    <th className="px-5 py-3 text-right font-semibold">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((item, index) => {
                    const date = getExpenseDate(item);
                    const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
                    return (
                      <tr key={item.id} className="border-b border-slate-800/60 last:border-0">
                        <td className="px-5 py-3 text-slate-400">{formatDateTime(date)}</td>
                        <td className="py-3">
                          <p className="font-medium text-slate-200">{item.merchant || item.description || 'Transaksi WhatsApp'}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">{item.payment_channel || item.rekening || 'Cash'}</p>
                        </td>
                        <td className="py-3"><CategoryBadge color={color}>{item.category || 'Lainnya'}</CategoryBadge></td>
                        <td className="py-3 text-right font-bold text-emerald-400">{currency(item.amount)}</td>
                        <td className="px-5 py-3 text-right text-slate-400">{item.source || 'Manual'}</td>
                      </tr>
                    );
                  })}
                  {!loading && !recentTransactions.length && (
                    <tr>
                      <td colSpan="5" className="px-5 py-12 text-center text-slate-500">
                        Belum ada transaksi. Kirim transaksi dari WhatsApp atau tambahkan manual.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="space-y-5">
            <Panel className="p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-[15px] font-bold text-slate-100">AI Insights</h2>
                <span className="rounded-md bg-violet-500/20 px-2 py-1 text-[10px] font-bold text-violet-300">New</span>
              </div>
              <div className="space-y-3">
                {insights.map((item) => (
                  <div key={item.title} className="group flex items-center gap-3 rounded-xl border border-slate-800 bg-[#101b26] p-3 transition hover:border-emerald-500/35">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                      <item.icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-sm text-slate-100">{item.title}</strong>
                      <small className="mt-1 block text-xs leading-relaxed text-slate-500">{item.detail}</small>
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-600 transition group-hover:text-emerald-400" />
                  </div>
                ))}
              </div>
            </Panel>

            <Panel className="p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-[15px] font-bold text-slate-100">Quick Actions</h2>
                <Sparkles className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="grid gap-3">
                <button type="button" onClick={() => navigate('/whatsapp')} className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-left transition hover:border-emerald-400/60">
                  <Wifi className="h-6 w-6 text-emerald-400" />
                  <span><strong className="block text-sm text-white">Connect WhatsApp</strong><small className="text-xs text-slate-400">Scan QR dan aktifkan bot.</small></span>
                  <ArrowRight className="ml-auto h-4 w-4 text-slate-500" />
                </button>
                <button type="button" onClick={() => navigate('/expenses')} className="flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-left transition hover:border-blue-400/60">
                  <Plus className="h-6 w-6 text-blue-300" />
                  <span><strong className="block text-sm text-white">Tambah Transaksi</strong><small className="text-xs text-slate-400">Catat manual jika diperlukan.</small></span>
                  <ArrowRight className="ml-auto h-4 w-4 text-slate-500" />
                </button>
                <button type="button" onClick={() => navigate('/settings')} className="flex items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/10 p-4 text-left transition hover:border-violet-400/60">
                  <Settings2 className="h-6 w-6 text-violet-300" />
                  <span><strong className="block text-sm text-white">Pengaturan AI</strong><small className="text-xs text-slate-400">Apps Script, Sheet, dan model.</small></span>
                  <ArrowRight className="ml-auto h-4 w-4 text-slate-500" />
                </button>
                <button type="button" onClick={() => setShowRecapModal(true)} className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-left transition hover:border-amber-400/60">
                  <Archive className="h-6 w-6 text-amber-300" />
                  <span><strong className="block text-sm text-white">New Recap</strong><small className="text-xs text-slate-400">Backup periode lama dan mulai dari 0.</small></span>
                  <ArrowRight className="ml-auto h-4 w-4 text-slate-500" />
                </button>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
