import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Brain,
  Info,
  LockKeyhole,
  PieChart as PieIcon,
  ShieldCheck,
  Sparkles,
  TrendingUp,
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
import Header from '../components/Header';
import { useAuth } from '../context/useAuth';
import { listExpenses } from '../lib/firestore';
import { getBackendSettings } from '../lib/whatsapp-api';

const COLORS = ['#22c55e', '#3b82f6', '#8b5cf6', '#eab308', '#ec4899', '#f97316'];
const TREND_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'last30', label: 'Last 30 Days' },
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
    <div className="rounded-xl border border-slate-700 bg-[#07111a] px-3 py-2 text-xs shadow-2xl">
      <p className="font-semibold text-slate-200">{label}</p>
      <p className="mt-1 text-emerald-300">{currency(payload[0].value)}</p>
    </div>
  );
}

function EmptyAnalytics({ text }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-800 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail, delta, neutral = false }) {
  const isDown = delta < 0;
  const DeltaIcon = isDown ? ArrowDown : ArrowUp;
  return (
    <section className="rounded-xl border border-slate-800 bg-[linear-gradient(135deg,rgba(15,23,42,.96),rgba(2,17,26,.96))] px-4 py-4 shadow-[0_14px_38px_rgba(0,0,0,.13)]">
      <div className="flex items-center gap-3">
        <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-xl bg-emerald-500/13 text-emerald-400 shadow-inner shadow-emerald-500/10">
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] text-slate-400">{label}</p>
          <p className="mt-0.5 truncate text-[22px] font-black leading-tight tracking-tight text-white">{value}</p>
          {neutral ? (
            <p className="mt-1.5 text-[13px] text-slate-400">{detail}</p>
          ) : (
            <p className={`mt-1.5 inline-flex items-center gap-1 text-[13px] ${isDown ? 'text-red-300' : 'text-emerald-300'}`}>
              <DeltaIcon className="h-3.5 w-3.5" />
              <span className="font-bold">{Math.abs(delta || 0).toFixed(1)}%</span>
              <span className="text-slate-400">{detail}</span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function InsightItem({ icon: Icon, children }) {
  return (
    <div className="flex gap-4">
      <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/13 text-emerald-400">
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-sm leading-6 text-slate-300">{children}</p>
    </div>
  );
}

function SelectPill({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-lg border border-slate-800 bg-[#09131c] px-3 py-1.5 text-xs font-semibold text-slate-300 outline-none transition hover:border-slate-700 focus:border-emerald-500"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

export default function Analytics() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [trendRange, setTrendRange] = useState('last30');
  const [categoryRange, setCategoryRange] = useState('month');
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState('');
  const [activeRecapStartDate, setActiveRecapStartDate] = useState('');

  useEffect(() => {
    setBusy(true);
    Promise.all([listExpenses(user.uid), getBackendSettings()])
      .then(([items, settings]) => {
        setExpenses(items.filter((item) => item.type !== 'income'));
        setActiveRecapStartDate(settings.active_recap_start_date || '');
      })
      .catch((error) => setNotice(error.message || 'Analytics belum dapat membaca Firestore.'))
      .finally(() => setBusy(false));
  }, [user.uid]);

  const analytics = useMemo(() => {
    const now = new Date();
    const activePeriodStart = dateFromInput(activeRecapStartDate) || startOfMonth(now);
    const currentMonthExpenses = expenses.filter((item) => {
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
    categoryExpenses.forEach((item) => {
      const key = getCategory(item);
      categoryMap[key] = (categoryMap[key] || 0) + Number(item.amount || 0);
    });
    const categories = Object.entries(categoryMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], index) => ({
        name,
        value,
        color: COLORS[index % COLORS.length],
        percent: categoryTotal ? (value / categoryTotal) * 100 : 0,
      }));

    const sourceMap = {};
    currentMonthExpenses.forEach((item) => {
      const key = getAccount(item);
      sourceMap[key] = (sourceMap[key] || 0) + Number(item.amount || 0);
    });
    const sources = Object.entries(sourceMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], index) => ({
        name,
        value,
        color: COLORS[index % COLORS.length],
        percent: currentTotal ? (value / currentTotal) * 100 : 0,
      }));

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
  }, [expenses, trendRange, categoryRange, activeRecapStartDate]);

  return (
    <div className="mx-auto w-full max-w-[1450px] space-y-5">
      <Header
        title="Analytics"
        subtitle="Lacak tren pengeluaran, temukan insight, dan optimalkan pengelolaan keuangan Anda."
      />

      {notice && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {notice}
        </div>
      )}

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

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-xl border border-slate-800 bg-[#0b141c] p-5 shadow-[0_18px_50px_rgba(0,0,0,.16)]">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-bold text-white">
              Spending Trend <Info className="h-4 w-4 text-slate-500" />
            </h2>
            <SelectPill value={trendRange} onChange={setTrendRange} options={TREND_OPTIONS} />
          </div>
          {analytics.trend.some((item) => item.amount > 0) ? (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="analyticsTrend" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.48} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={18} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={shortCurrency} tickLine={false} axisLine={false} width={64} />
                  <Tooltip content={<AnalyticsTooltip />} />
                  <Area type="monotone" dataKey="amount" stroke="#22c55e" strokeWidth={3} fill="url(#analyticsTrend)" dot={{ r: 3, fill: '#22c55e' }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyAnalytics text="Grafik tren akan muncul setelah ada transaksi pada periode terpilih." />
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0b141c] p-5 shadow-[0_18px_50px_rgba(0,0,0,.16)]">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-bold text-white">
              Spend by Category <Info className="h-4 w-4 text-slate-500" />
            </h2>
            <SelectPill value={categoryRange} onChange={setCategoryRange} options={CATEGORY_OPTIONS} />
          </div>
          {analytics.categories.length ? (
            <div className="space-y-4">
              {analytics.categories.slice(0, 6).map((item) => (
                <div key={item.name} className="grid grid-cols-[110px_1fr_92px_54px] items-center gap-3 text-sm">
                  <span className="truncate text-slate-300">{item.name}</span>
                  <span className="h-3 overflow-hidden rounded-full bg-slate-800">
                    <span className="block h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300" style={{ width: `${Math.max(4, item.percent)}%` }} />
                  </span>
                  <span className="text-right text-slate-300">{currency(item.value)}</span>
                  <span className="text-right text-slate-500">{item.percent.toFixed(1)}%</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-slate-800 pt-4 text-sm">
                <span className="text-slate-300">Total</span>
                <strong className="text-white">{currency(analytics.categoryTotal)}</strong>
              </div>
            </div>
          ) : (
            <EmptyAnalytics text="Kategori akan muncul setelah transaksi pada periode terpilih tersedia." />
          )}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_0.85fr]">
        <div className="rounded-xl border border-violet-500/20 bg-[linear-gradient(135deg,rgba(46,16,101,.45),rgba(11,20,28,.96)_45%)] p-5 shadow-[0_18px_50px_rgba(0,0,0,.16)]">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-bold text-white">
              <Sparkles className="h-5 w-5 text-violet-300" /> AI Insights
            </h2>
            <span className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-bold text-violet-200">Data-driven</span>
          </div>
          <div className="space-y-5">
            <InsightItem icon={TrendingUp}>{analytics.insights[0]}</InsightItem>
            <InsightItem icon={BarChart3}>{analytics.insights[1]}</InsightItem>
            <InsightItem icon={Brain}>{analytics.insights[2]}</InsightItem>
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-4 text-xs text-slate-500">
            <span>Insight dibuat dari data transaksi tersimpan dan bisa berubah saat data bertambah.</span>
            <span className="font-semibold text-emerald-400">AI-ready</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0b141c] p-5 shadow-[0_18px_50px_rgba(0,0,0,.16)]">
          <h2 className="mb-5 flex items-center gap-2 font-bold text-white">
            Pengeluaran per Rekening <Info className="h-4 w-4 text-slate-500" />
          </h2>
          {analytics.sources.length ? (
            <div className="grid items-center gap-5 md:grid-cols-[220px_1fr]">
              <div className="relative h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={analytics.sources} dataKey="value" nameKey="name" innerRadius={64} outerRadius={96} paddingAngle={2} stroke="none">
                      {analytics.sources.map((item) => <Cell key={item.name} fill={item.color} />)}
                    </Pie>
                    <Tooltip formatter={(value) => currency(value)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xs text-slate-400">Total</span>
                  <strong className="text-sm text-white">{shortCurrency(analytics.currentTotal)}</strong>
                </div>
              </div>
              <div className="space-y-4">
                {analytics.sources.map((item) => (
                  <div key={item.name} className="flex items-center gap-3 text-sm">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="flex-1 text-slate-300">{item.name}</span>
                    <span className="text-slate-400">{currency(item.value)}</span>
                    <span className="w-12 text-right text-slate-500">{item.percent.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyAnalytics text="Rekening/metode pembayaran akan muncul setelah ada transaksi." />
          )}
          <p className="mt-4 text-xs text-slate-500">Data berdasarkan rekening/metode pembayaran transaksi pada periode aktif.</p>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-emerald-500/15 bg-[#0b141c] px-5 py-4 text-sm text-slate-300 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <p>
            Data Anda bersifat privat dan aman. WA Finance hanya menyimpan data finansial yang berhasil diekstrak untuk membantu Anda memantau pengeluaran; akses tetap dibatasi oleh autentikasi Firebase dan izin akun.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-bold text-emerald-400">
          <LockKeyhole className="h-4 w-4" /> Firebase Security
        </span>
      </section>

    </div>
  );
}
