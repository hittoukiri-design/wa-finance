import React, { useState, useEffect } from 'react';
import { 
  Activity, LayoutDashboard, MessageSquare, Wallet, BarChart3, 
  Settings, TerminalSquare, Receipt, HelpCircle, 
  CheckCircle2, Sun, ArrowUpRight, ArrowDownRight, 
  MoreHorizontal, Plus, Settings2, ShieldCheck, Zap
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { QRCodeSVG } from 'qrcode.react';

// --- MOCK DATA ---
const expenseData = [
  { name: 'May 15', amount: 1200 },
  { name: 'May 16', amount: 1600 },
  { name: 'May 17', amount: 2100 },
  { name: 'May 18', amount: 1400 },
  { name: 'May 19', amount: 2300 },
  { name: 'May 20', amount: 1800 },
  { name: 'May 21', amount: 2100 },
];

const categoryData = [
  { name: 'Food & Drink', value: 3250.40, color: '#22c55e' },
  { name: 'Transport', value: 2145.60, color: '#8b5cf6' },
  { name: 'Shopping', value: 1985.30, color: '#3b82f6' },
  { name: 'Utilities', value: 1560.00, color: '#eab308' },
  { name: 'Entertainment', value: 1230.25, color: '#ef4444' },
  { name: 'Others', value: 2279.20, color: '#64748b' },
];

const recentTransactions = [
  { id: 1, date: 'May 21, 2024 10:34 AM', desc: 'Bought 2 cups of coffee for $10', cat: 'Food & Drink', amount: '-$10.00', catColor: 'bg-green-500/20 text-green-400' },
  { id: 2, date: 'May 21, 2024 09:15 AM', desc: 'Uber Ride to Office', cat: 'Transport', amount: '-$18.75', catColor: 'bg-purple-500/20 text-purple-400' },
  { id: 3, date: 'May 20, 2024 08:47 PM', desc: 'Grocery Shopping', cat: 'Shopping', amount: '-$76.40', catColor: 'bg-blue-500/20 text-blue-400' },
  { id: 4, date: 'May 20, 2024 07:12 PM', desc: 'Electricity Bill', cat: 'Utilities', amount: '-$120.00', catColor: 'bg-yellow-500/20 text-yellow-400' },
  { id: 5, date: 'May 20, 2024 06:05 PM', desc: 'Movie Tickets', cat: 'Entertainment', amount: '-$24.50', catColor: 'bg-red-500/20 text-red-400' },
];

function App() {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [status, setStatus] = useState('disconnected');
  const [qrCode, setQrCode] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'Conversations', icon: MessageSquare },
    { name: 'Expenses', icon: Wallet },
    { name: 'Analytics', icon: BarChart3 },
    { name: 'Rules & Automation', icon: Settings2 },
    { name: 'Settings', icon: Settings },
    { name: 'Logs', icon: TerminalSquare },
    { name: 'Billing', icon: Receipt },
    { name: 'Help & Support', icon: HelpCircle },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-slate-200 flex font-sans overflow-hidden">
      
      {/* Toast Notification (Zero-Fault Rule) */}
      {toastMsg && (
        <div className="fixed top-4 right-4 bg-brand-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-in fade-in slide-in-from-top-4">
          {toastMsg}
        </div>
      )}

      {/* --- SIDEBAR --- */}
      <aside className="w-64 border-r border-slate-800/60 bg-[#0c0c0e] flex flex-col hidden md:flex shrink-0">
        <div className="p-6 flex items-center gap-3">
          <Activity className="text-green-500 w-6 h-6" />
          <span className="font-bold text-lg text-white tracking-wide">WA Finance Gateway</span>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 mt-2 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.name}
              onClick={() => setActiveTab(item.name)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === item.name 
                  ? 'bg-green-500/10 text-green-400' 
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.name}
            </button>
          ))}
        </nav>

        <div className="p-4 mt-auto border-t border-slate-800/60">
          <button className="w-full flex items-center justify-between p-2 hover:bg-slate-800/50 rounded-lg transition-colors text-left">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-900 text-green-400 flex items-center justify-center font-bold text-xs">
                WA
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white truncate w-32">WA Finance Team</span>
                <span className="text-xs text-slate-500 truncate w-32">admin@wafinance.com</span>
              </div>
            </div>
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 overflow-y-auto h-screen p-6 lg:p-8 relative">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-start justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">{activeTab}</h1>
            <p className="text-sm text-slate-400">Overview of your finance operations and AI insights.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700/50 text-sm">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-slate-300">System Operational</span>
            </div>
            <button className="p-2 rounded-full hover:bg-slate-800/50 text-slate-400 transition-colors">
              <Sun className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm font-medium text-white border border-slate-700 cursor-pointer">
              A
            </div>
          </div>
        </header>

        {activeTab === 'Dashboard' ? (
          <div className="space-y-6 max-w-[1400px]">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Total Expenses" value="$12,450.75" icon={Wallet} trend="+12.4%" positive={false} />
              <StatCard title="Monthly Budget" value="$18,000.00" icon={CheckCircle2} subtitle="65.3% utilized" progress={65.3} />
              <StatCard title="Active Conversations" value="23" icon={MessageSquare} trend="+5" positive={true} />
              <StatCard title="Automation Success Rate" value="98.7%" icon={Activity} trend="+1.6%" positive={true} />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Expense Trend */}
              <div className="lg:col-span-2 bg-[#121214] border border-slate-800/60 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-semibold text-white">Expense Trend</h3>
                  <button className="text-xs flex items-center gap-1 text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800/50">
                    Last 7 Days <MoreHorizontal className="w-3 h-3" />
                  </button>
                </div>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={expenseData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <defs>
                        <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val/1000}K`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                        itemStyle={{ color: '#22c55e' }}
                      />
                      <Line type="monotone" dataKey="amount" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top Categories */}
              <div className="bg-[#121214] border border-slate-800/60 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-semibold text-white">Top Expense Categories</h3>
                  <button className="text-xs flex items-center gap-1 text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800/50">
                    This Month <MoreHorizontal className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center justify-center relative h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-lg font-bold text-white">$12,450.75</span>
                    <span className="text-xs text-slate-400">Total</span>
                  </div>
                </div>
                
                {/* Legend */}
                <div className="mt-4 space-y-2">
                  {categoryData.slice(0,5).map((cat) => (
                    <div key={cat.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-slate-300">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }}></div>
                        {cat.name}
                      </div>
                      <div className="flex gap-4">
                        <span className="text-slate-200 w-16 text-right">${cat.value.toFixed(2)}</span>
                        <span className="text-slate-500 w-10 text-right">
                          {((cat.value / 12450.75) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Recent Transactions */}
              <div className="lg:col-span-2 bg-[#121214] border border-slate-800/60 rounded-xl p-5 shadow-sm overflow-x-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-white">Recent Transactions</h3>
                  <button className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800/50 transition-colors">
                    View all transactions
                  </button>
                </div>
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-400 border-b border-slate-800/60">
                    <tr>
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Description</th>
                      <th className="pb-3 font-medium">Category</th>
                      <th className="pb-3 font-medium text-right">Amount</th>
                      <th className="pb-3 font-medium text-right">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {recentTransactions.map((trx) => (
                      <tr key={trx.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 text-slate-400 whitespace-nowrap text-xs flex items-center gap-2">
                          <CheckCircle2 className="w-3 h-3 text-slate-500" />
                          {trx.date.split(' ')[0]} <span className="text-slate-600">{trx.date.split(' ').slice(1).join(' ')}</span>
                        </td>
                        <td className="py-3 text-slate-200">{trx.desc}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${trx.catColor}`}>
                            {trx.cat}
                          </span>
                        </td>
                        <td className="py-3 text-green-400 text-right font-medium">{trx.amount}</td>
                        <td className="py-3 flex justify-end">
                          <div className="w-6 h-6 rounded bg-green-500/10 flex items-center justify-center">
                            <MessageSquare className="w-3 h-3 text-green-500" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* AI Insights */}
              <div className="bg-[#121214] border border-slate-800/60 rounded-xl p-5 shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-white">AI Insights</h3>
                  <span className="text-[10px] uppercase font-bold bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">New</span>
                </div>
                
                <div className="space-y-3 flex-1">
                  <InsightCard 
                    icon={ArrowUpRight} 
                    color="text-green-400" bgColor="bg-green-500/10"
                    text="Your food expenses are 18% higher than last month." 
                  />
                  <InsightCard 
                    icon={Zap} 
                    color="text-purple-400" bgColor="bg-purple-500/10"
                    text="3 recurring payments detected. Consider automating them." 
                  />
                  <InsightCard 
                    icon={ShieldCheck} 
                    color="text-blue-400" bgColor="bg-blue-500/10"
                    text="Great job! Your automation success rate is above 98%." 
                  />
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col md:flex-row gap-4 pt-4">
              <h3 className="font-semibold text-white self-center md:mr-4 w-full md:w-auto">Quick Actions</h3>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                <button onClick={() => setActiveTab('Settings')} className="flex items-center gap-3 p-3 rounded-xl border border-slate-700/50 bg-[#121214] hover:bg-slate-800 transition-colors text-left group">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <MessageSquare className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">Connect WhatsApp</div>
                    <div className="text-xs text-slate-400">Link your number</div>
                  </div>
                </button>
                <button onClick={() => showToast("Add Expense Modal Coming Soon!")} className="flex items-center gap-3 p-3 rounded-xl border border-slate-700/50 bg-[#121214] hover:bg-slate-800 transition-colors text-left group">
                  <div className="w-10 h-10 rounded-full border border-green-500/30 flex items-center justify-center group-hover:bg-green-500/10 transition-colors">
                    <Plus className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">Add Expense</div>
                    <div className="text-xs text-slate-400">Manually add an expense</div>
                  </div>
                </button>
                <button onClick={() => showToast("Create Rule Automation Coming Soon!")} className="flex items-center gap-3 p-3 rounded-xl border border-slate-700/50 bg-[#121214] hover:bg-slate-800 transition-colors text-left group">
                  <div className="w-10 h-10 rounded-full border border-green-500/30 flex items-center justify-center group-hover:bg-green-500/10 transition-colors">
                    <Settings2 className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">Create Rule</div>
                    <div className="text-xs text-slate-400">Automate expense tracking</div>
                  </div>
                </button>
              </div>
            </div>

          </div>
        ) : activeTab === 'Settings' ? (
          <div className="max-w-2xl bg-[#121214] border border-slate-800/60 rounded-xl p-8 shadow-sm">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <MessageSquare className="text-green-500" /> Connect WhatsApp Bot
            </h2>
            <p className="text-slate-400 mb-8 text-sm">Scan the QR code below using your WhatsApp Linked Devices feature to activate the AI Gateway.</p>
            
            <div className="flex flex-col items-center justify-center p-8 border border-dashed border-slate-700 rounded-2xl bg-[#0c0c0e]">
              {status === 'disconnected' && (
                <button 
                  onClick={() => { setStatus('qr'); setQrCode('demo-qr-code-string'); }}
                  className="bg-green-600 hover:bg-green-500 text-white px-6 py-2.5 rounded-lg font-medium shadow-lg transition-colors"
                >
                  Generate QR Code
                </button>
              )}
              {status === 'qr' && (
                <div className="flex flex-col items-center">
                  <div className="bg-white p-4 rounded-xl mb-4">
                    <QRCodeSVG value={qrCode} size={200} level="H" />
                  </div>
                  <p className="text-sm text-slate-400 animate-pulse">Waiting for scan...</p>
                  <button onClick={() => setStatus('disconnected')} className="mt-4 text-xs text-slate-500 hover:text-white underline">Cancel</button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center bg-[#121214] border border-slate-800/60 rounded-xl">
            <div className="w-20 h-20 bg-slate-800/50 rounded-2xl flex items-center justify-center mb-6">
              <Settings className="w-10 h-10 text-slate-500 animate-spin-slow" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{activeTab}</h2>
            <p className="text-slate-400">This module is currently under construction.</p>
          </div>
        )}

        {/* Internal Code Signature as requested in project_check_list.md */}
        {/* This App was build by Chris Tambayong - Fumakill4 */}
        
      </main>
    </div>
  );
}

// --- SUB-COMPONENTS ---

function StatCard({ title, value, icon: Icon, trend, positive, subtitle, progress }) {
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
        
        {subtitle && progress && (
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

function InsightCard({ icon: Icon, color, bgColor, text }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-800/60 bg-[#0c0c0e] hover:bg-slate-800/50 transition-colors cursor-pointer group">
      <div className={`w-8 h-8 rounded-lg ${bgColor} flex items-center justify-center shrink-0`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className="text-sm text-slate-300 flex-1">{text}</p>
      <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
    </div>
  );
}

export default App;
