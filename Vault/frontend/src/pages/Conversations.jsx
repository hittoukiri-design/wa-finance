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
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-green-600 text-white shadow-[0_0_24px_rgba(34,197,94,0.22)] ring-2 ring-white/70">
      <MessageCircle className="h-7 w-7 fill-white/20" />
    </span>
  );
}

function StatusBadge({ children, tone = 'emerald' }) {
  const tones = {
    emerald: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
    amber: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
    slate: 'border-slate-700 bg-slate-800/70 text-slate-300',
  };
  return <span className={`rounded-md border px-2 py-1 text-[10px] font-bold ${tones[tone] || tones.slate}`}>{children}</span>;
}

function TimelineItem({ icon: Icon, title, detail, tone = 'emerald' }) {
  const tones = {
    emerald: 'bg-emerald-500/20 text-emerald-300',
    blue: 'bg-sky-500/20 text-sky-300',
    violet: 'bg-violet-500/20 text-violet-300',
  };
  return (
    <div className="relative flex gap-3 pb-6 last:pb-0">
      <span className="absolute left-4 top-9 h-[calc(100%-36px)] w-px bg-slate-800 last:hidden" />
      <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tones[tone] || tones.emerald}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-100">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{detail}</p>
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
    <div className="mx-auto flex h-full max-w-[1540px] flex-col">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">Conversations</h1>
        <p className="mt-1 text-sm text-slate-400">Chat WhatsApp antara Anda dan bot, diperbarui otomatis.</p>
      </header>

      {notice && (
        <div className="mb-5 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {notice}
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[335px_minmax(0,1fr)_285px]">
        <section className="flex min-h-[560px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#0b141c] shadow-[0_18px_50px_rgba(0,0,0,0.16)]">
          <div className="border-b border-slate-800 p-4">
            <div className="flex gap-3">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search conversations..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/40 py-2.5 pl-9 pr-3 text-sm text-white outline-none transition focus:border-emerald-400"
                />
              </div>
              <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-950/40 text-slate-300">
                <Filter className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                ['all', 'All'],
                ['unread', 'Unread'],
                ['review', 'Needs Review'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilterMode(key)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${filterMode === key ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300' : 'border-slate-700 bg-[#101b26] text-slate-400 hover:text-white'}`}
                >
                  {label}
                </button>
              ))}
              <button type="button" className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-[#101b26] px-3 py-1.5 text-xs text-slate-400">
                Filter <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {threads.map((thread) => (
              <button
                key={thread.phone}
                onClick={() => setSelectedPhone(thread.phone)}
                className={`mb-2 flex w-full gap-3 rounded-xl border p-3 text-left transition ${selected?.phone === thread.phone ? 'border-emerald-500/70 bg-emerald-500/10' : 'border-transparent hover:border-slate-800 hover:bg-slate-900/60'}`}
              >
                <WhatsAppAvatar />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <strong className="truncate text-sm text-slate-100">{thread.phone}</strong>
                    <small className="shrink-0 text-xs text-slate-500">{clock(thread.latest?.timestamp)}</small>
                  </span>
                  <small className="mt-1 block truncate text-xs text-slate-400">
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
              <div className="p-8 text-center text-sm text-slate-500">Belum ada percakapan.</div>
            )}
          </div>
          <div className="border-t border-slate-800 px-4 py-3 text-xs text-slate-500">
            Showing {threads.length ? `1 to ${threads.length}` : '0'} of {threads.length} conversations
          </div>
        </section>

        <section className="flex min-h-[560px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#0b141c] shadow-[0_18px_50px_rgba(0,0,0,0.16)]">
          {selected ? (
            <>
              <div className="flex items-center justify-between gap-4 border-b border-slate-800 p-5">
                <div className="flex min-w-0 items-center gap-3">
                  <WhatsAppAvatar />
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-white">{selected.phone}</h2>
                    <p className="text-xs text-emerald-400">WhatsApp bot</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-800 bg-[#101b26] text-slate-300"><Search className="h-4 w-4" /></button>
                  <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-800 bg-[#101b26] text-slate-300"><Tag className="h-4 w-4" /></button>
                  <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-800 bg-[#101b26] text-slate-300"><MoreVertical className="h-4 w-4" /></button>
                </div>
              </div>

              {selectedNeedsMapping && (
                <div className="border-b border-amber-500/20 bg-amber-500/10 p-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-semibold text-amber-200">
                        <Link2 className="h-4 w-4" />
                        Mapping nomor pengirim diperlukan
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-amber-100/70">
                        WhatsApp mengirim chat ini sebagai <span className="font-mono">{selected.rawPhone}</span>, bukan nomor HP.
                        Isi nomor HP pribadi pengirim agar bot bisa membalas ke WhatsApp.
                      </p>
                    </div>
                    <div className="flex w-full gap-2 xl:w-[430px]">
                      <input
                        value={mappingPhone}
                        onChange={(event) => setMappingPhone(event.target.value)}
                        placeholder="6281234567890"
                        className="min-w-0 flex-1 rounded-lg border border-amber-400/30 bg-[#09131c] px-3 py-2 text-sm text-white outline-none focus:border-amber-300"
                      />
                      <button
                        type="button"
                        disabled={mappingBusy || !mappingPhone.trim()}
                        onClick={saveMapping}
                        className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"
                      >
                        {mappingBusy ? '...' : 'Simpan'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-1 flex-col gap-5 overflow-y-auto bg-[radial-gradient(circle_at_80%_12%,rgba(16,185,129,.08),transparent_28%)] p-6">
                {selectedDate && (
                  <div className="self-center rounded-full bg-slate-800/70 px-4 py-1 text-xs text-slate-400">{dateLabel(selectedDate)}</div>
                )}
                {selected.items.map((item) => {
                  const extractedAmount = !item.is_from_me ? parseAmount(item.message) : null;
                  const extractedCategory = !item.is_from_me ? parseCategory(item.message) : null;
                  const extractedAccount = !item.is_from_me ? parseAccount(item.message) : null;
                  return (
                    <div key={item.id} className={`flex ${item.is_from_me ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[78%] rounded-2xl p-4 text-sm shadow-lg ${item.is_from_me ? 'rounded-br-sm bg-emerald-500 text-[#062617]' : 'rounded-bl-sm border border-slate-800 bg-[#111a23] text-slate-200'}`}>
                        <p className="whitespace-pre-wrap leading-relaxed">{item.message}</p>
                        {!item.is_from_me && extractedAmount && (
                          <div className="mt-5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
                            <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                              <Sparkles className="h-4 w-4 text-violet-300" />
                              I've extracted the expense details below.
                            </p>
                            <div className="mt-4 grid gap-4 rounded-xl border border-slate-800 bg-[#0b141c] p-4 md:grid-cols-3">
                              <div><small className="text-slate-500">Category</small><p className="mt-1 font-semibold text-white">{extractedCategory}</p></div>
                              <div><small className="text-slate-500">Amount</small><p className="mt-1 font-semibold text-white">{currency(extractedAmount)}</p></div>
                              <div><small className="text-slate-500">Account</small><p className="mt-1 font-semibold text-white">{extractedAccount}</p></div>
                            </div>
                          </div>
                        )}
                        <p className={`mt-2 text-right text-[10px] ${item.is_from_me ? 'text-emerald-950/70' : 'text-slate-500'}`}>
                          {clock(item.timestamp)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-slate-800 p-4">
                <div className="flex items-center gap-2">
                  <button type="button" className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-800 bg-[#101b26] text-slate-300"><Paperclip className="h-5 w-5" /></button>
                  <div className="flex h-12 min-w-0 flex-1 items-center rounded-xl border border-slate-800 bg-slate-950/40 px-4 text-sm text-slate-500">Type a message...</div>
                  <button type="button" className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300"><Send className="h-5 w-5" /></button>
                </div>
                <p className="mt-3 text-center text-xs text-slate-600">All messages are encrypted end-to-end.</p>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <Smartphone className="h-14 w-14 text-slate-700" />
              <h2 className="mt-5 text-lg font-semibold text-white">Belum ada percakapan</h2>
              <p className="mt-2 max-w-sm text-sm text-slate-500">
                Hubungkan WhatsApp. Pesan Anda dan balasan bot akan muncul seperti WhatsApp Web.
              </p>
            </div>
          )}
        </section>

        <aside className="hidden min-h-[560px] flex-col gap-4 xl:flex">
          <section className="rounded-xl border border-slate-800 bg-[#0b141c] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.16)]">
            <h2 className="text-base font-bold text-white">Conversation Details</h2>
            {selected ? (
              <div className="mt-5 space-y-4">
                <div><p className="text-xs text-slate-500">Phone Number</p><p className="mt-1 text-sm font-semibold text-white">{selected.phone}</p></div>
                <div><p className="text-xs text-slate-500">First Seen</p><p className="mt-1 text-sm font-semibold text-white">{dateLabel(selected.first?.timestamp) || '-'}</p></div>
                <div><p className="text-xs text-slate-500">Total Expenses</p><p className="mt-1 text-sm font-semibold text-white">{selected.expenseCount}</p></div>
                <div><p className="text-xs text-slate-500">Last Message</p><p className="mt-1 text-sm font-semibold text-white">{clock(selected.latest?.timestamp) || '-'}</p></div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Belum ada detail.</p>
            )}
          </section>

          <section className="flex-1 rounded-xl border border-slate-800 bg-[#0b141c] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.16)]">
            <h2 className="text-base font-bold text-white">Activity Timeline</h2>
            {selected ? (
              <div className="mt-6">
                <TimelineItem
                  icon={Sparkles}
                  title="Expense extracted"
                  detail={selectedExpense ? `${dateLabel(selectedExpense.timestamp)} ${clock(selectedExpense.timestamp)} · ${selectedCategory} • ${currency(selectedAmount)}` : 'Menunggu transaksi dari chat.'}
                  tone="violet"
                />
                <TimelineItem
                  icon={MessageSquare}
                  title="Message received"
                  detail={selected.latest ? `${dateLabel(selected.latest.timestamp)} ${clock(selected.latest.timestamp)} · ${selected.latest.message}` : 'Belum ada pesan.'}
                  tone="blue"
                />
                <TimelineItem
                  icon={CheckCircle2}
                  title="Expense saved"
                  detail={selectedExpense ? `${selectedCategory} siap dipantau dari dashboard.` : 'Belum ada transaksi tersimpan.'}
                  tone="emerald"
                />
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Timeline akan muncul setelah chat masuk.</p>
            )}
            <button type="button" className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#101b26] px-4 py-3 text-sm font-medium text-slate-300 transition hover:border-emerald-500/40 hover:text-white">
              View Full History <Clock3 className="h-4 w-4" />
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
