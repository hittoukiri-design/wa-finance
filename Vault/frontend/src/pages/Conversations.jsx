import React, { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Filter,
  Link2,
  MessageCircle,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Search,
  Send,
  Smartphone,
  Sparkles,
  Tag,
} from 'lucide-react';
import Header from '../components/Header';
import { useAuth } from '../context/useAuth';
import { listConversations } from '../lib/firestore';
import { getBackendSettings, saveJidMapping } from '../lib/whatsapp-api';

function clock(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(value);
}

function dateLabel(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(value);
}

function normalizeLid(value = '') {
  return String(value).trim().toLowerCase();
}

function displayPhone(value = '', mappings = {}) {
  const raw = String(value || 'WhatsApp').trim();
  if (!raw.endsWith('@lid')) return raw;
  return mappings[normalizeLid(raw)] || raw;
}

function parseAmount(message = '') {
  const matches = String(message).match(/\d[\d.,]*/g);
  if (!matches?.length) return null;
  const raw = matches[matches.length - 1].replace(/[.,]/g, '');
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function parseAccount(message = '') {
  const text = String(message);
  const fromMatch = text.match(/\b(?:dari|rekening|via|pakai)\s+([a-zA-Z0-9._-]+)/i);
  if (fromMatch?.[1]) return fromMatch[1].toUpperCase();
  const known = text.match(/\b(BCA|BRI|BNI|MANDIRI|GOPAY|OVO|DANA|CASH)\b/i);
  return known?.[1]?.toUpperCase() || 'Cash';
}

function parseCategory(message = '') {
  const text = String(message).toLowerCase();
  if (/makan|kopi|coffee|minum|resto|nasi|bakso|ayam/.test(text)) return 'Food & Drink';
  if (/bensin|grab|gojek|taxi|tol|parkir|transport/.test(text)) return 'Transport';
  if (/listrik|air|internet|pulsa|token/.test(text)) return 'Utilities';
  if (/belanja|market|shop|mall/.test(text)) return 'Shopping';
  if (/gaji|bonus|terima|income/.test(text)) return 'Income';
  return 'Lainnya';
}

function currency(value) {
  if (!value) return '-';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
}

function isExpenseLike(message = '') {
  return Boolean(parseAmount(message)) && !/^help$/i.test(String(message).trim());
}

function WhatsAppAvatar() {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-green-600 text-white shadow-md">
      <MessageCircle className="h-5 w-5 fill-white/20" />
    </span>
  );
}

