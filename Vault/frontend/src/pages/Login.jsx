import React, { useState } from 'react';
import { ArrowRight, Bot, Eye, EyeOff, LockKeyhole, Mail, Menu, RefreshCw, ShieldCheck, UserRound, Zap } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import waFinanceLogo from '../assets/wa-finance-logo.png';

const firebaseMessage = (error) => {
  const messages = {
    'auth/invalid-credential': 'Email atau password salah.',
    'auth/email-already-in-use': 'Email sudah terdaftar.',
    'auth/weak-password': 'Password minimal 6 karakter.',
    'auth/invalid-email': 'Format email tidak valid.',
    'auth/user-not-found': 'Akun tidak ditemukan.',
    'auth/popup-closed-by-user': 'Login Google dibatalkan.',
    'auth/operation-not-allowed': 'Login Google belum diaktifkan di Firebase Authentication.',
  };
  return messages[error.code] || 'Proses autentikasi gagal. Coba lagi.';
};

const benefits = [
  [Zap, 'AI Finance Engine', 'Otomatis mencatat & menganalisis transaksi'],
  [ShieldCheck, '100% Aman', 'Data terenkripsi dan privasi terjaga'],
  [RefreshCw, 'Realtime Sync', 'Sinkronisasi otomatis ke semua perangkat'],
  [Bot, 'WhatsApp Bot AI', 'Catat transaksi cukup dengan chat'],
];

function BrandMark({ small = false }) {
  return (
    <span className={`relative flex items-center justify-center rounded-[22px] border border-emerald-400/35 bg-emerald-500/10 shadow-[0_0_32px_rgba(34,197,94,.15)] ${small ? 'h-12 w-12 p-1.5' : 'h-20 w-20 p-2.5'}`}>
      <img src={waFinanceLogo} alt="WA Finance Gateway" className="h-full w-full object-contain drop-shadow-[0_0_18px_rgba(34,197,94,.35)]" />
    </span>
  );
}

