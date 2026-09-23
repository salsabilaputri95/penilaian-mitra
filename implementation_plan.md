# Rencana Implementasi: Sistem Penilaian Mitra Terbaik BPS Kab Jeneponto SE2026

Membangun aplikasi website penilaian mitra statistik (PPL & PML) BPS Kabupaten Jeneponto untuk Sensus Ekonomi 2026 (SE2026) dengan antarmuka modern, responsif, dan aman sesuai aturan bisnis dan hierarki penugasan.

---

## 📌 Alur Bisnis & Hak Akses (Role-Based Access Control)

1. **Akun & Peran**:
   - **Super Admin**:
     - *Username*: `thinkerstone`
     - *Password*: `stone!23`
     - *Hak Akses*:
       - Dashboard Executive & Statistik Progres Penilaian Kabupaten & per Kecamatan.
       - Halaman Leaderboard & Pemeringkatan Mitra Terbaik (PPL & PML).
       - Fitur Export Rekapitulasi Penilaian ke File Excel (`.xlsx`).
       - Rekap detail isian butir penilaian seluruh mitra.
   - **PML (Pengawas Mitra Lapangan)**:
     - Kredensial dari sheet `Akun PML` di Excel.
     - Hanya dapat melihat dan menilai **PPL bawahannya** (berdasarkan relasi di `Daftar PPL dan PML`).
     - **Bisa mengedit kembali** hasil penilaian yang telah disimpan.
     - **Tidak dapat** melihat leaderboard atau nilai PML/PPL lain.
   - **Pegawai (Organik BPS)**:
     - Kredensial dari sheet `Akun Pegawai` di Excel.
     - Hanya dapat melihat dan menilai **PML di kecamatan wilayah tugasnya**.
     - **Bisa mengedit kembali** hasil penilaian yang telah disimpan.
     - **Tidak dapat** melihat leaderboard atau nilai pegawai/PML lain.

2. **Rumus Perhitungan Nilai Akhir (Skala 0 - 100)**:
   Setiap indikator memiliki 3 butir pertanyaan dengan skala nilai 1 - 10 (Skor Maksimal = 30 per indikator).
   $$\text{Nilai Akhir} = \left(\frac{\text{Skor Indikator 1}}{30} \times 35\right) + \left(\frac{\text{Skor Indikator 2}}{30} \times 30\right) + \left(\frac{\text{Skor Indikator 3}}{30} \times 20\right) + \left(\frac{\text{Skor Indikator 4}}{30} \times 15\right)$$

3. **Indikator & Butir Penilaian**:
   - **PML Menilai PPL**:
     1. Kualitas Data & Akurasi Teknis (Bobot: 35%, 3 Butir)
     2. Ketepatan Waktu & Target Output (Bobot: 30%, 3 Butir)
     3. Kedisiplinan & Etika Pendataan (Bobot: 20%, 3 Butir)
     4. Sikap Kerja, Komunikasi, & Responsivitas (Bobot: 15%, 3 Butir)
   - **Pegawai Menilai PML**:
     1. Pengawasan Teknis & Quality Control (Bobot: 35%, 3 Butir)
     2. Manajemen Tim & Penyelesaian Target (Bobot: 30%, 3 Butir)
     3. Kepemimpinan & Pembinaan PPL (Bobot: 20%, 3 Butir)
     4. Komunikasi & Pelaporan ke Organik (Bobot: 15%, 3 Butir)

---

## 🛠️ Arsitektur & Teknologi

- **Backend**: Node.js + Express + SQLite (data awal diimpor otomatis dari file `Mitra Terbaik SE2026.xlsx`).
- **Frontend**: Single Page Application (SPA) responsif & modern bergaya BPS Corporate (BPS Blue, Cyan Accent, Glassmorphism, Micro-animations, Mobile Friendly).
- **Export Engine**: `exceljs` untuk menghasilkan rekapitulasi penilaian Excel berformat rapi dan profesional.

---

## 📋 Langkah Eksekusi

1. **Inisialisasi Project Node.js**: Setup `package.json`, install dependencies (`express`, `better-sqlite3` / `sqlite3`, `exceljs`, `cors`, `xlsx`, `jsonwebtoken`, `bcryptjs` / simple secure hash).
2. **Database & Seeder**:
   - Script migrasi database SQLite untuk tabel `users`, `relations_ppl_pml`, `questions`, dan `evaluations`.
   - Seed data otomatis dari file `Mitra Terbaik SE2026.xlsx` + Akun Super Admin `thinkerstone`.
3. **Backend API Endpoints**:
   - Auth: `/api/auth/login`, `/api/auth/me`.
   - Penilaian: `/api/targets` (daftar target yang boleh dinilai), `/api/questions` (indikator sesuai role), `/api/evaluations` (simpan/edit nilai).
   - Admin Only: `/api/admin/overview`, `/api/admin/leaderboard`, `/api/admin/export`.
4. **Frontend Modern**:
   - **Login Page**: Pilihan login mudah dengan info bantuan akun.
   - **PML & Pegawai Dashboard**: Card daftar mitra, status penilaian, tombol Nilai / Edit Nilai, progres bar penyelesaian.
   - **Penilaian Modal / Form View**: Slider / Radio Skala 1-10 interaktif, live counter skor indikator, live gauge Nilai Akhir, input catatan evaluasi.
   - **Super Admin Dashboard & Leaderboard**:
     - Metrik total progres penilaian (PPL ternilai, PML ternilai).
     - Leaderboard Ranking PPL & PML Terbaik dengan filter Kecamatan dan Search.
     - Tombol Export Excel (.xlsx) dengan laporan berbobot lengkap.
5. **Testing & Validasi**:
   - Verifikasi login PML, Pegawai, Super Admin.
   - Verifikasi isolasi hak akses (PML hanya menilai PPL-nya, Pegawai hanya menilai PML kecamatannya).
   - Verifikasi perhitungan matematis rumus bobot.
   - Verifikasi fitur edit nilai setelah disimpan.
   - Verifikasi export Excel.
