import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileCode2,
  Gauge,
  KeyRound,
  LogOut,
  RefreshCw,
  Save,
  Server,
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
  return <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{children}</label>;
}

function SectionTitle({ icon: Icon, title, description, children }) {
  return <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="flex items-center gap-3 text-[22px] font-semibold tracking-tight text-slate-900 dark:text-white"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500"><Icon className="h-5 w-5" /></span>{title}</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</p></div>{children}</div>;
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
      notify('success', 'URL Apps Script tersimpan untuk akun ini.');
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
  const statusClass = status === 'connected' ? 'bg-emerald-500/10 text-emerald-600' : status === 'error' ? 'bg-red-500/10 text-red-600' : 'bg-amber-500/10 text-amber-600';

  return <div className="mx-auto w-full max-w-[1450px]">
    <Header title="Settings" subtitle="Hubungkan akun Anda ke Google Apps Script untuk bot keuangan." />
    {notice && <div className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-2xl ${notice.type === 'error' ? 'border-red-400/30 bg-red-950/90 text-red-200' : notice.type === 'warning' ? 'border-amber-400/30 bg-amber-950/90 text-amber-200' : 'border-emerald-400/30 bg-emerald-950/90 text-emerald-200'}`}>{notice.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}{notice.message}</div>}
    <form onSubmit={handleSave} className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="space-y-6 xl:sticky xl:top-6">
        <div className="rounded-[28px] border border-slate-200 bg-white p-7 text-center shadow-[0_18px_50px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-[#0b141c]">
          <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 via-sky-500 to-emerald-400 text-3xl font-bold text-white shadow-lg"><span>{(user?.displayName || user?.email || 'WA').slice(0, 2).toUpperCase()}</span><span className="absolute bottom-0 right-0 h-5 w-5 rounded-full border-4 border-white bg-emerald-400 dark:border-[#0b141c]" /></div>
          <h2 className="mt-5 text-xl font-semibold text-slate-900 dark:text-white">{user?.displayName || 'WA Finance User'}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{user?.email || 'Authenticated account'}</p>
          <button type="button" onClick={signOut} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-500 transition hover:bg-red-500/15"><LogOut className="h-4 w-4" />Sign Out</button>
        </div>
        <div className="rounded-[28px] bg-[#111a31] p-7 text-white shadow-[0_18px_50px_rgba(15,23,42,0.18)]"><h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400"><Gauge className="h-4 w-4" />System Info</h3><div className="mt-6 space-y-4"><div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-4"><span className="text-xs text-slate-400">Backend Status</span><span className={`rounded-md px-2 py-1 text-[10px] font-bold ${backendStatus === 'ok' ? 'bg-emerald-500/20 text-emerald-400' : backendStatus === 'checking' ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'}`}>{backendStatus === 'ok' ? 'OK' : backendStatus === 'checking' ? '...' : 'OFFLINE'}</span></div><div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-4"><span className="text-xs text-slate-400">Mode</span><span className="text-[10px] font-bold text-white">PRIVATE TESTING</span></div></div></div>
        <div className="overflow-hidden rounded-[28px] border border-emerald-500/15 bg-[#08151d] p-7 text-white shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
          <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-300">Tentang Aplikasi</h3>
          <div className="mt-5 space-y-4">
            <div>
              <h4 className="text-xl font-bold tracking-tight text-white">WA Finance Gateway V.2.0</h4>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Asisten keuangan berbasis WhatsApp yang membantu mencatat transaksi dari chat menjadi data yang rapi,
                cepat, dan mudah dipantau.
              </p>
            </div>
            <p className="text-sm leading-6 text-slate-400">
              Data Anda diamankan menggunakan Firebase® dengan autentikasi, enkripsi, dan pembatasan akses berbasis
              izin pengguna, sehingga privasi tetap terlindungi.
            </p>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-xs font-semibold leading-6 text-emerald-300">
              Didukung AI • WhatsApp Sync • Firebase® Security
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Dikembangkan oleh i729 Tambayong
            </p>
          </div>
        </div>
      </aside>
      <div className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-[#0b141c] md:p-10">
          <SectionTitle icon={FileCode2} title="Apps Script Configuration" description="Hubungkan bot ke Google Sheets melalui Apps Script Web App."><span className={`rounded-full px-3 py-1.5 text-[10px] font-bold tracking-[0.12em] ${statusClass}`}>{status === 'testing' && <RefreshCw className="mr-1 inline h-3 w-3 animate-spin" />}{statusLabel}</span></SectionTitle>
          <div className="mt-8"><div className="flex items-center justify-between"><FieldLabel>Web App Endpoint URL</FieldLabel><button type="button" disabled={busy} onClick={handleTest} className="mb-2 text-xs font-semibold text-violet-600 hover:text-violet-500 disabled:opacity-50"><Wifi className="mr-1 inline h-3.5 w-3.5" />Test Connection</button></div><input value={settings.apps_script_url} onChange={(event) => setSettings((current) => ({ ...current, apps_script_url: event.target.value }))} placeholder="https://script.google.com/macros/s/.../exec" className="w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-mono text-sm text-slate-800 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100" />{settings.apps_script_last_tested_at && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Last tested: {formatTestedAt(settings.apps_script_last_tested_at)} · HTTP {settings.apps_script_last_status || '-'}</p>}</div>
          <div className="mt-6 flex gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" /><div><strong className="block text-sm">Spreadsheet tetap di Apps Script</strong><p className="mt-1 text-sm leading-relaxed">Isi <b>SPREADSHEET_ID</b> di Apps Script Project Settings → Script Properties. Key Groq dari webapp akan diproses backend dan hasilnya diteruskan ke script ini.</p></div></div>
        </section>
        <section className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-[#0b141c] md:p-10">
          <SectionTitle icon={Sparkles} title="AI Configuration" description="Key dipakai oleh backend WhatsApp dan disimpan di Google Secret Manager." />
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2"><div><FieldLabel>Groq API Key</FieldLabel><div className="relative"><KeyRound className="absolute left-4 top-4 h-4 w-4 text-slate-400" /><input type="password" value={settings.groq_api_key} onChange={(event) => setSettings((current) => ({ ...current, groq_api_key: event.target.value }))} placeholder={hasSavedKey ? 'API key tersimpan (isi untuk mengganti)' : 'gsk_...'} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-4 pl-11 pr-4 text-sm text-slate-800 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100" /></div></div><div><FieldLabel>AI Model</FieldLabel><select value={settings.ai_model} onChange={(event) => setSettings((current) => ({ ...current, ai_model: event.target.value }))} className="w-full rounded-xl border-2 border-violet-500 bg-slate-50 px-4 py-4 text-sm text-slate-800 outline-none dark:bg-slate-900/60 dark:text-slate-100">{AI_MODEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">GPT OSS 120B paling aman untuk production. Qwen3.6 27B tersedia untuk eksperimen, tapi masih preview.</p></div><div className="lg:col-span-2"><div className="flex items-center justify-between gap-3"><FieldLabel>Spreadsheet ID</FieldLabel>{settings.spreadsheet_id && <a href={sheetUrl(settings.spreadsheet_id)} target="_blank" rel="noreferrer" className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-500"><ExternalLink className="h-3.5 w-3.5" />Open configured Sheet</a>}</div><input value={settings.spreadsheet_id} onChange={(event) => setSettings((current) => ({ ...current, spreadsheet_id: event.target.value }))} placeholder="ID dari URL Google Spreadsheet" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-mono text-sm text-slate-800 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100" />{settings.spreadsheet_id && <p className="mt-2 break-all text-xs text-slate-500 dark:text-slate-400">Sheet aktif: {settings.spreadsheet_id}</p>}</div><div className="lg:col-span-2"><FieldLabel>System Prompt</FieldLabel><textarea rows="4" value={settings.system_prompt} onChange={(event) => setSettings((current) => ({ ...current, system_prompt: event.target.value }))} className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-relaxed text-slate-800 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100" /></div></div>
          <button type="submit" disabled={busy} className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-[#111a31] px-5 py-4 font-semibold text-white transition hover:bg-[#1b2746] disabled:opacity-60"><Save className="h-4 w-4" />{busy ? 'Menyimpan...' : 'Save AI Configuration'}</button>
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-slate-500 dark:text-slate-300"><Server className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /><p>Key tidak disimpan di browser atau SQLite Cloud Run. Backend menggunakannya untuk memproses pesan, lalu mengirim hasil transaksi ke Apps Script dan Google Sheets.</p></div>
        </section>
      </div>
    </form>
  </div>;
}
