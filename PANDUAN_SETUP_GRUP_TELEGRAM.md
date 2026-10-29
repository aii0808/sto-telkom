# PANDUAN LENGKAP SETUP GRUP & BOT TELEGRAM STO TELKOM AKSES

Dokumen ini berisi panduan resmi langkah demi langkah untuk menghubungkan **Bot Telegram (@sto_pyk_bot)** dengan **Grup Koordinasi Lapangan STO Telkom Akses Payakumbuh**.

---

## 1. Spesifikasi Bot & Grup Saat Ini

* **Username Bot:** `@sto_pyk_bot`
* **Nama Bot:** `sto_pyk`
* **Token Bot:** `8893464249:AAFhp-jmadAfKHrYfM56EzWyLN2d9_iaMm4`
* **Group ID Aktif:** `-1003981401195` (Nama Grup: `STO Beta`)

---

## 2. Cara Membuat Grup Telegram Baru & Memasukkan Bot

Jika Anda ingin membuat grup koordinasi baru (misalnya khusus teknisi atau pimpinan):

### Langkah 1: Buat Grup di Telegram
1. Buka aplikasi **Telegram** di HP (Android/iOS) atau Telegram Desktop/Web.
2. Klik ikon **Pensil / Menu** lalu pilih **Grup Baru (New Group)**.
3. Beri nama grup, contoh: `STO TELKOM AKSES PAYAKUMBUH`.

### Langkah 2: Tambahkan Bot ke Grup
1. Pada pencarian anggota grup, ketik username bot: **`@sto_pyk_bot`**.
2. Pilih bot **`sto_pyk`** dan klik **Tambah (Add)**.

### Langkah 3: Jadikan Bot sebagai Admin Grup (Wajib)
Supaya bot leluasa menyiarkan pesan dan mengelola inline button tanpa pembatasan privasi Telegram:
1. Buka **Info Grup** -> klik ikon **Edit / Pensil** -> pilih **Administrators (Pengurus)**.
2. Klik **Tambah Admin (Add Admin)** -> pilih `@sto_pyk_bot`.
3. Pastikan izin centang aktif:
   - ✅ **Kirim Pesan (Send Messages)**
   - ✅ **Sematkan Pesan (Pin Messages)**
   - ✅ **Kirim Tautan / Media (Embed Links)**
4. Klik **Simpan (Save)**.

---

## 3. Cara Mendapatkan Chat ID / Group ID Telegram

Jika membuat grup baru, Group ID-nya akan berbeda dari `-1003981401195`. Berikut 3 cara mudah mengetahuinya:

### Cara A: Melalui Endpoint Sistem STO (Paling Mudah)
1. Kirim pesan sembarang di dalam grup (misal: "Halo bot STO").
2. Buka browser atau jalankan terminal:
   ```bash
   curl http://localhost:5000/api/telegram/status
   ```
3. Cari bagian `recent_chats`. Anda akan melihat nama grup beserta ID-nya yang berawalan `-100...`.

### Cara B: Menggunakan Bot `@RawDataBot`
1. Masukkan sementara bot **`@RawDataBot`** ke grup Anda.
2. Bot tersebut akan otomatis membalas pesan JSON.
3. Lihat baris `"chat": { "id": -100xxxxxxxxxx }`.
4. Salin angka tersebut (termasuk tanda minus `-100`), lalu keluarkan bot `@RawDataBot`.

### Cara C: Melalui Telegram Web (web.telegram.org)
1. Buka grup Anda di Telegram Web browser.
2. Perhatikan URL di address bar, contoh: `https://web.telegram.org/a/#-1003981401195`.
3. Bagian `-1003981401195` adalah Group ID grup tersebut.

---

## 4. Konfigurasi File `.env` Backend

Buka file `sto-backend/.env` dan pastikan konfigurasi berikut terisi:

```env
PORT=5000
SUPABASE_URL=https://tguizphzmquqsuezjphr.supabase.co
SUPABASE_KEY=sb_publishable_Uau4leBbn8gHPo_acRwCTQ_Oq296jhM

# Konfigurasi Bot Telegram Resmi
TELEGRAM_TOKEN=8893464249:AAFhp-jmadAfKHrYfM56EzWyLN2d9_iaMm4
TELEGRAM_GROUP_ID=-1003981401195

APP_FRONTEND_URL=https://sto-telkom.vercel.app
```

---

## 5. Alur & Contoh Pesan Broadcast Otomatis

Sistem secara otomatis menyiarkan pesan ke grup Telegram saat 3 event operasional berikut terjadi di aplikasi:

### 1. 🚨 Tiket Gangguan / Pekerjaan Baru (Saat Pimpinan Terbitkan SPK)
Sistem mendukung 2 mode sesuai operasional riil Telkom IndiHome:

* **Mode A: Siaran Terbuka / Open Pool (Standar Tiket Gangguan)**
  Tiket tidak mencantumkan nama teknisi karena disiarkan terbuka untuk diperebutkan / diklaim oleh teknisi siaga di grup:
  ```html
  🚨 <b>TIKET GANGGUAN / PEKERJAAN BARU</b>
  ODP: ODP-PYK-FA/001
  Lokasi: Jl. Soekarno Hatta Koto Nan IV
  Jenis: Kabel Putus Tertimpa Pohon
  Status: 📢 Terbuka untuk Diambil (Open Pool)
  ```
  *(Dilengkapi tombol inline Telegram <b>[ 🔘 AMBIL TIKET SEKARANG ]</b> sehingga siapapun teknisi di grup yang pertama menekan tombol akan otomatis mengunci tiket tersebut ke akunnya).*

* **Mode B: Disposisi Langsung oleh Pimpinan**
  Jika Pimpinan memilih teknisi tertentu saat membuat tiket:
  ```html
  📌 <b>PENUGASAN TIKET PEKERJAAN</b>
  ODP: ODP-PYK-FA/001
  Lokasi: Jl. Soekarno Hatta Koto Nan IV
  Jenis: Pasang Baru IndiHome
  Teknisi Ditugaskan: Ahmad Fadli
  Status: Menunggu Pengerjaan
  ```
  *(Dilengkapi tombol inline <b>[ 🔍 BUKA TIKET PEKERJAAN ]</b>).*

### 2. 👷 Pendaftaran Teknisi Baru
Pesan tersiar saat akun teknisi baru didaftarkan ke sistem:
```html
👷 <b>TEKNISI BARU</b>
Nama: Ahmad Fadli (Teknisi Lapangan STO)
```

### 3. 📦 Pengajuan Barang / Material Baru
Pesan tersiar saat teknisi mengajukan kebutuhan material atau petugas gudang mendaftarkan inventaris:
```html
📦 <b>PENGAJUAN BARANG BARU</b>
Barang: 150m Dropcore FO, 1x Modem ONT ZTE
Pemohon: Ahmad Fadli
```

---

## 6. Uji Coba Manual via Terminal

Untuk menguji apakah bot dapat mengirim pesan ke grup Telegram:

```bash
# Uji coba via Node.js
node -e "require('dotenv').config({ path: 'sto-backend/.env' }); const { kirimKeGrup, esc } = require('./sto-backend/src/services/telegramService'); kirimKeGrup('🤖 <b>Tes Pesan Manual</b>\nKoneksi sukses!').then(console.log);"
```

