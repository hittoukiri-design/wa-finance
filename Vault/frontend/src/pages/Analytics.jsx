import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Brain,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Flame,
  History,
  Info,
  LockKeyhole,
  PieChart as PieIcon,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
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
import Header from '../components/Header';
import { useAuth } from '../context/useAuth';
import { useFilter } from '../context/FilterContext';
import { listExpenses } from '../lib/firestore';
import { getBackendSettings, listRecaps } from '../lib/whatsapp-api';

const VIBRANT_CHART_COLORS = [
  '#2f781c', // Forest Green
  '#6952ec', // Indigo / Purple
  '#f77132', // Coral / Orange
  '#f59e0b', // Amber / Gold
  '#16b896', // Emerald / Teal
  '#389ef2', // Sky Blue
  '#e11d48', // Crimson Rose
  '#8b5cf6', // Violet
];

const ACCOUNT_COLORS = {
  BCA: '#2f781c',
  CASH: '#f77132',
  SUPERBANK: '#6952ec',
  GOPAY: '#00aed6',
  QRIS: '#ea1d2c',
  DANA: '#118eea',
  SHOPEEPAY: '#ee4d2d',
  TRANSFER: '#f59e0b',
};

const TREND_OPTIONS = [
  { value: 'daily', label: 'Harian' },
  { value: 'weekly', label: 'Mingguan' },
  { value: 'last30', label: '30 Hari Terakhir' },
];

const CATEGORY_OPTIONS = [
  { value: 'day', label: 'Hari ini' },
  { value: 'week', label: 'Minggu ini' },
  { value: 'month', label: 'Periode aktif' },
];

const categoryPeriodLabel = (value) => CATEGORY_OPTIONS.find((item) => item.value === value)?.label.toLowerCase() || 'periode terpilih';

const currency = (amount) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(Number(amount || 0));

