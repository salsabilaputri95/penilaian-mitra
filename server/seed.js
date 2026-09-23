const path = require('path');
const xlsx = require('xlsx');
const db = require('./db');

function seed() {
  console.log('🚀 Memulai proses seeding data dari Mitra Terbaik SE2026.xlsx...');

  const excelPath = path.join(__dirname, '..', 'Mitra Terbaik SE2026.xlsx');
  const workbook = xlsx.readFile(excelPath);

  // 1. Bersihkan tabel master
  db.exec(`DELETE FROM users;`);
  db.exec(`DELETE FROM relations_ppl_pml;`);
  db.exec(`DELETE FROM questions;`);

  // Reset auto-increment
  db.exec(`DELETE FROM sqlite_sequence WHERE name IN ('users', 'relations_ppl_pml', 'questions');`);

  // 2. Insert Super Admin
  const insertUser = db.prepare(`
    INSERT INTO users (name, kecamatan, username, password, role)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertUser.run('Super Admin BPS Jeneponto', 'KABUPATEN JENEPONTO', 'thinkerstone', 'stone!23', 'Super Admin');
  console.log('✅ Super Admin dibuat: thinkerstone / stone!23');

  // 3. Insert Akun Pegawai
  const sheetPegawai = xlsx.utils.sheet_to_json(workbook.Sheets['Akun Pegawai'] || {});
  let pegCount = 0;
  for (const row of sheetPegawai) {
    const name = (row['Nama Pegawai'] || '').toString().trim();
    const kec = (row['Kecamatan'] || '').toString().trim().toUpperCase();
    const user = (row['Username'] || '').toString().trim();
    const pass = (row['Password'] || '').toString().trim();
    const role = (row['Role'] || 'Pegawai').toString().trim();

    if (name && user && pass) {
      insertUser.run(name, kec, user, pass, role);
      pegCount++;
    }
  }
  console.log(`✅ ${pegCount} Akun Pegawai berhasil diimport.`);

  // 4. Insert Akun PML
  const sheetPML = xlsx.utils.sheet_to_json(workbook.Sheets['Akun PML'] || {});
  let pmlCount = 0;
  for (const row of sheetPML) {
    const name = (row['Nama PML'] || '').toString().trim();
    const kec = (row['Kecamatan'] || '').toString().trim().toUpperCase();
    const user = (row['Username'] || '').toString().trim();
    const pass = (row['Password'] || '').toString().trim();
    const role = (row['Role'] || 'PML').toString().trim();

    if (name && user && pass) {
      insertUser.run(name, kec, user, pass, role);
      pmlCount++;
    }
  }
  console.log(`✅ ${pmlCount} Akun PML berhasil diimport.`);

  // 5. Insert Relasi PPL dan PML (dengan Deduplikasi Otomatis)
  const sheetRelasi = xlsx.utils.sheet_to_json(workbook.Sheets['Daftar PPL dan PML'] || {});
  const insertRel = db.prepare(`
    INSERT OR IGNORE INTO relations_ppl_pml (nama_ppl, nama_pml, kecamatan)
    VALUES (?, ?, ?)
  `);

  let relCount = 0;
  const seenRelations = new Set();

  for (const row of sheetRelasi) {
    const ppl = (row['Nama_PPL'] || '').toString().trim();
    const pml = (row['Nama_PML'] || '').toString().trim();
    const kec = (row['Nama_Kecamatan'] || '').toString().trim().toUpperCase();

    if (ppl && pml && kec) {
      const key = `${ppl.toUpperCase()}||${pml.toUpperCase()}||${kec}`;
      if (!seenRelations.has(key)) {
        seenRelations.add(key);
        insertRel.run(ppl, pml, kec);
        relCount++;
      }
    }
  }
  console.log(`✅ ${relCount} Relasi PPL-PML Unik berhasil diimport (Deduplikasi dari ${sheetRelasi.length} baris excel).`);

  // 6. Insert Pertanyaan PML (menilai PPL)
  const sheetQ_PML = xlsx.utils.sheet_to_json(workbook.Sheets['Daftar Pertanyaan PML'] || {});
  const insertQ = db.prepare(`
    INSERT INTO questions (target_role, number, code, indicator, weight, criteria, question, scale)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let qPmlCount = 0;
  for (const row of sheetQ_PML) {
    const no = parseInt(row['No']) || 0;
    const code = (row['Kode'] || '').toString().trim();
    const ind = (row['Indikator Penilaian'] || '').toString().trim();
    const weight = parseFloat(row['Bobot Indikator']) || 0;
    const crit = (row['Kriteria Evaluasi'] || '').toString().trim();
    const q = (row['Butir Pertanyaan'] || '').toString().trim();
    const scale = (row['Skala'] || '1 - 10').toString().trim();

    if (code && q) {
      insertQ.run('PPL', no, code, ind, weight, crit, q, scale);
      qPmlCount++;
    }
  }
  console.log(`✅ ${qPmlCount} Pertanyaan PML (Penilaian PPL) berhasil diimport.`);

  // 7. Insert Pertanyaan Pegawai (menilai PML)
  const sheetQ_Peg = xlsx.utils.sheet_to_json(workbook.Sheets['Daftar Pertanyaan Pegawai'] || {});
  let qPegCount = 0;
  for (const row of sheetQ_Peg) {
    const no = parseInt(row['No']) || 0;
    const code = (row['Kode'] || '').toString().trim();
    const ind = (row['Indikator Penilaian'] || '').toString().trim();
    const weight = parseFloat(row['Bobot Indikator']) || 0;
    const crit = (row['Kriteria Evaluasi'] || '').toString().trim();
    const q = (row['Butir Pertanyaan'] || '').toString().trim();
    const scale = (row['Skala'] || '1 - 10').toString().trim();

    if (code && q) {
      insertQ.run('PML', no, code, ind, weight, crit, q, scale);
      qPegCount++;
    }
  }
  console.log(`✅ ${qPegCount} Pertanyaan Pegawai (Penilaian PML) berhasil diimport.`);

  console.log('🎉 Seeding database selesai sempurna!');
}

if (require.main === module) {
  seed();
}

module.exports = seed;
