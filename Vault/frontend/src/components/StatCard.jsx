import React from 'react';

export default function StatCard({ title, value, icon: Icon, trend, positive, subtitle, progress }) {
  return (
    <div className="bg-[#121214] border border-slate-800/60 rounded-xl p-5 shadow-sm hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-green-500" />
        </div>
      </div>
      <div className="mt-4">
        <div className="text-sm font-medium text-slate-400 mb-1">{title}</div>
        <div className="text-2xl font-bold text-white tracking-tight">{value}</div>

        {trend && (
          <div className="mt-2 flex items-center gap-1 text-xs font-medium">
            <span className={positive === false ? 'text-red-400' : 'text-green-400'}>
              {trend}
            </span>
            <span className="text-slate-500">vs last month</span>
          </div>
        )}

        {subtitle && progress !== undefined && (
          <div className="mt-2">
            <div className="text-xs text-slate-500 mb-1">{subtitle}</div>
            <div className="w-full bg-slate-800 rounded-full h-1">
              <div className="bg-green-500 h-1 rounded-full" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
