import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  LockKeyhole,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  User,
  XCircle,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Header from '../components/Header';
import {
  connectWhatsApp,
  disconnectWhatsApp,
  getWhatsAppStatus,
  sendWhatsAppMessage,
} from '../lib/whatsapp-api';

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
    ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
    : status.status === 'offline'
      ? 'border-red-500/30 bg-red-500/15 text-red-800 dark:text-red-300'
      : hasQr
        ? 'border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300'
        : 'border-[#dcebd0] bg-[#eef7e6] text-slate-600 dark:border-[#263e1d] dark:bg-[#162718] dark:text-slate-400';

  let qrVisual;
  if (hasQr) {
    qrVisual = (
      <>
        <div className="rounded-2xl bg-white p-4 shadow-xl border border-[#dcebd0] dark:border-none">
          <QRCodeSVG value={status.qr} size={210} />
        </div>
        <h3 className="mt-5 text-lg font-black text-[#0e2a07] dark:text-[#f3ffe9]">Scan dengan WhatsApp</h3>
        <p className="mt-2 max-w-xs text-center text-xs font-semibold text-[#436d32] dark:text-[#8bb37a]">
          Buka WhatsApp → <strong className="text-[#0e2a07] dark:text-white">Linked Devices</strong> → Tautkan Perangkat → Scan QR ini.
        </p>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">QR berubah otomatis jika kedaluwarsa.</p>
      </>
    );
  } else if (isConnected) {
    qrVisual = (
      <>
        <CheckCircle2 className="h-16 w-16 text-[#1a5611] dark:text-[#76d446]" />
        <h3 className="mt-4 text-lg font-black text-[#0e2a07] dark:text-[#f3ffe9]">WhatsApp Terhubung</h3>
        <p className="mt-1 text-center text-xs font-semibold text-[#436d32] dark:text-[#8bb37a]">Bot aktif dan siap menerima & mencatat transaksi.</p>
        <button
          onClick={disconnect}
          disabled={busy}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-6 py-2 text-xs font-bold text-red-700 hover:bg-red-500/20 dark:text-red-300 disabled:opacity-50"
        >
          <XCircle className="h-3.5 w-3.5" />
          {busy ? 'Memutus...' : 'Putuskan Koneksi'}
        </button>
      </>
    );
  } else {
    qrVisual = (
      <>
        <RefreshCw className="h-10 w-10 animate-spin text-[#358219] dark:text-[#76d446]" />
        <p className="mt-3 text-xs font-bold text-[#436d32] dark:text-[#8bb37a]">Menyiapkan QR Code…</p>
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1250px] space-y-6">
      <Header
        title="WhatsApp Gateway"
        subtitle="Kelola koneksi bot WhatsApp, scan QR, dan kirim pesan notifikasi transaksi."
      />

      <section className="flex flex-col gap-3 rounded-[22px] border border-[#dcebd0] bg-[#eef7e6] p-4 text-xs text-[#285814] dark:border-[#243e1c] dark:bg-[#121e14] dark:text-[#b8d8a7] md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1a5611] dark:text-[#76d446]" />
          <p>
            Koneksi aman dengan enkripsi end-to-end WhatsApp. Data pesan hanya diproses untuk ekstraksi transaksi keuangan Anda.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-black text-[#1a5611] dark:text-[#76d446]">
          <LockKeyhole className="h-3.5 w-3.5" /> Secure Baileys Bridge
        </span>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* LEFT — Quick Send */}
        <section className="rounded-[22px] border border-[#dcebd0] bg-[#eef7e6] p-6 shadow-sm dark:border-[#243e1c] dark:bg-[#121e14]">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#d8f0c4] text-[#1a5611] dark:bg-[#1b3816] dark:text-[#76d446]">
              <Send className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-black text-[#0e2a07] dark:text-[#f3ffe9]">Kirim Pesan Cepat</h2>
              <p className="text-[11px] text-[#436d32] dark:text-[#8bb37a]">Kirim pesan WhatsApp langsung dari dashboard</p>
            </div>
          </div>

          {quickNotice && (
            <div className={`mb-4 rounded-xl border px-4 py-2.5 text-xs font-bold ${
              quickNotice.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
                : 'border-red-500/30 bg-red-500/15 text-red-800 dark:text-red-200'
            }`}>
              {quickNotice.text}
            </div>
          )}

          <form onSubmit={handleQuickSend} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-[#358219] dark:text-[#76d446]">
                Nomor Tujuan WhatsApp
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={quickTo}
                  onChange={e => setQuickTo(e.target.value)}
                  placeholder="628123456789"
                  className="w-full rounded-xl border border-[#dcebd0] bg-white py-2.5 pl-10 pr-4 text-xs font-bold text-[#0e2a07] outline-none shadow-sm transition focus:border-[#76d446] dark:border-[#263e1d] dark:bg-[#162718] dark:text-[#f3ffe9]"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-[#358219] dark:text-[#76d446]">
                Isi Pesan
              </label>
              <textarea
                rows={4}
                value={quickMsg}
                onChange={e => setQuickMsg(e.target.value)}
                placeholder="Tulis pesan..."
                className="w-full resize-none rounded-xl border border-[#dcebd0] bg-white px-3.5 py-2.5 text-xs font-bold text-[#0e2a07] outline-none shadow-sm transition focus:border-[#76d446] dark:border-[#263e1d] dark:bg-[#162718] dark:text-[#f3ffe9]"
              />
            </div>

            <button
              type="submit"
              disabled={quickBusy || !isConnected}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1a5611] py-2.5 text-xs font-black text-white shadow-md transition hover:bg-[#123d0c] disabled:opacity-40 dark:bg-[#76d446] dark:text-[#0d170a]"
            >
              <Send className="h-3.5 w-3.5" />
              {quickBusy ? 'Mengirim...' : 'Kirim Sekarang'}
            </button>

            {!isConnected && (
              <p className="text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Hubungkan WhatsApp terlebih dahulu untuk menggunakan fitur kirim pesan.
              </p>
            )}
          </form>
        </section>

        {/* RIGHT — QR Code */}
        <section className="flex min-h-[400px] flex-col items-center justify-center rounded-[22px] border border-[#dcebd0] bg-[#eef7e6] p-6 text-center shadow-sm dark:border-[#243e1c] dark:bg-[#121e14]">
          <div className="mb-4 flex w-full items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-[#436d32] dark:text-[#8bb37a]">
              <Smartphone className="h-4 w-4 text-[#1a5611] dark:text-[#76d446]" />
              Status Sesi
            </div>
            <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${badgeClass}`}>
              {status.status}
            </span>
          </div>
          {qrVisual}
        </section>

      </div>
    </div>
  );
}
