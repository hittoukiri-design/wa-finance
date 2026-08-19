import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeftRight,
  Banknote,
  Bot,
  BusFront,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  EyeOff,
  FileSpreadsheet,
  FileText,
  HeartPulse,
  House,
  Menu,
  MessageSquare,
  Moon,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBasket,
  SlidersHorizontal,
  Smartphone,
  Sun,
  Tags,
  Trash2,
  Trophy,
  Utensils,
  Wallet,
  X,
  UsersRound,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '../context/useTheme';
import waFinanceLogo from '../assets/wa-finance-logo.png';

const initialTransactions = [
  { id: 1, date: '2026-08-01', merchant: 'Token listrik', category: 'Tagihan', wallet: 'BCA', amount: 350000 },
  { id: 2, date: '2026-08-02', merchant: 'Belanja bulanan', category: 'Belanja', wallet: 'BCA', amount: 612000 },
  { id: 3, date: '2026-08-03', merchant: 'Bakso keluarga', category: 'Makan', wallet: 'Cash', amount: 118000 },
  { id: 4, date: '2026-08-04', merchant: 'Grab sekolah', category: 'Transport', wallet: 'Gopay', amount: 72000 },
  { id: 5, date: '2026-08-05', merchant: 'Sampah komplek', category: 'Rumah', wallet: 'BCA', amount: 50000 },
  { id: 6, date: '2026-08-07', merchant: 'Internet rumah', category: 'Tagihan', wallet: 'BCA', amount: 445000 },
  { id: 7, date: '2026-08-08', merchant: 'Apotek', category: 'Kesehatan', wallet: 'Cash', amount: 188000 },
  { id: 8, date: '2026-08-10', merchant: 'Pisang goreng', category: 'Makan', wallet: 'Cash', amount: 10000 },
  { id: 9, date: '2026-08-11', merchant: 'Beras dan sayur', category: 'Belanja', wallet: 'BCA', amount: 430000 },
  { id: 10, date: '2026-08-12', merchant: 'Bensin', category: 'Transport', wallet: 'Cash', amount: 150000 },
  { id: 11, date: '2026-08-13', merchant: 'Paket data', category: 'Tagihan', wallet: 'Superbank', amount: 83000 },
  { id: 12, date: '2026-08-16', merchant: 'Bayar sampah BCA', category: 'Rumah', wallet: 'BCA', amount: 50000 },
  { id: 13, date: '2026-08-16', merchant: 'Kebab malam', category: 'Makan', wallet: 'Cash', amount: 44000 },
  { id: 14, date: '2026-08-17', merchant: 'Hadiah keluarga', category: 'Keluarga', wallet: 'BCA', amount: 275000 },
];

const initialWallets = [
  { id: 'BCA', name: 'BCA', type: 'Bank', reminder: 20, balance: 4_500_000 },
  { id: 'Superbank', name: 'Superbank', type: 'Bank', reminder: 15, balance: 3_200_000 },
  { id: 'Gopay', name: 'Gopay', type: 'E-Wallet', reminder: 15, balance: 650_000 },
  { id: 'Cash', name: 'Cash', type: 'Tunai', reminder: 30, balance: 900_000 },
];

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: House },
  { id: 'analytics', label: 'Analytic', icon: Activity },
  { id: 'transactions', label: 'Transaction', icon: ReceiptText },
  { id: 'dompet', label: 'Dompet', icon: Wallet },
  { id: 'conversation', label: 'Conversation', icon: MessageSquare },
  { id: 'whatsapp', label: 'Whatsapp', icon: Smartphone },
  { id: 'pengaturan', label: 'Settings', icon: Settings },
  { id: 'setup', label: 'Setup Guide', icon: FileText },
];

const categoryMeta = {
  Tagihan: { color: '#e53935', budget: 900000, icon: CreditCard },
  Belanja: { color: '#f5962a', budget: 1200000, icon: ShoppingBasket },
  Makan: { color: '#f5c842', budget: 650000, icon: Utensils },
  Transport: { color: '#1e88e5', budget: 420000, icon: BusFront },
  Rumah: { color: '#ec407a', budget: 400000, icon: House },
  Kesehatan: { color: '#d93829', budget: 350000, icon: HeartPulse },
  Keluarga: { color: '#42a5f5', budget: 550000, icon: UsersRound },
};

const replyFormats = [
  { trigger: 'berhasil_catat', text: '✅ Dicatat: {kategori} dari {rekening} sebesar {jumlah}.' },
  { trigger: 'butuh_konfirmasi', text: 'Aku perlu konfirmasi: transaksi ini masuk kategori apa?' },
  { trigger: 'berhasil_batal', text: 'Transaksi terakhir sudah dibatalkan.' },
];

const dictionaryEntries = [
  ['bensin, grab, parkir', 'Transport'],
  ['listrik, internet, air', 'Tagihan'],
  ['beras, sayur, bulanan', 'Belanja'],
  ['kopi, makan, kebab', 'Makan'],
  ['dokter, apotek, vitamin', 'Kesehatan'],
];

const reviewMessages = [
  { id: 1, from: 'Demo User', text: 'bayar sampah bca 50000', result: 'Rumah dari BCA, Rp 50.000', state: 'Tercatat' },
  { id: 2, from: 'Demo User', text: 'beli pisang cash 10000', result: 'Makan dari Cash, Rp 10.000', state: 'Tercatat' },
  { id: 3, from: 'Demo User', text: 'batalkan transaksi terakhir', result: 'Menunggu konfirmasi pembatalan', state: 'Review' },
];

