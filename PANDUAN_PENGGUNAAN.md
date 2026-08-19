# 📖 Panduan Penggunaan Lengkap WA Finance Gateway Platform

Selamat datang di **WA Finance Gateway** — Platform pencatatan, pemantauan keuangan pribadi, dan pengelolaan dompet multi-rekening yang terintegrasi langsung dengan WhatsApp Bot AI.

Dokumen ini berisi panduan lengkap seluruh menu, kartu metrik, sub-menu popover, tombol aksi, dan alur penggunaan webapp dari A sampai Z.

---

## 📑 Daftar Isi
1. [Struktur Navigasi & Tampilan Utama](#1-struktur-navigasi--tampilan-utama)
2. [Header Global & Fitur Filter Popover](#2-header-global--fitur-filter-popover)
3. [Menu 1: Dashboard (Pusat Kendali Keuangan)](#3-menu-1-dashboard-pusat-kendali-keuangan)
4. [Menu 2: Transaksi (`/expenses`)](#4-menu-2-transaksi-expenses)
5. [Menu 3: Dompet & Proteksi Budget (`/dompet`)](#5-menu-3-dompet--proteksi-budget-dompet)
6. [Menu 4: Gateway WA (`/whatsapp`)](#6-menu-4-gateway-wa-whatsapp)
7. [Menu 5: Format Balasan WA (`/conversations`)](#7-menu-5-format-balasan-wa-conversations)
8. [Menu 6: Analytic (`/analytics`)](#8-menu-6-analytic-analytics)
9. [Menu 7: Pengaturan (`/settings`)](#9-menu-7-pengaturan-settings)
10. [Panduan Input via Chat WhatsApp Bot](#10-panduan-input-via-chat-whatsapp-bot)

---

## 1. Struktur Navigasi & Tampilan Utama

Sidebar di sebelah kiri memiliki 2 kelompok menu utama:
* **APLIKASI**:
  * **Dashboard** (`/`): Ringkasan total saldo, kartu ATM multi-dompet, 4 kartu ringkasan keuangan, streak harian, grafik tren, dan riwayat transaksi terbaru.
  * **Transaksi** (`/expenses`): Tabel riwayat seluruh transaksi, filter kategori, pencarian cepat, cetak/ekspor data, tambah/edit transaksi manual.
  * **Dompet** (`/dompet`): Manajemen rekening/e-wallet (tambah saldo, nomor rekening, set Dompet Utama ⭐) dan pembatasan limit anggaran per kategori belanja.
* **OPERASIONAL**:
  * **Gateway WA** (`/whatsapp`): Monitoring koneksi bot WhatsApp Baileys, QR Code Pairing, status server.
  * **Format Balasan** (`/conversations`): Kustomisasi template pesan otomatis WhatsApp saat transaksi dicatat bot.
  * **Analytic** (`/analytics`): Analisis visual mendalam pengeluaran, perbandingan pemasukan vs pengeluaran, dan persebaran dompet.
  * **Pengaturan** (`/settings`): Profil pengguna, konfigurasi budget bulanan, integrasi webhook, reset data.

---

## 2. Header Global & Fitur Filter Popover

Header terletak di bagian paling atas setiap halaman:
1. **Tombol Sidebar Toggle (☰ / ‹)**: Untuk menyembunyikan atau memperlebar sidebar navigasi.
2. **Tombol Filter Periode & Sumber Dana (⚙️ [Bulan])**:
   * **Bulan**: Menampilkan nama bulan aktif saat ini.
   * **Dari Tanggal & Sampai Tanggal**: Menentukan rentang tanggal transaksi yang ingin ditampilkan di seluruh grafik dan tabel.
   * **Dompet**: Filter data berdasarkan rekening tertentu (misal hanya melihat transaksi *BCA*, *SUPERBANK*, *Cash*, *GoPay*, atau *Semua dompet*).
   * **Kategori**: Filter data berdasarkan pos pengeluaran tertentu (misal hanya melihat *Makan*, *Belanja*, *Tagihan*, *Tabungan*, dll.).
   * **Tombol Reset**: Mengembalikan semua filter ke posisi default (1 bulan penuh, semua dompet, semua kategori).
   * **Tombol Terapkan**: Mengeksekusi filter secara instan di Dashboard, Transaksi, dan Analitik.
   * **Badge Indikator**: Ketika filter aktif, tombol filter akan menyala hijau dan menampilkan jumlah filter yang sedang bekerja.
3. **Tombol Dark / Light Mode (☀️ / 🌙)**: Beralih tema gelap (Emerald Forest Dark) atau tema terang.
4. **Avatar Profil**: Menampilkan inisial akun kamu.

---

## 3. Menu 1: Dashboard (Pusat Kendali Keuangan)

### A. Hero Top Bar
* **Sapaan & Periode**: Menampilkan nama dan rentang periode aktif pembukuan.
* **Tombol `Excel`**: Mengunduh seluruh pembukuan periode aktif ke dalam format spreadsheet Excel (`.xlsx`).
* **Tombol `Cetak PDF`**: Membuka tampilan cetak browser untuk menyimpan laporan keuangan ke file PDF atau dicetak langsung.
* **Tombol `Tutup Periode`**: Membackup Google Sheet lama, mengarsipkan transaksi lama, dan memulai periode pembukuan baru dari nol tanpa menghapus histori.

### B. Carousel Kartu ATM (Total Saldo & Rekening Terpisah)
* **Auto-Slide & Drag-to-Slide**: Kartu bergeser otomatis setiap 5 detik (berhenti saat kursor mouse berada di atas kartu). Kamu juga bisa menekan dan menggeser (drag/swipe) kartu ke kiri/kanan secara manual.
* **Seamless Infinite Loop**: Kartu berputar tanpa batas secara halus tanpa efek 'rewind'.
* **Kartu 0 (TOTAL SALDO)**: Menampilkan total seluruh dana gabungan dari seluruh dompet aktif yang kamu miliki, persentase sisa budget bulanan, serta tombol pensil ✏️ untuk mengubah target budget bulanan.
* **Kartu 1..N (Masing-Masing Dompet)**: Menampilkan saldo tersisa riil khusus untuk dompet tersebut (misal Saldo BCA, Saldo SUPERBANK, Saldo Cash), badge ⭐ jika dompet tersebut merupakan **Dompet Utama**, dan 4 digit terakhir nomor rekening yang disamarkan (`•••• •••• •••• 7890`).

### C. Baris 4 Kartu Metrik Keuangan
1. **PEMASUKAN**: Total uang masuk (Gaji, Bonus, Transfer Masuk) di periode aktif.
2. **PENGELUARAN**: Total uang keluar yang dibelanjakan pada periode aktif beserta grafik garis mini (sparkline).
3. **TRANSAKSI**: Jumlah total frekuensi transaksi yang tercatat.
4. **TABUNGAN & INVESTASI**:
   * Menampilkan total dana yang berhasil disisihkan ke pos tabungan/investasi.
   * **Tombol `+ Catat`**: Klik tombol ini untuk membuka pop-up cepat mencatat setoran tabungan baru langsung dari Dashboard.

### D. Strip Aktivitas 7 Hari (Streak & Kalender)
* **Streak Counter**: Menghitung berapa hari berturut-turut kamu aktif mencatat keuangan tanpa terputus.
* **Navigasi Minggu `‹` dan `›`**: Klik panah kiri/kanan untuk melihat riwayat minggu lalu atau minggu depan.
* **Klik Tanggal (Hari)**: Klik salah satu kotak hari (misal `RAB 19`) untuk langsung memfilter tabel transaksi di bawahnya khusus transaksi pada hari tersebut.
* **Tombol `Lihat satu bulan`**: Navigasi cepat ke halaman tabel lengkap transaksi.

### E. Grafik Pengeluaran & Persebaran Dompet
* **Expense Trend**: Grafik area interaktif dengan pilihan rentang waktu *Harian*, *Mingguan*, dan *Bulanan*.
* **Category Breakdown**: Grafik donat interaktif pengeluaran per kategori.
* **Saldo per Dompet**: Bar perbandingan pengeluaran antar rekening.

### F. Riwayat Transaksi Terbaru (Recent Transactions)
* Menampilkan 5 transaksi paling baru (atau transaksi dari tanggal yang kamu klik di strip 7 hari).

---

## 4. Menu 2: Transaksi (`/expenses`)

Menu pencatatan dan pembukuan detail seluruh transaksi:
* **Tombol `+ Tambah`**: Membuka modal formulir transaksi manual:
  * Pilihan Tipe: **↘ Pengeluaran**, **↗ Pemasukan**, atau **🏦 Tabungan**.
  * Input: Nama Toko/Merchant/Deskripsi, Nominal (Rp), Tanggal, Pilihan Dompet, dan Kategori.
* **Pencarian Cepat (`🔍 Cari transaksi...`)**: Ketik nama toko, kategori, nominal, atau nama rekening untuk memfilter tabel secara instan.
* **10 Kartu Ringkasan Kategori**: Menampilkan 10 kategori teratas beserta persentase dan nominalnya. Klik kartu kategori untuk langsung memfilter tabel.
* **Aksi Edit & Hapus**:
  * Klik ikon pensil ✏️ untuk mengedit transaksi.
  * Klik ikon tempat sampah 🗑️ untuk menghapus transaksi.

---

## 5. Menu 3: Dompet & Proteksi Budget (`/dompet`)

Kelola seluruh rekening bank, e-wallet, uang tunai, dan pagu anggaran:
1. **Daftar Dompet (Sumber Dana)**:
   * Tambah dompet baru (misal BCA, Bank Mandiri, GoPay, OVO, Bibit).
   * Masukkan **Saldo Awal** dan **Nomor Rekening**.
   * Klik tombol **Bintang ⭐** untuk menjadikan rekening tersebut sebagai **Dompet Utama**.
2. **Proteksi Budget per Kategori (Budgeting)**:
   * Atur limit anggaran maksimal per bulan untuk masing-masing kategori (misal: Makan Rp 1.500.000, Belanja Rp 2.000.000, Tabungan Rp 1.000.000).
   * Atur batas peringatan dini (*Threshold*, misal 80%) agar sistem memberi sinyal saat pengeluaran hampir mendekati batas pagu.

---

## 6. Menu 4: Gateway WA (`/whatsapp`)

Pusat kendali koneksi server WhatsApp:
* **Status Koneksi**: Menampilkan status realtime bot (Connected 🟢, QR Ready 🟡, atau Offline 🔴).
* **Scan QR Code**: Jika koneksi terputus, pindai QR Code menggunakan aplikasi WhatsApp di HP kamu (WhatsApp > Perangkat Tertaut > Tautkan Perangkat).
* **Tombol Reconnect & Restart**: Melakukan penyambungan ulang otomatis tanpa perlu login ulang ke terminal server.

---

## 7. Menu 5: Format Balasan WA (`/conversations`)

Kustomisasi format teks balasan otomatis yang dikirimkan oleh Bot WhatsApp:
* Mengatur template balasan saat transaksi pengeluaran berhasil disimpan.
* Mengatur template balasan saat uang masuk/gaji tercatat.
* Mengatur template rekap saldo harian/mingguan.

---

## 8. Menu 6: Analytic (`/analytics`)

Halaman statistik dan visualisasi cerdas:
* **Grafik Arus Kas (Income vs Expense)**: Membandingkan total uang masuk versus uang keluar.
* **Distribusi Dompet**: Melihat dari dompet mana pengeluaran terbanyak dilakukan.
* **Rata-rata Pengeluaran Harian & Mingguan**.

---

## 9. Menu 7: Pengaturan (`/settings`)

* Mengatur nama profil pengguna.
* Mengatur budget bulanan global.
* Konfigurasi koneksi database & sinkronisasi Google Sheets.
* Menghapus cache atau melakukan reset sistem jika diperlukan.

---

## 10. Panduan Input via Chat WhatsApp Bot

Kamu bisa mencatat seluruh transaksi hanya dengan mengirim chat WhatsApp ke nomor bot kamu:

### A. Format Pengeluaran:
* `Makan siang ayam geprek 25rb di BCA`
* `Beli bensin 50000 cash`
* `Bayar listrik token 200rb transfer`
* `Kopi kenangan 35k gopay`

### B. Format Pemasukan:
* `Gaji bulanan 8000000 masuk ke BCA`
* `Bonus proyek 1.5jt bca`
* `Terima transfer 250rb dari teman`

### C. Format Tabungan & Investasi:
* `Nabung 500rb di BCA`
* `Tabung 1jt ke Bank`
* `Beli reksadana bibit 500rb bca`
* `Simpan tabungan dana darurat 300rb`

---
*WA Finance Gateway Platform — Dirancang untuk kerapian finansial dan kemudahan hidup sehari-hari.* 🌿🚀
