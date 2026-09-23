const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, '..', 'data', 'penilaian.db');
const DATA_DIR = path.join(__dirname, '..', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

// Enable WAL mode for better concurrency
db.exec(`PRAGMA journal_mode = WAL;`);

// Create Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    kecamatan TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL, -- 'Super Admin', 'Pegawai', 'PML'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS relations_ppl_pml (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama_ppl TEXT NOT NULL,
    nama_pml TEXT NOT NULL,
    kecamatan TEXT NOT NULL,
    UNIQUE(nama_ppl, nama_pml, kecamatan)
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_role TEXT NOT NULL, -- 'PPL' (dinilai PML) atau 'PML' (dinilai Pegawai)
    number INTEGER NOT NULL,
    code TEXT NOT NULL,
    indicator TEXT NOT NULL,
    weight REAL NOT NULL,
    criteria TEXT NOT NULL,
    question TEXT NOT NULL,
    scale TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evaluator_id INTEGER NOT NULL,
    evaluator_name TEXT NOT NULL,
    evaluator_role TEXT NOT NULL,
    target_name TEXT NOT NULL,
    target_type TEXT NOT NULL, -- 'PPL' atau 'PML'
    kecamatan TEXT NOT NULL,
    scores_json TEXT NOT NULL, -- JSON object of { [question_code]: score }
    score_ind1 REAL NOT NULL,
    score_ind2 REAL NOT NULL,
    score_ind3 REAL NOT NULL,
    score_ind4 REAL NOT NULL,
    final_score REAL NOT NULL,
    predikat TEXT NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(evaluator_id, target_name, target_type)
  );
`);

module.exports = db;