function StatusBadge({ children, tone = 'emerald' }) {
  const tones = {
    emerald: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
    amber: 'border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300',
    slate: 'border-[#dcebd0] bg-[#eef7e6] text-slate-600 dark:border-[#263e1d] dark:bg-[#162718] dark:text-slate-400',
  };
  return <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${tones[tone] || tones.slate}`}>{children}</span>;
}

function TimelineItem({ icon: Icon, title, detail, tone = 'emerald' }) {
  const tones = {
    emerald: 'bg-[#d8f0c4] text-[#1a5611] dark:bg-[#1b3816] dark:text-[#76d446]',
    blue: 'bg-sky-500/20 text-sky-700 dark:text-sky-300',
    violet: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
  };
  return (
    <div className="relative flex gap-3 pb-5 last:pb-0">
      <span className="absolute left-3.5 top-8 h-[calc(100%-28px)] w-px bg-[#dcebd0] dark:bg-[#243e1c] last:hidden" />
      <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tones[tone] || tones.emerald}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold text-[#0e2a07] dark:text-[#f3ffe9]">{title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-[#436d32] dark:text-[#8bb37a]">{detail}</p>
      </div>
    </div>
  );
}

export default function Conversations() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [jidMappings, setJidMappings] = useState({});
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [busy, setBusy] = useState(true);
  const [selectedPhone, setSelectedPhone] = useState('');
  const [notice, setNotice] = useState('');
  const [mappingPhone, setMappingPhone] = useState('');
  const [mappingBusy, setMappingBusy] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [items, settings] = await Promise.all([
          listConversations(user.uid),
          getBackendSettings().catch(() => ({ jid_display_mappings: {} })),
        ]);
        if (!active) return;
        const nextMappings = settings.jid_display_mappings || {};
        setMessages(items);
        setJidMappings(nextMappings);
        setSelectedPhone((current) => current || displayPhone(items[0]?.phone_number, nextMappings) || '');
        setNotice('');
      } catch (error) {
        if (active) setNotice(error.message || 'Percakapan belum dapat dibaca.');
      } finally {
        if (active) setBusy(false);
      }
    };

    load();
    const timer = window.setInterval(load, 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user.uid]);

  const threads = useMemo(() => {
    const grouped = new Map();
    messages.forEach((item) => {
      const rawPhone = item.phone_number || item.from || 'WhatsApp';
      const phone = displayPhone(rawPhone, jidMappings);
      if (!grouped.has(phone)) grouped.set(phone, { phone, rawPhone, items: [] });
      const group = grouped.get(phone);
      if (String(group.rawPhone || '').endsWith('@lid') && !String(rawPhone || '').endsWith('@lid')) {
        group.rawPhone = rawPhone;
      }
      group.items.push({ ...item, display_phone: phone, raw_phone: rawPhone });
    });

    return [...grouped.values()]
      .map((thread) => {
        const sorted = [...thread.items].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        const userMessages = sorted.filter((item) => !item.is_from_me);
        const expenseCount = userMessages.filter((item) => isExpenseLike(item.message)).length;
        const latestUserExpense = [...userMessages].reverse().find((item) => isExpenseLike(item.message));
        const status = expenseCount ? 'new' : 'reviewed';
        return {
          phone: thread.phone,
          rawPhone: thread.rawPhone,
          items: sorted,
          latest: sorted[sorted.length - 1],
          first: sorted[0],
          userMessages,
          expenseCount,
          latestUserExpense,
          status,
        };
      })
      .filter((thread) => {
        const matchesSearch = thread.phone.toLowerCase().includes(search.toLowerCase())
          || thread.latest?.message?.toLowerCase().includes(search.toLowerCase());
        if (!matchesSearch) return false;
        if (filterMode === 'unread') return thread.latest && !thread.latest.is_from_me;
        if (filterMode === 'review') return thread.expenseCount > 0;
        return true;
      })
      .sort((a, b) => (b.latest?.timestamp || 0) - (a.latest?.timestamp || 0));
  }, [messages, jidMappings, search, filterMode]);

  const selected = threads.find((thread) => thread.phone === selectedPhone) || threads[0];
  const selectedNeedsMapping = Boolean(selected?.rawPhone?.endsWith('@lid') && selected?.phone?.endsWith('@lid'));
  const selectedExpense = selected?.latestUserExpense;
  const selectedAmount = parseAmount(selectedExpense?.message);
  const selectedCategory = parseCategory(selectedExpense?.message);
  const selectedAccount = parseAccount(selectedExpense?.message);
  const selectedDate = selectedExpense?.timestamp || selected?.latest?.timestamp || selected?.first?.timestamp;

  useEffect(() => {
    if (threads.length && !threads.some((thread) => thread.phone === selectedPhone)) {
      setSelectedPhone(threads[0].phone);
    }
  }, [selectedPhone, threads]);

  const saveMapping = async () => {
    if (!selected?.rawPhone) return;
    setMappingBusy(true);
    try {
      const result = await saveJidMapping(selected.rawPhone, mappingPhone);
      setJidMappings((current) => ({
        ...current,
        [normalizeLid(selected.rawPhone)]: mappingPhone.replace(/\D/g, ''),
      }));
      setNotice(`Mapping tersimpan: ${selected.rawPhone} → ${result.target_jid}.`);
      setMappingPhone('');
    } catch (error) {
      setNotice(error.message || 'Mapping nomor gagal disimpan.');
    } finally {
      setMappingBusy(false);
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-[1540px] flex-col space-y-6">
      <Header
        title="Format Balasan & Chat"
        subtitle="Riwayat percakapan WhatsApp antara Anda dan bot, diperbarui otomatis secara real-time."
      />

      {notice && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          {notice}
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[330px_minmax(0,1fr)_300px]">
        
        {/* Contact List Pane */}
        <section className="flex min-h-[560px] flex-col overflow-hidden rounded-[22px] border border-[#dcebd0] bg-[#eef7e6] shadow-sm dark:border-[#243e1c] dark:bg-[#121e14]">
          <div className="border-b border-[#dcebd0] p-4 dark:border-[#243e1c]">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari chat..."
                className="w-full rounded-full border border-[#dcebd0] bg-white py-2 pl-9 pr-3 text-xs font-bold text-[#0e2a07] outline-none shadow-sm transition focus:border-[#76d446] dark:border-[#263e1d] dark:bg-[#162718] dark:text-[#f3ffe9]"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[
                ['all', 'Semua'],
                ['unread', 'Belum Dibaca'],
                ['review', 'Perlu Review'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilterMode(key)}
                  className={`rounded-full px-3 py-1 text-[11px] font-black transition ${
                    filterMode === key
                      ? 'bg-[#1a5611] text-white dark:bg-[#76d446] dark:text-[#0d170a]'
                      : 'border border-[#dcebd0] bg-white text-slate-600 hover:bg-[#e4f2da] dark:border-[#263e1d] dark:bg-[#162718] dark:text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {threads.map((thread) => (
              <button
                key={thread.phone}
                onClick={() => setSelectedPhone(thread.phone)}
                className={`flex w-full gap-3 rounded-2xl border p-3 text-left transition ${
                  selected?.phone === thread.phone
                    ? 'border-[#76d446] bg-[#d8f0c4] dark:border-[#76d446] dark:bg-[#1b3816]'
                    : 'border-transparent bg-white/60 hover:bg-white dark:bg-white/5 dark:hover:bg-white/10'
                }`}
              >
                <WhatsAppAvatar />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <strong className="truncate text-xs font-black text-[#0e2a07] dark:text-[#f3ffe9]">{thread.phone}</strong>
                    <small className="shrink-0 text-[10px] text-slate-500 dark:text-slate-400">{clock(thread.latest?.timestamp)}</small>
                  </span>
                  <small className="mt-1 block truncate text-[11px] font-semibold text-[#436d32] dark:text-[#8bb37a]">
                    {thread.latest?.is_from_me ? 'Bot: ' : 'User: '}
                    {thread.latest?.message || ''}
                  </small>
                  <span className="mt-2 flex items-center justify-end">
                    {thread.status === 'new' ? <StatusBadge>New</StatusBadge> : <StatusBadge tone="slate">Reviewed</StatusBadge>}
                  </span>
                </span>
              </button>
            ))}

            {!busy && !threads.length && (
              <div className="p-8 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">Belum ada percakapan.</div>
            )}
          </div>
          <div className="border-t border-[#dcebd0] px-4 py-2.5 text-[10px] font-bold text-slate-500 dark:border-[#243e1c] dark:text-slate-400">
            Menampilkan {threads.length} percakapan
          </div>
        </section>

        {/* Chat Message Pane */}
        <section className="flex min-h-[560px] flex-col overflow-hidden rounded-[22px] border border-[#dcebd0] bg-[#eef7e6] shadow-sm dark:border-[#243e1c] dark:bg-[#121e14]">
          {selected ? (
            <>
              <div className="flex items-center justify-between gap-4 border-b border-[#dcebd0] p-4 dark:border-[#243e1c]">
                <div className="flex min-w-0 items-center gap-3">
                  <WhatsAppAvatar />
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-black text-[#0e2a07] dark:text-[#f3ffe9]">{selected.phone}</h2>
                    <p className="text-[11px] font-bold text-[#1a5611] dark:text-[#76d446]">WhatsApp Bot Connected</p>
                  </div>
                </div>
              </div>

              {selectedNeedsMapping && (
                <div className="border-b border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-200">
                  <p className="font-bold">Mapping nomor pengirim diperlukan</p>
                  <p className="mt-0.5 text-[11px]">WhatsApp mengirim chat ini sebagai <span className="font-mono font-bold">{selected.rawPhone}</span>.</p>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={mappingPhone}
                      onChange={(event) => setMappingPhone(event.target.value)}
                      placeholder="6281234567890"
                      className="rounded-xl border border-amber-400/30 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 outline-none dark:bg-[#162718] dark:text-white"
                    />
                    <button
                      type="button"
                      disabled={mappingBusy || !mappingPhone.trim()}
                      onClick={saveMapping}
                      className="rounded-xl bg-amber-500 px-4 py-1.5 text-xs font-black text-slate-950"
                    >
                      Simpan
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
                {selectedDate && (
                  <div className="self-center rounded-full bg-[#d8f0c4] px-4 py-1 text-[10px] font-black uppercase tracking-wider text-[#1a5611] dark:bg-[#1b3816] dark:text-[#76d446]">
                    {dateLabel(selectedDate)}
                  </div>
                )}
                {selected.items.map((item) => {
                  const isBot = item.is_from_me;
                  return (
                    <div
                      key={item.id || item.timestamp}
                      className={`flex flex-col max-w-[80%] ${isBot ? 'self-end items-end' : 'self-start items-start'}`}
                    >
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-xs font-medium shadow-sm leading-relaxed ${
                          isBot
                            ? 'bg-[#1a5611] text-white dark:bg-[#76d446] dark:text-[#0d170a]'
                            : 'border border-[#dcebd0] bg-white text-[#0e2a07] dark:border-[#263e1d] dark:bg-[#18291a] dark:text-[#f3ffe9]'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{item.message}</p>
                      </div>
                      <span className="mt-1 text-[9.5px] font-bold text-slate-400">
                        {clock(item.timestamp)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-xs font-bold text-slate-400">
              Pilih salah satu percakapan di sebelah kiri.
            </div>
          )}
        </section>

        {/* Transaction Extraction Preview Pane */}
        <section className="flex min-h-[560px] flex-col rounded-[22px] border border-[#dcebd0] bg-[#eef7e6] p-5 shadow-sm dark:border-[#243e1c] dark:bg-[#121e14]">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#1a5611] dark:text-[#76d446]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-[#358219] dark:text-[#76d446]">
              Ekstraksi Transaksi
            </h3>
          </div>

          {selectedExpense ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#dcebd0] bg-white/80 p-4 shadow-sm dark:border-[#263e1d] dark:bg-[#162718]">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pesan Asli</span>
                <p className="mt-1 text-xs font-bold text-[#0e2a07] dark:text-[#f3ffe9] italic">
                  “{selectedExpense.message}”
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <span className="text-[10px] font-black uppercase text-[#358219] dark:text-[#76d446]">Nominal Terdeteksi</span>
                  <div className="text-xl font-black text-[#1a5611] dark:text-[#76d446]">{currency(selectedAmount)}</div>
                </div>

                <div>
                  <span className="text-[10px] font-black uppercase text-[#358219] dark:text-[#76d446]">Kategori Otomatis</span>
                  <div className="text-xs font-black text-[#0e2a07] dark:text-[#f3ffe9]">{selectedCategory}</div>
                </div>

                <div>
                  <span className="text-[10px] font-black uppercase text-[#358219] dark:text-[#76d446]">Sumber Dompet</span>
                  <div className="text-xs font-black text-[#0e2a07] dark:text-[#f3ffe9]">{selectedAccount}</div>
                </div>
              </div>

              <div className="mt-4 border-t border-[#dcebd0] pt-4 dark:border-[#243e1c]">
                <TimelineItem icon={CheckCircle2} title="Terekstraksi AI" detail="Format transaksi valid dan tersimpan di database." />
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-center text-xs font-semibold text-slate-400">
              Belum ada transaksi terdeteksi pada chat ini.
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
