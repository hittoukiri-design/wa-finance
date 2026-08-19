import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileCode2,
  Gauge,
  KeyRound,
  LockKeyhole,
  LogOut,
  RefreshCw,
  Save,
  Server,
  ShieldCheck,
  Sparkles,
  Wifi,
} from 'lucide-react';
import Header from '../components/Header';
import { useAuth } from '../context/useAuth';
import { auth } from '../lib/firebase';

const API_BASE = import.meta.env.VITE_API_URL
  || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'https://wa-finance-bot-i729.web.app' : '');
const DEFAULT_SETTINGS = {
  apps_script_url: '',
  groq_api_key: '',
  spreadsheet_id: '',
  ai_model: 'openai/gpt-oss-120b',
  system_prompt: 'You are a precise Indonesian financial transaction extractor. Output ONLY valid JSON.',
  apps_script_status: 'not_configured',
  apps_script_last_tested_at: null,
  apps_script_last_status: null,
  apps_script_last_preview: '',
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

function sheetUrl(spreadsheetId) {
  return spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` : '';
}

function formatTestedAt(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function Settings() {
  const { user, signOut } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [status, setStatus] = useState('not_configured');
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
        const [saved, health] = await Promise.all([apiRequest('/api/settings'), apiRequest('/api/health')]);
        setSettings((current) => ({ ...current, ...saved, groq_api_key: '' }));
        setHasSavedKey(Boolean(saved.has_groq_api_key));
        setStatus(saved.apps_script_status || (saved.apps_script_url ? 'configured' : 'not_configured'));
        setBackendStatus(health.status === 'ok' ? 'ok' : 'error');
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
      setStatus(result.settings.apps_script_status || (result.settings.apps_script_url ? 'configured' : 'not_configured'));
      notify('success', 'Pengaturan berhasil disimpan.');
    } catch (error) {
      notify('error', error.message);
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    if (!settings.apps_script_url) {
      notify('warning', 'Masukkan Web App Endpoint URL terlebih dahulu.');
      return;
    }
    setBusy(true);
    setStatus('testing');
    try {
      const result = await apiRequest('/api/apps-script/test', {
        method: 'POST',
        body: JSON.stringify({ apps_script_url: settings.apps_script_url }),
      });
      if (result.settings) setSettings((current) => ({ ...current, ...result.settings, groq_api_key: '' }));
      setStatus(result.settings?.apps_script_status || 'connected');
      notify('success', `Apps Script terhubung. HTTP ${result.status}.`);
    } catch (error) {
      setStatus('error');
      notify('error', error.message);
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = {
    connected: 'CONNECTED', configured: 'CONFIGURED', testing: 'TESTING', error: 'CHECK FAILED', not_configured: 'NOT CONFIGURED',
  }[status];
  const statusClass = status === 'connected'
    ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
    : status === 'error'
      ? 'border-red-500/30 bg-red-500/15 text-red-800 dark:text-red-300'
      : 'border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300';

  return (
    <div className="mx-auto w-full max-w-[1450px] space-y-6">
      <Header
        title="Pengaturan"
        subtitle="Atur integrasi AI, konfigurasi Google Sheets, dan profil akun WA Finance Anda."
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
                <span className="text-xs font-bold text-[#436d32] dark:text-[#8bb37a]">Backend API</span>
                <span className={`rounded-full px-2.5 py-0.5 text-[9.5px] font-black uppercase ${
                  backendStatus === 'ok' ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/20 text-red-700 dark:text-red-300'
                }`}>
                  {backendStatus === 'ok' ? 'ONLINE (OK)' : 'OFFLINE'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[#d6e4be] bg-white/70 px-3.5 py-2.5 dark:border-[#263e1d] dark:bg-[#162718]">
                <span className="text-xs font-bold text-[#436d32] dark:text-[#8bb37a]">Database</span>
                <span className="text-xs font-black text-[#1a5611] dark:text-[#76d446]">Firestore Multi-User</span>
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

          {/* Legacy Apps Script / Sheet */}
          <section className="rounded-[22px] border border-[#d6e4be] bg-[#eaf2da] p-6 shadow-sm dark:border-[#243e1c] dark:bg-[#121e14]">
            <SectionTitle
              icon={FileCode2}
              title="Google Apps Script (Opsional)"
              description="Untuk backup sinkronisasi legacy ke Google Spreadsheet."
            >
              <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${statusClass}`}>
                {status === 'testing' && <RefreshCw className="mr-1 inline h-3 w-3 animate-spin" />}
                {statusLabel}
              </span>
            </SectionTitle>

            <div className="mt-5 space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <FieldLabel>Web App Endpoint URL</FieldLabel>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleTest}
                    className="text-xs font-bold text-[#1a5611] hover:underline dark:text-[#76d446] disabled:opacity-50"
                  >
                    <Wifi className="mr-1 inline h-3 w-3" />
                    Test Koneksi
                  </button>
                </div>
                <input
                  value={settings.apps_script_url}
                  onChange={(event) => setSettings((current) => ({ ...current, apps_script_url: event.target.value }))}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full rounded-xl border border-[#d6e4be] bg-white px-3.5 py-2.5 font-mono text-xs font-bold text-[#0e2a07] outline-none shadow-sm transition focus:border-[#76d446] dark:border-[#263e1d] dark:bg-[#162718] dark:text-[#f3ffe9]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <FieldLabel>Spreadsheet ID</FieldLabel>
                  {settings.spreadsheet_id && (
                    <a
                      href={sheetUrl(settings.spreadsheet_id)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#1a5611] hover:underline dark:text-[#76d446]"
                    >
                      <ExternalLink className="h-3 w-3" /> Buka Sheet
                    </a>
                  )}
                </div>
                <input
                  value={settings.spreadsheet_id}
                  onChange={(event) => setSettings((current) => ({ ...current, spreadsheet_id: event.target.value }))}
                  placeholder="ID Spreadsheet Google"
                  className="w-full rounded-xl border border-[#d6e4be] bg-white px-3.5 py-2.5 font-mono text-xs font-bold text-[#0e2a07] outline-none shadow-sm transition focus:border-[#76d446] dark:border-[#263e1d] dark:bg-[#162718] dark:text-[#f3ffe9]"
                />
              </div>
            </div>
          </section>

        </div>
      </form>
    </div>
  );
}
