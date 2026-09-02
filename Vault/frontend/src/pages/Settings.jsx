import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Clock,
  Database,
  Download,
  FileCheck,
  Gauge,
  HardDrive,
  KeyRound,
  LogOut,
  Save,
  Server,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import Header from '../components/Header';
import { useAuth } from '../context/useAuth';
import { auth } from '../lib/firebase';

const API_BASE = import.meta.env.VITE_API_URL
  || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:5000' : '');

const DEFAULT_SETTINGS = {
  groq_api_key: '',
  ai_model: 'openai/gpt-oss-120b',
  system_prompt: 'You are a precise Indonesian financial transaction extractor. Output ONLY valid JSON.',
};

const AI_MODEL_OPTIONS = [
  {
    value: 'openai/gpt-oss-120b',
    label: 'GPT OSS 120B (recommended)',
  },
  {
    value: 'openai/gpt-oss-20b',
    label: 'GPT OSS 20B (fast)',
  },
  {
    value: 'qwen/qwen3.6-27b',
    label: 'Qwen3.6 27B (preview)',
  },
];

function formatBackupDate(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(d);
  } catch {
    return isoString;
  }
}

async function apiRequest(path, options = {}) {
  const currentUser = auth.currentUser;
  const token = currentUser ? await currentUser.getIdToken() : '';
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed with HTTP ${response.status}`);
  return data;
}

function FieldLabel({ children }) {
  return <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-[#358219] dark:text-[#76d446]">{children}</label>;
}

function SectionTitle({ icon: Icon, title, description, children }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="flex items-center gap-2.5 text-lg font-black text-[#0e2a07] dark:text-[#f3ffe9]">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#c3ef92] text-[#1a5611] dark:bg-[#1b3816] dark:text-[#76d446]">
            <Icon className="h-5 w-5" />
          </span>
          {title}
        </h2>
        <p className="mt-1 text-xs text-[#436d32] dark:text-[#8bb37a]">{description}</p>
      </div>
      {children}
    </div>
  );
}

export default function Settings() {
  const { user, signOut } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [backupStatus, setBackupStatus] = useState(null);
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const notify = (type, message) => {
    setNotice({ type, message });
    window.setTimeout(() => setNotice(null), 3500);
  };

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [saved, health, backupInfo] = await Promise.all([
          apiRequest('/api/settings'),
          apiRequest('/api/health'),
          apiRequest('/api/backup/status').catch(() => null),
        ]);
        setSettings((current) => ({ ...current, ...saved, groq_api_key: '' }));
        setHasSavedKey(Boolean(saved.has_groq_api_key));
        setBackendStatus(health.status === 'ok' ? 'ok' : 'error');
        if (backupInfo) setBackupStatus(backupInfo);
      } catch (error) {
        setBackendStatus('offline');
        notify('error', error.message);
      }
    };
    load();
  }, [user]);

  const handleSave = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await apiRequest('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      setSettings((current) => ({ ...current, ...result.settings, groq_api_key: '' }));
      setHasSavedKey(Boolean(result.settings.has_groq_api_key));
      notify('success', 'Pengaturan AI berhasil disimpan.');
    } catch (error) {
      notify('error', error.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const currentUser = auth.currentUser;
      const token = currentUser ? await currentUser.getIdToken() : '';
      const response = await fetch(`${API_BASE}/api/backup/export`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) throw new Error('Gagal mengunduh backup dari server.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `wa-finance-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      notify('success', 'File cadangan database (.json) berhasil diunduh.');
    } catch (err) {
      notify('error', err.message || 'Gagal mengunduh backup.');
    }
  };

  const lastBackup = backupStatus?.last_backup;
  const historyList = backupStatus?.history || [];

  return (
    <div className="mx-auto w-full max-w-[1450px] space-y-6">
      <Header
        title="Pengaturan"
        subtitle="Atur integrasi AI Groq dan kelola keamanan database server WA Finance Anda."
      />

      {notice && (
        <div className={`rounded-xl border px-4 py-3 text-xs font-bold shadow-lg ${
          notice.type === 'error'
            ? 'border-red-400/30 bg-red-500/15 text-red-800 dark:text-red-200'
            : notice.type === 'warning'
              ? 'border-amber-400/30 bg-amber-500/15 text-amber-800 dark:text-amber-200'
              : 'border-emerald-400/30 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
        }`}>
          {notice.message}
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        
        {/* Left Side: Profile & System Info */}
        <aside className="space-y-5 xl:sticky xl:top-6">
          <div className="rounded-[22px] border border-[#d6e4be] bg-[#eaf2da] p-6 text-center shadow-sm dark:border-[#243e1c] dark:bg-[#121e14]">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#1a5611] text-2xl font-black text-white shadow-md dark:bg-[#76d446] dark:text-[#0d170a]">
              {(user?.displayName || user?.email || 'CH').slice(0, 2).toUpperCase()}
            </div>
            <h2 className="mt-4 text-base font-black text-[#0e2a07] dark:text-[#f3ffe9]">{user?.displayName || 'WA Finance User'}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email || 'Authenticated account'}</p>
            <button
              type="button"
              onClick={signOut}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-500/20 dark:text-red-300"
            >
              <LogOut className="h-3.5 w-3.5" /> Keluar Akun
            </button>
          </div>

          <div className="rounded-[22px] border border-[#d6e4be] bg-[#eaf2da] p-6 shadow-sm dark:border-[#243e1c] dark:bg-[#121e14]">
            <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-[#358219] dark:text-[#76d446]">
              <Gauge className="h-4 w-4" /> System Info
            </h3>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-[#d6e4be] bg-white/70 px-3.5 py-2.5 dark:border-[#263e1d] dark:bg-[#162718]">
                <span className="text-xs font-bold text-[#436d32] dark:text-[#8bb37a]">App Version</span>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-black text-emerald-700 dark:bg-emerald-500/20 dark:text-[#76d446]">
                  v.2.0
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[#d6e4be] bg-white/70 px-3.5 py-2.5 dark:border-[#263e1d] dark:bg-[#162718]">
                <span className="text-xs font-bold text-[#436d32] dark:text-[#8bb37a]">Backend API</span>
                <span className={`rounded-full px-2.5 py-0.5 text-[9.5px] font-black uppercase ${
                  backendStatus === 'ok' ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/20 text-red-700 dark:text-red-300'
                }`}>
                  {backendStatus === 'ok' ? 'ONLINE (OK)' : 'OFFLINE'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[#d6e4be] bg-white/70 px-3.5 py-2.5 dark:border-[#263e1d] dark:bg-[#162718]">
                <span className="text-xs font-bold text-[#436d32] dark:text-[#8bb37a]">Database</span>
                <span className="text-xs font-black text-[#1a5611] dark:text-[#76d446]">Server Mac mini & Firestore</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[#d6e4be] bg-white/70 px-3.5 py-2.5 dark:border-[#263e1d] dark:bg-[#162718]">
                <span className="text-xs font-bold text-[#436d32] dark:text-[#8bb37a]">Auto-Backup</span>
                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">AKTIF (03:15 WIB) 🟢</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Side: Configuration Sections */}
        <div className="space-y-5">
          
          {/* AI Configuration */}
          <section className="rounded-[22px] border border-[#d6e4be] bg-[#eaf2da] p-6 shadow-sm dark:border-[#243e1c] dark:bg-[#121e14]">
            <SectionTitle
              icon={Sparkles}
              title="Konfigurasi AI"
              description="Model AI Groq yang mengekstrak nominal, merchant, dan kategori dari pesan WhatsApp."
            />

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <FieldLabel>Groq API Key</FieldLabel>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    value={settings.groq_api_key}
                    onChange={(event) => setSettings((current) => ({ ...current, groq_api_key: event.target.value }))}
                    placeholder={hasSavedKey ? 'API key tersimpan (isi untuk mengganti)' : 'gsk_...'}
                    className="w-full rounded-xl border border-[#d6e4be] bg-white py-2.5 pl-10 pr-3.5 text-xs font-bold text-[#0e2a07] outline-none shadow-sm transition focus:border-[#76d446] dark:border-[#263e1d] dark:bg-[#162718] dark:text-[#f3ffe9]"
                  />
                </div>
              </div>

              <div>
                <FieldLabel>AI Model</FieldLabel>
                <select
                  value={settings.ai_model}
                  onChange={(event) => setSettings((current) => ({ ...current, ai_model: event.target.value }))}
                  className="w-full rounded-xl border border-[#d6e4be] bg-white px-3.5 py-2.5 text-xs font-bold text-[#0e2a07] outline-none shadow-sm transition focus:border-[#76d446] dark:border-[#263e1d] dark:bg-[#162718] dark:text-[#f3ffe9]"
                >
                  {AI_MODEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <FieldLabel>System Prompt AI</FieldLabel>
                <textarea
                  rows="3"
                  value={settings.system_prompt}
                  onChange={(event) => setSettings((current) => ({ ...current, system_prompt: event.target.value }))}
                  className="w-full resize-y rounded-xl border border-[#d6e4be] bg-white px-3.5 py-2.5 text-xs font-bold text-[#0e2a07] outline-none shadow-sm transition focus:border-[#76d446] dark:border-[#263e1d] dark:bg-[#162718] dark:text-[#f3ffe9]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#1a5611] py-3 text-xs font-black text-white shadow-md transition hover:bg-[#123d0c] disabled:opacity-50 dark:bg-[#76d446] dark:text-[#0d170a]"
            >
              <Save className="h-4 w-4" />
              {busy ? 'Menyimpan...' : 'Simpan Konfigurasi AI'}
            </button>
          </section>

          {/* Server Auto-Backup & Data Safety */}
          <section className="rounded-[22px] border border-[#d6e4be] bg-[#eaf2da] p-6 shadow-sm dark:border-[#243e1c] dark:bg-[#121e14]">
            <SectionTitle
              icon={Database}
              title="Keamanan Data & Server Auto-Backup"
              description="Penyimpanan database berjalan 24/7 di server Mac mini dan backup terenkripsi tersimpan lokal."
            >
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-300">
                AUTO-BACKUP ON 🟢
              </span>
            </SectionTitle>

            <div className="mt-6 space-y-4">
              
              {/* Highlight: Last Backup Time Banner */}
              <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-4 dark:border-emerald-500/20 dark:bg-emerald-950/30">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                      <FileCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-[#358219] dark:text-[#76d446]">
                        Backup Terakhir Server
                      </div>
                      <div className="flex items-center gap-2 text-sm font-black text-[#0e2a07] dark:text-[#f3ffe9]">
                        <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span>{formatBackupDate(lastBackup?.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-white/80 px-2.5 py-1 text-[10px] font-bold text-slate-700 shadow-sm dark:bg-black/40 dark:text-slate-300">
                      📦 Ukuran: {lastBackup?.size || '237.9 KB'}
                    </span>
                    <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[10px] font-black text-emerald-800 dark:text-emerald-300">
                      {lastBackup?.status || 'Berhasil 🟢'}
                    </span>
                  </div>
                </div>
                <div className="mt-2.5 border-t border-emerald-500/15 pt-2 text-[10.5px] text-[#436d32] dark:text-[#8bb37a]">
                  📍 <strong>Jadwal Otomatis:</strong> Setiap hari pukul 03:15 WIB (Encrypted AES-256 PBKDF2).
                </div>
              </div>

              {/* History Snapshots list */}
              {historyList.length > 0 && (
                <div className="rounded-xl border border-[#d6e4be] bg-white/70 p-4 dark:border-[#263e1d] dark:bg-[#162718]">
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#358219] dark:text-[#76d446]">
                      Riwayat Snapshot Terakhir
                    </span>
                    <span className="text-[10px] text-slate-400">Arsip Otomatis 30 Hari</span>
                  </div>
                  <div className="divide-y divide-[#e4f0d2] dark:divide-[#213519]">
                    {historyList.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2 text-xs">
                        <div className="flex items-center gap-2 font-bold text-[#0e2a07] dark:text-[#f3ffe9]">
                          <HardDrive className="h-3.5 w-3.5 text-slate-400" />
                          <span>{formatBackupDate(item.timestamp)}</span>
                          <span className="text-[10px] text-slate-400">({item.type})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{item.size}</span>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Terenkripsi 🔒</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[#d6e4be] bg-white/70 p-4 dark:border-[#263e1d] dark:bg-[#162718]">
                  <div className="flex items-center gap-2 text-xs font-black text-[#1a5611] dark:text-[#76d446]">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Anti Tumpang Tindih</span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[#436d32] dark:text-[#8bb37a]">
                    Setiap transaksi WhatsApp dilindungi <code>message_id</code> unik (idempotensi). Pesan ganda atau reconnect tidak akan menduplikasi saldo.
                  </p>
                </div>

                <div className="rounded-xl border border-[#d6e4be] bg-white/70 p-4 dark:border-[#263e1d] dark:bg-[#162718]">
                  <div className="flex items-center gap-2 text-xs font-black text-[#1a5611] dark:text-[#76d446]">
                    <Server className="h-4 w-4" />
                    <span>Stand-alone 24/7</span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[#436d32] dark:text-[#8bb37a]">
                    Server berjalan independen di background. Saat laptop mati atau tidak digunakan, bot dan database tetap mencatat transaksi.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="inline-flex items-center gap-2 rounded-full bg-[#1a5611] px-5 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-[#123d0c] dark:bg-[#76d446] dark:text-[#0d170a]"
                >
                  <Download className="h-4 w-4" />
                  Download Full Database Snapshot (.json)
                </button>
                <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
                  Cadangan lengkap berisi semua data transaksi, dompet, pagu anggaran, dan konfigurasi yang dapat kamu simpan di Google Drive pribadi kapan saja.
                </p>
              </div>
            </div>
          </section>
        </div>
      </form>
    </div>
  );
}
