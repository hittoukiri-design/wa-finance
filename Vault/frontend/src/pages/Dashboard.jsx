import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  BarChart3,
  CalendarDays,
  CreditCard,
  Edit3,
  FileSpreadsheet,
  FileText,
  PieChart as PieChartIcon,
  Save,
  Wallet,
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

const CATEGORY_COLORS = ['#2f781c', '#6952ec', '#f77132', '#f59e0b', '#16b896', '#389ef2', '#94a3b8'];
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
  const [selectedDayIndex, setSelectedDayIndex] = useState(null);
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
  const totalIncome = salaryIncomePeriod + extraIncomePeriod;

  const budgetUsed = monthlyBudget ? (totalMonth / monthlyBudget) * 100 : 0;
  const budgetBase = monthlyBudget || salaryIncomePeriod;
  const budgetRemaining = budgetBase + extraIncomePeriod - totalMonth;

  // Streak computations
  const streak = useMemo(() => {
    const dates = new Set(
      activePeriodExpenses
        .map((e) => { const d = getExpenseDate(e); return d ? dateKey(d) : null; })
        .filter(Boolean)
    );
    let count = 0;
    const today = startOfDay(new Date());
    for (let i = 0; i < 365; i++) {
      if (dates.has(dateKey(addDays(today, -i)))) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }, [activePeriodExpenses]);

  const longestStreak = useMemo(() => {
    const sorted = [...new Set(
      activePeriodExpenses
        .map((e) => { const d = getExpenseDate(e); return d ? dateKey(d) : null; })
        .filter(Boolean)
    )].sort();
    let longest = 0;
    let cur = 0;
    sorted.forEach((dk, i) => {
      if (i === 0) {
        cur = 1;
      } else {
        const diff = Math.round((new Date(dk) - new Date(sorted[i - 1])) / 86400000);
        cur = diff === 1 ? cur + 1 : 1;
      }
      if (cur > longest) longest = cur;
    });
    return Math.max(longest, streak);
  }, [activePeriodExpenses, streak]);

  const daysWithTx = useMemo(() => new Set(
    activePeriodExpenses
      .map((e) => { const d = getExpenseDate(e); return d ? dateKey(d) : null; })
      .filter(Boolean)
  ).size, [activePeriodExpenses]);

  const totalDays = useMemo(() => {
    return Math.max(1, Math.ceil((activePeriodEnd - activePeriodStart) / 86400000) + 1);
  }, [activePeriodStart, activePeriodEnd]);

  const lastTxDate = useMemo(() => {
    if (!activePeriodExpenses.length) return null;
    const sorted = [...activePeriodExpenses].sort((a, b) => (getExpenseDate(b)?.getTime() || 0) - (getExpenseDate(a)?.getTime() || 0));
    return getExpenseDate(sorted[0]);
  }, [activePeriodExpenses]);

  // 7-day strip
  const weekDays = useMemo(() => {
    const today = startOfDay(new Date());
    const txDates = new Set(
      activePeriodExpenses
        .map((e) => { const d = getExpenseDate(e); return d ? dateKey(d) : null; })
        .filter(Boolean)
    );
    const dow = today.getDay();
    const monday = addDays(today, -(dow === 0 ? 6 : dow - 1));
    const names = ['MIN', 'SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(monday, i);
      return {
        key: dateKey(d),
        day: names[d.getDay()],
        date: d.getDate(),
        isToday: dateKey(d) === dateKey(today),
        hasTx: txDates.has(dateKey(d)),
      };
    });
  }, [activePeriodExpenses]);

  // Saldo per Dompet
  const saldoPerDompet = useMemo(() => {
    const grouped = {};
    activePeriodExpenses.forEach((e) => {
      const ch = String(e.payment_channel || e.rekening || 'Cash').trim();
      grouped[ch] = (grouped[ch] || 0) + Number(e.amount || 0);
    });
    const maxVal = Math.max(...Object.values(grouped), 1);
    const COLORS = ['#1b5e20', '#f5962a', '#2563eb', '#6952ec'];
    return Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, amount], i) => ({
        name,
        amount,
        percent: Math.round((amount / maxVal) * 100),
        color: COLORS[i % COLORS.length],
      }));
  }, [activePeriodExpenses]);

  // Sparkline data calculations
  const expenseSparkline = useMemo(() => {
    const byDay = {};
    activePeriodExpenses.forEach((e) => {
      const d = getExpenseDate(e);
      if (d) { const k = dateKey(d); byDay[k] = (byDay[k] || 0) + Number(e.amount || 0); }
    });
    const today = startOfDay(new Date());
    const daysSoFar = Math.max(1, Math.ceil((today - activePeriodStart) / 86400000) + 1);
    return Array.from({ length: Math.min(daysSoFar, totalDays) }, (_, i) => byDay[dateKey(addDays(activePeriodStart, i))] || 0);
  }, [activePeriodExpenses, activePeriodStart, totalDays]);

  const txBarData = useMemo(() => {
    const byDay = {};
    activePeriodExpenses.forEach((e) => {
      const d = getExpenseDate(e);
      if (d) { const k = dateKey(d); byDay[k] = (byDay[k] || 0) + 1; }
    });
    const today = startOfDay(new Date());
    const daysSoFar = Math.max(1, Math.ceil((today - activePeriodStart) / 86400000) + 1);
    return Array.from({ length: Math.min(daysSoFar, totalDays) }, (_, i) => byDay[dateKey(addDays(activePeriodStart, i))] || 0);
  }, [activePeriodExpenses, activePeriodStart, totalDays]);

  // Trend Chart
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

  // Categories Chart
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
      setBudgetNotice(nextBudget ? 'Monthly budget tersimpan.' : 'Monthly budget dinonaktifkan.');
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
      setBudgetNotice(`New Recap berhasil. Arsip: ${result.recap?.name || 'periode lama'}.`);
    } catch (reason) {
      setBudgetNotice(reason.message || 'New Recap gagal.');
    } finally {
      setRecapBusy(false);
    }
  };

  // Sparkline generator SVG points
  const maxExp = Math.max(...expenseSparkline, 1);
  const expPoints = expenseSparkline.length < 2
    ? '0,18 100,18'
    : expenseSparkline.map((v, i) => {
        const x = (i / (expenseSparkline.length - 1)) * 100;
        const y = 20 - (v / maxExp) * 16;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');

  const maxBar = Math.max(...txBarData, 1);

  return (
    <div className="mx-auto w-full max-w-[1450px]">
      <Header title="Dashboard" subtitle="Overview keuangan & insight AI kamu." />

      {error && (
        <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          {error}
        </div>
      )}
      {budgetNotice && (
        <div className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
          {budgetNotice}
        </div>
      )}

      {/* ════ 1. HERO BANNER CAPSULE ════ */}
      <div className="hero-banner-exact">
        <div className="hero-content-exact-left">
          <div className="hero-pill-badge-exact">
            <div className="hero-pill-badge-icon">
              <svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
            </div>
            <span className="hero-pill-badge-text">AETHER FAMILY FINANCE</span>
          </div>
          <h1 className="hero-title-exact">{getGreeting()}, {firstName(user)}</h1>
          <p className="hero-desc-exact">
            Mulai hari dengan catatan yang rapi. · {formatLongDate(activePeriodStart)} - {formatLongDate(activePeriodEnd)}
          </p>
        </div>

        <div className="hero-buttons-exact">
          <button className="btn-hero-solid-green" onClick={() => navigate('/expenses')}>
            <FileSpreadsheet width="13" height="13" />
            Excel
          </button>
          <button className="btn-hero-solid-green" onClick={() => setShowRecapModal(true)}>
            <FileText width="13" height="13" />
            PDF
          </button>
        </div>
      </div>

      {/* ════ 2. TOP SUB-ROW GRID ════ */}
      <div className="top-subrow-grid">
        
        {/* Weekly Strip Card */}
        <div className="box-card">
          <div className="week-card-top">
            <span className="badge-streak-status">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {streak > 0 ? `${streak} hari streak` : 'Belum ada streak'}
            </span>
            <span className="week-tx-count-text">
              {loading ? '...' : `${activePeriodExpenses.length} transaksi`} • Terakhir: {lastTxDate ? formatDay(lastTxDate) : '-'}
            </span>
          </div>

          <div className="week-selector-bar">
            <button onClick={() => navigate('/expenses')}>‹</button>
            <span className="week-selector-title">
              {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date())}
            </span>
            <button onClick={() => navigate('/expenses')}>›</button>
          </div>

          <div className="week-days-flex">
            {weekDays.map((d, index) => {
              const isSelected = selectedDayIndex === index || (selectedDayIndex === null && d.isToday);
              return (
                <div
                  key={d.key}
                  className={`week-day-box ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedDayIndex(index)}
                >
                  <span className="week-day-name-txt">{d.day}</span>
                  <div className="week-day-num-circle">{d.date}</div>
                </div>
              );
            })}
          </div>

          <button className="link-view-all-month" onClick={() => navigate('/expenses')}>
            <CalendarDays width="12" height="12" />
            Lihat satu bulan
          </button>
        </div>

        {/* Streak Stats Card */}
        <div className="box-card streak-stack-box">
          <div className="streak-stat-item">
            <div className="streak-icon-wrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#245c10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
            </div>
            <div>
              <div className="streak-stat-label">Streak Berjalan</div>
              <div className="streak-stat-number">{streak} hari</div>
            </div>
          </div>
          <div className="streak-stat-item">
            <div className="streak-icon-wrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#245c10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2"/><path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.45 1-1 1H8v4h8v-4h-1c-.55 0-1-.45-1-1v-2.34"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>
            </div>
            <div>
              <div className="streak-stat-label">Streak Terpanjang</div>
              <div className="streak-stat-number">{longestStreak} hari</div>
            </div>
          </div>
          <div className="streak-stat-item">
            <div className="streak-icon-wrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#245c10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div>
              <div className="streak-stat-label">Hari Tercatat Bulan Ini</div>
              <div className="streak-stat-number">{daysWithTx} / {totalDays}</div>
            </div>
          </div>
        </div>

        {/* Total Saldo Card */}
        <div className="box-card total-saldo-card">
          <div>
            <div className="saldo-card-head">
              <div className="saldo-card-label">
                <Wallet width="14" height="14" />
                TOTAL SALDO
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setBudgetEditing((v) => !v)}
                  className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Edit budget"
                >
                  <Edit3 width="13" height="13" />
                </button>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2d7a18" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
              </div>
            </div>

            <div className="saldo-chip-icon">
              <div></div><div></div><div></div><div></div>
            </div>

            {budgetEditing ? (
              <div className="my-2 flex gap-2">
                <input
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  inputMode="numeric"
                  placeholder="Budget bulanan..."
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <button
                  onClick={saveBudget}
                  disabled={budgetBusy}
                  className="flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-1 text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  <Save width="14" height="14" />
                </button>
              </div>
            ) : (
              <div className="saldo-main-amount">
                {loading ? '...' : currency(monthlyBudget ? budgetRemaining : totalMonth)}
              </div>
            )}

            <div className="saldo-card-number">•••• •••• •••• 0080</div>
          </div>

          <div>
            <div className="saldo-card-bottom">
              <span className="saldo-wallet-name">
                {monthlyBudget ? `${budgetUsed.toFixed(1)}% budget terpakai` : 'Semua dompet'}
              </span>
              <span className="saldo-wallet-sub">{saldoPerDompet.length || 3} dompet aktif</span>
            </div>
            <div className="saldo-pagination-dots">
              <div className="saldo-dot active"></div>
              <div className="saldo-dot"></div>
              <div className="saldo-dot"></div>
              <div className="saldo-dot"></div>
            </div>
          </div>
        </div>

      </div>

      {/* ════ 3. 4 METRIC CARDS ROW ════ */}
      <div className="metrics-four-grid">
        
        {/* 1. PEMASUKAN */}
        <div className="metric-mini-card">
          <div className="metric-mini-icon-row">
            <div className="metric-mini-icon-badge">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#245c10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
          </div>
          <div className="metric-mini-title">PEMASUKAN</div>
          <div className="metric-mini-value">{loading ? '...' : currency(totalIncome)}</div>
          <div className="metric-sparkline-box">
            <svg viewBox="0 0 100 24" width="100%" height="24" preserveAspectRatio="none">
              <line x1="0" y1="18" x2="100" y2="18" stroke="#4a8c2c" strokeWidth="1.6" strokeDasharray="3 2" />
            </svg>
          </div>
          <div className="metric-mini-sub">Dari tambah saldo dompet</div>
        </div>

        {/* 2. PENGELUARAN */}
        <div className="metric-mini-card">
          <div className="metric-mini-icon-row">
            <div className="metric-mini-icon-badge">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#245c10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
            </div>
          </div>
          <div className="metric-mini-title">PENGELUARAN</div>
          <div className="metric-mini-value">{loading ? '...' : currency(totalMonth)}</div>
          <div className="metric-sparkline-box">
            <svg viewBox="0 0 100 24" width="100%" height="24" preserveAspectRatio="none">
              <defs>
                <linearGradient id="expSparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4a8c2c" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#4a8c2c" stopOpacity="0.05" />
                </linearGradient>
              </defs>
              <polygon points={`${expPoints} 100,24 0,24`} fill="url(#expSparkGrad)" />
              <polyline points={expPoints} fill="none" stroke="#4a8c2c" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          </div>
          <div className="metric-mini-sub">Semua catatan periode ini</div>
        </div>

        {/* 3. TRANSAKSI */}
        <div className="metric-mini-card">
          <div className="metric-mini-icon-row">
            <div className="metric-mini-icon-badge">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#245c10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/></svg>
            </div>
          </div>
          <div className="metric-mini-title">TRANSAKSI</div>
          <div className="metric-mini-value">{loading ? '...' : activePeriodExpenses.length}</div>
          <div className="metric-sparkline-box">
            <svg viewBox="0 0 100 24" width="100%" height="24" preserveAspectRatio="none">
              {txBarData.slice(0, 15).map((v, i, arr) => {
                const bw = Math.max(2.5, 90 / Math.max(arr.length, 1) - 1.5);
                const x = arr.length < 2 ? (i * 20) : (i / (arr.length - 1)) * (95 - bw);
                const bh = v > 0 ? Math.max(4, (v / maxBar) * 18) : 2;
                return <rect key={i} x={x} y={22 - bh} width={bw} height={bh} rx="1" fill={i === arr.length - 1 ? '#22c55e' : '#4a8c2c'} opacity={v > 0 ? 0.9 : 0.25} />;
              })}
            </svg>
          </div>
          <div className="metric-mini-sub">
            {saldoPerDompet.length || 3} dompet • {categories.length || 1} kategori
          </div>
        </div>

        {/* 4. TABUNGAN */}
        <div className="metric-mini-card">
          <div className="metric-mini-icon-row">
            <div className="metric-mini-icon-badge">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#245c10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z"/><path d="M16 12a2 2 0 1 1-4 0 2 2 0 014 0z"/></svg>
            </div>
          </div>
          <div className="metric-mini-title">TABUNGAN</div>
          <div className="metric-mini-value">Rp 0</div>
          <div className="metric-sparkline-box">
            <svg viewBox="0 0 100 24" width="100%" height="24" preserveAspectRatio="none">
              <line x1="0" y1="18" x2="100" y2="18" stroke="#4a8c2c" strokeWidth="1.6" strokeDasharray="3 2" />
            </svg>
          </div>
          <div className="metric-mini-sub">Kategori Tabungan</div>
        </div>

      </div>

      {/* ════ 4. MIDDLE CHARTS GRID ════ */}
      <div className="middle-charts-grid">
        
        {/* Expense Trend */}
        <div className="box-card">
          <div className="card-header-flex">
            <span className="card-title-main">Expense Trend</span>
            <select className="card-select-pill" value={trendRange} onChange={(e) => setTrendRange(e.target.value)}>
              <option value="daily">Harian</option>
              <option value="weekly">Mingguan</option>
              <option value="monthly">Bulanan</option>
            </select>
          </div>
          <div style={{ height: '160px', position: 'relative' }}>
            {trend.some((d) => d.amount > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="trendAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2d7a18" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#2d7a18" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#dcebd0" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="label" stroke="#8ca37d" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#8ca37d" fontSize={10} tickLine={false} axisLine={false} tickFormatter={shortCurrency} />
                  <Tooltip
                    contentStyle={{ background: '#f3f8ee', border: '1px solid #dcebd0', borderRadius: 8, color: '#112409', fontSize: 11 }}
                    formatter={(v) => [currency(v), 'Pengeluaran']}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#2d7a18" strokeWidth={2.5} fill="url(#trendAreaGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-[#dcebd0] text-center">
                <BarChart3 className="h-7 w-7 text-[#8ca37d]" />
                <p className="mt-2 text-xs text-[#567245]">Trend muncul setelah transaksi tersimpan.</p>
              </div>
            )}
          </div>
        </div>

        {/* Top Expense Categories */}
        <div className="box-card">
          <div className="card-header-flex">
            <span className="card-title-main">Top Expense Categories</span>
            <select className="card-select-pill" value={categoryRange} onChange={(e) => setCategoryRange(e.target.value)}>
              <option value="month">This Month</option>
              <option value="week">This Week</option>
              <option value="day">This Day</option>
            </select>
          </div>

          <div className="donut-chart-flex-wrap">
            {categories.length ? (
              <>
                <div className="donut-canvas-relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categories} innerRadius={48} outerRadius={68} paddingAngle={2} dataKey="amount" stroke="none">
                        {categories.map((c) => <Cell key={c.name} fill={c.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="donut-center-label-box">
                    <span className="donut-center-total-val">{shortCurrency(categories.reduce((s, c) => s + c.amount, 0))}</span>
                    <span className="donut-center-total-lbl">Total</span>
                  </div>
                </div>

                <div className="donut-legend-list">
                  {categories.map((c) => (
                    <div key={c.name} className="donut-legend-row">
                      <div className="donut-legend-left">
                        <span className="legend-dot-indicator" style={{ backgroundColor: c.color }} />
                        <span className="truncate max-w-[90px]">{c.name}</span>
                      </div>
                      <div className="donut-legend-right">
                        <span className="legend-amount-val">{currency(c.amount)}</span>
                        <span className="legend-pct-val">{c.percent}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#dcebd0] text-center">
                <PieChartIcon className="h-7 w-7 text-[#8ca37d]" />
                <p className="mt-2 text-xs text-[#567245]">Kategori muncul sesuai filter periode.</p>
              </div>
            )}
          </div>
        </div>

        {/* Saldo per Dompet */}
        <div className="box-card">
          <div className="card-header-flex">
            <span className="card-title-main">Saldo per Dompet</span>
            <div className="streak-icon-wrap" style={{ width: '24px', height: '24px', fontSize: '11px' }}>
              <CreditCard width="13" height="13" color="#245c10" />
            </div>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-light)', marginBottom: '6px' }}>Dompet</div>

          <div className="dompet-progress-list">
            {saldoPerDompet.length ? (
              saldoPerDompet.map((d) => (
                <div key={d.name} className="dompet-bar-item">
                  <div className="dompet-bar-header">
                    <span>{d.name}</span>
                    <span>{currency(d.amount)}</span>
                  </div>
                  <div className="dompet-track-bg">
                    <div className="dompet-track-fill" style={{ width: `${d.percent}%`, backgroundColor: d.color }} />
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Wallet className="h-6 w-6 text-[#8ca37d]" />
                <p className="mt-2 text-xs text-[#567245]">Dompet muncul setelah transaksi ada.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ════ 5. BOTTOM ROW ════ */}
      <div className="bottom-dashboard-grid">
        
        {/* Recent Transactions */}
        <div className="box-card">
          <div className="card-header-flex">
            <span className="card-title-main">Recent Transactions</span>
            <button className="card-select-pill" onClick={() => navigate('/expenses')}>
              View all transactions
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="recent-tx-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((item) => {
                  const date = getExpenseDate(item);
                  return (
                    <tr key={item.id}>
                      <td className="tx-date-cell">{formatDateTime(date)}</td>
                      <td>
                        <div className="tx-desc-cell-title">{item.merchant || item.description || 'Transaksi WhatsApp'}</div>
                        <div className="tx-desc-cell-sub">{item.payment_channel || item.rekening || 'Cash'}</div>
                      </td>
                      <td>
                        <span className="pill-tag-category">{item.category || 'Lainnya'}</span>
                      </td>
                      <td className="tx-amt-green">{currency(item.amount)}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{item.source || 'WhatsApp'}</td>
                    </tr>
                  );
                })}
                {!loading && !recentTransactions.length && (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-xs text-slate-500">
                      Belum ada transaksi. Kirim dari WhatsApp atau catat manual.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Motivational Quote Banner */}
        <div className="box-card quote-motivational-card">
          <div className="quote-left-block">
            <div className="quote-icon-leaf">🌱</div>
            <p className="quote-text-p">
              Catatan kecil hari ini,<br />
              membawa perubahan besar<br />
              di masa depan.
            </p>
          </div>
        </div>

      </div>

      {/* Recap Modal */}
      {showRecapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <form onSubmit={submitNewRecap} className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-[#0b141c]">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                <Archive className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">New Recap / Tutup Periode</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Sistem akan backup tab Google Sheet lama, arsipkan data aktif di webapp, lalu mulai periode baru dari kosong.
                </p>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Nama periode baru</span>
                <input
                  required
                  value={recapForm.name}
                  onChange={(e) => setRecapForm((c) => ({ ...c, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  placeholder="Contoh: Gaji Agustus 2026"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Tanggal mulai periode baru</span>
                <input
                  required
                  type="date"
                  value={recapForm.start_date}
                  onChange={(e) => setRecapForm((c) => ({ ...c, start_date: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </label>
              <div className="rounded-xl border border-amber-400/20 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-700 dark:bg-amber-500/10 dark:text-amber-100/80">
                Data tidak dihapus. Tab Sheet lama dicopy ke arsip, tab aktif dikosongkan, data webapp lama diberi label arsip.
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowRecapModal(false)}
                disabled={recapBusy}
                className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-400 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={recapBusy}
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {recapBusy ? 'Memproses backup...' : 'Backup & Mulai Baru'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
