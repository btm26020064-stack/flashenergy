# Flash Energy Sibu - Sistem Tempahan & Pengurusan Operasi (ERP)

Sistem tempahan perkhidmatan servis penghawa dingin (Air Conditioning) & pendawaian elektrik (Electric Wiring) untuk **Flash Energy Sibu**, lengkap dengan modul ERP (Pengurusan Tempahan, Integrasi WhatsApp, Penugasan Juruteknik, Inventori Alat Ganti, Invois & Resit Rasmi).

---

## Maklumat Perniagaan (Daripada `details.txt`)

- **Nama Syarikat:** Flash Energy Sibu
- **Perkhidmatan:** 
  - Electric Wiring (Pendawaian Elektrik)
  - Air Conditioning Service & Installation (Servis & Pemasangan Aircond)
- **Kawasan Liputan:** Sibu, Sarawak (Jalan Intan, Lorong Pahlawan, Ulu Sungai Merah, Pekan Sibu, Sibu Jaya, Jalan Lanang, dsb.)
- **No. Telefon / WhatsApp:** 018-959 6569
- **Emel:** flashenergysibu@gmail.com
- **Facebook:** flashenergy
- **Alamat:** No. 38 & 40, Lot 2852 - 2853, Tingkat 1, Jalan Intan, 96000 Sibu, Sarawak

---

## Ciri-Ciri Utama Sistem

### 1. Portal Pelanggan (`/`)
- Paparan moden dengan logo rasmi `logo.jpeg` dan maklumat syarikat.
- **Borang Tempahan Lengkap:**
  - Nama Penuh
  - No. Telefon / WhatsApp
  - Emel (Pilihan)
  - Alamat Servis (disertakan butang pilihan pantas kawasan sekitar Sibu)
  - Pilihan Servis Utama (Air Conditioning vs Electric Wiring)
  - Sub-kategori servis dinamik (Chemical Wash, Gas Refill, Repair Tripping, DB Box Upgrade, dll.)
  - Bilangan unit / titik elektrik
  - Tarikh temujanji pilihan (minimum tarikh hari ini) & slot masa (Pagi, Tengah Hari/Petang, Petang/Malam)
  - Catatan masalah
- **Pengesahan Segera:** Kod rujukan tempahan dijana secara automatik (contoh: `FE-202610-XXXX`) berserta butang terus ke WhatsApp Flash Energy.
- **Semak Status Tempahan:** Pelanggan boleh masukkan kod tempahan atau nombor telefon untuk mengetahui status terkini (Menunggu, Diluluskan, Juruteknik Bertugas, Selesai).

### 2. Portal Admin & Modul ERP (`/admin`)
- **Papan Pemuka Statistik Masa Nyata:**
  - Jumlah tempahan **Hari Ini**
  - Jumlah tempahan **Esok**
  - Jumlah tempahan **Akan Datang**
  - Tempahan yang **Menunggu Kelulusan**
  - Jumlah Kutipan Hasil Bayaran
  - Notifikasi amaran baki stok inventori rendah
- **Pengurusan Tempahan:**
  - Penapis mengikut tarikh: *Semua*, *Hari Ini*, *Esok*, *Akan Datang*, *Terdahulu*.
  - Penapis status (*Pending*, *Approved*, *In Progress*, *Completed*, *Rejected*) dan carian pantas.
  - **Butang WhatsApp Terus:** Membuka WhatsApp Web / App dengan mesej pra-sedia yang diperibadikan mengikut nama, servis, tarikh, dan alamat pelanggan.
  - **Luluskan Tempahan (Approve):** Tugaskan juruteknik bertugas dan tetapkan anggaran kos.
  - **Tolak (Reject) & Padam (Delete):** Pengurusan status tempahan yang fleksibel.
- **ERP - Juruteknik & Staf:**
  - Senarai juruteknik, nombor telefon, kepakaran, dan pemantauan bilangan tugasan aktif.
  - Butang pantas untuk menghubungi juruteknik di WhatsApp.
- **ERP - Inventori & Alat Ganti:**
  - Pemantauan stok gas aircond (R32, R410A), kapasitor, kabel tembaga, MCB breaker, paip tembaga, dsb.
  - Butang tambah/kurang stok pantas (+ / -), amaran stok rendah, harga modal dan harga jualan.
- **ERP - Invois & Resit:**
  - Jana invois rasmi bagi tempahan.
  - Status bayaran (PAID / UNPAID) dan kaedah bayaran (Tunai, Online Banking / DuitNow, Cek).
  - Paparan & cetakan resit/invois rasmi berkepala surat (letterhead) syarikat Flash Energy Sibu (siap untuk cetak atau simpan ke PDF).
- **Tetapan Mesej WhatsApp & Profil:**
  - Admin boleh mengubah templat teks WhatsApp pada bila-bila masa menggunakan cip pembolehubah automatik (`{name}`, `{service}`, `{date}`, `{time}`, `{address}`, `{order_code}`, `{estimated_cost}`).

---

## Cara Menjalankan Sistem

1. Pasang dependensi (jika belum dipasang):
   ```bash
   npm install
   ```

2. Jalankan pelayan:
   ```bash
   npm start
   ```
   Pelayan akan aktif pada: `http://localhost:3001`

3. Akses laman web:
   - **Portal Pelanggan:** [http://localhost:3001/](http://localhost:3001/)
   - **Portal Admin & ERP:** [http://localhost:3001/admin](http://localhost:3001/admin)
