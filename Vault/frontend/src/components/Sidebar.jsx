import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  Bot,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileCode2,
  FileText,
  LayoutDashboard,
  LayoutGrid,
  List,
  LogOut,
  Menu,
  MessageSquare,
  MessageSquareWarning,
  Receipt,
  Settings,
  Sliders,
  Smartphone,
  Tag,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { useSidebar } from '../context/SidebarContext';
import waFinanceLogo from '../assets/wa-finance-logo.png';

const navGroups = [
  {
    group: 'APLIKASI',
    items: [
      { name: 'Dashboard', icon: LayoutGrid, path: '/' },
      { name: 'Transaksi', icon: Receipt, path: '/expenses' },
      { name: 'Dompet', icon: Wallet, path: '/dompet' },
      { name: 'Kategori', icon: Tag, path: '/categories' },
    ],
  },
  {
    group: 'OPERASIONAL',
    items: [
      { name: 'Gateway WA', icon: Smartphone, path: '/whatsapp' },
      { name: 'Format Balasan', icon: MessageSquare, path: '/conversations' },
      { name: 'Analytic', icon: BarChart3, path: '/analytics' },
      { name: 'Pengaturan', icon: Settings, path: '/settings' },
      { name: 'Setup Guide', icon: FileCode2, path: '/setup' },
    ],
  },
];

export default function Sidebar() {
  const { user, signOut } = useAuth();
  const { isCollapsed, toggleSidebar } = useSidebar();

  return (
    <aside
      className={`app-sidebar hidden h-screen shrink-0 flex-col border-r transition-all duration-300 ease-in-out md:flex ${
        isCollapsed
          ? 'w-[76px] border-[#dcebd0] bg-[#f4faef] dark:border-[#263e1d] dark:bg-[#0c180e]'
          : 'w-[250px] border-[#dcebd0] bg-[#f4faef] dark:border-[#263e1d] dark:bg-[#0c180e]'
      }`}
    >
      {/* ── Top Header / Brand ── */}
      <div
        className={`flex items-center border-b border-[#e5eedc] dark:border-[#1d3517] ${
          isCollapsed ? 'justify-center p-4' : 'justify-between px-5 py-4'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={waFinanceLogo}
            alt="WA Finance"
            className="h-8 w-8 shrink-0 object-contain drop-shadow-[0_0_8px_rgba(52,211,93,0.5)]"
          />
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="truncate text-[15px] font-black tracking-tight text-[#0e2a07] dark:text-[#f3ffe9]">
                WA Finance
              </span>
              <span className="truncate text-[8.5px] font-bold uppercase tracking-wider text-[#358219] dark:text-[#76d446]">
                Gateway Platform
              </span>
            </div>
          )}
        </div>

        {/* Toggle Collapse Button */}
        {!isCollapsed && (
          <button
            onClick={toggleSidebar}
            title="Sembunyikan menu"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#dcebd0] bg-white/80 text-[#358219] shadow-sm transition hover:bg-white dark:border-[#263e1d] dark:bg-[#162914] dark:text-[#76d446]"
          >
            <ChevronLeft width="16" height="16" />
          </button>
        )}
      </div>

      {/* When collapsed, small expand button under logo */}
      {isCollapsed && (
        <div className="flex justify-center pt-2">
          <button
            onClick={toggleSidebar}
            title="Tampilkan menu"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-[#e4f2da] hover:text-[#1a5611] dark:text-slate-400 dark:hover:bg-[#162914] dark:hover:text-[#76d446]"
          >
            <ChevronRight width="16" height="16" />
          </button>
        </div>
      )}

      {/* ── Navigation Menu Groups ── */}
      <nav className="mt-3 flex-1 space-y-4 overflow-y-auto px-3">
        {navGroups.map((grp) => (
          <div key={grp.group} className="space-y-1">
            {!isCollapsed ? (
              <div className="px-3 pb-1 text-[9.5px] font-black uppercase tracking-wider text-[#436d32] dark:text-[#76d446]/80">
                {grp.group}
              </div>
            ) : (
              <div className="my-1 border-t border-[#e2edd8] dark:border-[#1d3517]" />
            )}

            {grp.items.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                title={isCollapsed ? item.name : undefined}
                className={({ isActive }) =>
                  `flex items-center rounded-xl font-bold transition-all ${
                    isCollapsed
                      ? 'h-11 w-11 justify-center mx-auto text-sm'
                      : 'gap-3 px-3.5 py-2 text-[13px]'
                  } ${
                    isActive
                      ? 'bg-[#d8f0c4] text-[#0e2a07] shadow-sm dark:bg-[#1a3816] dark:text-[#76d446]'
                      : 'text-slate-700 hover:bg-[#e6f4dc] hover:text-[#0e2a07] dark:text-slate-300 dark:hover:bg-[#142616] dark:hover:text-white'
                  }`
                }
              >
                <item.icon className={isCollapsed ? 'h-[19px] w-[19px]' : 'h-[17px] w-[17px] shrink-0'} />
                {!isCollapsed && <span className="truncate">{item.name}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* ── Bottom Profile Card ── */}
      <div className="mt-auto border-t border-[#e5eedc] p-3 dark:border-[#1d3517]">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div
              title={user?.displayName || user?.email || 'User'}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1a5611] text-xs font-black text-white shadow-sm dark:bg-[#76d446] dark:text-[#0d170a]"
            >
              {(user?.displayName || user?.email || 'CH').slice(0, 2).toUpperCase()}
            </div>
            <button
              onClick={signOut}
              title="Keluar"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
            >
              <LogOut width="15" height="15" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-[#dcebd0] bg-[#eaf4e2] p-2.5 dark:border-[#263e1d] dark:bg-[#132212]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1a5611] text-xs font-black text-white dark:bg-[#76d446] dark:text-[#0d170a]">
                {(user?.displayName || user?.email || 'CH').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="truncate text-xs font-black text-[#0e2a07] dark:text-[#f3ffe9]">
                  {user?.displayName || user?.email?.split('@')[0] || 'Chris'}
                </span>
                <span className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                  {user?.email || 'User'}
                </span>
              </div>
            </div>
            <button
              onClick={signOut}
              title="Keluar"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
            >
              <LogOut width="15" height="15" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
