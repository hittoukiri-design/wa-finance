import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Menu,
  Moon,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Sun,
  X,
} from 'lucide-react';
import { useTheme } from '../context/useTheme';
import { useSidebar } from '../context/SidebarContext';
import { useAuth } from '../context/useAuth';
import { getWhatsAppStatus } from '../lib/whatsapp-api';

function currentMonthYear() {
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date());
}

function dateInputValue(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function Header({ title, subtitle }) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const [waStatus, setWaStatus] = useState({ status: 'checking' });

  // Filter Popover state
  const [showFilter, setShowFilter] = useState(false);
  const filterRef = useRef(null);

  const [filterMonth, setFilterMonth] = useState(() => currentMonthYear());
  const [filterStart, setFilterStart] = useState(() => {
    const d = new Date();
    return dateInputValue(new Date(d.getFullYear(), d.getMonth(), 1));
  });
  const [filterEnd, setFilterEnd] = useState(() => {
    const d = new Date();
    return dateInputValue(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  });
  const [filterWallet, setFilterWallet] = useState('Semua dompet');
  const [filterCategory, setFilterCategory] = useState('Semua kategori');

  // WhatsApp status polling
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
    const timer = window.setInterval(load, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  // Close filter popover on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilter(false);
      }
    }
    if (showFilter) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFilter]);

  const handleResetFilter = () => {
    const d = new Date();
    setFilterMonth(currentMonthYear());
    setFilterStart(dateInputValue(new Date(d.getFullYear(), d.getMonth(), 1)));
    setFilterEnd(dateInputValue(new Date(d.getFullYear(), d.getMonth() + 1, 0)));
    setFilterWallet('Semua dompet');
    setFilterCategory('Semua kategori');
  };

  const handleApplyFilter = () => {
    setShowFilter(false);
  };

  const userInitials = useMemo(() => {
    const name = user?.displayName || user?.email || 'CH';
    return name.slice(0, 2).toUpperCase();
  }, [user]);

  return (
    <header className="mb-6 flex items-center justify-between gap-4">
      {/* ── Left: Hide / Unhide Toggle & WA Finance Gateway Title ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          title={isCollapsed ? 'Tampilkan sidebar' : 'Sembunyikan sidebar'}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#dcebd0] bg-[#f4faef] text-[#358219] shadow-sm transition hover:bg-[#e4f2da] dark:border-[#263e1d] dark:bg-[#122214] dark:text-[#76d446]"
        >
          {isCollapsed ? <Menu width="18" height="18" /> : <ChevronLeft width="19" height="19" />}
        </button>

        <div>
          <h1 className="text-xl font-black tracking-tight text-[#0e2a07] dark:text-[#f3ffe9]">
            {title || 'WA Finance Gateway'}
          </h1>
          {subtitle && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      {/* ── Right: Month Filter Popover, Theme Toggle & User Avatar ── */}
      <div className="relative flex items-center gap-2.5">
        
        {/* Month Filter Button */}
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setShowFilter((v) => !v)}
            title="Filter tanggal & sumber dana"
            className="inline-flex items-center gap-2 rounded-full border border-[#dcebd0] bg-[#f4faef] px-3.5 py-1.5 text-xs font-bold text-[#0e2a07] shadow-sm transition hover:bg-[#e4f2da] dark:border-[#263e1d] dark:bg-[#122214] dark:text-[#f3ffe9]"
          >
            <SlidersHorizontal width="13" height="13" className="text-[#358219] dark:text-[#76d446]" />
            <span>{filterMonth}</span>
          </button>

          {/* Filter Popover Dropdown (Matching Screenshot media_1787109418862.png) */}
          {showFilter && (
            <div className="absolute right-0 top-11 z-50 w-72 rounded-2xl border border-[#dcebd0] bg-[#eef7e6] p-4 shadow-2xl backdrop-blur-md dark:border-[#263e1d] dark:bg-[#112013]">
              <div className="space-y-2.5">
                {/* 1. Bulan */}
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-[#436d32] dark:text-[#76d446]">Bulan</label>
                  <div className="flex items-center justify-between rounded-xl border border-[#dcebd0] bg-white/80 px-3 py-2 text-xs font-bold text-[#0e2a07] dark:border-[#263e1d] dark:bg-[#162718] dark:text-white">
                    <span>{filterMonth}</span>
                    <Calendar width="14" height="14" className="text-[#358219] dark:text-[#76d446]" />
                  </div>
                </div>

                {/* 2. Dari Tanggal */}
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-[#436d32] dark:text-[#76d446]">Dari</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={filterStart}
                      onChange={(e) => setFilterStart(e.target.value)}
                      className="w-full rounded-xl border border-[#dcebd0] bg-white/80 px-3 py-2 text-xs font-bold text-[#0e2a07] outline-none dark:border-[#263e1d] dark:bg-[#162718] dark:text-white"
                    />
                  </div>
                </div>

                {/* 3. Sampai Tanggal */}
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-[#436d32] dark:text-[#76d446]">Sampai</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={filterEnd}
                      onChange={(e) => setFilterEnd(e.target.value)}
                      className="w-full rounded-xl border border-[#dcebd0] bg-white/80 px-3 py-2 text-xs font-bold text-[#0e2a07] outline-none dark:border-[#263e1d] dark:bg-[#162718] dark:text-white"
                    />
                  </div>
                </div>

                {/* 4. Dompet */}
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-[#436d32] dark:text-[#76d446]">Dompet</label>
                  <select
                    value={filterWallet}
                    onChange={(e) => setFilterWallet(e.target.value)}
                    className="w-full rounded-xl border border-[#dcebd0] bg-white/80 px-3 py-2 text-xs font-bold text-[#0e2a07] outline-none dark:border-[#263e1d] dark:bg-[#162718] dark:text-white"
                  >
                    <option value="Semua dompet">Semua dompet</option>
                    <option value="Bank">Bank</option>
                    <option value="Cash">Cash</option>
                    <option value="Utama">Utama</option>
                    <option value="BCA">BCA</option>
                    <option value="SUPERBANK">SUPERBANK</option>
                  </select>
                </div>

                {/* 5. Kategori */}
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-[#436d32] dark:text-[#76d446]">Kategori</label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full rounded-xl border border-[#dcebd0] bg-white/80 px-3 py-2 text-xs font-bold text-[#0e2a07] outline-none dark:border-[#263e1d] dark:bg-[#162718] dark:text-white"
                  >
                    <option value="Semua kategori">Semua kategori</option>
                    <option value="Makan">Makan</option>
                    <option value="Belanja">Belanja</option>
                    <option value="Transportasi">Transportasi</option>
                    <option value="Tagihan">Tagihan</option>
                    <option value="Rumah">Rumah</option>
                    <option value="Kesehatan">Kesehatan</option>
                    <option value="Pendidikan">Pendidikan</option>
                    <option value="Hiburan">Hiburan</option>
                    <option value="Sosial">Sosial</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleResetFilter}
                    className="inline-flex items-center gap-1 rounded-full border border-[#dcebd0] bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-[#e4f2da] dark:border-[#263e1d] dark:bg-[#162718] dark:text-slate-200"
                  >
                    <RotateCcw width="12" height="12" />
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyFilter}
                    className="rounded-full bg-[#1a5611] px-5 py-1.5 text-xs font-black text-white shadow-md transition hover:bg-[#123d0c] dark:bg-[#76d446] dark:text-[#0d170a]"
                  >
                    Terapkan
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Aktifkan light mode' : 'Aktifkan dark mode'}
          aria-label={theme === 'dark' ? 'Aktifkan light mode' : 'Aktifkan dark mode'}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dcebd0] bg-[#f4faef] text-slate-700 shadow-sm transition hover:bg-[#e4f2da] hover:text-amber-600 dark:border-[#263e1d] dark:bg-[#122214] dark:text-slate-300 dark:hover:text-amber-400"
        >
          {theme === 'dark' ? <Sun width="16" height="16" /> : <Moon width="16" height="16" />}
        </button>

        {/* User Initials Circle */}
        <div
          title={user?.displayName || user?.email || 'User'}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d8f0c4] text-xs font-black text-[#1a5611] shadow-sm dark:bg-[#1b3816] dark:text-[#76d446]"
        >
          {userInitials}
        </div>
      </div>
    </header>
  );
}
