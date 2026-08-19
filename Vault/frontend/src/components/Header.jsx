import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Menu, Moon, RefreshCw, Sun } from 'lucide-react';
import { useTheme } from '../context/useTheme';
import { useSidebar } from '../context/SidebarContext';
import { getWhatsAppStatus } from '../lib/whatsapp-api';

function StatusPill({ tone = 'slate', label, spinning = false }) {
  const tones = {
    emerald: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    amber: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    red: 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300',
    slate: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700/70 dark:bg-slate-800/50 dark:text-slate-300',
    violet: 'border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  };
  const dot = {
    emerald: 'bg-emerald-500 dark:bg-emerald-400',
    amber: 'bg-amber-500 dark:bg-amber-400',
    red: 'bg-red-500 dark:bg-red-400',
    slate: 'bg-slate-500 dark:bg-slate-400',
    violet: 'bg-violet-500 dark:bg-violet-400',
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
  const { isCollapsed, toggleSidebar } = useSidebar();
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
    <header className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start">
      <div className="flex items-center gap-3">
        {/* Toggle Expand Button (Visible when sidebar collapsed) */}
        {isCollapsed && (
          <button
            onClick={toggleSidebar}
            title="Besarkan menu"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#dcebd0] bg-white text-[#358219] shadow-sm transition hover:bg-[#ebf5e3] dark:border-[#263e1d] dark:bg-[#122214] dark:text-[#76d446]"
          >
            <Menu width="18" height="18" />
          </button>
        )}
        <div>
          <h1 className="text-2xl font-black text-[#0e2a07] dark:text-white mb-0.5">{title}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
        <StatusPill tone="emerald" label="MULTI-USER ACTIVE" />
        <StatusPill {...waBadge} />
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Aktifkan light mode' : 'Aktifkan dark mode'}
          aria-label={theme === 'dark' ? 'Aktifkan light mode' : 'Aktifkan dark mode'}
          className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-amber-500 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-amber-300"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>
    </header>
  );
}
