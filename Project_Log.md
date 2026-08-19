# WA Finance - Project Journal

**Date:** July 10, 2026
**Topic:** Project Initiation & Inspiration

## Initial Conversation & Idea
- The user discovered `freeapigateway.my.id`, a platform offering a Free WhatsApp AI BOT using Google Apps Script and Groq API.
- We discussed the possibility of building something similar, and the user decided to greenlight a new project called **"WA Finance"**.
- Our goal is to build an advanced WhatsApp Bot platform/gateway with AI capabilities, tailored towards Finance (specifics to be defined).
- **Core Technology Idea:**
  - Backend: Node.js (with Baileys or similar WhatsApp Web library) or Google Apps Script.
  - Frontend: React / Next.js / Vite dashboard.
  - AI Engine: Groq API (for blazing fast inference) or OpenAI.

## Open Questions for Next Steps
- Is "WA Finance" a SaaS platform where users can scan a QR code to create their own finance bots?
- Or is it a personal WhatsApp bot designed specifically to track the user's daily expenses and financial reports?

*Note: This document will be continuously updated to keep track of our conversations and progress.*

---

**Date:** August 19, 2026
**Topic:** UI Redesign Demo (Botanical Forest Green) & Visual Asset Preparation

## What Changed

### UI Redesign Demo (Standalone)
- Dibuat **high-fidelity standalone demo** (`wa-finance-demo.html`) yang mereplikasi desain baru 100% identik dengan referensi.
- Demo mencakup: Dashboard penuh (hero banner, metric cards, Chart.js area & donut chart, recent transactions, quote card) dan halaman Transaksi (summary banner, 7 category cards, activity table lengkap).
- Demo dapat dibuka di browser lokal: `file:///Users/christambayong/Downloads/wa-finance-demo.html`

### Visual Assets untuk Hero Header
Dua gambar asli telah disalin ke dalam proyek frontend (`Vault/frontend`) dan siap dipakai oleh Codex untuk integrasi ke React:

| File | Digunakan pada | Path (`src/assets/`) | Path (`public/`) |
|------|---------------|----------------------|------------------|
| `hero-banner-bg.png` | Hero Dashboard & Quote Card | `Vault/frontend/src/assets/hero-banner-bg.png` | `Vault/frontend/public/hero-banner-bg.png` |
| `transaction-banner-bg.png` | Header Menu Transaksi | `Vault/frontend/src/assets/transaction-banner-bg.png` | `Vault/frontend/public/transaction-banner-bg.png` |

> **Penting untuk Codex:** Gunakan `background-size: 100% 100%` agar gambar daun/botanical tidak terpotong pada capsule card dengan `border-radius: 20px`.

### Deployment Status (Diverifikasi 19 Agustus 2026)
- ✅ Firebase Hosting `https://wa-finance-bot-i729.web.app` — **HTTP 200** (live & sehat).
- ✅ Firebase Hosting `/m3-demo` route — **HTTP 200** (live).
- ✅ Custom domain `https://api-finance.i729.my.id` — **HTTP 200** (live & sehat).
- ✅ Custom domain `/m3-demo` route — **HTTP 200** (live, sudah terupdate, bukan 404 lagi).
- ✅ **Build di server production** sudah memakai asset terbaru `index-B8UEu-4V.js` dan `index-aNs1PpHZ.css` setelah deploy ke Mac mini.

## Next Steps untuk Codex
1. Review tampilan production di `https://api-finance.i729.my.id/m3-demo` bersama user.
2. Kalau demo sudah disetujui, pisahkan mana yang masuk ke halaman utama dan mana yang tetap sebagai demo.
3. Jika ada perubahan UI berikutnya, ulangi flow aman: rebuild frontend → salin ke `Vault/backend/public` → upload clean archive ke Mac mini → rebuild/restart Docker.

## Important Safety Note
- Jangan upload data sensitif ke GitHub: `.env`, Firebase service account JSON, API keys, SQLite database, WhatsApp session, Excel/PSD/screenshot/zip backup, personal reports.
- Gunakan explicit file staging, **bukan** `git add .`.