function money(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function compactMoney(value) {
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(value % 1_000_000 ? 1 : 0)}jt`;
  if (value >= 1_000) return `Rp ${Math.round(value / 1_000)}rb`;
  return money(value);
}

function parseDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function fullDate(value) {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(parseDate(value));
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

function exportCsv(rows) {
  const csv = [
    ['Tanggal', 'Keterangan', 'Kategori', 'Dompet', 'Nominal'],
    ...rows.map((row) => [row.date, row.merchant, row.category, row.wallet, row.amount]),
  ].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'wa-finance-demo.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="wa-skin-tooltip">
      <strong>{label || payload[0].name}</strong>
      <span>{money(payload[0].value)}</span>
    </div>
  );
}

export default function WaFinanceM3Demo() {
  const { theme, toggleTheme } = useTheme();
  const [activeView, setActiveView] = useState('dashboard');
  const [transactionRows, setTransactionRows] = useState(initialTransactions);
  const [walletRows, setWalletRows] = useState(initialWallets);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedWallet, setSelectedWallet] = useState('all');
  const [chartMode, setChartMode] = useState('day');
  const [selectedDay, setSelectedDay] = useState(17);
  const [walletIndex, setWalletIndex] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [transactionEditorOpen, setTransactionEditorOpen] = useState(false);
  const [walletEditorOpen, setWalletEditorOpen] = useState(false);
  const [draftTransaction, setDraftTransaction] = useState(null);
  const [draftWallet, setDraftWallet] = useState(null);
  const [rowLimit, setRowLimit] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [notice, setNotice] = useState('');
  const [allocationDraft, setAllocationDraft] = useState({
    source: 'Superbank',
    income: 5_000_000,
    cash: 1_000_000,
    gopay: 250_000,
  });
  const [topUpDraft, setTopUpDraft] = useState({ source: 'BCA', amount: 250_000 });
  const [cashOutDraft, setCashOutDraft] = useState({ source: 'BCA', amount: 500_000 });
  const [ledgerLog, setLedgerLog] = useState([]);

  const showNotice = (message) => {
    setNotice(message);
    window.clearTimeout(window.__waFinanceSkinNotice);
    window.__waFinanceSkinNotice = window.setTimeout(() => setNotice(''), 2400);
  };

  const filteredTransactions = useMemo(() => transactionRows.filter((item) => {
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    if (selectedWallet !== 'all' && item.wallet !== selectedWallet) return false;
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      return [item.merchant, item.category, item.wallet].some((value) => value.toLowerCase().includes(query));
    }
    return true;
  }), [searchTerm, selectedCategory, selectedWallet, transactionRows]);

  const walletSpend = useMemo(() => transactionRows.reduce((grouped, item) => {
    grouped.set(item.wallet, (grouped.get(item.wallet) || 0) + item.amount);
    return grouped;
  }, new Map()), [transactionRows]);

  const walletData = useMemo(() => walletRows.map((wallet) => {
    const spent = walletSpend.get(wallet.id) || 0;
    return {
      ...wallet,
      spent,
      available: Math.max(wallet.balance - spent, 0),
      percent: wallet.balance ? Math.max(0, Math.round(((wallet.balance - spent) / wallet.balance) * 100)) : 0,
    };
  }), [walletRows, walletSpend]);

  const totalExpense = transactionRows.reduce((sum, item) => sum + item.amount, 0);
  const totalWalletBalance = walletData.reduce((sum, wallet) => sum + wallet.available, 0);
  const monthlyBudgetFromWallets = totalWalletBalance;
  const activeDaysCount = new Set(transactionRows.map((item) => item.date)).size;
  const averageTransaction = transactionRows.length ? Math.round(totalExpense / transactionRows.length) : 0;

  const categoryData = useMemo(() => {
    const grouped = new Map();
    transactionRows
      .filter((item) => selectedWallet === 'all' || item.wallet === selectedWallet)
      .forEach((item) => {
        const current = grouped.get(item.category) || { value: 0, count: 0 };
        grouped.set(item.category, { value: current.value + item.amount, count: current.count + 1 });
      });
    const total = Array.from(grouped.values()).reduce((sum, item) => sum + item.value, 0);
    return Array.from(grouped.entries())
      .map(([name, item]) => {
        const meta = categoryMeta[name] || { color: '#3d8816', budget: item.value + 1, icon: Tags };
        return {
          name,
          value: item.value,
          count: item.count,
          budget: meta.budget,
          color: meta.color,
          Icon: meta.icon,
          percent: total ? Math.round((item.value / total) * 100) : 0,
          used: Math.min(100, Math.round((item.value / meta.budget) * 100)),
          over: item.value > meta.budget,
        };
      })
      .sort((first, second) => second.value - first.value);
  }, [selectedWallet, transactionRows]);

  const dailyData = useMemo(() => {
    const rows = Array.from({ length: 31 }, (_, index) => {
      const day = index + 1;
      const date = `2026-08-${String(day).padStart(2, '0')}`;
      return { date, day, label: `${day} Agu`, amount: 0 };
    });
    const byDate = new Map(rows.map((row) => [row.date, row]));
    filteredTransactions.forEach((item) => {
      const row = byDate.get(item.date);
      if (row) row.amount += item.amount;
    });
    return rows;
  }, [filteredTransactions]);

  const dailyCounts = useMemo(() => {
    const rows = Array.from({ length: 31 }, (_, index) => {
      const day = index + 1;
      const date = `2026-08-${String(day).padStart(2, '0')}`;
      return { date, day, count: 0 };
    });
    const byDate = new Map(rows.map((row) => [row.date, row]));
    filteredTransactions.forEach((item) => {
      const row = byDate.get(item.date);
      if (row) row.count += 1;
    });
    return rows;
  }, [filteredTransactions]);

  const latestMetricDay = Math.max(...filteredTransactions.map((item) => Number(item.date.slice(8))), 1);
  const metricDailyData = dailyData.filter((day) => day.day <= latestMetricDay);
  const metricDailyCounts = dailyCounts.filter((day) => day.day <= latestMetricDay);
  const chartData = chartMode === 'transaction'
    ? filteredTransactions.slice(0, 16).map((item, index) => ({ label: `Tx ${index + 1}`, amount: item.amount }))
    : metricDailyData;
  const latestTransactionDay = Math.max(...transactionRows.map((item) => Number(item.date.slice(8))), 1);

  const visibleTransactions = filteredTransactions.slice().reverse().slice(0, rowLimit);
  const bankWallets = walletRows.filter((wallet) => wallet.type === 'Bank');
  const walletDeck = [{ id: 'all', name: 'Semua dompet', available: totalWalletBalance, type: `${walletData.length} dompet aktif`, percent: 100 }, ...walletData];
  const activeWalletCard = walletDeck[walletIndex] || walletDeck[0];
  const selectedDayAmount = dailyData.find((day) => day.day === selectedDay)?.amount || 0;
  const allocationIncome = Number(allocationDraft.income) || 0;
  const allocationCash = Number(allocationDraft.cash) || 0;
  const allocationGopay = Number(allocationDraft.gopay) || 0;
  const allocationRemaining = allocationIncome - allocationCash - allocationGopay;
  const allocationInvalid = allocationIncome <= 0 || allocationRemaining < 0;
  const walletAvailable = (id) => walletData.find((wallet) => wallet.id === id)?.available || 0;
  const topUpAmount = Number(topUpDraft.amount) || 0;
  const cashOutAmount = Number(cashOutDraft.amount) || 0;
  const topUpInvalid = topUpAmount <= 0 || topUpAmount > walletAvailable(topUpDraft.source);
  const cashOutInvalid = cashOutAmount <= 0 || cashOutAmount > walletAvailable(cashOutDraft.source);
  const activeTitle = navItems.find((item) => item.id === activeView)?.label || 'Dashboard';
  const shellModeClass = activeView === 'dashboard'
    ? 'wa-skin-shell-dashboard'
    : activeView === 'transactions'
      ? 'wa-skin-shell-transaction'
      : '';

  const selectView = (id) => {
    setActiveView(id);
    setFilterOpen(false);
  };

  const openTransactionEditor = (item) => {
    setDraftTransaction(item || {
      id: Date.now(),
      date: '2026-08-19',
      merchant: '',
      category: 'Makan',
      wallet: 'Cash',
      amount: 0,
    });
    setTransactionEditorOpen(true);
  };

  const saveTransaction = () => {
    const normalized = { ...draftTransaction, amount: Number(draftTransaction.amount) || 0 };
    if (!normalized.merchant.trim() || normalized.amount <= 0) {
      showNotice('Isi keterangan dan nominal dulu');
      return;
    }
    setTransactionRows((rows) => {
      const exists = rows.some((item) => item.id === normalized.id);
      return exists ? rows.map((item) => (item.id === normalized.id ? normalized : item)) : [...rows, normalized];
    });
    setTransactionEditorOpen(false);
    showNotice('Transaksi demo tersimpan');
  };

  const deleteTransaction = (id) => {
    setTransactionRows((rows) => rows.filter((item) => item.id !== id));
    showNotice('Transaksi demo dihapus');
  };

  const openWalletEditor = (wallet) => {
    setDraftWallet({ ...wallet });
    setWalletEditorOpen(true);
  };

  const saveWallet = () => {
    const normalized = {
      ...draftWallet,
      balance: Number(draftWallet.balance) || 0,
      reminder: Number(draftWallet.reminder) || 0,
    };
    setWalletRows((rows) => rows.map((wallet) => (wallet.id === normalized.id ? normalized : wallet)));
    setWalletEditorOpen(false);
    showNotice(`${normalized.name} diperbarui`);
  };

  const applySalaryAllocation = () => {
    if (allocationInvalid) {
      showNotice('Alokasi harus lebih kecil dari gaji');
      return;
    }
    setWalletRows((rows) => rows.map((wallet) => {
      if (wallet.id === allocationDraft.source) return { ...wallet, balance: wallet.balance + allocationRemaining };
      if (wallet.id === 'Cash') return { ...wallet, balance: wallet.balance + allocationCash };
      if (wallet.id === 'Gopay') return { ...wallet, balance: wallet.balance + allocationGopay };
      return wallet;
    }));
    setLedgerLog((rows) => [
      { id: Date.now(), title: 'Alokasi gaji', body: `${allocationDraft.source} sisa ${money(allocationRemaining)}, Cash ${money(allocationCash)}, Gopay ${money(allocationGopay)}` },
      ...rows,
    ].slice(0, 5));
    showNotice('Gaji dialokasikan ke dompet');
  };

  const applyWalletMove = ({ source, target, amount, label }) => {
    const normalizedAmount = Number(amount) || 0;
    if (normalizedAmount <= 0) {
      showNotice('Nominal mutasi harus diisi');
      return;
    }
    if (normalizedAmount > walletAvailable(source)) {
      showNotice(`Saldo ${source} tidak cukup`);
      return;
    }
    setWalletRows((rows) => rows.map((wallet) => {
      if (wallet.id === source) return { ...wallet, balance: wallet.balance - normalizedAmount };
      if (wallet.id === target) return { ...wallet, balance: wallet.balance + normalizedAmount };
      return wallet;
    }));
    setLedgerLog((rows) => [
      { id: Date.now(), title: label, body: `${source} berkurang ${money(normalizedAmount)}, ${target} bertambah` },
      ...rows,
    ].slice(0, 5));
    showNotice(`${label} berhasil`);
  };

  const chooseCategory = (category) => {
    setSelectedCategory(selectedCategory === category ? 'all' : category);
    setActiveView('transactions');
  };

  const renderDashboard = () => (
    <main className="wa-skin-view wa-skin-dashboard-view">
      <AnimatedDashboardHero
        greeting={getGreeting()}
        name="Demo User"
        period="1 Agustus 2026 - 31 Agustus 2026"
        onExcel={() => { exportCsv(filteredTransactions); showNotice('CSV demo diunduh'); }}
        onPdf={() => { window.print(); showNotice('Dialog cetak dibuka'); }}
      />

      <section className="wa-skin-hero-row">
        <article className="wa-skin-card wa-skin-week-card">
          <div className="wa-skin-card-head compact">
            <span className="wa-skin-pill">Periode aktif</span>
            <small>{transactionRows.length} transaksi · terakhir {latestTransactionDay} Agu</small>
          </div>
          <div className="wa-skin-week-title">
            <button type="button" onClick={() => showNotice('Minggu sebelumnya')} aria-label="Minggu sebelumnya"><ChevronLeft size={16} /></button>
            <strong>Agustus 2026</strong>
            <button type="button" onClick={() => showNotice('Minggu berikutnya')} aria-label="Minggu berikutnya"><ChevronRight size={16} /></button>
          </div>
          <div className="wa-skin-week-days">
            {[
              ['JUM', 14],
              ['SAB', 15],
              ['MIN', 16],
              ['SEN', 17],
              ['SEL', 18],
              ['RAB', 19],
              ['KAM', 20],
            ].map(([day, number]) => (
              <button key={number} type="button" aria-pressed={selectedDay === number} onClick={() => setSelectedDay(number)}>
                <small>{day}</small>
                <strong>{number}</strong>
              </button>
            ))}
          </div>
          <button type="button" className="wa-skin-link-btn" onClick={() => setCalendarOpen(true)}>
            <CalendarDays size={14} /> Lihat satu bulan
          </button>
        </article>

        <div className="wa-skin-streak-stack">
          <MiniStat icon={<Activity size={17} />} label="Hari aktif" value={`${activeDaysCount} hari`} />
          <MiniStat icon={<Trophy size={17} />} label="Kategori terpakai" value={`${categoryData.length} kategori`} />
          <MiniStat icon={<CalendarDays size={17} />} label="Dipilih" value={`${selectedDay} Agu, ${compactMoney(selectedDayAmount)}`} />
        </div>

        <article className="wa-skin-wallet-card" onClick={() => setWalletIndex((walletIndex + 1) % walletDeck.length)} onKeyDown={(event) => { if (event.key === 'Enter') setWalletIndex((walletIndex + 1) % walletDeck.length); }} role="button" tabIndex={0}>
          <div className="wa-skin-wallet-card-top">
            <strong>WA Finance</strong>
            <span />
          </div>
          <div>
            <small>Total saldo</small>
            <b>{money(activeWalletCard.available)}</b>
          </div>
          <div className="wa-skin-wallet-card-bottom">
            <span>{activeWalletCard.name}</span>
            <small>{activeWalletCard.type}</small>
          </div>
          <div className="wa-skin-wallet-dots">
            {walletDeck.map((wallet, index) => (
              <button key={wallet.id} type="button" aria-label={`Pilih ${wallet.name}`} aria-pressed={walletIndex === index} onClick={(event) => { event.stopPropagation(); setWalletIndex(index); }} />
            ))}
          </div>
        </article>
      </section>

      <section className="wa-skin-metric-grid">
        <MetricCard label="Pemasukan" value={money(ledgerLog.filter((item) => item.title === 'Alokasi gaji').length ? allocationIncome : 0)} icon={<Banknote size={18} />} tone="good" detail="Masuk lewat alokasi dompet demo" />
        <MetricCard label="Pengeluaran" value={money(totalExpense)} icon={<Activity size={18} />} sparkline={metricDailyData.map((day) => day.amount)} detail="Semua catatan periode ini" />
        <MetricCard label="Transaksi" value={transactionRows.length} icon={<ReceiptText size={18} />} bars={metricDailyCounts.map((day) => day.count)} detail="Bar mengikuti jumlah transaksi harian" />
        <MetricCard label="Tabungan" value={money(0)} icon={<Wallet size={18} />} tone="good" detail="Kategori Tabungan" />
      </section>

      <section className="wa-skin-chart-grid">
        <article className="wa-skin-card wa-skin-chart-card">
          <div className="wa-skin-card-head">
            <div>
              <span className="wa-skin-label">Grafik Pengeluaran</span>
              <h2>Pengeluaran harian</h2>
            </div>
            <div className="wa-skin-segmented" role="group" aria-label="Mode grafik">
              <button type="button" aria-pressed={chartMode === 'day'} onClick={() => setChartMode('day')}>Per hari</button>
              <button type="button" aria-pressed={chartMode === 'transaction'} onClick={() => setChartMode('transaction')}>Per transaksi</button>
            </div>
          </div>
          <div className="wa-skin-chart-area">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="waSkinArea" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--wa-skin-primary)" stopOpacity={0.34} />
                    <stop offset="100%" stopColor="var(--wa-skin-primary)" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--wa-skin-grid)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--wa-skin-muted)', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={compactMoney} tick={{ fill: 'var(--wa-skin-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="amount" stroke="var(--wa-skin-primary)" strokeWidth={2.4} fill="url(#waSkinArea)" dot={{ r: 2.4, fill: 'var(--wa-skin-primary)' }} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="wa-skin-card wa-skin-donut-card">
          <div className="wa-skin-card-head">
            <div>
              <span className="wa-skin-label">Komposisi</span>
              <h2>Kategori</h2>
            </div>
            <button type="button" className="wa-skin-icon-btn" onClick={() => showNotice('Klik potongan chart untuk filter kategori')} aria-label="Info chart kategori">
              <Activity size={17} />
            </button>
          </div>
          <div className="wa-skin-donut-wrap">
            <svg
              className="wa-skin-svg-donut"
              viewBox="0 0 120 120"
              role="button"
              tabIndex={0}
              aria-label="Klik donut untuk filter kategori"
              onClick={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                const x = event.clientX - bounds.left - bounds.width / 2;
                const y = event.clientY - bounds.top - bounds.height / 2;
                const percentAtPoint = ((Math.atan2(y, x) * 180 / Math.PI + 450) % 360) / 3.6;
                let cursor = 0;
                const hit = categoryData.find((category) => {
                  cursor += category.percent;
                  return percentAtPoint <= cursor;
                }) || categoryData[0];
                if (hit) chooseCategory(hit.name);
              }}
              onKeyDown={(event) => { if (event.key === 'Enter' && categoryData[0]) chooseCategory(categoryData[0].name); }}
            >
              {(() => {
                let offset = 0;
                return categoryData.map((category) => {
                  const segment = Math.max(category.percent, 1);
                  const currentOffset = offset;
                  offset += category.percent;
                  return (
                    <circle
                      key={category.name}
                      cx="60"
                      cy="60"
                      r="38"
                      fill="none"
                      stroke={category.color}
                      strokeDasharray={`${segment} ${100 - segment}`}
                      strokeDashoffset={-currentOffset}
                      strokeLinecap="butt"
                      strokeWidth={selectedCategory === category.name ? 21 : 18}
                      pathLength="100"
                      transform="rotate(-90 60 60)"
                    />
                  );
                });
              })()}
              <circle cx="60" cy="60" r="27" fill="var(--wa-skin-card)" />
              <text x="60" y="58" textAnchor="middle" fill="var(--wa-skin-text)" fontSize="10" fontWeight="900">{compactMoney(totalExpense)}</text>
              <text x="60" y="70" textAnchor="middle" fill="var(--wa-skin-muted)" fontSize="7">Total</text>
            </svg>
          </div>
          <div className="wa-skin-legend">
            {categoryData.map((category) => (
              <button key={category.name} type="button" aria-pressed={selectedCategory === category.name} onClick={() => chooseCategory(category.name)}>
                <i style={{ background: category.color }} />
                {category.name}
              </button>
            ))}
          </div>
        </article>

        <article className="wa-skin-card wa-skin-wallet-bars-card">
          <div className="wa-skin-card-head">
            <div>
              <span className="wa-skin-label">Saldo Nett</span>
              <h2>Saldo per Dompet</h2>
            </div>
            <button type="button" className="wa-skin-icon-btn" onClick={() => selectView('dompet')} aria-label="Buka dompet">
              <Wallet size={17} />
            </button>
          </div>
          <div className="wa-skin-wallet-bars">
            {walletData.map((wallet) => (
              <button key={wallet.id} type="button" aria-pressed={selectedWallet === wallet.id} onClick={() => setSelectedWallet(selectedWallet === wallet.id ? 'all' : wallet.id)}>
                <span><b>{wallet.name}</b><small>{money(wallet.available)}</small></span>
                <i><em style={{ width: `${wallet.percent}%` }} /></i>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="wa-skin-dashboard-footer">
        <article className="wa-skin-card wa-skin-recent-card">
          <div className="wa-skin-card-head compact">
            <div>
              <h2>Recent Transactions</h2>
            </div>
            <button type="button" className="wa-skin-link-btn" onClick={() => selectView('transactions')}>View all transactions</button>
          </div>
          <div className="wa-skin-dashboard-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {visibleTransactions.slice(0, 3).map((item) => (
                  <tr key={item.id}>
                    <td>{fullDate(item.date).replace(' Agustus 2026', ' Agu 2026')}</td>
                    <td><strong>{item.merchant}</strong><small>{item.wallet}</small></td>
                    <td><span className="wa-skin-chip">{item.category}</span></td>
                    <td><b>{money(item.amount)}</b></td>
                    <td>WhatsApp</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="wa-skin-card wa-skin-note-card">
          <span><Banknote size={26} /></span>
          <p>Catatan kecil hari ini, membawa perubahan besar di masa depan.</p>
          <LeafMark />
        </article>
      </section>
    </main>
  );

  const renderTransactions = () => (
    <main className="wa-skin-view wa-skin-transactions-view">
      <section className="wa-skin-tx-summary">
        <div className="wa-skin-export-group">
          <button type="button" className="wa-skin-btn danger" onClick={() => { window.print(); showNotice('Dialog cetak dibuka'); }}><FileText size={15} /> PDF</button>
          <button type="button" className="wa-skin-btn filled" onClick={() => { exportCsv(filteredTransactions); showNotice('CSV demo diunduh'); }}><FileSpreadsheet size={15} /> Excel</button>
        </div>
        <svg viewBox="0 0 300 34" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 25 Q 45 4, 90 18 T 180 8 T 300 22" fill="none" stroke="var(--wa-skin-primary)" strokeWidth="2.4" />
        </svg>
        <div className="wa-skin-tx-stats">
          <span><b>{money(averageTransaction)}</b><small>Rata-rata</small></span>
          <span><b>{activeDaysCount} hari</b><small>Hari aktif</small></span>
          <span><b>{categoryData.length} kategori</b><small>Total kategori</small></span>
        </div>
      </section>

      <section className="wa-skin-category-grid">
        {categoryData.map((category) => {
          const Icon = category.Icon;
          return (
            <button key={category.name} type="button" aria-pressed={selectedCategory === category.name} onClick={() => setSelectedCategory(selectedCategory === category.name ? 'all' : category.name)}>
              <em className={category.over ? 'danger' : ''}>{category.percent}%</em>
              <span style={{ color: category.color }}><Icon size={22} /></span>
              <strong>{category.name}</strong>
              <b>{money(category.value)}</b>
              <small>{category.count} transaksi</small>
              <i><u className={category.over ? 'danger' : ''} style={{ width: `${category.used}%` }} /></i>
            </button>
          );
        })}
      </section>

      <section className="wa-skin-table-card">
        <div className="wa-skin-table-head">
          <div>
            <span className="wa-skin-label">Aktivitas</span>
            <h2>Daftar transaksi</h2>
            <p>Menampilkan 1 sampai {visibleTransactions.length} dari {filteredTransactions.length} catatan.</p>
          </div>
          <div className="wa-skin-table-tools">
            <label>
              <Search size={14} />
              <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Cari transaksi" />
            </label>
            <select value={rowLimit} onChange={(event) => setRowLimit(Number(event.target.value))} aria-label="Jumlah baris">
              <option value={5}>5 baris</option>
              <option value={10}>10 baris</option>
              <option value={14}>14 baris</option>
            </select>
          </div>
        </div>
        {visibleTransactions.length ? (
          <div className="wa-skin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Merchant</th>
                  <th>Kategori</th>
                  <th>Type</th>
                  <th>Nominal</th>
                  <th>Date</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleTransactions.map((item) => {
                  const sourceCode = `ID ${String(item.id).padStart(2, '0')}AF${item.date.replaceAll('-', '').slice(4)}`;
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="wa-skin-merchant-cell">
                          <span>{item.merchant.charAt(0).toUpperCase()}</span>
                          <div>
                            <strong>{item.merchant}</strong>
                            <small>{item.wallet.toUpperCase()}</small>
                          </div>
                        </div>
                      </td>
                      <td><span className="wa-skin-chip">{item.category}</span></td>
                      <td><span className="wa-skin-type-chip expense">↘ Pengeluaran</span></td>
                      <td><b>- {money(item.amount)}</b></td>
                      <td>{fullDate(item.date).replace(' Agustus 2026', ' Agu 2026')}</td>
                      <td>
                        <div className="wa-skin-source-cell">
                          <span>WhatsApp</span>
                          <small>{sourceCode}</small>
                        </div>
                      </td>
                      <td><span className="wa-skin-status-chip"><i /> Approved</span></td>
                      <td>
                        <button type="button" aria-label={`Edit ${item.merchant}`} onClick={() => openTransactionEditor(item)}><Pencil size={15} /></button>
                        <button type="button" aria-label={`Hapus ${item.merchant}`} onClick={() => deleteTransaction(item.id)}><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Filter kosong" body="Ganti kategori, dompet, atau pencarian untuk melihat transaksi." />
        )}
      </section>
    </main>
  );

  const renderWallets = () => (
    <main className="wa-skin-view wa-skin-wallet-view">
      <section className="wa-skin-card wa-skin-wallet-ledger">
        <div className="wa-skin-card-head">
          <div>
            <span className="wa-skin-label">Sumber Dana</span>
            <h2>Dompet</h2>
            <p>Saldo rekening, e-wallet, dan cash otomatis menjadi Monthly Budget dashboard.</p>
          </div>
          <button type="button" className="wa-skin-btn tonal" onClick={() => showNotice('Data dompet demo disegarkan')}>
            <Wallet size={15} /> Refresh
          </button>
        </div>
        <div className="wa-skin-wallet-list">
          {walletData.map((wallet) => (
            <article key={wallet.id}>
              <span><Banknote size={16} /></span>
              <div>
                <strong>{wallet.name}</strong>
                <small>{wallet.type} · ingatkan di {wallet.reminder}%</small>
              </div>
              <b>{money(wallet.available)}</b>
              <button type="button" aria-label={`Edit ${wallet.name}`} onClick={() => openWalletEditor(wallet)}><Pencil size={16} /></button>
              <button type="button" aria-label={`Sembunyikan ${wallet.name}`} onClick={() => showNotice(`${wallet.name} disembunyikan di demo`)}><EyeOff size={16} /></button>
            </article>
          ))}
        </div>
      </section>

      <aside className="wa-skin-wallet-side">
        <section className="wa-skin-card">
          <span className="wa-skin-label">Alokasi gaji</span>
          <h2>Masuk lalu pecah ke dompet</h2>
          <div className="wa-skin-form-grid">
            <label>Gaji masuk ke<select value={allocationDraft.source} onChange={(event) => setAllocationDraft({ ...allocationDraft, source: event.target.value })}>{bankWallets.map((wallet) => <option key={wallet.id}>{wallet.id}</option>)}</select></label>
            <label>Nominal gaji<input type="number" min="0" value={allocationDraft.income} onChange={(event) => setAllocationDraft({ ...allocationDraft, income: event.target.value })} /></label>
            <label>Jadi Cash<input type="number" min="0" value={allocationDraft.cash} onChange={(event) => setAllocationDraft({ ...allocationDraft, cash: event.target.value })} /></label>
            <label>Jadi Gopay<input type="number" min="0" value={allocationDraft.gopay} onChange={(event) => setAllocationDraft({ ...allocationDraft, gopay: event.target.value })} /></label>
          </div>
          <div className="wa-skin-result-row"><span>Sisa tetap di {allocationDraft.source}</span><b>{money(Math.max(allocationRemaining, 0))}</b></div>
          <button type="button" className="wa-skin-btn filled wide" disabled={allocationInvalid} onClick={applySalaryAllocation}><ArrowLeftRight size={15} /> Alokasikan gaji</button>
        </section>

        <section className="wa-skin-card">
          <span className="wa-skin-label">Mutasi dompet</span>
          <h2>Pindah saldo</h2>
          <div className="wa-skin-move-grid">
            <WalletMoveCard
              title="Bank ke Gopay"
              icon={<Smartphone size={18} />}
              draft={topUpDraft}
              setDraft={setTopUpDraft}
              bankWallets={bankWallets}
              target="Gopay"
              available={walletAvailable(topUpDraft.source)}
              invalid={topUpInvalid}
              onSubmit={() => applyWalletMove({ source: topUpDraft.source, target: 'Gopay', amount: topUpDraft.amount, label: 'Bank ke Gopay' })}
            />
            <WalletMoveCard
              title="Tarik tunai"
              icon={<Banknote size={18} />}
              draft={cashOutDraft}
              setDraft={setCashOutDraft}
              bankWallets={bankWallets}
              target="Cash"
              available={walletAvailable(cashOutDraft.source)}
              invalid={cashOutInvalid}
              onSubmit={() => applyWalletMove({ source: cashOutDraft.source, target: 'Cash', amount: cashOutDraft.amount, label: 'Tarik tunai' })}
            />
          </div>
        </section>

        <section className="wa-skin-card">
          <span className="wa-skin-label">Riwayat</span>
          <h2>Mutasi terakhir</h2>
          <div className="wa-skin-log-list">
            {ledgerLog.length ? ledgerLog.map((item) => (
              <article key={item.id}>
                <strong>{item.title}</strong>
                <small>{item.body}</small>
              </article>
            )) : <p>Belum ada mutasi dompet di demo ini.</p>}
          </div>
        </section>
      </aside>
    </main>
  );

  const renderSimpleView = () => {
    if (activeView === 'anggaran') {
      return (
        <main className="wa-skin-view wa-skin-simple-grid">
          {categoryData.slice(0, 3).map((category) => (
            <InfoCard key={category.name} title={category.name} label="Anggaran" body={`${category.used}% terpakai dari budget ${money(category.budget)}.`} icon={<CalendarDays size={18} />} action={() => chooseCategory(category.name)} />
          ))}
        </main>
      );
    }

    if (activeView === 'tabungan') {
      return (
        <main className="wa-skin-view wa-skin-simple-grid">
          <InfoCard title="Tabungan" label="Saldo" body="Belum ada kategori tabungan di data demo." icon={<Banknote size={18} />} action={() => showNotice('Kategori Tabungan belum ada di demo')} />
          <InfoCard title="Dompet aktif" label="Sumber Dana" body={`Saldo tersedia dari semua dompet: ${money(monthlyBudgetFromWallets)}.`} icon={<Wallet size={18} />} action={() => selectView('dompet')} />
        </main>
      );
    }

    if (activeView === 'laporan') {
      return (
        <main className="wa-skin-view wa-skin-simple-grid">
          <InfoCard title="Export Excel" label="Laporan" body="Unduh transaksi yang sedang difilter sebagai CSV." icon={<FileSpreadsheet size={18} />} action={() => { exportCsv(filteredTransactions); showNotice('CSV demo diunduh'); }} />
          <InfoCard title="Export PDF" label="Laporan" body="Buka dialog cetak untuk simpan laporan PDF." icon={<FileText size={18} />} action={() => { window.print(); showNotice('Dialog cetak dibuka'); }} />
        </main>
      );
    }

    if (activeView === 'kategori') {
      return (
        <main className="wa-skin-view wa-skin-simple-grid">
          {categoryData.map((category) => (
            <InfoCard key={category.name} title={category.name} label="Kategori" body={`${category.count} transaksi, total ${money(category.value)}.`} icon={<Tags size={18} />} action={() => chooseCategory(category.name)} />
          ))}
        </main>
      );
    }

    if (activeView === 'analytics') {
      return (
        <main className="wa-skin-view wa-skin-simple-grid">
          <InfoCard title="Expense Trend" label="Analytic" body={`${activeDaysCount} hari aktif dengan total ${money(totalExpense)}.`} icon={<Activity size={18} />} action={() => selectView('dashboard')} />
          <InfoCard title="Top Category" label="Analytic" body={categoryData[0] ? `${categoryData[0].name} paling besar bulan ini.` : 'Kategori muncul setelah transaksi masuk.'} icon={<Tags size={18} />} action={() => selectView('transactions')} />
          <InfoCard title="Budget Source" label="Analytic" body={`Monthly Budget demo mengikuti saldo dompet: ${money(monthlyBudgetFromWallets)}.`} icon={<Wallet size={18} />} action={() => selectView('dompet')} />
        </main>
      );
    }

    if (activeView === 'conversation') {
      return (
        <main className="wa-skin-view">
          <section className="wa-skin-card">
            <span className="wa-skin-label">Conversation</span>
            <h2>Pesan WhatsApp yang perlu dicek</h2>
            <div className="wa-skin-review-list">
              {reviewMessages.map((message) => (
                <article key={message.id}>
                  <span>{message.from}</span>
                  <strong>{message.text}</strong>
                  <small>{message.result}</small>
                  <button type="button" onClick={() => showNotice(message.state === 'Review' ? 'Pesan masuk antrian review' : 'Pesan sudah tercatat')}>{message.state}</button>
                </article>
              ))}
            </div>
          </section>
        </main>
      );
    }

    if (activeView === 'whatsapp') {
      return (
        <main className="wa-skin-view wa-skin-simple-grid">
          <InfoCard title="Webhook" label="Whatsapp" body="Bot hanya mencatat transaksi ke webapp demo, bukan langsung ke Google Sheet." icon={<Smartphone size={18} />} action={() => showNotice('Webhook demo aktif')} />
          <InfoCard title="Parser rekening" label="Whatsapp" body="BCA, Superbank, Gopay, dan Cash dikenali dari teks." icon={<SlidersHorizontal size={18} />} action={() => selectView('dompet')} />
          <InfoCard title="Review pesan" label="Whatsapp" body="Pesan ambigu masuk Conversation untuk dicek." icon={<MessageSquare size={18} />} action={() => selectView('conversation')} />
        </main>
      );
    }

    if (activeView === 'setup') {
      return (
        <main className="wa-skin-view wa-skin-simple-grid">
          <InfoCard title="Step 1" label="Setup Guide" body="Atur wallet utama dan saldo awal." icon={<Wallet size={18} />} action={() => selectView('dompet')} />
          <InfoCard title="Step 2" label="Setup Guide" body="Rapikan kategori dan keyword parser." icon={<Tags size={18} />} action={() => showNotice('Menu kategori belum dibuat di demo ini')} />
          <InfoCard title="Step 3" label="Setup Guide" body="Hubungkan WhatsApp bot ke API webapp." icon={<Smartphone size={18} />} action={() => selectView('whatsapp')} />
        </main>
      );
    }

    if (activeView === 'pengaturan') {
      return (
        <main className="wa-skin-view wa-skin-simple-grid">
          <InfoCard title="Tentang Aplikasi" label="Pengaturan" body="WA Finance Gateway V.2.0" icon={<Settings size={18} />} />
          <InfoCard title="Model AI" label="Groq routing" body="Qwen atau GPT OSS bisa dipakai sebagai pengganti Llama lama." icon={<Bot size={18} />} />
          <InfoCard title="Default dompet" label="Parser" body="Tanpa sumber rekening, pesan pengeluaran masuk ke Cash." icon={<Wallet size={18} />} />
        </main>
      );
    }

    if (activeView === 'admin') {
      return (
        <main className="wa-skin-view wa-skin-simple-grid">
          {['Owner Demo: semua dompet', 'WA Finance Bot: catat dan review', 'Family Viewer: lihat dashboard'].map((body) => (
            <InfoCard key={body} title={body.split(':')[0]} label="Admin" body={body.split(': ')[1]} icon={<ShieldCheck size={18} />} />
          ))}
        </main>
      );
    }

    if (activeView === 'gateway') {
      return (
        <main className="wa-skin-view wa-skin-simple-grid">
          {[
            ['Webhook', 'Terhubung dan siap menerima pesan sample.', Smartphone],
            ['Parser rekening', 'BCA, Superbank, Gopay, dan Cash dikenali dari teks.', SlidersHorizontal],
            ['Sheets sync', 'Catatan demo siap masuk ke spreadsheet.', FileSpreadsheet],
          ].map(([title, body, Icon]) => <InfoCard key={title} title={title} label="Gateway WA" body={body} icon={<Icon size={18} />} action={() => showNotice(`${title} dicek`)} />)}
        </main>
      );
    }

    if (activeView === 'format') {
      return (
        <main className="wa-skin-view">
          <section className="wa-skin-card">
            <span className="wa-skin-label">Format Balasan</span>
            <h2>Template respons WhatsApp</h2>
            <div className="wa-skin-template-list">
              {replyFormats.map((format) => (
                <button key={format.trigger} type="button" onClick={() => showNotice(`${format.trigger} dipilih`)}>
                  <strong>{format.trigger}</strong>
                  <small>{format.text}</small>
                </button>
              ))}
            </div>
          </section>
        </main>
      );
    }

    if (activeView === 'kamus') {
      return (
        <main className="wa-skin-view">
          <section className="wa-skin-card">
            <span className="wa-skin-label">Kamus</span>
            <h2>Keyword kategori</h2>
            <div className="wa-skin-template-list">
              {dictionaryEntries.map(([keywords, category]) => (
                <button key={keywords} type="button" onClick={() => { setSelectedCategory(category); setActiveView('transactions'); }}>
                  <strong>{keywords}</strong>
                  <small>{category}</small>
                </button>
              ))}
            </div>
          </section>
        </main>
      );
    }

    return (
      <main className="wa-skin-view">
        <section className="wa-skin-card">
          <span className="wa-skin-label">Review Pesan</span>
          <h2>Pesan WhatsApp yang perlu dicek</h2>
          <div className="wa-skin-review-list">
            {reviewMessages.map((message) => (
              <article key={message.id}>
                <span>{message.from}</span>
                <strong>{message.text}</strong>
                <small>{message.result}</small>
                <button type="button" onClick={() => showNotice(message.state === 'Review' ? 'Pesan masuk antrian review' : 'Pesan sudah tercatat')}>{message.state}</button>
              </article>
            ))}
          </div>
        </section>
      </main>
    );
  };

  return (
    <div className={`wa-skin-shell ${shellModeClass}`}>
      <aside className="wa-skin-sidebar" aria-label="Navigasi demo">
        <button type="button" className="wa-skin-logo" onClick={() => selectView('dashboard')}>
          <Menu size={18} className="wa-skin-menu-mark" />
          <img src={waFinanceLogo} alt="WA Finance Gateway" />
          <strong>WA Finance <b>Gateway</b></strong>
          <small>Personal Finance</small>
        </button>
        <nav>
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const showGroup = item.group && (index === 0 || navItems[index - 1].group !== item.group);
            return (
              <React.Fragment key={item.id}>
                {showGroup ? <span className="wa-skin-nav-group">{item.group}</span> : null}
                <button type="button" className={activeView === item.id ? 'active' : ''} onClick={() => selectView(item.id)} aria-current={activeView === item.id ? 'page' : undefined}>
                  <Icon size={16} />
                  {item.label}
                </button>
              </React.Fragment>
            );
          })}
        </nav>
        <div className="wa-skin-sidebar-balance">
          <span>Saldo Total</span>
          <strong>{money(totalWalletBalance)}</strong>
          <small>Semua dompet</small>
        </div>
        <small className="wa-skin-sidebar-copy">© 2026 WA Finance Gateway</small>
      </aside>

      <section className="wa-skin-main-shell">
        <header className="wa-skin-topbar">
          <div className="wa-skin-top-left">
            <button type="button" aria-label="Kembali ke dashboard" onClick={() => selectView('dashboard')}><ChevronLeft size={17} /></button>
            <strong>{activeTitle === 'Dashboard' ? 'WA Finance Dashboard' : activeTitle}</strong>
          </div>
          <div className="wa-skin-top-right">
            <button type="button" className="wa-skin-month-btn" onClick={() => setFilterOpen((value) => !value)} aria-expanded={filterOpen}>
              <CalendarDays size={14} /> Agustus 2026
            </button>
            <button type="button" className="wa-skin-btn tonal" onClick={() => openTransactionEditor()}>
              <Plus size={14} /> Catat
            </button>
            <button type="button" className="wa-skin-icon-btn" onClick={toggleTheme} aria-label="Ganti tema">
              {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button type="button" className="wa-skin-avatar" onClick={() => showNotice('Profile demo')}>{activeView === 'dashboard' ? 'FA' : 'DU'}</button>
          </div>
        </header>

        {notice ? <div className="wa-skin-snackbar" role="status"><Check size={16} />{notice}</div> : null}

        {filterOpen ? (
          <section className="wa-skin-filter-panel">
            <label>Kategori<select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}><option value="all">Semua kategori</option>{categoryData.map((category) => <option key={category.name}>{category.name}</option>)}</select></label>
            <label>Dompet<select value={selectedWallet} onChange={(event) => setSelectedWallet(event.target.value)}><option value="all">Semua dompet</option>{walletRows.map((wallet) => <option key={wallet.id}>{wallet.id}</option>)}</select></label>
            <label>Cari<input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Merchant, kategori, dompet" /></label>
            <button type="button" className="wa-skin-btn tonal" onClick={() => { setSelectedCategory('all'); setSelectedWallet('all'); setSearchTerm(''); }}>Reset</button>
          </section>
        ) : null}

        {activeView === 'dashboard' ? renderDashboard() : null}
        {activeView === 'transactions' ? renderTransactions() : null}
        {activeView === 'dompet' ? renderWallets() : null}
        {!['dashboard', 'transactions', 'dompet'].includes(activeView) ? renderSimpleView() : null}
      </section>

      {calendarOpen ? (
        <Modal title="Agustus 2026" onClose={() => setCalendarOpen(false)}>
          <div className="wa-skin-calendar-grid">
            {dailyData.map((day) => (
              <button key={day.date} type="button" className={day.day === selectedDay ? 'active' : ''} onClick={() => { setSelectedDay(day.day); setCalendarOpen(false); showNotice(`${day.label}: ${day.amount ? money(day.amount) : 'Tidak ada pengeluaran'}`); }}>
                <span>{day.day}</span>
                <small>{day.amount ? compactMoney(day.amount) : '-'}</small>
              </button>
            ))}
          </div>
        </Modal>
      ) : null}

      {transactionEditorOpen && draftTransaction ? (
        <Modal title="Edit transaksi" onClose={() => setTransactionEditorOpen(false)}>
          <div className="wa-skin-form-grid">
            <label>Tanggal<input type="date" value={draftTransaction.date} onChange={(event) => setDraftTransaction({ ...draftTransaction, date: event.target.value })} /></label>
            <label>Nominal<input type="number" min="0" value={draftTransaction.amount} onChange={(event) => setDraftTransaction({ ...draftTransaction, amount: event.target.value })} /></label>
            <label>Kategori<select value={draftTransaction.category} onChange={(event) => setDraftTransaction({ ...draftTransaction, category: event.target.value })}>{Object.keys(categoryMeta).map((category) => <option key={category}>{category}</option>)}</select></label>
            <label>Dompet<select value={draftTransaction.wallet} onChange={(event) => setDraftTransaction({ ...draftTransaction, wallet: event.target.value })}>{walletRows.map((wallet) => <option key={wallet.id}>{wallet.id}</option>)}</select></label>
            <label className="wide">Keterangan<input value={draftTransaction.merchant} onChange={(event) => setDraftTransaction({ ...draftTransaction, merchant: event.target.value })} placeholder="Contoh: belanja makan" /></label>
          </div>
          <div className="wa-skin-dialog-actions">
            <button type="button" className="wa-skin-btn tonal" onClick={() => setTransactionEditorOpen(false)}>Batal</button>
            <button type="button" className="wa-skin-btn filled" onClick={saveTransaction}>Simpan</button>
          </div>
        </Modal>
      ) : null}

      {walletEditorOpen && draftWallet ? (
        <Modal title="Edit dompet" onClose={() => setWalletEditorOpen(false)}>
          <div className="wa-skin-form-grid">
            <label>Nama<input value={draftWallet.name} onChange={(event) => setDraftWallet({ ...draftWallet, name: event.target.value })} /></label>
            <label>Reminder (%)<input type="number" min="0" max="100" value={draftWallet.reminder} onChange={(event) => setDraftWallet({ ...draftWallet, reminder: event.target.value })} /></label>
            <label className="wide">Saldo awal<input type="number" min="0" value={draftWallet.balance} onChange={(event) => setDraftWallet({ ...draftWallet, balance: event.target.value })} /></label>
          </div>
          <div className="wa-skin-dialog-actions">
            <button type="button" className="wa-skin-btn tonal" onClick={() => setWalletEditorOpen(false)}>Batal</button>
            <button type="button" className="wa-skin-btn filled" onClick={saveWallet}>Simpan</button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function AnimatedDashboardHero({
  greeting,
  name,
  period,
  onExcel,
  onPdf,
}) {
  return (
    <section className="wf-hero" aria-label="WA Finance Gateway hero">
      <div className="wf-hero__art" aria-hidden="true">
        <span className="wf-blob wf-blob--1" />
        <span className="wf-blob wf-blob--2" />
        <span className="wf-blob wf-blob--3" />
        <span className="wf-orb wf-orb--1" />
        <span className="wf-orb wf-orb--2" />
        <span className="wf-pill wf-pill--1" />
        <span className="wf-pill wf-pill--2" />

        <svg className="wf-wave wf-wave--back" viewBox="0 0 1600 240" preserveAspectRatio="none">
          <path d="M0,150 C180,88 310,205 490,155 C700,97 800,188 1000,135 C1185,88 1370,135 1600,96" fill="none" />
        </svg>

        <svg className="wf-wave wf-wave--front" viewBox="0 0 1600 240" preserveAspectRatio="none">
          <path d="M0,178 C210,110 360,225 550,170 C760,110 930,205 1120,152 C1325,94 1460,145 1600,128" fill="none" />
        </svg>

        <svg className="wf-leaf" viewBox="0 0 280 300" role="presentation">
          <g className="wf-leaf__sway">
            <path className="wf-leaf__stem" d="M126 274 C137 219 150 165 172 114 C193 67 217 36 245 16" fill="none" />
            <ellipse className="wf-leaf__blade wf-leaf__blade--1" cx="158" cy="182" rx="26" ry="12" transform="rotate(-35 158 182)" />
            <ellipse className="wf-leaf__blade wf-leaf__blade--2" cx="191" cy="137" rx="28" ry="13" transform="rotate(25 191 137)" />
            <ellipse className="wf-leaf__blade wf-leaf__blade--3" cx="178" cy="103" rx="25" ry="11" transform="rotate(-35 178 103)" />
            <ellipse className="wf-leaf__blade wf-leaf__blade--4" cx="220" cy="82" rx="29" ry="13" transform="rotate(18 220 82)" />
            <ellipse className="wf-leaf__blade wf-leaf__blade--5" cx="214" cy="45" rx="23" ry="11" transform="rotate(-36 214 45)" />
            <ellipse className="wf-leaf__blade wf-leaf__blade--6" cx="250" cy="30" rx="27" ry="12" transform="rotate(24 250 30)" />
          </g>
        </svg>
      </div>

      <div className="wf-hero__content">
        <div className="wf-brand">
          <span className="wf-brand__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M7.2 11.1h2.1l1.1-2.6 2 6.4 1.5-3.8h2.9" />
              <path d="M20 11.8a8 8 0 1 1-3.2-6.4" />
              <path d="M17.1 4.1h3.2v3.2" />
            </svg>
          </span>
          <span>WA FINANCE GATEWAY</span>
        </div>

        <h1>{greeting}, {name}</h1>
        <p className="wf-hero__subtitle">
          Mulai hari dengan catatan yang rapi.
          <br />
          {period}
        </p>
      </div>

      <div className="wf-hero__actions">
        <button className="wf-btn" type="button" onClick={onExcel}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 3h8l4 4v14H6z" />
            <path d="M14 3v5h5" />
            <path d="M9 12h6M9 15h6M9 18h6" />
          </svg>
          Excel
        </button>

        <button className="wf-btn" type="button" onClick={onPdf}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 3h8l4 4v14H6z" />
            <path d="M14 3v5h5" />
            <path d="M9 12h6M9 15h6M9 18h4" />
          </svg>
          PDF
        </button>
      </div>
    </section>
  );
}

function LeafMark() {
  return (
    <svg className="wa-skin-leaf-mark" viewBox="0 0 150 96" aria-hidden="true">
      <path d="M56 88 C78 56 100 26 140 16" stroke="rgba(37,116,28,.34)" strokeWidth="6" fill="none" strokeLinecap="round" />
      <ellipse cx="91" cy="51" rx="14" ry="30" fill="rgba(65,150,41,.55)" transform="rotate(-46 91 51)" />
      <ellipse cx="119" cy="33" rx="12" ry="27" fill="rgba(38,122,31,.68)" transform="rotate(-24 119 33)" />
    </svg>
  );
}

function MiniStat({ icon, label, value }) {
  return (
    <article className="wa-skin-mini-stat">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function buildSparkline(values, width = 168, height = 42, padding = 3) {
  const safeValues = values.length ? values : [0];
  const max = Math.max(...safeValues, 1);
  const step = safeValues.length > 1 ? (width - padding * 2) / (safeValues.length - 1) : 0;
  const points = safeValues.map((item, index) => ({
    x: padding + index * step,
    y: height - padding - (item / max) * (height - padding * 2),
  }));

  const line = points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    const previous = points[index - 1];
    const controlX = (previous.x + point.x) / 2;
    return `${path} C ${controlX.toFixed(2)} ${previous.y.toFixed(2)}, ${controlX.toFixed(2)} ${point.y.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }, '');
  const area = `${line} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;

  return { line, area, lastPoint: points[points.length - 1] };
}

function MetricSparkline({ values }) {
  const { line, area, lastPoint } = buildSparkline(values);

  return (
    <svg className="wa-skin-sparkline" viewBox="0 0 168 42" preserveAspectRatio="none" aria-label="Tren pengeluaran harian">
      <path className="wa-skin-sparkline-area" d={area} />
      <path className="wa-skin-sparkline-line" d={line} />
      <circle className="wa-skin-sparkline-dot" cx={lastPoint.x} cy={lastPoint.y} r="2.4" />
    </svg>
  );
}

function MetricBars({ values }) {
  const max = Math.max(...values, 1);
  return (
    <div className="wa-skin-mini-bars" aria-label="Jumlah transaksi harian">
      {values.slice(0, 18).map((count, index) => (
        <i key={index} style={{ height: `${Math.max(12, Math.round((count / max) * 100))}%` }} />
      ))}
    </div>
  );
}

function MetricCard({ label, value, icon, tone, sparkline, bars, detail }) {
  return (
    <article className="wa-skin-metric-card">
      <div>
        <span>{label}</span>
        {icon}
      </div>
      <strong className={tone || ''}>{value}</strong>
      {sparkline ? <MetricSparkline values={sparkline} /> : null}
      {bars ? <MetricBars values={bars} /> : null}
      <small>{detail}</small>
    </article>
  );
}

function WalletMoveCard({ title, icon, draft, setDraft, bankWallets, target, available, invalid, onSubmit }) {
  return (
    <article className="wa-skin-move-card">
      <span>{icon}</span>
      <strong>{title}</strong>
      <label>Sumber<select value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })}>{bankWallets.map((wallet) => <option key={wallet.id}>{wallet.id}</option>)}</select></label>
      <label>Nominal<input type="number" min="0" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} /></label>
      <small className={invalid ? 'warning' : ''}>{draft.source} berkurang, {target} bertambah. Tersedia {money(available)}</small>
      <button type="button" className="wa-skin-btn filled wide" disabled={invalid} onClick={onSubmit}>Proses</button>
    </article>
  );
}

function InfoCard({ label, title, body, icon, action }) {
  return (
    <article className="wa-skin-card wa-skin-info-card">
      <span>{icon}</span>
      <div>
        <small className="wa-skin-label">{label}</small>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
      {action ? (
        <button type="button" className="wa-skin-btn tonal" onClick={action}>Cek</button>
      ) : (
        <span className="wa-skin-status">Aktif</span>
      )}
    </article>
  );
}

function EmptyState({ title, body }) {
  return (
    <div className="wa-skin-empty">
      <ReceiptText size={28} />
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="wa-skin-modal-backdrop" onClick={onClose}>
      <section className="wa-skin-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button type="button" aria-label="Tutup dialog" onClick={onClose}><X size={17} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}