const shortCurrency = (amount) => {
  const value = Number(amount || 0);
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)} jt`;
  if (value >= 1_000) return `Rp ${(value / 1_000).toFixed(0)} rb`;
  return currency(value);
};

function getDate(item) {
  const value = item.createdAt || item.timestamp || item.date;
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date = new Date()) {
  const current = startOfDay(date);
  const day = (current.getDay() + 6) % 7;
  current.setDate(current.getDate() - day);
  return current;
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function dateFromInput(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function laterDate(first, second) {
  return first > second ? first : second;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function formatDay(date) {
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' }).format(date);
}

function formatWeek(date) {
  const start = startOfWeek(date);
  const end = addDays(start, 6);
  return `${formatDay(start)} - ${formatDay(end)}`;
}

function isInRange(date, start, end) {
  if (!date || !start || !end) return false;
  return date >= start && date <= end;
}

function getPeriodRange(period, now = new Date(), activeStart = startOfMonth(now)) {
  if (period === 'day') {
    return { start: laterDate(startOfDay(now), activeStart), end: new Date(now) };
  }
  if (period === 'week') {
    return { start: laterDate(startOfWeek(now), activeStart), end: new Date(now) };
  }
  return { start: activeStart, end: new Date(now) };
}

function getCategory(item) {
  return item.category || item.cat || 'Lainnya';
}

function getAccount(item) {
  return String(item.payment_channel || item.rekening || 'Cash').trim() || 'Cash';
}

function AnalyticsTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[#d6e4be] bg-[#eaf2da] px-3.5 py-2 text-xs shadow-xl dark:border-[#263e1d] dark:bg-[#112013]">
      <p className="font-bold text-[#0e2a07] dark:text-[#f3ffe9]">{label}</p>
      <p className="mt-0.5 font-extrabold text-[#1a5611] dark:text-[#76d446]">{currency(payload[0].value)}</p>
    </div>
  );
}

function EmptyAnalytics({ text }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-[#d6e4be] text-center text-xs font-semibold text-slate-500 dark:border-[#263e1d] dark:text-slate-400">
      {text}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail, delta, neutral = false }) {
  const isDown = delta < 0;
  const DeltaIcon = isDown ? ArrowDown : ArrowUp;
  return (
    <section className="rounded-[22px] border border-[#d6e4be] bg-[#eaf2da] p-5 shadow-sm transition hover:border-[#b8dc9f] dark:border-[#243e1c] dark:bg-[#121e14] dark:hover:border-[#38642a]">
      <div className="flex items-center gap-3.5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#c3ef92] text-[#1a5611] shadow-sm dark:bg-[#1b3816] dark:text-[#76d446]">
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#358219] dark:text-[#76d446]">{label}</p>
          <p className="mt-0.5 truncate text-xl font-black text-[#0e2a07] dark:text-[#f3ffe9]">{value}</p>
          {neutral ? (
            <p className="mt-1 text-[11px] font-semibold text-[#436d32] dark:text-[#8bb37a]">{detail}</p>
          ) : (
            <p className={`mt-1 inline-flex items-center gap-1 text-[11px] font-bold ${isDown ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              <DeltaIcon className="h-3 w-3" />
              <span>{Math.abs(delta || 0).toFixed(1)}%</span>
              <span className="text-slate-500 dark:text-slate-400">{detail}</span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function InsightItem({ icon: Icon, children }) {
  return (
    <div className="flex gap-3.5">
      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#c3ef92] text-[#1a5611] dark:bg-[#1b3816] dark:text-[#76d446]">
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-xs font-medium leading-relaxed text-[#1e3c15] dark:text-[#cde8bd]">{children}</p>
    </div>
  );
}

function SelectPill({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-full border border-[#d6e4be] bg-white px-3.5 py-1.5 text-xs font-bold text-[#0e2a07] outline-none shadow-sm transition dark:border-[#263e1d] dark:bg-[#162718] dark:text-[#f3ffe9]"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

function isTransferTransaction(item) {
  if (!item) return false;
  const cat = String(item.category || item.cat || '').toLowerCase();
  const merch = String(item.merchant || item.description || '').toLowerCase();
  return cat.includes('transfer') || 
         merch.includes('pindah saldo') || 
         merch.includes('transfer ke') || 
         merch.includes('terima transfer') || 
         merch.includes('tarik / transfer');
}

export default function Analytics() {
  const { user } = useAuth();
  const [allTransactions, setAllTransactions] = useState([]);
  const [recapsList, setRecapsList] = useState([]);
  const [selectedPeriodModal, setSelectedPeriodModal] = useState(null);
  const [trendRange, setTrendRange] = useState('last30');
  const [categoryRange, setCategoryRange] = useState('month');
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState('');
  const [activeRecapStartDate, setActiveRecapStartDate] = useState('');

  useEffect(() => {
    setBusy(true);
    Promise.all([
      listExpenses(user.uid, { recapId: 'all' }),
      listRecaps().catch(() => ({ recaps: [] })),
      getBackendSettings().catch(() => ({}))
    ])
      .then(([items, recapRes, settings]) => {
        setAllTransactions(items || []);
        setRecapsList(recapRes?.recaps || []);
        setActiveRecapStartDate(settings?.active_recap_start_date || '');
      })
      .catch((error) => setNotice(error.message || 'Analytics belum dapat membaca data.'))
      .finally(() => setBusy(false));
  }, [user.uid]);

  const analytics = useMemo(() => {
    const now = new Date();
    const activePeriodStart = dateFromInput(activeRecapStartDate) || startOfMonth(now);
    const currentMonthExpenses = allTransactions.filter((item) => {
      if (item.type === 'income' || isTransferTransaction(item)) return false;
      if (item.recap_status === 'archived') return false;
      const date = getDate(item);
      return date && date >= activePeriodStart && date <= now;
    });

    const currentTotal = currentMonthExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const elapsedDays = Math.max(1, Math.floor((startOfDay(now) - activePeriodStart) / 86_400_000) + 1);
    const dailyAverage = currentTotal / elapsedDays;

    const categoryPeriod = getPeriodRange(categoryRange, now, activePeriodStart);
    const categoryExpenses = currentMonthExpenses.filter((item) => {
      const date = getDate(item);
      return isInRange(date, categoryPeriod.start, categoryPeriod.end);
    });
    const categoryTotal = categoryExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const categoryMap = {};
    const catDisplayName = {};
    categoryExpenses.forEach((item) => {
      if (isTransferTransaction(item)) return;
      const raw = getCategory(item);
      const k = raw.toLowerCase();
      if (!catDisplayName[k]) catDisplayName[k] = raw;
      categoryMap[k] = (categoryMap[k] || 0) + Number(item.amount || 0);
    });
    const categories = Object.entries(categoryMap)
      .sort((a, b) => b[1] - a[1])
      .map(([k, value], index) => ({
        name: catDisplayName[k] || k,
        value,
        color: VIBRANT_CHART_COLORS[index % VIBRANT_CHART_COLORS.length],
        percent: categoryTotal ? (value / categoryTotal) * 100 : 0,
      }));

    const sourceMap = {};
    const srcDisplayName = {};
    currentMonthExpenses.forEach((item) => {
      if (isTransferTransaction(item)) return;
      const raw = getAccount(item);
      const k = raw.toLowerCase();
      if (!srcDisplayName[k]) srcDisplayName[k] = raw;
      sourceMap[k] = (sourceMap[k] || 0) + Number(item.amount || 0);
    });
    const sources = Object.entries(sourceMap)
      .sort((a, b) => b[1] - a[1])
      .map(([k, value], index) => {
        const displayName = srcDisplayName[k] || k;
        const normalized = displayName.toUpperCase();
        const color = ACCOUNT_COLORS[normalized] || VIBRANT_CHART_COLORS[index % VIBRANT_CHART_COLORS.length];
        return {
          name: displayName,
          value,
          color,
          percent: currentTotal ? (value / currentTotal) * 100 : 0,
        };
      });

    const trend = trendRange === 'weekly'
      ? Array.from({ length: 8 }, (_, index) => {
        const weekStart = addDays(startOfWeek(now), (index - 7) * 7);
        const weekEnd = addDays(weekStart, 6);
        const value = currentMonthExpenses.reduce((sum, item) => {
          const itemDate = getDate(item);
          if (!isInRange(itemDate, weekStart, new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate(), 23, 59, 59, 999))) return sum;
          return sum + Number(item.amount || 0);
        }, 0);
        return { label: formatWeek(weekStart), amount: value };
      })
      : Array.from({ length: trendRange === 'daily' ? 7 : 30 }, (_, index) => {
        const days = trendRange === 'daily' ? 6 : 29;
        const date = addDays(now, index - days);
        const key = dayKey(date);
        const value = currentMonthExpenses.reduce((sum, item) => {
          const itemDate = getDate(item);
          if (!itemDate || dayKey(itemDate) !== key) return sum;
          return sum + Number(item.amount || 0);
        }, 0);
        return { label: formatDay(date), amount: value };
      });

    const topCategory = categories[0];
    const insights = currentMonthExpenses.length
      ? [
        `Pengeluaran periode aktif sejak ${formatDay(activePeriodStart)} adalah ${currency(currentTotal)}. Transaksi sebelum tanggal tersebut tidak ikut dihitung.`,
        topCategory
          ? `${topCategory.name} menjadi kategori terbesar untuk ${categoryPeriodLabel(categoryRange)}, mengambil ${topCategory.percent.toFixed(1)}% dari total pengeluaran periode tersebut.`
          : 'Kategori terbesar belum tersedia karena data masih kosong.',
        `Rata-rata pengeluaran harian saat ini adalah ${currency(dailyAverage)} selama ${elapsedDays} hari pada periode aktif.`,
      ]
      : [
        `Belum ada transaksi pada periode aktif sejak ${formatDay(activePeriodStart)}. Insight akan muncul otomatis setelah WhatsApp atau input manual mencatat transaksi.`,
        'Hubungkan WhatsApp dan kirim transaksi seperti “beli kopi 50000 pakai BCA” untuk mulai membangun grafik.',
        'Semua ringkasan di halaman ini dihitung dari data Firestore milik akun Anda.',
      ];

    return {
      currentMonthExpenses,
      currentTotal,
      dailyAverage,
      activePeriodStart,
      elapsedDays,
      categoryTotal,
      categories,
      sources,
      trend,
      topCategory,
      insights,
    };
  }, [allTransactions, trendRange, categoryRange, activeRecapStartDate]);

  const periodHistory = useMemo(() => {
    const list = [];

    // 1. Periode Aktif (Berjalan) -> SELALU DI PALING ATAS!
    const activeStart = dateFromInput(activeRecapStartDate) || startOfMonth(new Date());
    const activeTxs = allTransactions.filter((item) => {
      const isArchived = item.recap_status === 'archived';
      const d = getDate(item);
      return !isArchived && d && d >= activeStart;
    });

    const activeNonTransferExpenses = activeTxs.filter((e) => e.type !== 'income' && !isTransferTransaction(e));
    const activeNonTransferIncomes = activeTxs.filter((e) => e.type === 'income' && !isTransferTransaction(e));
    const activeTotalExpense = activeNonTransferExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const activeTotalIncome = activeNonTransferIncomes.reduce((s, e) => s + Number(e.amount || 0), 0);

    list.push({
      id: 'active',
      name: 'Periode Aktif (Sedang Berjalan)',
      startDateLabel: formatDay(activeStart),
      endDateLabel: 'Sekarang',
      dateRangeStr: `${formatDay(activeStart)} - Sekarang`,
      totalExpense: activeTotalExpense,
      totalIncome: activeTotalIncome,
      net: activeTotalIncome - activeTotalExpense,
      txCount: activeTxs.length,
      isActive: true,
      transactions: activeTxs,
    });

    // 2. Periode Tutup Buku yang Sudah Lewat -> diurutkan dari terbaru hingga paling lama di PALING BAWAH!
    recapsList.forEach((r) => {
      const rClosed = r.closed_at ? new Date(r.closed_at) : null;
      const baseStart = dateFromInput(r.start_date);

      const rTxs = allTransactions.filter((item) => {
        if (item.recap_id && item.recap_id === r.id) return true;
        if (item.recap_status === 'archived' && baseStart && rClosed) {
          const d = getDate(item);
          return d && d >= baseStart && d <= rClosed;
        }
        return false;
      });

      const txDates = rTxs.map(getDate).filter(Boolean).sort((a, b) => a - b);
      const minTxDate = txDates.length ? txDates[0] : null;
      let rStart = baseStart || minTxDate || (r.created_at ? new Date(r.created_at) : null);

      // If rStart and rClosed fall on the exact same date, try using minTxDate if it differs
      if (rStart && rClosed && formatDay(rStart) === formatDay(rClosed) && minTxDate && formatDay(minTxDate) !== formatDay(rClosed)) {
        rStart = minTxDate;
      }

      const rNonTransferExpenses = rTxs.filter((e) => e.type !== 'income' && !isTransferTransaction(e));
      const rNonTransferIncomes = rTxs.filter((e) => e.type === 'income' && !isTransferTransaction(e));
      
      const rTotalExpense = rNonTransferExpenses.reduce((s, e) => s + Number(e.amount || 0), Number(r.total_expense || 0));
      const rTotalIncome = rNonTransferIncomes.reduce((s, e) => s + Number(e.amount || 0), Number(r.total_income || 0));

      const rangeStr = rStart && rClosed
        ? `${formatDay(rStart)} - ${formatDay(rClosed)}`
        : rStart
        ? formatDay(rStart)
        : (r.name || 'Periode Lalu');

      list.push({
        id: r.id,
        name: r.name || `Arsip ${rStart ? formatDay(rStart) : 'Tutup Buku'}`,
        startDateLabel: rStart ? formatDay(rStart) : '-',
        endDateLabel: rClosed ? formatDay(rClosed) : '-',
        dateRangeStr: rangeStr,
        totalExpense: rTotalExpense,
        totalIncome: rTotalIncome,
        net: rTotalIncome - rTotalExpense,
        txCount: rTxs.length || Number(r.expense_count || 0),
        isActive: false,
        transactions: rTxs,
      });
    });

    // Deteksi lonjakan dibanding rata-rata pengeluaran periode lalu
    const pastExpenses = list.filter((p) => !p.isActive).map((p) => p.totalExpense);
    const avgPast = pastExpenses.length ? pastExpenses.reduce((a, b) => a + b, 0) / pastExpenses.length : 0;

    return list.map((item) => {
      const isSpike = avgPast > 0 && item.totalExpense > avgPast * 1.15;
      const spikePct = avgPast > 0 ? Math.round(((item.totalExpense - avgPast) / avgPast) * 100) : 0;
      return {
        ...item,
        isSpike,
        spikePct,
      };
    });
  }, [allTransactions, recapsList, activeRecapStartDate]);

  return (
    <div className="mx-auto w-full max-w-[1450px] space-y-6">
      <Header
        title="Analytics"
        subtitle="Lacak tren pengeluaran, temukan insight, dan optimalkan pengelolaan keuangan Anda."
      />

      {notice && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          {notice}
        </div>
      )}

      {/* ── Metric Cards Row ── */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Wallet}
          label="Pengeluaran Periode Aktif"
          value={busy ? '...' : currency(analytics.currentTotal)}
          neutral
          detail={`sejak ${formatDay(analytics.activePeriodStart)}`}
        />
        <MetricCard
          icon={TrendingUp}
          label="Rata-rata Harian"
          value={busy ? '...' : currency(analytics.dailyAverage)}
          neutral
          detail={`${analytics.elapsedDays} hari periode aktif`}
        />
        <MetricCard
          icon={BarChart3}
          label="Transaksi Periode Aktif"
          value={busy ? '...' : String(analytics.currentMonthExpenses.length)}
          neutral
          detail="transaksi tersimpan"
        />
        <MetricCard
          icon={PieIcon}
          label="Kategori Teratas"
          value={busy ? '...' : analytics.topCategory?.name || 'Belum ada'}
          neutral
          detail={analytics.topCategory ? `${currency(analytics.topCategory.value)} (${analytics.topCategory.percent.toFixed(1)}%)` : 'Menunggu data'}
        />
      </section>

      {/* ── Main Charts Row ── */}
      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        
        {/* Spending Trend Area Chart */}
        <div className="rounded-[22px] border border-[#d6e4be] bg-[#eaf2da] p-5 shadow-sm dark:border-[#243e1c] dark:bg-[#121e14]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-black text-[#0e2a07] dark:text-[#f3ffe9]">
              Spending Trend <Info className="h-3.5 w-3.5 text-[#358219] dark:text-[#76d446]" />
            </h2>
            <SelectPill value={trendRange} onChange={setTrendRange} options={TREND_OPTIONS} />
          </div>

          {analytics.trend.some((item) => item.amount > 0) ? (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="analyticsTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#76d446" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#76d446" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#dcebd0" strokeDasharray="3 3" vertical={false} opacity={0.5} />
                  <XAxis dataKey="label" tick={{ fill: '#436d32', fontSize: 11, fontWeight: 600 }} tickLine={false} axisLine={false} minTickGap={18} />
                  <YAxis tick={{ fill: '#436d32', fontSize: 11, fontWeight: 600 }} tickFormatter={shortCurrency} tickLine={false} axisLine={false} width={64} />
                  <Tooltip content={<AnalyticsTooltip />} />
                  <Area type="monotone" dataKey="amount" stroke="#4a8c2c" strokeWidth={2.5} fill="url(#analyticsTrend)" dot={{ r: 3, fill: '#76d446' }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyAnalytics text="Grafik tren akan muncul setelah ada transaksi pada periode terpilih." />
          )}
        </div>

        {/* Spend by Category Progress Breakdown */}
        <div className="rounded-[22px] border border-[#d6e4be] bg-[#eaf2da] p-5 shadow-sm dark:border-[#243e1c] dark:bg-[#121e14]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-black text-[#0e2a07] dark:text-[#f3ffe9]">
              Spend by Category <Info className="h-3.5 w-3.5 text-[#358219] dark:text-[#76d446]" />
            </h2>
            <SelectPill value={categoryRange} onChange={setCategoryRange} options={CATEGORY_OPTIONS} />
          </div>

          {analytics.categories.length ? (
            <div className="space-y-3.5">
              {analytics.categories.slice(0, 6).map((item) => (
                <div key={item.name} className="grid grid-cols-[105px_1fr_95px_45px] items-center gap-3 text-xs font-bold">
                  <span className="truncate text-[#0e2a07] dark:text-[#f3ffe9]">{item.name}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-[#c3ef92]/60 dark:bg-[#1c3818]">
                    <span className="block h-full rounded-full" style={{ width: `${Math.max(4, item.percent)}%`, backgroundColor: item.color }} />
                  </span>
                  <span className="text-right text-[#1a5611] dark:text-[#76d446]">{currency(item.value)}</span>
                  <span className="text-right text-slate-500 dark:text-slate-400">{item.percent.toFixed(1)}%</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-[#d6e4be] pt-3 text-xs font-black dark:border-[#243e1c]">
                <span className="text-[#0e2a07] dark:text-[#f3ffe9]">Total Kategori</span>
                <strong className="text-[#1a5611] dark:text-[#76d446]">{currency(analytics.categoryTotal)}</strong>
              </div>
            </div>
          ) : (
            <EmptyAnalytics text="Kategori akan muncul setelah transaksi pada periode terpilih tersedia." />
          )}
        </div>

      </section>

      {/* ── Riwayat Pengeluaran Per Periode (Tutup Buku) ── */}
      <section className="rounded-[22px] border border-[#d6e4be] bg-[#eaf2da] p-5 shadow-sm dark:border-[#243e1c] dark:bg-[#121e14]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-black text-[#0e2a07] dark:text-[#f3ffe9]">
            <History className="h-4 w-4 text-[#358219] dark:text-[#76d446]" /> Riwayat Pengeluaran Per Periode
          </h2>
          <span className="rounded-full bg-[#c3ef92] px-2.5 py-0.5 text-[10px] font-black uppercase text-[#1a5611] dark:bg-[#1a3816] dark:text-[#76d446]">
            {periodHistory.length} Periode
          </span>
        </div>

        <div className="divide-y divide-[#d6e4be] dark:divide-[#1e3319]">
          {periodHistory.map((period) => (
            <button
              key={period.id}
              type="button"
              onClick={() => setSelectedPeriodModal(period)}
              className="group w-full flex items-center justify-between gap-4 py-3 text-left transition first:pt-0 last:pb-0 hover:opacity-80"
            >
              {/* Left */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                    period.isActive
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                      : 'bg-[#d6e4be]/80 text-[#436d32] dark:bg-[#1e3319] dark:text-[#8bb37a]'
                  }`}>
                    {period.isActive ? 'Periode Aktif' : 'Tutup Buku'}
                  </span>
                  {period.isSpike && (
                    <span className="flex items-center gap-0.5 text-[9px] font-extrabold text-amber-600 dark:text-amber-400">
                      <Flame className="h-2.5 w-2.5" /> +{period.spikePct}%
                    </span>
                  )}
                </div>
                <p className="truncate text-sm font-bold text-[#0e2a07] dark:text-[#f3ffe9]">
                  {period.isActive ? 'Periode Aktif (Sedang Berjalan)' : period.name}
                </p>
                <p className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <Calendar className="h-2.5 w-2.5" /> {period.dateRangeStr} · {period.txCount} transaksi
                </p>
              </div>

              {/* Right */}
              <div className="shrink-0 text-right">
                <p className="font-black text-red-600 dark:text-red-400">{currency(period.totalExpense)}</p>
                <p className={`flex items-center justify-end gap-0.5 text-[11px] font-semibold ${period.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                  {period.net >= 0 ? `+${shortCurrency(period.net)}` : shortCurrency(period.net)}
                  <ChevronRight className="h-3.5 w-3.5 opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-90" />
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>



      {/* ── Lower Section: AI Insights & Sources Breakdown ── */}
      <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        
        {/* AI Insights Card */}
        <div className="rounded-[22px] border border-[#d6e4be] bg-[#eaf2da] p-5 shadow-sm dark:border-[#243e1c] dark:bg-[#121e14]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-black text-[#0e2a07] dark:text-[#f3ffe9]">
              <Sparkles className="h-4 w-4 text-[#358219] dark:text-[#76d446]" /> AI Insights
            </h2>
            <span className="rounded-full bg-[#c3ef92] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#1a5611] dark:bg-[#1a3816] dark:text-[#76d446]">
              Data-driven
            </span>
          </div>

          <div className="space-y-4">
            <InsightItem icon={TrendingUp}>{analytics.insights[0]}</InsightItem>
            <InsightItem icon={BarChart3}>{analytics.insights[1]}</InsightItem>
            <InsightItem icon={Brain}>{analytics.insights[2]}</InsightItem>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-[#d6e4be] pt-3 text-[11px] text-[#436d32] dark:border-[#243e1c] dark:text-[#8bb37a]">
            <span>Insight dibuat dari data transaksi tersimpan real-time.</span>
            <span className="font-bold text-[#1a5611] dark:text-[#76d446]">AI-Ready</span>
          </div>
        </div>

        {/* Pengeluaran per Rekening Donut Breakdown */}
        <div className="rounded-[22px] border border-[#d6e4be] bg-[#eaf2da] p-5 shadow-sm dark:border-[#243e1c] dark:bg-[#121e14]">
          <h2 className="mb-4 flex items-center gap-2 font-black text-[#0e2a07] dark:text-[#f3ffe9]">
            Pengeluaran per Rekening <Info className="h-3.5 w-3.5 text-[#358219] dark:text-[#76d446]" />
          </h2>

          {analytics.sources.length ? (
            <div className="grid items-center gap-4 md:grid-cols-[190px_1fr]">
              <div className="relative h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={analytics.sources} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={2} stroke="none">
                      {analytics.sources.map((item) => <Cell key={item.name} fill={item.color} />)}
                    </Pie>
                    <Tooltip formatter={(value) => currency(value)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Total</span>
                  <strong className="text-xs font-black text-[#0e2a07] dark:text-[#f3ffe9]">{shortCurrency(analytics.currentTotal)}</strong>
                </div>
              </div>

              <div className="space-y-2.5">
                {analytics.sources.map((item) => (
                  <div key={item.name} className="flex items-center gap-2.5 text-xs font-bold">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="flex-1 truncate text-[#0e2a07] dark:text-[#f3ffe9]">{item.name}</span>
                    <span className="text-[#1a5611] dark:text-[#76d446]">{currency(item.value)}</span>
                    <span className="w-10 text-right text-slate-500 dark:text-slate-400">{item.percent.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyAnalytics text="Rekening/metode pembayaran akan muncul setelah ada transaksi." />
          )}
          <p className="mt-3 text-[10px] text-[#436d32] dark:text-[#8bb37a]">Data berdasarkan rekening/metode pembayaran transaksi pada periode aktif.</p>
        </div>

      </section>

      {/* ── Security Banner ── */}
      <section className="flex flex-col gap-3 rounded-[22px] border border-[#d6e4be] bg-[#eaf2da] p-4 text-xs text-[#285814] dark:border-[#243e1c] dark:bg-[#121e14] dark:text-[#b8d8a7] md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1a5611] dark:text-[#76d446]" />
          <p>
            Data Anda bersifat privat dan aman. WA Finance hanya menyimpan data finansial yang berhasil diekstrak untuk membantu Anda memantau pengeluaran.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-black text-[#1a5611] dark:text-[#76d446]">
          <LockKeyhole className="h-3.5 w-3.5" /> Firebase Security
        </span>
      </section>

      {/* ── Interactive Detail Popup Modal ── */}
      {selectedPeriodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl rounded-3xl border border-[#d6e4be] bg-[#eaf2da] p-6 shadow-2xl dark:border-[#263e1d] dark:bg-[#0f1a10] sm:p-7">
            
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[#d6e4be] pb-4 dark:border-[#243e1c]">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-extrabold text-[#0e2a07] dark:text-[#f3ffe9]">
                    {selectedPeriodModal.name}
                  </h2>
                  {selectedPeriodModal.isActive ? (
                    <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">
                      Periode Aktif
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase text-slate-600 dark:text-slate-400">
                      Tutup Buku
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-[#358219] dark:text-[#8bb37a]">
                  Rentang Waktu: <strong>{selectedPeriodModal.dateRangeStr}</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPeriodModal(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-400/30 bg-slate-500/10 text-slate-500 transition hover:bg-slate-500/20 hover:text-slate-900 dark:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Metric Highlights */}
            <div className="my-5 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3">
                <span className="block text-[10px] font-black uppercase tracking-wider text-red-600 dark:text-red-400">Pengeluaran Riil</span>
                <p className="mt-1 text-sm font-black text-red-700 dark:text-red-300">{currency(selectedPeriodModal.totalExpense)}</p>
              </div>

              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                <span className="block text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Pemasukan Riil</span>
                <p className="mt-1 text-sm font-black text-emerald-700 dark:text-emerald-300">{currency(selectedPeriodModal.totalIncome)}</p>
              </div>

              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3">
                <span className="block text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">Arus Kas (Sisa)</span>
                <p className={`mt-1 text-sm font-black ${selectedPeriodModal.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {selectedPeriodModal.net >= 0 ? `+${currency(selectedPeriodModal.net)}` : currency(selectedPeriodModal.net)}
                </p>
              </div>
            </div>

            {/* Scrollable Transaction List */}
            <div className="mb-2 flex items-center justify-between text-xs font-bold text-[#0e2a07] dark:text-[#f3ffe9]">
              <span>Rincian Transaksi Periode ({selectedPeriodModal.transactions.length})</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Scroll untuk melihat seluruhnya</span>
            </div>

            <div className="max-h-[320px] space-y-2.5 overflow-y-auto pr-1">
              {selectedPeriodModal.transactions.length > 0 ? (
                selectedPeriodModal.transactions.map((tx, idx) => {
                  const isInc = tx.type === 'income';
                  const isTransfer = isTransferTransaction(tx);
                  const d = getDate(tx);
                  return (
                    <div
                      key={tx.id || idx}
                      className="flex items-center justify-between rounded-xl border border-[#d6e4be] bg-white p-3 text-xs shadow-sm transition dark:border-[#243e1c] dark:bg-[#152417]"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-bold text-[#0e2a07] dark:text-[#f3ffe9]">
                            {tx.merchant || tx.description || 'Transaksi'}
                          </span>
                          <span className="rounded-md bg-[#c3ef92]/60 px-2 py-0.5 text-[9px] font-extrabold uppercase text-[#1a5611] dark:bg-[#1b3816] dark:text-[#76d446]">
                            {tx.category || (isInc ? 'Pemasukan' : 'Lainnya')}
                          </span>
                          {isTransfer && (
                            <span className="rounded-md bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold text-purple-600 dark:text-purple-300">
                              Transfer
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                          {d ? formatDay(d) : '-'} • {getAccount(tx)}
                        </p>
                      </div>

                      <div className="text-right whitespace-nowrap">
                        <span className={`font-black ${isInc ? 'text-emerald-600 dark:text-emerald-400' : isTransfer ? 'text-purple-600 dark:text-purple-400' : 'text-red-600 dark:text-red-400'}`}>
                          {isInc ? '+' : '-'}{currency(tx.amount)}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-[#d6e4be] p-6 text-center text-xs text-slate-500 dark:border-[#243e1c] dark:text-slate-400">
                  Tidak ada transaksi tersimpan untuk periode ini.
                </div>
              )}
            </div>

            <div className="mt-5 border-t border-[#d6e4be] pt-3 text-right dark:border-[#243e1c]">
              <button
                type="button"
                onClick={() => setSelectedPeriodModal(null)}
                className="rounded-xl bg-[#c3ef92] px-5 py-2 text-xs font-bold text-[#1a5611] transition hover:brightness-105 dark:bg-[#1b3816] dark:text-[#76d446]"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
