import React from 'react';

export default function StatCard({ title, value, icon: Icon, trend, positive, subtitle, progress }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-slate-300 dark:border-slate-800/60 dark:bg-[#121214] dark:hover:border-slate-700">
      <div className="mb-2 flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
          <Icon className="h-5 w-5 text-green-500" />
        </div>
      </div>
      <div className="mt-4">
        <div className="mb-1 text-sm font-medium text-slate-500 dark:text-slate-400">{title}</div>
        <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</div>

        {trend && (
          <div className="mt-2 flex items-center gap-1 text-xs font-medium">
            <span className={positive === false ? 'text-red-400' : 'text-green-500'}>
              {trend}
            </span>
            <span className="text-slate-400 dark:text-slate-500">vs last month</span>
          </div>
        )}

        {subtitle && progress !== undefined && (
          <div className="mt-2">
            <div className="mb-1 text-xs text-slate-400 dark:text-slate-500">{subtitle}</div>
            <div className="h-1 w-full rounded-full bg-slate-200 dark:bg-slate-800">
              <div className="h-1 rounded-full bg-green-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
