import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  BarChart3, FileCode2, LayoutDashboard, LogOut, MessageSquare, Settings, Smartphone, Wallet,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import waFinanceLogo from '../assets/wa-finance-logo.png';

const navItems = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { name: 'Analytic', icon: BarChart3, path: '/analytics' },
  { name: 'Transaction', icon: Wallet, path: '/expenses' },
  { name: 'Conversation', icon: MessageSquare, path: '/conversations' },
  { name: 'Whatsapp', icon: Smartphone, path: '/whatsapp' },
  { name: 'Settings', icon: Settings, path: '/settings' },
  { name: 'Setup Guide', icon: FileCode2, path: '/setup' },
];

export default function Sidebar() {
  const { user, signOut } = useAuth();
  return (
    <aside className="app-sidebar hidden h-screen w-[300px] shrink-0 flex-col border-r border-slate-800/80 bg-[#071019] md:flex">
      <div className="flex items-center gap-3 px-8 py-7">
        <img src={waFinanceLogo} alt="WA Finance Gateway" className="h-10 w-10 object-contain drop-shadow-[0_0_10px_rgba(52,211,93,0.65)]" />
        <span className="text-[18px] font-semibold tracking-tight text-white">WA Finance Gateway</span>
      </div>

      <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-4">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `relative flex w-full items-center gap-4 rounded-lg px-5 py-3.5 text-[15px] font-medium transition-colors ${
                isActive
                  ? 'bg-slate-800/60 text-white before:absolute before:-left-4 before:top-0 before:h-full before:w-0.5 before:rounded-r before:bg-emerald-400'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`
            }
          >
            <item.icon className="h-[21px] w-[21px]" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto border-t border-slate-800/80 p-5">
        <div className="flex w-full items-center gap-3 rounded-xl border border-slate-800 bg-[#0c1822] p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-bold text-emerald-300">
              {(user?.displayName || user?.email || 'WA').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="w-36 truncate text-sm font-medium text-white">{user?.displayName || 'WA Finance User'}</span>
              <span className="w-36 truncate text-xs text-slate-500">{user?.email || 'Authenticated account'}</span>
            </div>
          </div>
          <button onClick={signOut} title="Sign Out" className="ml-auto rounded-lg p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-300"><LogOut className="h-4 w-4" /></button>
        </div>
      </div>
    </aside>
  );
}
