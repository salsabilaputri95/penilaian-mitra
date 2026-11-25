<div align="center">

# Sistem Penilaian Mitra Terbaik SE2026
### Badan Pusat Statistik (BPS) Kabupaten Jeneponto

Aplikasi web resmi untuk evaluasi kinerja, pemantauan progres, dan pemeringkatan objektif Mitra Statistik (**PPL** & **PML**) pada kegiatan **Sensus Ekonomi 2026 (SE2026)** di lingkungan BPS Kabupaten Jeneponto.

![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A522.5-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.21-000000?style=flat-square&logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-node%3Asqlite%20(WAL)-003B57?style=flat-square&logo=sqlite&logoColor=white)
![ExcelJS](https://img.shields.io/badge/Export-ExcelJS%20(.xlsx)-217346?style=flat-square&logo=microsoft-excel&logoColor=white)
![Status](https://img.shields.io/badge/Status-Production%20Ready-0066CC?style=flat-square)

</div>

---

## Daftar Isi

1. [Gambaran Umum](#-gambaran-umum)
2. [Fitur Utama](#-fitur-utama)
3. [Arsitektur & Teknologi](#-arsitektur--teknologi)
4. [Struktur Direktori](#-struktur-direktori)
5. [Hak Akses & Peran (RBAC)](#-hak-akses--peran-rbac)
6. [Metodologi & Rumus Penilaian](#-metodologi--rumus-penilaian)
7. [Skema Database](#-skema-database)
8. [Referensi API](#-referensi-api)
9. [Prasyarat & Instalasi](#-prasyarat--instalasi)
10. [Seeding Data dari Excel](#-seeding-data-dari-excel)
11. [Skrip yang Tersedia](#-skrip-yang-tersedia)

---

## 📌 Gambaran Umum

Pemilihan Mitra Terbaik SE2026 membutuhkan mekanisme penilaian yang terstruktur, terstandarisasi, dan bebas bias. Sistem ini dibangun sebagai *Single Page Application* (SPA) ringan dengan backend Node.js/Express dan basis data SQLite terintegrasi (`node:sqlite`) yang secara otomatis mengimpor data master penugasan, akun evaluator, relasi PML–PPL, serta instrumen pertanyaan langsung dari berkas sumber `Mitra Terbaik SE2026.xlsx`.

Sistem menerapkan pemisahan hak akses (*Role-Based Access Control*) yang ketat sehingga setiap evaluator hanya dapat mengakses dan menilai mitra sesuai hierarki penugasan wilayah masing-masing, sementara pemantauan progres kabupaten, pemeringkatan (*leaderboard*), dan ekspor laporan terpusat dikelola oleh Super Admin.

---

## 🌟 Fitur Utama

- **Evaluasi Berjenjang Berbasis Relasi & Wilayah**:
  - **PML** menilai **PPL** binaannya secara langsung berdasarkan relasi penugasan.
  - **Pegawai Organik BPS** menilai **PML** di kecamatan wilayah tugasnya.
- **Perhitungan Nilai Terbobot Otomatis & Real-Time**:
  - Kalkulator skor langsung (*live score calculator*) pada formulir evaluasi sebelum disimpan.
  - Dukungan pembaruan/edit nilai (*idempotent upsert*) untuk penilaian yang telah tersimpan.
- **Dashboard Eksekutif & Leaderboard (Khusus Super Admin)**:
  - Ringkasan metrik progres penilaian tingkat kabupaten dan rincian per kecamatan.
  - Papan peringkat (*leaderboard*) Mitra Terbaik untuk kategori PPL dan PML.
  - Fitur penghapusan/reset entri evaluasi apabila diperlukan audit ulang.
- **Ekspor Laporan Excel Terformat (`.xlsx`)**:
  - Menghasilkan rekapitulasi nilai per indikator, skor akhir terbobot, predikat, dan catatan evaluasi menggunakan `ExcelJS`.
- **Auto-Seeding & Zero-Config Database**:
  - Basis data SQLite dengan mode `WAL` (*Write-Ahead Logging*) untuk konkurensi lebih baik, serta inisialisasi otomatis saat server pertama kali dijalankan jika tabel pengguna masih kosong.
- **Antarmuka Modern & Responsif**:
  - Desain bersih bernuansa korporat BPS, mendukung penggunaan melalui perangkat desktop maupun smartphone di lapangan.

---

## 🛠️ Arsitektur & Teknologi

| Lapisan | Teknologi / Pustaka | Keterangan |
| :--- | :--- | :--- |
| **Runtime** | Node.js ($\ge$ 22.5) | Menggunakan modul bawaan `node:sqlite` (`DatabaseSync`) |
| **Backend Framework** | Express (`^4.21.2`), CORS (`^2.8.5`) | REST API dan penyajian aset statis SPA |
| **Database** | SQLite (`data/penilaian.db`) | Mode `PRAGMA journal_mode = WAL` |
| **Excel Importer** | SheetJS / `xlsx` (`^0.18.5`) | Membaca data akun, relasi, dan instrumen dari `.xlsx` |
| **Excel Exporter** | `exceljs` (`^4.4.0`) | Ekspor laporan rekapitulasi terstruktur |
| **Frontend** | HTML5, CSS3, Vanilla JavaScript | SPA ringan di folder `public/` dengan Font Awesome & Plus Jakarta Sans |

---

## 📂 Struktur Direktori

```text
Penilaian Mitra/
├── data/
│   └── penilaian.db           # File database SQLite (otomatis dibuat/diisi saat seed)
├── public/
│   ├── index.html             # Halaman utama SPA (Login, Dashboard, Evaluasi, Admin)
│   ├── app.js                 # Logika antarmuka, state pengguna, dan integrasi API
│   ├── style.css              # Gaya antarmuka modern & responsif
│   └── logo.webp              # Logo resmi BPS Kabupaten Jeneponto
├── server/
│   ├── db.js                  # Koneksi SQLite (WAL mode) & inisialisasi skema tabel
│   ├── seed.js                # Seeder data master dari file Excel ke SQLite
│   └── server.js              # Entry point Express, kalkulasi skor, & seluruh endpoint API
├── Mitra Terbaik SE2026.xlsx  # Berkas sumber data akun, relasi PPL-PML, dan kuesioner
├── implementation_plan.md     # Dokumen perencanaan implementasi sistem
├── package.json               # Konfigurasi proyek dan dependensi Node.js
└── README.md                  # Dokumentasi proyek
```

---

## 🔐 Hak Akses & Peran (RBAC)

| Peran (`role`) | Sumber Akun | Ruang Lingkup Penilaian | Akses Leaderboard & Ekspor | Edit Nilai |
| :--- | :--- | :--- | :---: | :---: |
| **PML** | Sheet `Akun PML` | Hanya **PPL binaannya** sesuai relasi penugasan | Tidak (disembunyikan demi objektivitas) | Ya |
| **Pegawai** | Sheet `Akun Pegawai` | Hanya **PML di kecamatan** wilayah tugasnya | Tidak (disembunyikan demi objektivitas) | Ya |
| **Super Admin** | Konfigurasi `seed.js` | Monitoring seluruh kabupaten & kecamatan | Ya (Overview, Leaderboard, Hapus Evaluasi, Ekspor `.xlsx`) | - |

> [!NOTE]
> Kredensial default untuk peran **Super Admin** didefinisikan di dalam `server/seed.js`. Pastikan untuk memperbarui kredensial tersebut sebelum melakukan deployment ke lingkungan produksi publik.

---

## 📐 Metodologi & Rumus Penilaian

Setiap target penilaian (baik **PPL** maupun **PML**) dievaluasi menggunakan **4 Indikator**, di mana masing-masing indikator terdiri dari **3 butir pertanyaan** dengan skala penilaian **1 – 10** (skor mentah maksimal per indikator = **30 poin**).

### Bobot Indikator

| Indikator | Kode Butir (PPL / PML) | Jumlah Butir | Skor Maksimal Mentah | Bobot |
| :--- | :---: | :---: | :---: | :---: |
| Indikator 1 | `P1.1–P1.3` / `M1.1–M1.3` | 3 | 30 | **35%** |
| Indikator 2 | `P2.1–P2.3` / `M2.1–M2.3` | 3 | 30 | **30%** |
| Indikator 3 | `P3.1–P3.3` / `M3.1–M3.3` | 3 | 30 | **20%** |
| Indikator 4 | `P4.1–P4.3` / `M4.1–M4.3` | 3 | 30 | **15%** |

### Rumus Nilai Akhir (Skala 0 – 100)

$$\text{Nilai Akhir} = \left(\frac{\text{Skor Indikator 1}}{30} \times 35\right) + \left(\frac{\text{Skor Indikator 2}}{30} \times 30\right) + \left(\frac{\text{Skor Indikator 3}}{30} \times 20\right) + \left(\frac{\text{Skor Indikator 4}}{30} \times 15\right)$$

### Kategori Predikat

| Rentang Nilai Akhir | Predikat |
| :---: | :--- |
| $\ge 90$ | **Sangat Baik (Sangat Memuaskan)** |
| $80 - 89.99$ | **Baik (Memuaskan)** |
| $70 - 79.99$ | **Cukup (Memenuhi Standar)** |
| $< 70$ | **Perlu Pembinaan** |

---

## 🗄️ Skema Database

Database SQLite (`data/penilaian.db`) dikelola oleh `server/db.js` dengan empat tabel utama:

1. **`users`**: Menyimpan data akun `Super Admin`, `Pegawai`, dan `PML` beserta wilayah `kecamatan`.
2. **`relations_ppl_pml`**: Menyimpan relasi unik `(nama_ppl, nama_pml, kecamatan)` hasil deduplikasi dari Excel.
3. **`questions`**: Menyimpan daftar indikator, bobot, kriteria evaluasi, butir pertanyaan, dan skala untuk `target_role` (`PPL` atau `PML`).
4. **`evaluations`**: Menyimpan hasil penilaian (`scores_json`, skor per indikator `score_ind1`–`score_ind4`, `final_score`, `predikat`, dan `notes`) dengan constraint unik `(evaluator_id, target_name, target_type)`.

---

## 🔌 Referensi API

### Autentikasi & Evaluasi

| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Autentikasi pengguna (`username` & `password`) |
| `GET` | `/api/questions` | Mengambil daftar pertanyaan evaluasi (opsional query `?targetType=PPL\|PML`) |
| `GET` | `/api/targets` | Mengambil daftar mitra yang berhak dinilai oleh `userId` |
| `GET` | `/api/evaluations/:targetType/:targetName` | Mengambil detail evaluasi yang sudah tersimpan untuk target tertentu |
| `POST` | `/api/evaluations` | Menyimpan atau memperbarui hasil penilaian mitra |

### Administrasi (Khusus Super Admin)

Endpoint admin dilindungi middleware `checkSuperAdmin` menggunakan header `x-user-id` atau parameter query `userId`.

| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/admin/overview` | Statistik progres penilaian tingkat kabupaten dan per kecamatan |
| `GET` | `/api/admin/leaderboard` | Daftar peringkat mitra terbaik (PPL & PML) |
| `DELETE` | `/api/admin/evaluations/:id` | Menghapus satu entri evaluasi berdasarkan ID |
| `GET` | `/api/admin/export` | Mengunduh laporan rekapitulasi penilaian dalam format `.xlsx` |

---

## 🚀 Prasyarat & Instalasi

### Prasyarat
- **Node.js** versi **22.5.0 atau lebih baru** (diperlukan karena menggunakan modul bawaan `node:sqlite`).
- **npm** (terinstal bersama Node.js).
- File sumber **`Mitra Terbaik SE2026.xlsx`** berada di direktori root proyek.

### Langkah Menjalankan Aplikasi

1. **Masuk ke direktori proyek dan pasang dependensi**:
   ```bash
   npm install
   ```

2. **Inisialisasi / Seeding Database (opsional jika database masih kosong)**:
   ```bash
   npm run seed
   ```
   > Server juga akan menjalankan proses seeding secara otomatis pada saat startup apabila tabel `users` masih kosong.

3. **Jalankan server aplikasi**:
   ```bash
   npm start
   ```
   Untuk mode pengembangan dengan *auto-reload*:
   ```bash
   npm run dev
   ```

4. **Akses aplikasi melalui browser**:
   ```text
   http://localhost:3000
   ```
   *(Port dapat diubah melalui environment variable `PORT`, default: `3000`.)*

---

## 📊 Seeding Data dari Excel

Skrip `server/seed.js` membaca sheet berikut dari `Mitra Terbaik SE2026.xlsx`:
- `Akun Pegawai` — akun evaluator Pegawai Organik BPS beserta kecamatannya.
- `Akun PML` — akun evaluator Pengawas Mitra Lapangan beserta kecamatannya.
- `Daftar PPL dan PML` — pemetaan relasi PPL–PML (otomatis dideduplikasi).
- `Daftar Pertanyaan PML` — instrumen penilaian untuk menilai PPL.
- `Daftar Pertanyaan Pegawai` — instrumen penilaian untuk menilai PML.

> [!WARNING]
> Menjalankan `npm run seed` akan menghapus dan mengisi ulang tabel master (`users`, `relations_ppl_pml`, `questions`), namun tetap mempertahankan data pada tabel `evaluations`.

---

## 📜 Skrip yang Tersedia

| Perintah | Deskripsi |
| :--- | :--- |
| `npm start` | Menjalankan server produksi (`node server/server.js`) |
| `npm run dev` | Menjalankan server dalam mode watch (`node --watch server/server.js`) |
| `npm run seed` | Mengimpor ulang data master dari `Mitra Terbaik SE2026.xlsx` ke SQLite |

---

<div align="center">
<sub>Dikembangkan untuk mendukung kelancaran dan objektivitas Sensus Ekonomi 2026 — <strong>BPS Kabupaten Jeneponto</strong></sub>
</div>
