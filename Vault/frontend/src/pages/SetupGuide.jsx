import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clipboard,
  Code2,
  Download,
  FileCode2,
  Info,
  Settings2,
  Sparkles,
} from 'lucide-react';
import SCRIPT_TEMPLATE from '../../../SCRIPT INPUT DATA WA TO GOOGLE SHEET.txt?raw';

const steps = [
  <>Buat Google Spreadsheet baru & buka Apps Script (<span className="text-slate-300">Extensions → Apps Script</span>).</>,
  <>Copy kode lengkap di samping ke project Apps Script Anda. Script ini adalah versi project WA Finance.</>,
  <>Klik <span className="text-slate-300">Deploy → New Deployment → Web App</span>. Set access ke <span className="text-slate-300">Anyone</span>.</>,
  <>Buka menu <span className="text-slate-300">Settings</span> di dashboard ini dan tempel URL Web App tersebut.</>,
];

export default function SetupGuide() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [backedUp, setBackedUp] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(SCRIPT_TEMPLATE);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  const backupScript = () => {
    const now = new Date();
    const stamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      '-',
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
    ].join('');
    const blob = new Blob([SCRIPT_TEMPLATE], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${stamp} - WA Finance Apps Script Backup.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setBackedUp(true);
    window.setTimeout(() => setBackedUp(false), 2200);
  };

  return <div className="mx-auto w-full max-w-[1450px]">
    <section className="rounded-[28px] bg-[#111a31] p-7 text-white shadow-[0_20px_60px_rgba(15,23,42,0.22)] md:p-10">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div><h1 className="flex items-center gap-3 text-[24px] font-semibold tracking-tight"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300"><FileCode2 className="h-5 w-5" /></span>Setup Guide</h1><p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">Ikuti panduan di bawah ini untuk menghubungkan bot ke Google Sheets Anda.</p></div><button onClick={() => navigate('/settings')} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm text-slate-200 transition hover:border-violet-400/50 hover:text-white"><Settings2 className="h-4 w-4" />Open Settings</button>
      </div>
      <div className="mt-10 grid grid-cols-1 gap-8 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[24px] border border-slate-700 bg-[#1a243b] p-7"><h2 className="flex items-center gap-3 text-lg font-semibold"><Sparkles className="h-5 w-5 text-violet-300" />Langkah-Langkah Setup</h2><div className="mt-6 space-y-5">{steps.map((step, index) => <div key={index} className="flex items-start gap-4"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500 text-xs font-semibold text-white">{index + 1}</span><p className="text-sm leading-relaxed text-slate-400">{step}</p></div>)}</div><div className="mt-7 flex gap-3 rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4 text-xs leading-relaxed text-slate-300"><Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" /><span>Pastikan Anda sudah mengizinkan akses <b className="text-white">Authorize</b> saat pertama kali menjalankan script di Google Apps Script.</span></div></div>
        <div className="min-w-0"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"><Code2 className="h-4 w-4" />Script Code</span><div className="flex flex-wrap items-center gap-3"><button onClick={backupScript} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-emerald-400/50 hover:text-white">{backedUp ? <Check className="h-4 w-4 text-emerald-400" /> : <Download className="h-4 w-4" />}{backedUp ? 'Backup Saved' : 'Backup Script'}</button><button onClick={copyCode} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-violet-400/50 hover:text-white">{copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Clipboard className="h-4 w-4" />}{copied ? 'Copied' : 'Copy Code'}</button></div></div><pre className="h-[430px] overflow-auto rounded-2xl border border-slate-700 bg-[#070c16] p-6 font-mono text-[11px] leading-[1.65] text-slate-300 shadow-inner"><code>{SCRIPT_TEMPLATE}</code></pre></div>
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-700 pt-6"><div className="flex items-center gap-2 text-xs text-slate-400"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Setelah deploy, gunakan Test Connection di Settings.</div><button onClick={() => navigate('/settings')} className="inline-flex items-center gap-2 text-sm font-semibold text-violet-300 transition hover:text-violet-200">Lanjut ke Settings <ArrowRight className="h-4 w-4" /></button></div>
    </section>
  </div>;
}
