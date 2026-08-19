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
  Mail,
  MoreVertical,
  Plus,
  ReceiptText,
  Search,
  ShoppingCart,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import Header from '../components/Header';
import { useAuth } from '../context/useAuth';
import { addExpense, deleteExpense, listExpenses } from '../lib/firestore';
import { getBackendSettings, listRecaps } from '../lib/whatsapp-api';

const currency = (amount) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(Number(amount || 0));

const today = () => dateInputValue(new Date());
const emptyForm = { merchant: '', category: 'Lainnya', amount: '', date: today(), payment_channel: 'Cash', type: 'expense' };

const CATEGORY_ICONS = {
  Belanja: '🛒',
  Shopping: '🛒',
  Tagihan: '💳',
  Utilities: '💳',
  Makan: '🍜',
  'Food & Drink': '🍜',
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

function getCategoryIcon(cat) {
  return CATEGORY_ICONS[cat] || '🏷️';
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

function formatDateOnly(value) {
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

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
  return String(item.type || 'expense').toLowerCase() === 'income' ? 'income' : 'expense';
}

function merchantInitial(merchant) {
  return String(merchant || '?').trim().slice(0, 1).toUpperCase();
}

export default function Expenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [startDate, setStartDate] = useState(() => dateInputValue(startOfMonth()));
  const [endDate, setEndDate] = useState(() => dateInputValue(endOfMonth()));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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
        }
      }
    } catch (error) {
      setNotice(error.message || 'Data Firestore belum dapat dibaca.');
    } finally {
      setBusy(false);
    }
  }, [user.uid, recapFilter]);

  useEffect(() => { load(); }, [load]);

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

  // Categories breakdown for top grid cards
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

  const exportCsv = () => {
    const header = ['Tanggal', 'Deskripsi', 'Kategori', 'Tipe', 'Nominal', 'Rekening', 'Sumber', 'Status'];
    const rows = filtered.map((item) => [
      formatDateTime(getDate(item)),
      getMerchant(item),
      getCategory(item),
      getType(item) === 'income' ? 'Pemasukan' : 'Pengeluaran',
      item.amount || 0,
      getAccount(item),
      getSource(item),
      getStatus(item),
    ]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `wa-finance-transaksi-${dateInputValue(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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

      {/* ════ 1. TOP SUMMARY BAR CARD (WITH AUTHENTIC BANNER BG) ════ */}
      <div className="tx-summary-bar-card">
        <div className="tx-export-pills">
          <button className="btn-export-outline" onClick={exportPdf}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d93829" strokeWidth="2.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            PDF
          </button>
          <button className="btn-export-outline" onClick={exportCsv}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2d7a18" strokeWidth="2.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Excel
          </button>
        </div>

        <div className="tx-stats-trio">
          <div className="tx-stat-cell-item">
            <div className="tx-stat-cell-val">{busy ? '...' : currency(averageExpense)}</div>
            <div className="tx-stat-cell-lbl">Rata-rata 1 catatan</div>
          </div>
          <div className="tx-stat-cell-item">
            <div className="tx-stat-cell-val">{busy ? '...' : `${activeDaysCount} hari aktif`}</div>
            <div className="tx-stat-cell-lbl">Hari aktif</div>
          </div>
          <div className="tx-stat-cell-item">
            <div className="tx-stat-cell-val">{busy ? '...' : `${totalCategoriesCount} kategori`}</div>
            <div className="tx-stat-cell-lbl">Total kategori</div>
          </div>
        </div>
      </div>

      {/* ════ 2. CATEGORY SUMMARY CARDS GRID ════ */}
      <div className="tx-category-cards-grid">
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
              <div className="tx-cat-icon">{getCategoryIcon(cat.name)}</div>
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
                <th style={{ textAlign: 'right', width: '75px' }}>ACTIONS</th>
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
                      {isIncome ? (
                        <span className="badge-type-green">
                          <ArrowUp width="11" height="11" /> Pemasukan
                        </span>
                      ) : (
                        <span className="badge-type-red">
                          <ArrowDown width="11" height="11" /> Pengeluaran
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>
                      <span className={isIncome ? 'text-[#2d7a18] dark:text-[#76d446]' : 'text-slate-900 dark:text-slate-100'}>
                        {isIncome ? `+ ${currency(item.amount)}` : `- ${currency(item.amount)}`}
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
                      <button
                        className="table-action-icon text-red-500 hover:text-red-700"
                        title="Hapus transaksi"
                        onClick={() => remove(item.id)}
                      >
                        <Trash2 width="14" height="14" />
                      </button>
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
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Tipe</label>
                <div className="grid grid-cols-2 gap-2">
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
                    onClick={() => setForm((c) => ({ ...c, type: 'income' }))}
                    className={`rounded-xl py-2 text-xs font-bold transition ${
                      form.type === 'income'
                        ? 'bg-emerald-600 text-white'
                        : 'border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    ↗ Pemasukan
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
                    {['Belanja', 'Tagihan', 'Makan', 'Keluarga', 'Rumah', 'Hiburan', 'Transportasi', 'Perawatan', 'Sosial', 'Kesehatan', 'Gaji', 'Lainnya'].map((c) => (
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
