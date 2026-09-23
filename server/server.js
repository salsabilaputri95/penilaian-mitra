const express = require('express');
const cors = require('cors');
const path = require('path');
const ExcelJS = require('exceljs');
const db = require('./db');
const seed = require('./seed');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Auto-seed if database is empty
try {
  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
  if (userCount === 0) {
    seed();
  }
} catch (e) {
  console.log('Seeding initial data...');
  seed();
}

// Helper: Calculate scores
function calculateScores(scoresJson, targetType) {
  // Questions group:
  // PPL: P1.1-P1.3 (ind1: 35%), P2.1-P2.3 (ind2: 30%), P3.1-P3.3 (ind3: 20%), P4.1-P4.3 (ind4: 15%)
  // PML: M1.1-M1.3 (ind1: 35%), M2.1-M2.3 (ind2: 30%), M3.1-M3.3 (ind3: 20%), M4.1-M4.3 (ind4: 15%)
  const prefix = targetType === 'PPL' ? 'P' : 'M';
  
  let raw1 = 0, raw2 = 0, raw3 = 0, raw4 = 0;
  for (let i = 1; i <= 3; i++) {
    raw1 += Number(scoresJson[`${prefix}1.${i}`] || 0);
    raw2 += Number(scoresJson[`${prefix}2.${i}`] || 0);
    raw3 += Number(scoresJson[`${prefix}3.${i}`] || 0);
    raw4 += Number(scoresJson[`${prefix}4.${i}`] || 0);
  }

  // Rumus:
  // Nilai Akhir = ((Skor Ind 1 / 30) * 35) + ((Skor Ind 2 / 30) * 30) + ((Skor Ind 3 / 30) * 20) + ((Skor Ind 4 / 30) * 15)
  const score_ind1 = Number(((raw1 / 30) * 35).toFixed(2));
  const score_ind2 = Number(((raw2 / 30) * 30).toFixed(2));
  const score_ind3 = Number(((raw3 / 30) * 20).toFixed(2));
  const score_ind4 = Number(((raw4 / 30) * 15).toFixed(2));
  const final_score = Number((score_ind1 + score_ind2 + score_ind3 + score_ind4).toFixed(2));

  let predikat = 'Perlu Pembinaan';
  if (final_score >= 90) predikat = 'Sangat Baik (Sangat Memuaskan)';
  else if (final_score >= 80) predikat = 'Baik (Memuaskan)';
  else if (final_score >= 70) predikat = 'Cukup (Memenuhi Standar)';

  return {
    raw1, raw2, raw3, raw4,
    score_ind1, score_ind2, score_ind3, score_ind4,
    final_score, predikat
  };
}

