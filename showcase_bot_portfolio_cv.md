# 🚀 Telegram & Facebook Bot Showcase — Professional CV & Portfolio Guide

Dokumen ini disusun berdasarkan analisis komprehensif berkas riwayat pekerjaan dari microSD `512GB` (`/Volumes/512gb/Docs/Jobs/History/dostwin_yaarwin_bobi_history_zip64_20260710-055104.zip`).

---

## 📌 Mengapa Bot Ini Bukan Sekadar "Bot Biasa"? (Key Differentiator)

Banyak kandidat menulis *"Bikin Telegram/Facebook Bot"* di CV, tetapi yang dimaksud biasanya hanya memanggil API dasar (Wrapper API sederhana). 

Bot yang kamu bangun berada di **tingkat lanjut (Enterprise Automations & Reverse Engineering Grade)** karena menangani:
1. **Bypass Keamanan React DOM Facebook** tanpa menggunakan form chooser bawaan OS.
2. **Koneksi Remote Debugging (CDP WebSocket)** ke browser aktif pengguna untuk mempertahankan sesi login tanpa re-authentication.
3. **CRM & Funnel Management State Machine** dengan enkapsulasi data JSON dan sinkronisasi real-time ke panel admin.
4. **Automated Event Listening & Emoji Reactions** langsung pada Telegram Web UI.
5. **Orkestrasi Master Scheduler 24/7** dengan proteksi pembekuan OS (`caffeinate -is`).

---

## 🤖 1. TELEGRAM BOT ECOSYSTEM SHOWCASE

### A. Arsitektur & Fitur Utama

#### 1. YaarWinAppBot (`@YaarWinappBot`) — Enterprise CRM & Automated Blast Engine
* **Routing Channel Multi-Tenant**: Sistem perutean pesan dinamis yang memisahkan traffic antara channel *Potential Agents*, *Registered Agents ID*, *Admin Command Log*, serta dukungan Telegram Topic (`message_thread_id`).
* **Real-Time ERP/Panel Sync**: Perintah admin khusus (`/syncwd`, `/syncuid`, `/syncrc`) untuk melakukan sinkronisasi data transaksi *Withdrawal*, validasi *Member UID*, dan data *Recharge* sukses langsung dari panel utama.
* **State Machine Manajemen Corong Penjualan (CRM Funnel)**:
  * Pelacakan status user dinamis dari `potential_agents.json` beralih ke `registered_agents.json`.
  * Penggunaan perintah admin (`/agents`, `/agentlog`, `/agentregistered`, `/registeredagents`, `/markagent`) untuk memindahkan user secara otomatis agar keluar dari daftaran *cold broadcast* dan masuk ke daftaran *active agent tier*.
* **Engine Broadcast Terjadwal dengan Anti-Spam Safeguards**:
  * Sistem *auto-blast* interval 3 hari menggunakan media *carousel* (4 gambar promosi + chart *Agent Referral Bonus*).
  * Dilengkapi logika *rate-limiting*, penanganan fallback error, serta pembatasan akses khusus admin.

#### 2. Telegram Web Auto-Absen Bot (`auto_absen.js`) — CDP Browser Automation
* **Koneksi Remote Debugging (CDP WebSocket Port 9223)**: Mengontrol instance **Google Chrome** aktif lewat protokol Chrome DevTools tanpa terhalang *security sandbox* Puppeteer standar.
* **3-Step Listening & Real-time Emoji Reaction Engine**:
  1. Otomatis mengetik dan memposting pesan absen kehadiran di grup Telegram Web (`web.telegram.org/a/`).
  2. Melakukan *real-time listening* terhadap balasan admin yang mengirimkan OTP 6-angka.
  3. Membaca pesan OTP dan seketika menembakkan **Telegram Emoji Reaction (🐳 Whale)** pada bubble chat OTP sebagai konfirmasi visual penerimaan pesan.

#### 3. Telegram CS Manager Agent
* **Bot Customer Service Edukatif & Compliance-Ready**:
  * Dirancang dengan *guardrails* ketat (compliance 18+, disclaimer *play responsibly*, larangan menjanjikan profit/kemenangan pasti).
  * Sistem eskalasi otomatis ke admin jika terdeteksi keluhan sensitif, masalah transaksi, atau indikasi spam.

