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
import Header from '../components/Header';
import SCRIPT_TEMPLATE from '../../../SCRIPT INPUT DATA WA TO GOOGLE SHEET.txt?raw';

const steps = [
  'Gunakan menu Kategori & Dompet untuk mengatur sumber dana, budget limit, dan kategori yang dipakai bot.',
  'Hubungkan WhatsApp dari menu Whatsapp. Chat transaksi akan otomatis diekstrak dan masuk ke database webapp.',
  'Apps Script di halaman ini hanya arsip legacy untuk backup Google Sheets lama, bukan flow utama pencatatan transaksi.',
  'Jika masih perlu backup Sheet untuk periode lama, simpan script ini secara terpisah dan jangan jadikan flow transaksi harian.',
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

  return (
    <div className="mx-auto w-full max-w-[1450px] space-y-6">
      <Header
        title="Setup Guide"
        subtitle="Panduan konfigurasi WhatsApp bot, kategori custom, dan arsip legacy Google Apps Script."
      />

      <section className="rounded-[22px] border border-[#d6e4be] bg-[#eaf2da] p-6 shadow-sm dark:border-[#243e1c] dark:bg-[#121e14] md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#d6e4be] pb-6 dark:border-[#243e1c]">
          <div>
            <h1 className="flex items-center gap-2.5 text-lg font-black text-[#0e2a07] dark:text-[#f3ffe9]">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#c3ef92] text-[#1a5611] dark:bg-[#1b3816] dark:text-[#76d446]">
                <FileCode2 className="h-5 w-5" />
              </span>
              Arsitektur & Konfigurasi Sistem
            </h1>
            <p className="mt-1 text-xs text-[#436d32] dark:text-[#8bb37a]">
              WhatsApp mencatat langsung ke database webapp secara real-time. Google Sheets disimpan sebagai opsi backup legacy.
            </p>
          </div>
          <button
            onClick={() => navigate('/settings')}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#1a5611] px-4 py-2 text-xs font-black text-white shadow transition hover:bg-[#123d0c] dark:bg-[#76d446] dark:text-[#0d170a]"
          >
            <Settings2 className="h-3.5 w-3.5" /> Buka Pengaturan
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          
          {/* Steps List */}
          <div className="rounded-2xl border border-[#d6e4be] bg-white/70 p-6 dark:border-[#263e1d] dark:bg-[#162718]">
            <h2 className="flex items-center gap-2 text-sm font-black text-[#0e2a07] dark:text-[#f3ffe9]">
              <Sparkles className="h-4 w-4 text-[#1a5611] dark:text-[#76d446]" /> Langkah Integrasi
            </h2>

            <div className="mt-4 space-y-4">
              {steps.map((step, index) => (
                <div key={index} className="flex items-start gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1a5611] text-[10px] font-black text-white dark:bg-[#76d446] dark:text-[#0d170a]">
                    {index + 1}
                  </span>
                  <p className="text-xs font-semibold leading-relaxed text-[#1e3c15] dark:text-[#cde8bd]">
                    {step}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs font-medium text-[#1a5611] dark:text-[#76d446]">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Untuk transaksi sehari-hari, cukup gunakan WhatsApp bot. Kategori dan saldo dompet akan terupdate otomatis.</span>
            </div>
          </div>

          {/* Script Code Viewer */}
          <div className="min-w-0">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#358219] dark:text-[#76d446]">
                <Code2 className="h-3.5 w-3.5" /> Apps Script Code (Legacy)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={backupScript}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#d6e4be] bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-[#e4f2da] dark:border-[#263e1d] dark:bg-[#162718] dark:text-slate-200"
                >
                  {backedUp ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Download className="h-3.5 w-3.5" />}
                  {backedUp ? 'Saved' : 'Download'}
                </button>
                <button
                  onClick={copyCode}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#d6e4be] bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-[#e4f2da] dark:border-[#263e1d] dark:bg-[#162718] dark:text-slate-200"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Clipboard className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Salin'}
                </button>
              </div>
            </div>

            <pre className="h-[380px] overflow-auto rounded-2xl border border-[#d6e4be] bg-white p-4 font-mono text-[11px] leading-relaxed text-[#0e2a07] shadow-inner dark:border-[#263e1d] dark:bg-[#0d170a] dark:text-[#d4f0c0]">
              <code>{SCRIPT_TEMPLATE}</code>
            </pre>
          </div>

        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#d6e4be] pt-4 text-xs font-bold text-[#436d32] dark:border-[#243e1c] dark:text-[#8bb37a]">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-[#1a5611] dark:text-[#76d446]" />
            Sistem siap digunakan untuk pencatatan multi-user.
          </div>
          <button
            onClick={() => navigate('/settings')}
            className="inline-flex items-center gap-1 font-black text-[#1a5611] hover:underline dark:text-[#76d446]"
          >
            Buka Pengaturan <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

      </section>
    </div>
  );
}