// ----------------- API AUTH -----------------
app.post('/api/auth/login', (req, res) => {
  let { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan Password wajib diisi.' });
  }

  // Bersihkan zero-width spaces, backticks, quotes, dan spasi
  const cleanUser = username.toString().replace(/[\u200B-\u200D\uFEFF`'"]/g, '').trim().toLowerCase();
  const cleanPass = password.toString().replace(/[\u200B-\u200D\uFEFF`'"]/g, '').trim();

  console.log(`[LOGIN ATTEMPT] Clean Username: "${cleanUser}", Clean Password: "${cleanPass}"`);

  // Query pencocokan username (case-insensitive) dan password
  const query = 'SELECT * FROM users WHERE LOWER(TRIM(username)) = ? AND TRIM(password) = ?';
  const users = db.prepare(query).all(cleanUser, cleanPass);

  if (!users || users.length === 0) {
    console.log(`[LOGIN FAILED] Kredensial tidak ditemukan untuk "${cleanUser}" / "${cleanPass}"`);
    return res.status(401).json({ error: 'Username atau Password salah. Pastikan data akun sesuai dengan penugasan SE2026.' });
  }

  const user = users[0];
  console.log(`[LOGIN SUCCESS] User: "${user.name}", Role: "${user.role}", Kecamatan: "${user.kecamatan}"`);

  res.json({
    user: {
      id: user.id,
      name: user.name,
      kecamatan: user.kecamatan,
      username: user.username,
      role: user.role
    }
  });
});

// ----------------- API QUESTIONS -----------------
app.get('/api/questions', (req, res) => {
  const { targetType } = req.query; // 'PPL' or 'PML'
  let query = 'SELECT * FROM questions';
  let params = [];
  if (targetType) {
    query += ' WHERE target_role = ? ORDER BY number ASC';
    params.push(targetType);
  } else {
    query += ' ORDER BY target_role DESC, number ASC';
  }

  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

// ----------------- API TARGETS (DAFTAR YANG BISA DINILAI) -----------------
app.get('/api/targets', (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: 'User ID diperlukan.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).json({ error: 'User tidak ditemukan.' });
  }

  if (user.role === 'PML') {
    // PML hanya menilai PPL bawahannya (Unik tanpa duplikasi)
    const pplList = db.prepare(`
      SELECT 
        MIN(r.id) as relation_id,
        r.nama_ppl as name,
        r.nama_pml as evaluator_name,
        r.kecamatan,
        'PPL' as target_type,
        e.id as evaluation_id,
        e.final_score,
        e.predikat,
        e.updated_at,
        CASE WHEN e.id IS NOT NULL THEN 1 ELSE 0 END as is_evaluated
      FROM relations_ppl_pml r
      LEFT JOIN evaluations e 
        ON e.evaluator_id = ? 
        AND UPPER(TRIM(e.target_name)) = UPPER(TRIM(r.nama_ppl)) 
        AND e.target_type = 'PPL'
      WHERE UPPER(TRIM(r.nama_pml)) = UPPER(TRIM(?))
      GROUP BY UPPER(TRIM(r.nama_ppl)), UPPER(TRIM(r.kecamatan))
      ORDER BY r.nama_ppl ASC
    `).all(user.id, user.name);

    return res.json({
      user,
      targetType: 'PPL',
      targets: pplList
    });
  } 
  
  if (user.role === 'Pegawai') {
    // Pegawai menilai SEMUA PML (seluruh Kabupaten Jeneponto)
    const pmlList = db.prepare(`
      SELECT 
        u.id as user_pml_id,
        u.name as name,
        u.kecamatan,
        'PML' as target_type,
        e.id as evaluation_id,
        e.final_score,
        e.predikat,
        e.updated_at,
        CASE WHEN e.id IS NOT NULL THEN 1 ELSE 0 END as is_evaluated,
        (SELECT COUNT(DISTINCT UPPER(TRIM(nama_ppl))) FROM relations_ppl_pml WHERE UPPER(TRIM(nama_pml)) = UPPER(TRIM(u.name))) as total_ppl_count
      FROM users u
      LEFT JOIN evaluations e 
        ON e.evaluator_id = ? 
        AND UPPER(TRIM(e.target_name)) = UPPER(TRIM(u.name)) 
        AND e.target_type = 'PML'
      WHERE u.role = 'PML'
      ORDER BY u.kecamatan ASC, u.name ASC
    `).all(user.id);

    return res.json({
      user,
      targetType: 'PML',
      targets: pmlList
    });
  }

  if (user.role === 'Super Admin') {
    return res.json({
      user,
      targetType: 'ALL',
      message: 'Super Admin memiliki akses ke seluruh data melalui Menu Leaderboard & Rekapitulasi.'
    });
  }

  res.status(403).json({ error: 'Role tidak memiliki target penilaian.' });
});

// ----------------- API GET EVALUATION BY TARGET -----------------
app.get('/api/evaluations/:targetType/:targetName', (req, res) => {
  const { userId } = req.query;
  const { targetType, targetName } = req.params;

  if (!userId) {
    return res.status(400).json({ error: 'User ID diperlukan.' });
  }

  const evaluation = db.prepare(`
    SELECT * FROM evaluations 
    WHERE evaluator_id = ? AND target_type = ? AND UPPER(TRIM(target_name)) = UPPER(TRIM(?))
  `).get(userId, targetType, targetName);

  if (!evaluation) {
    return res.json({ evaluation: null });
  }

  evaluation.scores = JSON.parse(evaluation.scores_json || '{}');
  res.json({ evaluation });
});

// ----------------- API SAVE / UPDATE EVALUATION -----------------
app.post('/api/evaluations', (req, res) => {
  const { userId, targetName, targetType, kecamatan, scores, notes } = req.body;

  if (!userId || !targetName || !targetType || !scores) {
    return res.status(400).json({ error: 'Data evaluasi belum lengkap.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).json({ error: 'Penilai tidak ditemukan.' });
  }

  // Hak Akses Validasi:
  if (user.role === 'PML') {
    if (targetType !== 'PPL') {
      return res.status(403).json({ error: 'PML hanya berhak menilai PPL!' });
    }
    const checkRelation = db.prepare(`
      SELECT * FROM relations_ppl_pml 
      WHERE UPPER(TRIM(nama_pml)) = UPPER(TRIM(?)) AND UPPER(TRIM(nama_ppl)) = UPPER(TRIM(?))
    `).get(user.name, targetName);
    if (!checkRelation) {
      return res.status(403).json({ error: 'PPL ini bukan merupakan mitra binaan di bawah pengawasan Anda!' });
    }
  } else if (user.role === 'Pegawai') {
    if (targetType !== 'PML') {
      return res.status(403).json({ error: 'Pegawai hanya berhak menilai PML!' });
    }
    const checkPml = db.prepare(`
      SELECT * FROM users 
      WHERE role = 'PML' AND UPPER(TRIM(name)) = UPPER(TRIM(?))
    `).get(targetName);
    if (!checkPml) {
      return res.status(403).json({ error: 'PML ini tidak terdaftar di sistem BPS Kabupaten Jeneponto!' });
    }
  } else {
    return res.status(403).json({ error: 'Role Anda tidak diizinkan melakukan pengisian nilai.' });
  }

  // Hitung Nilai Akhir
  const calculated = calculateScores(scores, targetType);

  const existing = db.prepare(`
    SELECT id FROM evaluations 
    WHERE evaluator_id = ? AND target_name = ? AND target_type = ?
  `).get(user.id, targetName, targetType);

  if (existing) {
    // Update
    db.prepare(`
      UPDATE evaluations SET
        scores_json = ?,
        score_ind1 = ?,
        score_ind2 = ?,
        score_ind3 = ?,
        score_ind4 = ?,
        final_score = ?,
        predikat = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      JSON.stringify(scores),
      calculated.score_ind1,
      calculated.score_ind2,
      calculated.score_ind3,
      calculated.score_ind4,
      calculated.final_score,
      calculated.predikat,
      notes || '',
      existing.id
    );

    res.json({
      success: true,
      message: `Penilaian untuk ${targetName} berhasil diperbarui!`,
      calculation: calculated
    });
  } else {
    // Insert
    db.prepare(`
      INSERT INTO evaluations (
        evaluator_id, evaluator_name, evaluator_role,
        target_name, target_type, kecamatan,
        scores_json, score_ind1, score_ind2, score_ind3, score_ind4,
        final_score, predikat, notes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      user.id, user.name, user.role,
      targetName, targetType, (kecamatan || user.kecamatan).toUpperCase(),
      JSON.stringify(scores),
      calculated.score_ind1,
      calculated.score_ind2,
      calculated.score_ind3,
      calculated.score_ind4,
      calculated.final_score,
      calculated.predikat,
      notes || ''
    );

    res.json({
      success: true,
      message: `Penilaian untuk ${targetName} berhasil disimpan!`,
      calculation: calculated
    });
  }
});

// ----------------- SUPER ADMIN APIS -----------------
// Middleware check Super Admin
function checkSuperAdmin(req, res, next) {
  const userId = req.headers['x-user-id'] || req.query.userId;
  if (!userId) return res.status(401).json({ error: 'Akses ditolak: User ID diperlukan.' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user || user.role !== 'Super Admin') {
    return res.status(403).json({ error: 'Akses khusus Super Admin.' });
  }
  req.adminUser = user;
  next();
}

app.get('/api/admin/overview', checkSuperAdmin, (req, res) => {
  const totalPegawai = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'Pegawai'").get().c;
  const totalPML = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'PML'").get().c;
  const totalPPL = db.prepare("SELECT COUNT(DISTINCT UPPER(TRIM(nama_ppl))) as c FROM relations_ppl_pml").get().c;

  const totalEvaluasiPPL = db.prepare("SELECT COUNT(*) as c FROM evaluations WHERE target_type = 'PPL'").get().c;
  const totalEvaluasiPML = db.prepare("SELECT COUNT(*) as c FROM evaluations WHERE target_type = 'PML'").get().c;

  // 1. Progres Penilai: Pegawai (Menilai seluruh 47 PML)
  const pegawais = db.prepare("SELECT id, name, kecamatan, role FROM users WHERE role = 'Pegawai' ORDER BY kecamatan ASC, name ASC").all();
  const pegawaiProgress = pegawais.map(peg => {
    const targetCount = totalPML; // 47 PML
    const evaluatedCount = db.prepare(`
      SELECT COUNT(DISTINCT UPPER(TRIM(target_name))) as c 
      FROM evaluations 
      WHERE evaluator_id = ? AND target_type = 'PML'
    `).get(peg.id).c;
    const pendingCount = Math.max(0, targetCount - evaluatedCount);
    const percent = targetCount > 0 ? Number(((evaluatedCount / targetCount) * 100).toFixed(1)) : 0;

    return {
      id: peg.id,
      name: peg.name,
      role: 'Pegawai',
      kecamatan: peg.kecamatan,
      target_count: targetCount,
      evaluated_count: evaluatedCount,
      pending_count: pendingCount,
      percent: percent,
      is_complete: evaluatedCount >= targetCount
    };
  });

  // 2. Progres Penilai: PML (Menilai PPL binaannya masing-masing)
  const pmls = db.prepare("SELECT id, name, kecamatan, role FROM users WHERE role = 'PML' ORDER BY kecamatan ASC, name ASC").all();
  const pmlProgress = pmls.map(pml => {
    const targetCount = db.prepare(`
      SELECT COUNT(DISTINCT UPPER(TRIM(nama_ppl))) as c 
      FROM relations_ppl_pml 
      WHERE UPPER(TRIM(nama_pml)) = UPPER(TRIM(?))
    `).get(pml.name).c;

    const evaluatedCount = db.prepare(`
      SELECT COUNT(DISTINCT UPPER(TRIM(target_name))) as c 
      FROM evaluations 
      WHERE evaluator_id = ? AND target_type = 'PPL'
    `).get(pml.id).c;

    const pendingCount = Math.max(0, targetCount - evaluatedCount);
    const percent = targetCount > 0 ? Number(((evaluatedCount / targetCount) * 100).toFixed(1)) : 0;

    return {
      id: pml.id,
      name: pml.name,
      role: 'PML',
      kecamatan: pml.kecamatan,
      target_count: targetCount,
      evaluated_count: evaluatedCount,
      pending_count: pendingCount,
      percent: percent,
      is_complete: targetCount > 0 && evaluatedCount >= targetCount
    };
  });

  // Total progres evaluasi PPL (Target total relasi unik)
  const totalTargetRelasiPPL = db.prepare("SELECT COUNT(*) as c FROM relations_ppl_pml").get().c;
  const totalTargetEvaluasiPML = totalPegawai * totalPML; // Jika seluruh pegawai menilai seluruh PML

  res.json({
    summary: {
      totalPegawai,
      totalPML,
      totalPPL,
      totalEvaluasiPPL,
      totalEvaluasiPML,
      progressPPLPercent: totalTargetRelasiPPL > 0 ? Number(((totalEvaluasiPPL / totalTargetRelasiPPL) * 100).toFixed(1)) : 0,
      progressPMLPercent: totalTargetEvaluasiPML > 0 ? Number(((totalEvaluasiPML / totalTargetEvaluasiPML) * 100).toFixed(1)) : 0
    },
    evaluatorProgress: [
      ...pegawaiProgress,
      ...pmlProgress
    ]
  });
});

app.get('/api/admin/leaderboard', checkSuperAdmin, (req, res) => {
  const { kecamatan, limit } = req.query;

  let queryPPL = `
    SELECT 
      e.id,
      e.target_name as nama_ppl,
      e.evaluator_name as nama_pml,
      e.kecamatan,
      e.score_ind1,
      e.score_ind2,
      e.score_ind3,
      e.score_ind4,
      e.final_score,
      e.predikat,
      e.notes,
      e.updated_at
    FROM evaluations e
    WHERE e.target_type = 'PPL'
  `;
  let paramsPPL = [];

  if (kecamatan && kecamatan !== 'SEMUA') {
    queryPPL += ` AND UPPER(e.kecamatan) = ?`;
    paramsPPL.push(kecamatan.toUpperCase());
  }

  queryPPL += ` ORDER BY e.final_score DESC, e.score_ind1 DESC, e.score_ind2 DESC, e.updated_at ASC`;
  if (limit) {
    queryPPL += ` LIMIT ?`;
    paramsPPL.push(parseInt(limit));
  }

  const leaderboardPPL = db.prepare(queryPPL).all(...paramsPPL);

  let queryPML = `
    SELECT 
      MIN(e.id) as id,
      e.target_name as nama_pml,
      GROUP_CONCAT(DISTINCT e.evaluator_name) as nama_pegawai,
      COUNT(DISTINCT e.evaluator_id) as total_penilai,
      e.kecamatan,
      ROUND(AVG(e.score_ind1), 2) as score_ind1,
      ROUND(AVG(e.score_ind2), 2) as score_ind2,
      ROUND(AVG(e.score_ind3), 2) as score_ind3,
      ROUND(AVG(e.score_ind4), 2) as score_ind4,
      ROUND(AVG(e.final_score), 2) as final_score,
      MAX(e.updated_at) as updated_at,
      (SELECT COUNT(DISTINCT UPPER(TRIM(nama_ppl))) FROM relations_ppl_pml WHERE UPPER(TRIM(nama_pml)) = UPPER(TRIM(e.target_name))) as total_ppl_binaan
    FROM evaluations e
    WHERE e.target_type = 'PML'
  `;
  let paramsPML = [];

  if (kecamatan && kecamatan !== 'SEMUA') {
    queryPML += ` AND UPPER(e.kecamatan) = ?`;
    paramsPML.push(kecamatan.toUpperCase());
  }

  queryPML += ` GROUP BY UPPER(TRIM(e.target_name)), UPPER(TRIM(e.kecamatan))`;
  queryPML += ` ORDER BY final_score DESC, score_ind1 DESC, score_ind2 DESC, updated_at ASC`;
  if (limit) {
    queryPML += ` LIMIT ?`;
    paramsPML.push(parseInt(limit));
  }

  const leaderboardPML = db.prepare(queryPML).all(...paramsPML);

  // Assign Predikat to calculated average
  leaderboardPML.forEach(pml => {
    const score = pml.final_score;
    if (score >= 90) pml.predikat = 'Sangat Baik (Sangat Memuaskan)';
    else if (score >= 80) pml.predikat = 'Baik (Memuaskan)';
    else if (score >= 70) pml.predikat = 'Cukup (Memenuhi Standar)';
    else pml.predikat = 'Perlu Pembinaan';
  });

  res.json({
    leaderboardPPL,
    leaderboardPML
  });
});

// ----------------- SUPER ADMIN DELETE EVALUATION -----------------
app.delete('/api/admin/evaluations/:id', checkSuperAdmin, (req, res) => {
  const { id } = req.params;

  const evalRecord = db.prepare('SELECT * FROM evaluations WHERE id = ?').get(id);
  if (!evalRecord) {
    return res.status(404).json({ error: 'Data penilaian tidak ditemukan.' });
  }

  // Hapus penilaian
  db.prepare('DELETE FROM evaluations WHERE id = ?').run(id);

  console.log(`[EVALUATION DELETED] Super Admin menghapus nilai ID ${id} untuk ${evalRecord.target_type}: ${evalRecord.target_name} (Penilai: ${evalRecord.evaluator_name})`);

  res.json({
    success: true,
    message: `Penilaian untuk ${evalRecord.target_name} (${evalRecord.target_type}) berhasil dihapus. Status pada penilai telah kembali menjadi 'Belum Dinilai'.`,
    deleted: {
      id: evalRecord.id,
      target_name: evalRecord.target_name,
      target_type: evalRecord.target_type,
      evaluator_name: evalRecord.evaluator_name
    }
  });
});

app.get('/api/admin/export', checkSuperAdmin, async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BPS Kabupaten Jeneponto';
    workbook.lastModifiedBy = 'Super Admin SE2026';
    workbook.created = new Date();

    // Style helpers
    const headerFill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0D3B66' } // Navy BPS
    };
    const headerFont = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    const borderStyle = {
      top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
      left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
      bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
      right: { style: 'thin', color: { argb: 'FFD3D3D3' } }
    };

    // 1. Sheet Ranking PPL Terbaik
    const sheetPPL = workbook.addWorksheet('Ranking PPL Terbaik');
    sheetPPL.columns = [
      { header: 'Rank', key: 'rank', width: 8 },
      { header: 'Nama PPL', key: 'nama_ppl', width: 28 },
      { header: 'Kecamatan', key: 'kecamatan', width: 20 },
      { header: 'PML Penilai', key: 'nama_pml', width: 28 },
      { header: 'Kualitas Data (35%)', key: 'score_ind1', width: 20 },
      { header: 'Ketepatan Waktu (30%)', key: 'score_ind2', width: 22 },
      { header: 'Kedisiplinan (20%)', key: 'score_ind3', width: 20 },
      { header: 'Sikap Kerja (15%)', key: 'score_ind4', width: 18 },
      { header: 'Nilai Akhir', key: 'final_score', width: 14 },
      { header: 'Predikat', key: 'predikat', width: 28 },
      { header: 'Catatan Evaluasi', key: 'notes', width: 35 }
    ];

    const pplRows = db.prepare(`
      SELECT * FROM evaluations 
      WHERE target_type = 'PPL' 
      ORDER BY final_score DESC, score_ind1 DESC, score_ind2 DESC
    `).all();

    pplRows.forEach((r, idx) => {
      sheetPPL.addRow({
        rank: idx + 1,
        nama_ppl: r.target_name,
        kecamatan: r.kecamatan,
        nama_pml: r.evaluator_name,
        score_ind1: r.score_ind1,
        score_ind2: r.score_ind2,
        score_ind3: r.score_ind3,
        score_ind4: r.score_ind4,
        final_score: r.final_score,
        predikat: r.predikat,
        notes: r.notes || '-'
      });
    });

    sheetPPL.getRow(1).eachCell(cell => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // 2. Sheet Ranking PML Terbaik
    const sheetPML = workbook.addWorksheet('Ranking PML Terbaik');
    sheetPML.columns = [
      { header: 'Rank', key: 'rank', width: 8 },
      { header: 'Nama PML', key: 'nama_pml', width: 28 },
      { header: 'Kecamatan', key: 'kecamatan', width: 20 },
      { header: 'Pegawai Penilai', key: 'nama_pegawai', width: 28 },
      { header: 'Pengawasan Teknis (35%)', key: 'score_ind1', width: 24 },
      { header: 'Manajemen Tim (30%)', key: 'score_ind2', width: 22 },
      { header: 'Kepemimpinan (20%)', key: 'score_ind3', width: 20 },
      { header: 'Komunikasi Organik (15%)', key: 'score_ind4', width: 25 },
      { header: 'Nilai Akhir', key: 'final_score', width: 14 },
      { header: 'Predikat', key: 'predikat', width: 28 },
      { header: 'Catatan Evaluasi', key: 'notes', width: 35 }
    ];

    const pmlRows = db.prepare(`
      SELECT * FROM evaluations 
      WHERE target_type = 'PML' 
      ORDER BY final_score DESC, score_ind1 DESC, score_ind2 DESC
    `).all();

    pmlRows.forEach((r, idx) => {
      sheetPML.addRow({
        rank: idx + 1,
        nama_pml: r.target_name,
        kecamatan: r.kecamatan,
        nama_pegawai: r.evaluator_name,
        score_ind1: r.score_ind1,
        score_ind2: r.score_ind2,
        score_ind3: r.score_ind3,
        score_ind4: r.score_ind4,
        final_score: r.final_score,
        predikat: r.predikat,
        notes: r.notes || '-'
      });
    });

    sheetPML.getRow(1).eachCell(cell => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // 3. Sheet Monitoring Progres Penilai
    const sheetProgress = workbook.addWorksheet('Monitoring Progres Penilai');
    sheetProgress.columns = [
      { header: 'No', key: 'no', width: 6 },
      { header: 'Nama Penilai', key: 'name', width: 30 },
      { header: 'Peran', key: 'role', width: 16 },
      { header: 'Kecamatan', key: 'kecamatan', width: 22 },
      { header: 'Target Mitra', key: 'target_count', width: 15 },
      { header: 'Sudah Dinilai', key: 'evaluated_count', width: 15 },
      { header: 'Belum Dinilai', key: 'pending_count', width: 15 },
      { header: 'Progres (%)', key: 'percent', width: 14 },
      { header: 'Status', key: 'status', width: 18 }
    ];

    // Data Pegawai
    const pegawais = db.prepare("SELECT id, name, kecamatan, role FROM users WHERE role = 'Pegawai' ORDER BY kecamatan ASC, name ASC").all();
    const totalPMLCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'PML'").get().c;
    let noCounter = 1;

    pegawais.forEach(peg => {
      const evaluatedCount = db.prepare("SELECT COUNT(DISTINCT UPPER(TRIM(target_name))) as c FROM evaluations WHERE evaluator_id = ? AND target_type = 'PML'").get(peg.id).c;
      const pendingCount = Math.max(0, totalPMLCount - evaluatedCount);
      const percent = totalPMLCount > 0 ? Number(((evaluatedCount / totalPMLCount) * 100).toFixed(1)) : 0;
      sheetProgress.addRow({
        no: noCounter++,
        name: peg.name,
        role: 'Pegawai BPS',
        kecamatan: peg.kecamatan,
        target_count: totalPMLCount,
        evaluated_count: evaluatedCount,
        pending_count: pendingCount,
        percent: `${percent}%`,
        status: percent >= 100 ? 'Selesai 100%' : (evaluatedCount > 0 ? 'Sedang Berjalan' : 'Belum Mengisi')
      });
    });

    // Data PML
    const pmls = db.prepare("SELECT id, name, kecamatan, role FROM users WHERE role = 'PML' ORDER BY kecamatan ASC, name ASC").all();
    pmls.forEach(pml => {
      const targetCount = db.prepare("SELECT COUNT(DISTINCT UPPER(TRIM(nama_ppl))) as c FROM relations_ppl_pml WHERE UPPER(TRIM(nama_pml)) = UPPER(TRIM(?))").get(pml.name).c;
      const evaluatedCount = db.prepare("SELECT COUNT(DISTINCT UPPER(TRIM(target_name))) as c FROM evaluations WHERE evaluator_id = ? AND target_type = 'PPL'").get(pml.id).c;
      const pendingCount = Math.max(0, targetCount - evaluatedCount);
      const percent = targetCount > 0 ? Number(((evaluatedCount / targetCount) * 100).toFixed(1)) : 0;
      sheetProgress.addRow({
        no: noCounter++,
        name: pml.name,
        role: 'Pengawas PML',
        kecamatan: pml.kecamatan,
        target_count: targetCount,
        evaluated_count: evaluatedCount,
        pending_count: pendingCount,
        percent: `${percent}%`,
        status: percent >= 100 ? 'Selesai 100%' : (evaluatedCount > 0 ? 'Sedang Berjalan' : 'Belum Mengisi')
      });
    });

    sheetProgress.getRow(1).eachCell(cell => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Rekap_Penilaian_Mitra_Terbaik_BPS_Jeneponto_SE2026.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Gagal mengekspor file Excel.' });
  }
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🌐 Server BPS Jeneponto Penilaian Mitra berjalan di: http://localhost:${PORT}`);
});