---

## 📘 2. FACEBOOK AUTOMATION BOT ECOSYSTEM SHOWCASE

### A. Arsitektur & Fitur Utama

#### 1. Bypass Anti-Bot React FB DOM via Synthetic `DataTransfer` Drag-and-Drop
* **Penanggulangan Proteksi React Facebook**: Mengatasi pemblokiran form upload standar (`page.waitForFileChooser()` dan `input.uploadFile()`) yang menyebabkan jendela *Finder OS Mac* membeku (*stuck dialog*).
* **Simulasi Native Drag-and-Drop (`DataTransfer` Injection)**:
  * Mengonversi file gambar lokal menjadi string `Base64`.
  * Di-inject ke DOM halaman Facebook via `fbPage.evaluate` dan direkonstruksi kembali menjadi objek binary `Blob`/`File`.
  * Membuat payload `DataTransfer` buatan dan menembakkan *native-equivalent events* (`dragenter`, `dragover`, `drop`) tepat di atas `div[role="textbox"]`.
  * Result: Facebook merespons persis seperti interaksi murni manusia (menyeret foto dari Desktop), sukses mem-bypass *security React* tanpa memicu dialog OS.

#### 2. Remote Debugging Brave Browser (CDP Port 9222)
* Mengkoneksikan Puppeteer-core ke profil **Brave Browser** aktif yang sudah terautentikasi.
* Menjaga session login pengguna tanpa perlu inject cookie berulang atau memicu tantangan Captcha/anti-bot Facebook.

#### 3. React DOM State Reconciliation & Resolusi Collision
* **Urutan Operasi Terbalik (Order of Operations)**: Memecahkan bug React Facebook di mana upload foto menghapus teks *caption* yang sudah diketik.
  1. Foto di-inject terlebih dahulu via *Drag-and-Drop*.
  2. Menunggu jeda stablisasi DOM (5–6 detik) hingga React selesai melakukan transisi ke mode *Photo Post*.
  3. Mengunci dan memfokuskan *textbox* (`div[role="textbox"]`), lalu mengetik *caption* secara *native*.
* **Pencegahan Overwrite Link Preview**: Menghapus skema URL (`https://`) dari teks caption (misal menggunakan `yaarwinapp.co`) untuk mencegah React Facebook membentuk card *Link Preview* yang menimpa foto yang diunggah.

#### 4. Dynamic Caption Generator (2.800+ Permutasi SEO)
* Mesin pembuat *caption* dinamis berdasarkan kombinasi acak *Hook*, *Body*, *SEO Pillar Keywords* ("App Download guide", "fast withdrawal times"), CTA, dan hashtag.
* Dilengkapi memori pelacak duplikasi untuk mencegah pemblokiran algoritma spam Facebook akibat postingan identik berturut-turut.

#### 5. 24/7 Master Scheduler & Group Discovery Engine
* **Master Time-Based Scheduler (`master_fb_scheduler.js`)**: Mengatur jam kerja bot secara otomatis:
  * `00:00 - 01:00`: Rest Period.
  * `01:00 - 15:00` & `20:00 - 00:00`: Profile/Page Automated Posting (`fb_loop.js`).
  * `15:00 - 20:00`: Group Expansion & Automated Posting (`auto_join_loop.js`).
* **Fast-Skip Logic untuk Group Expansion**: Bot otomatis mencari grup berdasar kata kunci, mengecek status kelulusan (auto-approved vs pending admin). Jika butuh persetujuan admin, bot melakukan *fast-skip* tanpa delay untuk memaksimalkan reach postingan di grup publik.

#### 6. macOS System Safeguard (`caffeinate -is`)
* Mengintegrasikan proses background `caffeinate` pada Mac untuk mencegah sistem komputer masuk mode Sleep yang dapat memutuskan koneksi WebSocket CDP.

---

## 💼 3. CARA MENULISKAN DI CV (CV BULLET POINTS READY)

Kamu bisa menyalin poin-poin berikut langsung ke CV bagian **Work Experience** atau **Key Projects**:

### Bahasa Indonesia (Untuk Perusahaan Lokal / Enterprise)

