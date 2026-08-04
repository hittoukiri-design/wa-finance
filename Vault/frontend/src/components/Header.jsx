import React, { useEffect, useMemo, useState } from 'react';
import { Moon, RefreshCw, Sun } from 'lucide-react';
import { useTheme } from '../context/useTheme';
import { getWhatsAppStatus } from '../lib/whatsapp-api';

function StatusPill({ tone = 'slate', label, spinning = false }) {
  const tones = {
    emerald: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
    amber: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
    red: 'border-red-500/25 bg-red-500/10 text-red-300',
    slate: 'border-slate-700/70 bg-slate-800/50 text-slate-300',
    violet: 'border-violet-500/25 bg-violet-500/10 text-violet-300',
  };
  const dot = {
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-400',
    red: 'bg-red-400',
    slate: 'bg-slate-400',
    violet: 'bg-violet-400',
  };

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] ${tones[tone] || tones.slate}`}>
      {spinning ? <RefreshCw className="h-3 w-3 animate-spin" /> : <span className={`h-2 w-2 rounded-full ${dot[tone] || dot.slate}`} />}
      {label}
    </span>
  );
}

export default function Header({ title, subtitle }) {
  const { theme, toggleTheme } = useTheme();
  const [waStatus, setWaStatus] = useState({ status: 'checking' });

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const next = await getWhatsAppStatus();
        if (active) setWaStatus(next);
      } catch (error) {
        if (active) setWaStatus({ status: 'offline', error: error.message });
      }
    };

    load();
    const timer = window.setInterval(load, 3500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const waBadge = useMemo(() => {
    if (waStatus.status === 'connected') return { label: 'CONNECTED', tone: 'emerald' };
    if (waStatus.status === 'qr') return { label: 'QR REQUIRED', tone: 'amber', spinning: true };
    if (waStatus.status === 'initializing' || waStatus.status === 'checking') return { label: 'CONNECTING', tone: 'amber', spinning: true };
    if (waStatus.status === 'error') return { label: 'WA ERROR', tone: 'red' };
    if (waStatus.status === 'offline') return { label: 'API OFFLINE', tone: 'red' };
    return { label: 'DISCONNECTED', tone: 'slate' };
  }, [waStatus.status]);

  return (
    <header className="flex flex-col md:flex-row md:items-start justify-between mb-8 gap-4">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">{title}</h1>
        <p className="text-sm text-slate-400">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
        <StatusPill tone="emerald" label="MULTI-USER ACTIVE" />
        <StatusPill {...waBadge} />
        <button type="button" onClick={toggleTheme} title={theme === 'dark' ? 'Aktifkan light mode' : 'Aktifkan dark mode'} aria-label={theme === 'dark' ? 'Aktifkan light mode' : 'Aktifkan dark mode'} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-800/50 hover:text-amber-300">
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>
    </header>
  );
}
