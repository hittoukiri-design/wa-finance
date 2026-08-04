import React, { useEffect, useState } from 'react';
import { CheckCircle2, QrCode, RefreshCw, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { connectWhatsApp, getWhatsAppStatus } from '../lib/whatsapp-api';

export default function WhatsAppLinkCard() {
  const [status, setStatus] = useState({ status: 'checking' });
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    const sync = async () => {
      try {
        let current = await getWhatsAppStatus();
        if (current.status === 'disconnected' && active) {
          await connectWhatsApp();
          current = await getWhatsAppStatus();
        }
        if (active) setStatus(current);
      } catch (error) {
        if (active) { setStatus({ status: 'offline' }); setNotice(error.message); }
      }
    };
    sync();
    const timer = window.setInterval(sync, 2500);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  return <section className="rounded-2xl border border-slate-800 bg-[#0b141c] p-5 shadow-[0_12px_30px_rgba(0,0,0,.12)]">
    <div className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300"><QrCode className="h-5 w-5" /></span><div><h2 className="font-semibold text-slate-100">WhatsApp Link</h2><p className="text-xs text-slate-500">{status.status === 'connected' ? 'Bot sedang memantau pesan' : 'QR diperbarui otomatis'}</p></div></div><RefreshCw className={status.status === 'connected' ? 'h-4 w-4 text-emerald-400' : 'h-4 w-4 animate-spin text-violet-300'} /></div>
    <div className="mt-5 flex min-h-[238px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-4 text-center">{status.qr ? <><div className="rounded-2xl bg-white p-3"><QRCodeSVG value={status.qr} size={176} /></div><p className="mt-4 text-sm font-semibold text-slate-100">Scan to Connect</p><p className="mt-1 text-xs text-slate-500">WhatsApp → Linked devices</p></> : status.status === 'connected' ? <><CheckCircle2 className="h-14 w-14 text-emerald-400" /><p className="mt-4 text-sm font-semibold text-slate-100">Active</p><p className="mt-1 text-xs text-slate-500">Bot is monitoring</p></> : status.status === 'error' ? <><Smartphone className="h-12 w-12 text-red-400" /><p className="mt-4 text-sm font-semibold text-red-200">WhatsApp gagal membuat QR</p><p className="mt-1 text-xs text-slate-500">{status.error || 'Buka halaman WhatsApp lalu reconnect.'}</p></> : <><Smartphone className="h-12 w-12 text-slate-600" /><p className="mt-4 text-sm font-semibold text-slate-200">Menyiapkan QR...</p><p className="mt-1 text-xs text-slate-500">{notice || 'Koneksi WhatsApp sedang dibuat otomatis.'}</p></>}</div>
  </section>;
}