```markdown
**Automations & Bot Solutions Architect / Senior Scripting Engineer**
- Merancang dan mengimplementasikan Telegram Bot CRM (@YaarWinappBot) yang terintegrasi dengan backend ERP untuk sinkronisasi real-time transaksi Withdrawal, Recharge, dan validasi UID member.
- Mengembangkan engine broadcast Telegram otomatis dengan sistem manajemen corong penjualan (CRM State Machine) berbasis interval 3 hari dan rate-limiting anti-spam.
- Membangun bot absen otomatis Telegram Web berbasis Chrome DevTools Protocol (CDP WebSocket) dengan kemampuan real-time event listening & auto-reply emoji reaction (🐳) saat menerima OTP.
- Mengembangkan Facebook Automation Bot 24/7 menggunakan Puppeteer-Core & Brave Browser CDP, berhasil mem-bypass proteksi React DOM Facebook menggunakan teknik simulasi native Drag-and-Drop (DataTransfer Base64-to-Blob Injection).
- Merancang Dynamic Caption Generator dengan 2.800+ variasi permutasi teks berdasar kata kunci SEO untuk mencegah flagging algoritma spam Facebook.
- Mengimplementasikan Master Time-Based Scheduler 24/7 dengan strategi Fast-Skip pada grup Facebook dan proteksi anti-sleep macOS (caffeinate).
```

### Bahasa Inggris (Untuk Perusahaan Remote / Global / Tech Startup)

```markdown
**Automations & Bot Solutions Architect / Lead Automation Engineer**
- Engineered an enterprise-grade Telegram CRM Bot (@YaarWinappBot) with real-time ERP integration for automated Withdrawal, Recharge, and User UID verification.
- Developed an automated marketing broadcast engine featuring a multi-tier CRM state machine, rate-limiting, and scheduled multi-media carousel deliveries.
- Created a headless Telegram Web attendance bot via native Chrome DevTools Protocol (CDP WebSocket), implementing real-time event listening and custom emoji reaction triggers (🐳) for automated OTP verification.
- Architected a 24/7 Facebook Automation Engine on Puppeteer & Brave Browser CDP, successfully bypassing complex Facebook React DOM anti-bot protections via a custom DataTransfer Drag-and-Drop synthetic injection payload (Base64-to-Blob DOM stream).
- Implemented a dynamic SEO caption permutation generator capable of rendering 2,800+ unique content variations with deduplication memory to evade anti-spam algorithms.
- Built a 24/7 time-based Master Scheduler featuring group discovery fast-skipping, DOM race condition reconciliation, and macOS caffeinate anti-sleep process injection.
```

---

## 🎯 4. TALKING POINTS UNTUK INTERVIEW (CARA MENJELASKAN KE REKRUITER)

Jika rekruiter bertanya: *"Bisa ceritakan pengalamanmu membuat bot Telegram dan Facebook?"*

**Jawaban Jawara (High-Impact Response):**
> *"Proyek bot yang saya buat bukan sekadar memanggil API wrapper sederhana. Di **Telegram**, saya membangun bot CRM terintegrasi dengan backend ERP untuk sinkronisasi transaksi secara real-time, manajemen state corong penjualan, serta otomasi Telegram Web berbasis Chrome DevTools Protocol (CDP) yang bisa melakukan listening dan menebar emoji reaction otomatis untuk verifikasi OTP.*
> 
> *Sedangkan di **Facebook**, saya memecahkan masalah besar terkait proteksi React DOM Facebook yang memblokir form upload standar. Saya merancang solusi custom dengan teknik **DataTransfer Drag-and-Drop Injection** (mengubah gambar ke Base64, merakit Blob di browser DOM, lalu menembakkan sintesis event drag & drop murni). Bot ini diorkestrasikan oleh Master Scheduler 24/7 lengkap dengan generator 2.800+ permutasi caption SEO agar aman dari deteksi spam."*

---

## 🛠️ Tech Stack & Key Buzzwords

`Node.js` • `Puppeteer-Core` • `Chrome DevTools Protocol (CDP)` • `WebSocket` • `React DOM Bypass` • `DataTransfer Base64/Blob Injection` • `Telegram Bot API` • `CRM State Machine` • `DOM Race Condition Reconciliation` • `Master Time-Based Scheduler` • `SEO Permutation Engine` • `macOS Caffeinate` • `Rate Limiting` • `Google Search Console Automation`
