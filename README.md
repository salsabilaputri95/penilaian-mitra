# Sistem Penilaian Mitra Terbaik SE2026 - BPS Kabupaten Jeneponto

Aplikasi Web Resmi Penilaian & Pemilihan Mitra Terbaik Sensus Ekonomi 2026 (SE2026) Badan Pusat Statistik Kabupaten Jeneponto.

---

## 🌟 Fitur Utama

1. **Autentikasi & Hak Akses Berjenjang (Role-Based Access Control)**:

   - **PML (Pengawas Mitra Lapangan)**:
     - Kredensial sesuai file `Mitra Terbaik SE2026.xlsx`.
     - Hanya dapat melihat & menilai **PPL binaannya**.
     - **Bisa mengedit kembali** hasil penilaian yang telah disimpan.
     - *Leaderboard disembunyikan* untuk menjaga objektivitas.
   - **Pegawai Organik BPS**:
     - Kredensial sesuai file `Mitra Terbaik SE2026.xlsx`.
     - Hanya dapat melihat & menilai **PML di wilayah kecamatannya**.
     - **Bisa mengedit kembali** hasil penilaian yang telah disimpan.
     - *Leaderboard disembunyikan*.
2. **Rumus Perhitungan Nilai Terbobot (Skala 0 - 100)**:
   Masing-masing indikator memiliki 3 pertanyaan dengan skala nilai 1 - 10 (Maksimal 30 poin):

   $$
   \text{Nilai Akhir} = \left(\frac{\text{Skor Indikator 1}}{30} \times 35\right) + \left(\frac{\text{Skor Indikator 2}}{30} \times 30\right) + \left(\frac{\text{Skor Indikator 3}}{30} \times 20\right) + \left(\frac{\text{Skor Indikator 4}}{30} \times 15\right)
   $$
3. **Desain Modern & Responsif**:

   - Tema elegan Navy & Cyan BPS dengan efek Glassmorphism.
   - Live score calculator ribbon pada formulir evaluasi.
   - Mobile-friendly untuk pengisian langsung melalui smartphone di lapangan.

---

## 🚀 Cara Menjalankan Aplikasi

1. Buka terminal/command prompt di folder project:

   ```bash
   npm install
   ```
2. (Opsional) Jalankan Seeder Database dari file Excel:

   ```bash
   npm run seed
   ```
3. Jalankan Server:

   ```bash
   npm start
   ```
4. Buka browser dan akses:

   ```
   http://localhost:3000
   ```
