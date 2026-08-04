import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, LockKeyhole, RefreshCw, Send, ShieldCheck, Smartphone, User, XCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { connectWhatsApp, disconnectWhatsApp, getWhatsAppStatus, sendWhatsAppMessage } from '../lib/whatsapp-api';

// This App was build by Chris Tambayong - Fumakill4

export default function WhatsApp() {
  const [status, setStatus] = useState({ status: 'checking' });
  const [busy, setBusy] = useState(false);
  const [quickTo, setQuickTo] = useState('');
  const [quickMsg, setQuickMsg] = useState('');
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickNotice, setQuickNotice] = useState(null);
  const connectingRef = useRef(false);

  const triggerConnect = useCallback(async () => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    try { await connectWhatsApp(); } catch (_) {}
    finally { connectingRef.current = false; }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const next = await getWhatsAppStatus();
        if (cancelled) return;
        setStatus(next);
        if (next.status === 'disconnected') triggerConnect();
      } catch (_) {
        if (!cancelled) setStatus({ status: 'offline' });
      }
    };
    poll();
    const timer = window.setInterval(poll, 2500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [triggerConnect]);

  const disconnect = async () => {
    setBusy(true);
    try { await disconnectWhatsApp(); setStatus({ status: 'disconnected' }); }
    finally { setBusy(false); }
  };

  const handleQuickSend = async (e) => {
    e.preventDefault();
    if (!quickTo.trim() || !quickMsg.trim()) return;
    setQuickBusy(true);
    setQuickNotice(null);
    try {
      await sendWhatsAppMessage(quickTo.trim(), quickMsg.trim());
      setQuickNotice({ type: 'success', text: '✅ Pesan berhasil dikirim!' });
      setQuickMsg('');
    } catch (err) {
      setQuickNotice({ type: 'error', text: err.message });
    } finally {
      setQuickBusy(false);
    }
  };

  const isConnected = status.status === 'connected';
  const hasQr = Boolean(status.qr);

  const badgeClass = isConnected
    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
    : status.status === 'offline'
      ? 'border-red-400/30 bg-red-500/10 text-red-200'
      : hasQr
        ? 'border-amber-400/30 bg-amber-500/10 text-amber-200'
        : 'border-slate-700 bg-slate-800/60 text-slate-400';

  let qrVisual;
  if (hasQr) {
    qrVisual = (
      <>
        <div className="rounded-2xl bg-white p-4 shadow-2xl">
          <QRCodeSVG value={status.qr} size={210} />
        </div>
        <h3 className="mt-5 text-lg font-semibold text-white">Scan dengan WhatsApp</h3>
        <p className="mt-2 max-w-xs text-center text-sm text-slate-400">
          Buka WhatsApp → <strong className="text-white">Linked Devices</strong> → Tautkan Perangkat → Scan QR ini.
        </p>
        <p className="mt-1 text-xs text-slate-500">QR berubah otomatis jika kedaluwarsa.</p>
      </>
    );
  } else if (isConnected) {
    qrVisual = (
      <>
        <CheckCircle2 className="h-20 w-20 text-emerald-400" />
        <h3 className="mt-5 text-lg font-semibold text-white">WhatsApp Terhubung</h3>
        <p className="mt-2 text-center text-sm text-slate-400">Bot aktif dan siap menerima pesan.</p>
        <button
          onClick={disconnect}
          disabled={busy}
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-6 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
        >
          <XCircle className="h-4 w-4" />
          {busy ? 'Memutus...' : 'Disconnect'}
        </button>
      </>
    );
  } else {
    qrVisual = (
      <>
        <RefreshCw className="h-12 w-12 animate-spin text-slate-600" />
        <p className="mt-4 text-sm text-slate-400">Menyiapkan QR Code…</p>
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <header className="mb-7">
        <h1 className="text-2xl font-bold text-white">WhatsApp Connection</h1>
        <p className="mt-1 text-sm text-slate-400">QR muncul otomatis. Scan dengan WhatsApp → Linked Devices → Tautkan Perangkat.</p>
      </header>

      <section className="mb-6 flex flex-col gap-3 rounded-xl border border-emerald-500/15 bg-[#0b141c] px-5 py-4 text-sm text-slate-300 md:flex-row md:items-center md:justify-between">
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

      <div className="grid gap-6 lg:grid-cols-2">

        {/* LEFT — Quick Send */}
        <section className="rounded-[28px] border border-slate-800 bg-[#0b141c] p-8 shadow-xl">
          {/* Header */}
          <div className="mb-7 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
              <Send className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-bold text-white">Quick Send</h2>
          </div>

          {quickNotice && (
            <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
              quickNotice.type === 'success'
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                : 'border-red-500/25 bg-red-500/10 text-red-300'
            }`}>
              {quickNotice.text}
            </div>
          )}

          <form onSubmit={handleQuickSend} className="flex flex-col gap-5">
            {/* Recipient */}
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Recipient
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={quickTo}
                  onChange={e => setQuickTo(e.target.value)}
                  placeholder="628123456789"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 py-3.5 pl-11 pr-4 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"
                />
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Message
              </label>
              <textarea
                rows={5}
                value={quickMsg}
                onChange={e => setQuickMsg(e.target.value)}
                placeholder="Type something..."
                className="w-full resize-none rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3.5 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"
              />
            </div>

            {/* Send Button */}
            <button
              type="submit"
              disabled={quickBusy || !isConnected}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:from-violet-500 hover:to-violet-400 disabled:opacity-40 disabled:shadow-none"
            >
              <Send className="h-4 w-4" />
              {quickBusy ? 'Mengirim...' : 'Send Now'}
            </button>

            {!isConnected && (
              <p className="text-center text-xs text-slate-600">
                Hubungkan WhatsApp terlebih dahulu untuk menggunakan Quick Send.
              </p>
            )}
          </form>
        </section>

        {/* RIGHT — QR Code */}
        <section className="flex min-h-[460px] flex-col items-center justify-center rounded-[28px] border border-slate-800 bg-[#0b141c] p-8 text-center shadow-xl">
          <div className="mb-4 flex w-full items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Smartphone className="h-4 w-4" />
              WhatsApp Link
            </div>
            <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${badgeClass}`}>
              {status.status}
            </span>
          </div>
          {qrVisual}
        </section>

      </div>
    </div>
  );
}
