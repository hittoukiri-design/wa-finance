import React from 'react';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Conversations from './pages/Conversations';
import Expenses from './pages/Expenses';
import Analytics from './pages/Analytics';
import SetupGuide from './pages/SetupGuide';
import WhatsApp from './pages/WhatsApp';
import Login from './pages/Login';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { ThemeProvider } from './context/ThemeContext';

// This App was build by Chris Tambayong - Fumakill4

function ProtectedApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#071019] text-sm text-slate-400">Memeriksa sesi...</div>;
  }

  if (!user) return <Login />;

  return (
    <BrowserRouter>
      <div className="app-shell flex min-h-screen overflow-hidden bg-[#071019] font-sans text-slate-200">

        <Sidebar />

        <main className="app-main relative h-screen flex-1 overflow-y-auto px-6 py-7 lg:px-9 lg:py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/whatsapp" element={<WhatsApp />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/conversations" element={<Conversations />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/setup" element={<SetupGuide />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function App() {
  return <ThemeProvider><AuthProvider><ProtectedApp /></AuthProvider></ThemeProvider>;
}

export default App;