export default function Login() {
  const { signIn, signInGoogle, signUp, resetPassword, setRememberMe } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const switchMode = () => { setMode((current) => current === 'login' ? 'signup' : 'login'); setNotice(''); };

  const submit = async (event) => {
    event.preventDefault();
    setNotice('');
    setBusy(true);
    try {
      await setRememberMe(remember);
      if (mode === 'login') await signIn(form.email, form.password);
      else await signUp(form.name, form.email, form.password);
    } catch (error) {
      setNotice(firebaseMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const loginGoogle = async () => {
    setNotice('');
    setBusy(true);
    try {
      await setRememberMe(remember);
      await signInGoogle();
    } catch (error) {
      setNotice(firebaseMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = async () => {
    if (!form.email) return setNotice('Isi email terlebih dahulu untuk menerima link reset password.');
    try {
      await resetPassword(form.email);
      setNotice('Link reset password sudah dikirim ke email Anda.');
    } catch (error) {
      setNotice(firebaseMessage(error));
    }
  };

  const inputClass = 'w-full rounded-xl border border-slate-700/80 bg-[#0c1821]/80 py-4 pl-12 pr-12 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10';

  return <main className="relative min-h-screen overflow-hidden bg-[#07111a] px-6 py-6 font-sans text-white sm:px-10 lg:px-12">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_84%_58%,rgba(16,185,129,.19),transparent_28%),radial-gradient(circle_at_14%_22%,rgba(34,197,94,.07),transparent_20%)]" />
    <header className="relative z-10 flex items-center justify-between"><div className="flex items-center gap-3"><Menu className="mr-3 h-6 w-6 text-slate-300 lg:hidden" /><BrandMark small /><div><p className="text-2xl font-semibold tracking-tight">WA Finance</p><p className="text-xs font-bold tracking-[.38em] text-emerald-400">Gateway</p></div></div><div className="hidden items-center gap-3 rounded-full border border-emerald-500/35 bg-emerald-500/5 px-5 py-2.5 text-sm font-semibold text-emerald-400 sm:flex"><ShieldCheck className="h-5 w-5" />100% Free Forever</div></header>
    <div className="relative z-10 mx-auto grid min-h-[calc(100vh-172px)] max-w-[1090px] items-center gap-14 py-16 lg:grid-cols-[.92fr_1px_1.08fr] lg:gap-14">
      <section className="hidden lg:block"><BrandMark /><p className="mt-8 text-sm font-bold tracking-[.18em] text-emerald-400">WELCOME BACK</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">{mode === 'login' ? <><span className="text-emerald-400">Masuk</span> ke workspace</> : <><span className="text-emerald-400">Buat</span> akun baru</>}</h1><p className="mt-4 max-w-md text-[15px] leading-7 text-slate-400">Gunakan akun Anda untuk mulai mencatat transaksi dan mengelola keuangan dengan AI.</p><div className="mt-11 space-y-6">{benefits.map(([Icon, title, detail]) => <div key={title} className="flex items-center gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/5 text-emerald-400"><Icon className="h-5 w-5" /></span><div><p className="font-semibold text-slate-100">{title}</p><p className="mt-0.5 text-sm text-slate-400">{detail}</p></div></div>)}</div></section>
      <div className="hidden h-[610px] bg-slate-700/50 lg:block" />
      <section className="mx-auto w-full max-w-[555px] rounded-2xl border border-slate-700/80 bg-[#0d1821]/80 p-8 shadow-[0_28px_80px_rgba(0,0,0,.3)] backdrop-blur-xl sm:p-11"><div className="mb-9"><h2 className="text-[26px] font-semibold tracking-tight">{mode === 'login' ? 'Masuk ke akun Anda' : 'Buat akun Anda'}</h2><p className="mt-2 text-sm text-slate-400">{mode === 'login' ? <>Belum punya akun? <button type="button" onClick={switchMode} className="font-semibold text-emerald-400 hover:text-emerald-300">Daftar sekarang</button></> : <>Sudah punya akun? <button type="button" onClick={switchMode} className="font-semibold text-emerald-400 hover:text-emerald-300">Masuk di sini</button></>}</p></div>{notice && <div className="mb-5 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{notice}</div>}<form onSubmit={submit} className="space-y-5">{mode === 'signup' && <label className="block"><span className="mb-2 block text-sm text-slate-300">Nama</span><div className="relative"><UserRound className="absolute left-4 top-4 h-5 w-5 text-slate-500" /><input required value={form.name} onChange={(event) => update('name', event.target.value)} className={inputClass} placeholder="Nama Anda" /></div></label>}<label className="block"><span className="mb-2 block text-sm text-slate-300">Email</span><div className="relative"><Mail className="absolute left-4 top-4 h-5 w-5 text-slate-500" /><input required type="email" value={form.email} onChange={(event) => update('email', event.target.value)} className={inputClass} placeholder="nama@email.com" /></div></label><label className="block"><span className="mb-2 block text-sm text-slate-300">Password</span><div className="relative"><LockKeyhole className="absolute left-4 top-4 h-5 w-5 text-slate-500" /><input required minLength="6" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => update('password', event.target.value)} className={inputClass} placeholder="Minimal 6 karakter" /><button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-4 top-4 text-slate-500 hover:text-emerald-300" aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div></label><div className="flex items-center justify-between text-sm"><label className="flex cursor-pointer items-center gap-2 text-slate-300"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 accent-emerald-500" />Ingat saya</label>{mode === 'login' && <button type="button" onClick={forgotPassword} className="font-semibold text-emerald-400 hover:text-emerald-300">Lupa password?</button>}</div><button disabled={busy} className="flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-5 py-4 text-[15px] font-semibold text-[#052216] shadow-[0_12px_32px_rgba(16,185,129,.2)] transition hover:brightness-110 disabled:opacity-60">{busy ? 'Memproses...' : mode === 'login' ? 'Masuk' : 'Daftar'}<ArrowRight className="h-5 w-5" /></button></form><div className="my-8 flex items-center gap-4 text-xs text-slate-500 before:h-px before:flex-1 before:bg-slate-700 after:h-px after:flex-1 after:bg-slate-700">atau</div><button type="button" disabled={busy} onClick={loginGoogle} className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-[#0c1821]/70 px-5 py-3.5 text-sm font-medium text-white transition hover:border-slate-500 hover:bg-slate-800/60 disabled:opacity-60"><span className="text-lg font-bold text-[#4285f4]"><span className="text-[#4285f4]">G</span></span>Masuk dengan Google</button></section>
    </div>
    <footer className="relative z-10 text-xs text-slate-500">© 2026 WA Finance Gateway. All rights reserved.</footer>
  </main>;
}
