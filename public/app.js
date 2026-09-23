/**
 * ==========================================================================
 * SISTEM PENILAIAN MITRA TERBAIK BPS KABUPATEN JENEPONTO SE2026
 * Frontend Logic & Clean UI State Management (Gen-Z Clean Theme)
 * ==========================================================================
 */

// State
let currentUser = null;
let currentTargets = [];
let currentQuestions = [];
let currentFilter = 'all';
let activeTarget = null;
let currentScores = {}; // { [question_code]: number }
let activeAdminTab = 'overview';
let activeLeaderboardCategory = 'PPL';

// DOM Elements
const loginSection = document.getElementById('loginSection');
const evaluatorSection = document.getElementById('evaluatorSection');
const superAdminSection = document.getElementById('superAdminSection');
const mainHeader = document.getElementById('mainHeader');
const adminNavLinks = document.getElementById('adminNavLinks');

// Init
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  setupEventListeners();
});

// ----------------- AUTHENTICATION -----------------
function initAuth() {
  const savedUser = localStorage.getItem('bps_mitra_user');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      renderUserSession();
    } catch (e) {
      localStorage.removeItem('bps_mitra_user');
      showLoginView();
    }
  } else {
    showLoginView();
  }
}

function showLoginView() {
  currentUser = null;
  localStorage.removeItem('bps_mitra_user');
  loginSection.classList.remove('hidden');
  evaluatorSection.classList.add('hidden');
  superAdminSection.classList.add('hidden');
  mainHeader.classList.add('hidden');
  adminNavLinks.style.display = 'none';
}

function renderUserSession() {
  if (!currentUser) return;

  // Header update
  mainHeader.classList.remove('hidden');
  document.getElementById('headerUserName').textContent = currentUser.name;
  document.getElementById('headerAvatar').textContent = currentUser.name.charAt(0).toUpperCase();

  let roleLabel = currentUser.role;
  if (currentUser.role === 'PML') {
    roleLabel = `PML • Kec. ${currentUser.kecamatan}`;
  } else if (currentUser.role === 'Pegawai') {
    roleLabel = `Pegawai BPS • Kec. ${currentUser.kecamatan}`;
  } else if (currentUser.role === 'Super Admin') {
    roleLabel = `Super Admin • BPS Jeneponto`;
  }
  document.getElementById('headerUserRole').textContent = roleLabel;

  loginSection.classList.add('hidden');

  if (currentUser.role === 'Super Admin') {
    evaluatorSection.classList.add('hidden');
    superAdminSection.classList.remove('hidden');
    adminNavLinks.style.display = 'flex';
    loadAdminOverview();
  } else {
    superAdminSection.classList.add('hidden');
    evaluatorSection.classList.remove('hidden');
    adminNavLinks.style.display = 'none';
    loadEvaluatorDashboard();
  }
}

function setupEventListeners() {
  // Login Form Submit
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  // Logout Button
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      if (confirm('Apakah Anda yakin ingin keluar dari sistem?')) {
        showLoginView();
        showToast('Anda telah keluar dari akun.', 'info');
      }
    });
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const alertBox = document.getElementById('loginAlert');
  alertBox.classList.add('hidden');

  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  const btnSubmit = document.getElementById('btnLoginSubmit');
  const originalBtnText = btnSubmit.innerHTML;
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Memverifikasi...`;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Username atau Password tidak cocok.');
    }

    currentUser = data.user;
    localStorage.setItem('bps_mitra_user', JSON.stringify(currentUser));
    showToast(`Selamat datang, ${currentUser.name}!`);
    renderUserSession();
  } catch (err) {
    alertBox.textContent = err.message;
    alertBox.classList.remove('hidden');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = originalBtnText;
  }
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  const icon = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}

// ----------------- EVALUATOR DASHBOARD (PML / PEGAWAI) -----------------
async function loadEvaluatorDashboard() {
  if (!currentUser) return;

  // Header Banner Info
  const roleTag = document.getElementById('dashRoleTag');
  const greeting = document.getElementById('dashGreeting');
  const instruction = document.getElementById('dashInstruction');

  if (currentUser.role === 'PML') {
    roleTag.innerHTML = `<i class="fa-solid fa-user-check"></i> PML PENGAWAS • KEC. ${currentUser.kecamatan}`;
    greeting.textContent = `Halo, ${currentUser.name} 👋`;
    instruction.textContent = `Berikut adalah daftar PPL (Petugas Pendataan Lapangan) binaan di bawah pengawasan Anda. Berikan penilaian objektif berdasarkan kinerja lapangan.`;
  } else if (currentUser.role === 'Pegawai') {
    roleTag.innerHTML = `<i class="fa-solid fa-user-tie"></i> PEGAWAI ORGANIK BPS JENEPONTO`;
    greeting.textContent = `Halo, ${currentUser.name} 👋`;
    instruction.textContent = `Berikut adalah daftar seluruh Pengawas Mitra Lapangan (PML) Sensus Ekonomi 2026 di Kabupaten Jeneponto. Silakan berikan evaluasi kinerja pengawasan dan manajemen tim untuk setiap PML.`;
  }

  // Fetch Questions for this evaluator
  const targetType = currentUser.role === 'PML' ? 'PPL' : 'PML';
  try {
    const qRes = await fetch(`/api/questions?targetType=${targetType}`);
    currentQuestions = await qRes.json();
  } catch (e) {
    console.error('Error fetching questions:', e);
  }

  // Fetch Targets
  try {
    const res = await fetch(`/api/targets?userId=${currentUser.id}`);
    const data = await res.json();
    currentTargets = data.targets || [];
    renderTargetCards();
    updateProgressStats();
  } catch (err) {
    console.error('Error loading targets:', err);
    showToast('Gagal memuat daftar mitra.', 'error');
  }
}

function updateProgressStats() {
  const total = currentTargets.length;
  const completed = currentTargets.filter(t => t.is_evaluated === 1).length;
  const pending = total - completed;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  document.getElementById('dashProgressCount').textContent = `${completed} / ${total} Mitra`;
  document.getElementById('dashProgressBar').style.width = `${percent}%`;
  document.getElementById('dashProgressPercent').textContent = `${percent}% Selesai`;

  document.getElementById('countAll').textContent = total;
  document.getElementById('countPending').textContent = pending;
  document.getElementById('countCompleted').textContent = completed;
}

function setTargetFilter(filterType, btn) {
  currentFilter = filterType;
  document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTargetCards();
}

function filterTargetList() {
  renderTargetCards();
}

function renderTargetCards() {
  const container = document.getElementById('targetsGrid');
  const searchQuery = document.getElementById('targetSearchInput').value.trim().toLowerCase();

  let filtered = currentTargets.filter(target => {
    // Search match
    const matchSearch = target.name.toLowerCase().includes(searchQuery) ||
                        target.kecamatan.toLowerCase().includes(searchQuery);

    // Tab filter match
    let matchFilter = true;
    if (currentFilter === 'pending') {
      matchFilter = target.is_evaluated === 0;
    } else if (currentFilter === 'completed') {
      matchFilter = target.is_evaluated === 1;
    }

    return matchSearch && matchFilter;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-clean-state" style="grid-column: 1 / -1; text-align: center; padding: 3.5rem 1rem; background: #ffffff; border-radius: var(--radius-md); border: 1px dashed var(--border-clean);">
        <i class="fa-solid fa-folder-open" style="font-size: 2.5rem; color: var(--text-light); margin-bottom: 0.8rem; display: block;"></i>
        <h4 style="color: var(--text-main); font-weight: 800;">Tidak ada data mitra</h4>
        <p style="font-size: 0.85rem; color: var(--text-muted);">Coba ubah kata kunci pencarian atau filter status.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(target => {
    const isDone = target.is_evaluated === 1;
    const targetTypeLabel = target.target_type === 'PPL' ? 'Petugas Lapangan (PPL)' : 'Pengawas Lapangan (PML)';
    const pplSub = target.total_ppl_count ? `<span>• <i class="fa-solid fa-users"></i> ${target.total_ppl_count} PPL Tim</span>` : '';

    return `
      <div class="target-bento-card">
        <div>
          <div class="card-head-row">
            <div class="card-avatar-pill">
              <i class="fa-solid ${target.target_type === 'PPL' ? 'fa-user-pen' : 'fa-user-shield'}"></i>
            </div>
            <span class="clean-status-tag ${isDone ? 'tag-completed' : 'tag-pending'}">
              <i class="fa-solid ${isDone ? 'fa-circle-check' : 'fa-clock'}"></i>
              ${isDone ? 'Sudah Dinilai' : 'Belum Dinilai'}
            </span>
          </div>

          <div class="target-details">
            <div class="target-role-tag">${targetTypeLabel}</div>
            <h3 class="target-title">${target.name}</h3>
            <div class="target-loc">
              <i class="fa-solid fa-location-dot"></i> Kec. ${target.kecamatan} ${pplSub}
            </div>
          </div>
        </div>

        <div>
          <button class="${isDone ? 'btn-card-secondary' : 'btn-card-primary'}" onclick="openEvaluationModal('${encodeURIComponent(JSON.stringify(target))}')">
            <i class="fa-solid ${isDone ? 'fa-pen-to-square' : 'fa-star'}"></i>
            <span>${isDone ? 'Edit Nilai' : 'Beri Nilai Sekarang'}</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ----------------- FORM EVALUASI MODAL -----------------
async function openEvaluationModal(encodedTarget) {
  const target = JSON.parse(decodeURIComponent(encodedTarget));
  activeTarget = target;
  currentScores = {};

  const modal = document.getElementById('evaluationModal');
  document.getElementById('modalTargetTypeBadge').textContent = `FORM PENILAIAN ${target.target_type}`;
  document.getElementById('modalTargetName').textContent = target.name;
  
  const metaText = target.target_type === 'PPL' 
    ? `Kecamatan: ${target.kecamatan} • Penilai: ${currentUser.name} (PML)`
    : `Kecamatan: ${target.kecamatan} • Penilai: ${currentUser.name} (Pegawai BPS)`;
  document.getElementById('modalTargetMeta').textContent = metaText;

  // Fetch existing evaluation if already evaluated
  try {
    const res = await fetch(`/api/evaluations/${target.target_type}/${encodeURIComponent(target.name)}?userId=${currentUser.id}`);
    const data = await res.json();
    if (data.evaluation) {
      currentScores = data.evaluation.scores || {};
      document.getElementById('evalNotes').value = data.evaluation.notes || '';
    } else {
      document.getElementById('evalNotes').value = '';
    }
  } catch (e) {
    console.error('Error fetching existing evaluation:', e);
  }

  // Render Questions
  renderQuestionsForm();
  recalculateLiveScores();

  modal.classList.remove('hidden');
}

function closeEvaluationModal() {
  document.getElementById('evaluationModal').classList.add('hidden');
  activeTarget = null;
  currentScores = {};
}

function renderQuestionsForm() {
  const container = document.getElementById('questionsContainer');
  
  // Group questions by indicator
  const grouped = {};
  currentQuestions.forEach(q => {
    if (!grouped[q.indicator]) {
      grouped[q.indicator] = {
        indicator: q.indicator,
        weight: q.weight,
        questions: []
      };
    }
    grouped[q.indicator].questions.push(q);
  });

  const html = Object.values(grouped).map((group, gIdx) => {
    const weightPercent = Math.round(group.weight * 100);

    const questionsHtml = group.questions.map(q => {
      const currentVal = currentScores[q.code] || 0;

      const scaleButtons = Array.from({ length: 10 }, (_, i) => i + 1).map(val => {
        const isActive = currentVal === val;
        return `
          <button type="button" class="scale-btn-clean ${isActive ? 'active' : ''}" onclick="setScoreValue('${q.code}', ${val}, this)">
            ${val}
          </button>
        `;
      }).join('');

      return `
        <div class="question-clean-row">
          <div class="q-code">${q.code} • ${q.criteria}</div>
          <div class="q-text">${q.question}</div>
          <div class="scale-track" data-code="${q.code}">
            ${scaleButtons}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="clean-indicator-block">
        <div class="indicator-top-row">
          <div class="indicator-name">
            Indikator ${gIdx + 1}: ${group.indicator}
          </div>
        </div>
        ${questionsHtml}
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

function setScoreValue(code, val, btn) {
  currentScores[code] = val;

  // Update active state in UI
  const parentBar = btn.closest('.scale-track');
  parentBar.querySelectorAll('.scale-btn-clean').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  recalculateLiveScores();
}

function recalculateLiveScores() {
  const prefix = activeTarget.target_type === 'PPL' ? 'P' : 'M';

  let raw1 = 0, raw2 = 0, raw3 = 0, raw4 = 0;
  for (let i = 1; i <= 3; i++) {
    raw1 += Number(currentScores[`${prefix}1.${i}`] || 0);
    raw2 += Number(currentScores[`${prefix}2.${i}`] || 0);
    raw3 += Number(currentScores[`${prefix}3.${i}`] || 0);
    raw4 += Number(currentScores[`${prefix}4.${i}`] || 0);
  }

  // Rumus: ((Total Skor Indikator / 30) * Bobot)
  const score_ind1 = Number(((raw1 / 30) * 35).toFixed(2));
  const score_ind2 = Number(((raw2 / 30) * 30).toFixed(2));
  const score_ind3 = Number(((raw3 / 30) * 20).toFixed(2));
  const score_ind4 = Number(((raw4 / 30) * 15).toFixed(2));
  const final_score = Number((score_ind1 + score_ind2 + score_ind3 + score_ind4).toFixed(2));

  let predikat = 'Perlu Pembinaan';
  if (final_score >= 90) predikat = 'Sangat Baik (Sangat Memuaskan)';
  else if (final_score >= 80) predikat = 'Baik (Memuaskan)';
  else if (final_score >= 70) predikat = 'Cukup (Memenuhi Standar)';

  const elInd1 = document.getElementById('liveInd1');
  if (elInd1) elInd1.textContent = `${score_ind1.toFixed(2)} / 35`;
  const elInd2 = document.getElementById('liveInd2');
  if (elInd2) elInd2.textContent = `${score_ind2.toFixed(2)} / 30`;
  const elInd3 = document.getElementById('liveInd3');
  if (elInd3) elInd3.textContent = `${score_ind3.toFixed(2)} / 20`;
  const elInd4 = document.getElementById('liveInd4');
  if (elInd4) elInd4.textContent = `${score_ind4.toFixed(2)} / 15`;
  const elFinal = document.getElementById('liveFinalScore');
  if (elFinal) elFinal.textContent = final_score.toFixed(2);
  const elPred = document.getElementById('livePredikat');
  if (elPred) elPred.textContent = predikat;
}

async function submitEvaluationForm() {
  if (!activeTarget || !currentUser) return;

  // Validate that all 12 questions are answered
  const prefix = activeTarget.target_type === 'PPL' ? 'P' : 'M';
  const missing = [];
  for (let ind = 1; ind <= 4; ind++) {
    for (let item = 1; item <= 3; item++) {
      const code = `${prefix}${ind}.${item}`;
      if (!currentScores[code] || currentScores[code] < 1) {
        missing.push(code);
      }
    }
  }

  if (missing.length > 0) {
    alert(`Mohon lengkapi seluruh butir pertanyaan (Skala 1 - 10). Terdapat ${missing.length} pertanyaan yang belum dinilai.`);
    return;
  }

  const notes = document.getElementById('evalNotes').value.trim();
  const btnSave = document.getElementById('btnSaveEvaluation');
  const origText = btnSave.innerHTML;
  btnSave.disabled = true;
  btnSave.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Menyimpan...`;

  try {
    const res = await fetch('/api/evaluations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        targetName: activeTarget.name,
        targetType: activeTarget.target_type,
        kecamatan: activeTarget.kecamatan,
        scores: currentScores,
        notes: notes
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Gagal menyimpan penilaian.');
    }

    showToast(data.message || 'Penilaian berhasil disimpan!');
    closeEvaluationModal();

    // Reload targets list
    await loadEvaluatorDashboard();
  } catch (err) {
    alert(err.message);
  } finally {
    btnSave.disabled = false;
    btnSave.innerHTML = origText;
  }
}

// ----------------- SUPER ADMIN DASHBOARD & LEADERBOARD -----------------
function switchAdminTab(tabName) {
  activeAdminTab = tabName;
  const navOverview = document.getElementById('navBtnDashboard');
  const navLeaderboard = document.getElementById('navBtnLeaderboard');
  const tabOverview = document.getElementById('adminTabOverview');
  const tabLeaderboard = document.getElementById('adminTabLeaderboard');

  if (tabName === 'overview') {
    navOverview.classList.add('active');
    navLeaderboard.classList.remove('active');
    tabOverview.classList.remove('hidden');
    tabLeaderboard.classList.add('hidden');
    loadAdminOverview();
  } else {
    navLeaderboard.classList.add('active');
    navOverview.classList.remove('active');
    tabLeaderboard.classList.remove('hidden');
    tabOverview.classList.add('hidden');
    loadAdminLeaderboard();
  }
}

// State Monitoring Admin
let allEvaluatorProgress = [];
let currentEvalRoleFilter = 'all';

async function loadAdminOverview() {
  if (!currentUser || currentUser.role !== 'Super Admin') return;

  try {
    const res = await fetch(`/api/admin/overview?userId=${currentUser.id}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Gagal memuat ringkasan admin.');

    const { summary, evaluatorProgress } = data;
    allEvaluatorProgress = evaluatorProgress || [];

    // Metrics Overview
    document.getElementById('adminTotalPPL').textContent = summary.totalPPL;
    document.getElementById('adminEvaluatedPPLSub').textContent = `${summary.totalEvaluasiPPL} dinilai (${summary.progressPPLPercent}%)`;

    document.getElementById('adminTotalPML').textContent = summary.totalPML;
    document.getElementById('adminEvaluatedPMLSub').textContent = `${summary.totalEvaluasiPML} dinilai (${summary.progressPMLPercent}%)`;

    document.getElementById('adminTotalPegawai').textContent = summary.totalPegawai;

    // Counts for Tabs
    const countPeg = allEvaluatorProgress.filter(e => e.role === 'Pegawai').length;
    const countPml = allEvaluatorProgress.filter(e => e.role === 'PML').length;
    document.getElementById('countEvalAll').textContent = allEvaluatorProgress.length;
    document.getElementById('countEvalPeg').textContent = countPeg;
    document.getElementById('countEvalPml').textContent = countPml;

    renderEvaluatorProgressTable();
  } catch (err) {
    console.error('Error loading overview:', err);
    showToast('Gagal memuat data statistik overview.', 'error');
  }
}

function setEvaluatorRoleFilter(role, btn) {
  currentEvalRoleFilter = role;
  document.querySelectorAll('.role-tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderEvaluatorProgressTable();
}

function filterEvaluatorTable() {
  renderEvaluatorProgressTable();
}

function renderEvaluatorProgressTable() {
  const tbody = document.getElementById('progressEvaluatorTbody');
  const search = (document.getElementById('evaluatorSearchInput')?.value || '').trim().toLowerCase();
  const kecFilter = document.getElementById('evaluatorKecFilter')?.value || 'SEMUA';

  const filtered = allEvaluatorProgress.filter(ev => {
    // Role filter
    if (currentEvalRoleFilter !== 'all' && ev.role !== currentEvalRoleFilter) {
      return false;
    }
    // Kecamatan filter
    if (kecFilter !== 'SEMUA' && ev.kecamatan.toUpperCase() !== kecFilter.toUpperCase()) {
      return false;
    }
    // Search filter
    if (search && !ev.name.toLowerCase().includes(search) && !ev.kecamatan.toLowerCase().includes(search)) {
      return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          <i class="fa-solid fa-users-slash" style="font-size: 1.8rem; margin-bottom: 0.5rem; display: block;"></i>
          Tidak ada data penilai yang sesuai dengan filter.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((ev, idx) => {
    const isPeg = ev.role === 'Pegawai';
    const roleBadge = isPeg 
      ? `<span class="badge-role-peg"><i class="fa-solid fa-user-tie"></i> Pegawai BPS</span>`
      : `<span class="badge-role-pml"><i class="fa-solid fa-user-shield"></i> Pengawas PML</span>`;

    let statusHtml = '';
    if (ev.percent >= 100) {
      statusHtml = `<span class="clean-status-tag tag-completed"><i class="fa-solid fa-check-double"></i> Selesai 100%</span>`;
    } else if (ev.evaluated_count > 0) {
      statusHtml = `<span class="clean-status-tag tag-progress"><i class="fa-solid fa-spinner fa-spin"></i> Berjalan</span>`;
    } else {
      statusHtml = `<span class="clean-status-tag tag-pending"><i class="fa-solid fa-clock"></i> Belum Mengisi</span>`;
    }

    return `
      <tr>
        <td style="color: var(--text-muted); font-weight: 700;">${idx + 1}</td>
        <td>
          <strong style="color: var(--text-main); font-size: 0.92rem;">${ev.name}</strong>
        </td>
        <td>${roleBadge}</td>
        <td><i class="fa-solid fa-location-dot" style="color: var(--primary); font-size: 0.75rem;"></i> ${ev.kecamatan}</td>
        <td style="text-align: center; font-weight: 700; color: var(--text-main);">${ev.target_count}</td>
        <td style="text-align: center;">
          <span style="font-weight: 800; color: #047857; background: #ecfdf5; padding: 0.2rem 0.6rem; border-radius: var(--radius-pill); border: 1px solid #a7f3d0;">
            ${ev.evaluated_count}
          </span>
        </td>
        <td style="text-align: center;">
          <span style="font-weight: 800; color: ${ev.pending_count > 0 ? '#b45309' : '#64748b'}; background: ${ev.pending_count > 0 ? '#fffbeb' : '#f1f5f9'}; padding: 0.2rem 0.6rem; border-radius: var(--radius-pill); border: 1px solid ${ev.pending_count > 0 ? '#fde68a' : '#e2e8f0'};">
            ${ev.pending_count}
          </span>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <div class="mini-progress-track">
              <div class="mini-progress-fill" style="width: ${ev.percent}%;"></div>
            </div>
            <span style="font-size: 0.78rem; font-weight: 800; color: var(--text-main); min-width: 42px;">${ev.percent}%</span>
          </div>
        </td>
        <td style="text-align: center;">
          ${statusHtml}
        </td>
      </tr>
    `;
  }).join('');
}

function setLeaderboardCategory(cat) {
  activeLeaderboardCategory = cat;
  document.getElementById('btnRankPPL').classList.toggle('active', cat === 'PPL');
  document.getElementById('btnRankPML').classList.toggle('active', cat === 'PML');
  loadAdminLeaderboard();
}

async function loadAdminLeaderboard() {
  if (!currentUser || currentUser.role !== 'Super Admin') return;

  const kec = document.getElementById('leaderboardKecamatanSelect').value;
  try {
    const res = await fetch(`/api/admin/leaderboard?userId=${currentUser.id}&kecamatan=${kec}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Gagal memuat leaderboard.');

    const list = activeLeaderboardCategory === 'PPL' ? data.leaderboardPPL : data.leaderboardPML;
    renderLeaderboardView(list);
  } catch (err) {
    console.error('Error loading leaderboard:', err);
    showToast('Gagal memuat leaderboard.', 'error');
  }
}

function renderLeaderboardView(list) {
  const podiumContainer = document.getElementById('leaderboardPodium');
  const thead = document.getElementById('leaderboardThead');
  const tbody = document.getElementById('leaderboardTbody');

  const isPPL = activeLeaderboardCategory === 'PPL';

  // Render Podium (Top 3)
  if (list.length >= 1) {
    const rank1 = list[0];
    const rank2 = list[1] || null;
    const rank3 = list[2] || null;

    podiumContainer.innerHTML = `
      <!-- Rank 2 -->
      <div class="podium-card-clean rank-2 ${!rank2 ? 'hidden' : ''}">
        <div class="podium-avatar-rank">🥈 2</div>
        <div class="podium-target-name">${rank2 ? (isPPL ? rank2.nama_ppl : rank2.nama_pml) : '-'}</div>
        <div class="podium-target-kec">Kec. ${rank2 ? rank2.kecamatan : '-'}</div>
        <div class="podium-target-score">${rank2 ? Number(rank2.final_score).toFixed(2) : '-'}</div>
        <div class="podium-target-lbl">Juara 2 ${isPPL ? 'PPL' : 'PML'} Terbaik</div>
      </div>

      <!-- Rank 1 -->
      <div class="podium-card-clean rank-1">
        <div class="podium-avatar-rank">👑 1</div>
        <div class="podium-target-name">${isPPL ? rank1.nama_ppl : rank1.nama_pml}</div>
        <div class="podium-target-kec">Kec. ${rank1.kecamatan}</div>
        <div class="podium-target-score">${Number(rank1.final_score).toFixed(2)}</div>
        <div class="podium-target-lbl" style="color: #b45309; font-weight: 800;">🏆 JUARA 1 ${isPPL ? 'PPL' : 'PML'} TERBAIK</div>
      </div>

      <!-- Rank 3 -->
      <div class="podium-card-clean rank-3 ${!rank3 ? 'hidden' : ''}">
        <div class="podium-avatar-rank">🥉 3</div>
        <div class="podium-target-name">${rank3 ? (isPPL ? rank3.nama_ppl : rank3.nama_pml) : '-'}</div>
        <div class="podium-target-kec">Kec. ${rank3 ? rank3.kecamatan : '-'}</div>
        <div class="podium-target-score">${rank3 ? Number(rank3.final_score).toFixed(2) : '-'}</div>
        <div class="podium-target-lbl">Juara 3 ${isPPL ? 'PPL' : 'PML'} Terbaik</div>
      </div>
    `;
    podiumContainer.style.display = 'grid';
  } else {
    podiumContainer.style.display = 'none';
  }

  // Render Header Table
  if (isPPL) {
    thead.innerHTML = `
      <tr>
        <th style="width: 60px;">Rank</th>
        <th>Nama PPL Terbaik</th>
        <th>Kecamatan</th>
        <th>PML Penilai</th>
        <th>Kualitas (35%)</th>
        <th>Ketepatan (30%)</th>
        <th>Disiplin (20%)</th>
        <th>Sikap (15%)</th>
        <th>Nilai Akhir</th>
        <th>Predikat</th>
        <th style="text-align: center; width: 100px;">Aksi</th>
      </tr>
    `;
  } else {
    thead.innerHTML = `
      <tr>
        <th style="width: 60px;">Rank</th>
        <th>Nama PML Terbaik</th>
        <th>Kecamatan</th>
        <th>Pegawai Penilai</th>
        <th>Pengawasan (35%)</th>
        <th>Manajemen (30%)</th>
        <th>Leadership (20%)</th>
        <th>Komunikasi (15%)</th>
        <th>Rerata Nilai</th>
        <th>Predikat</th>
        <th style="text-align: center; width: 100px;">Aksi</th>
      </tr>
    `;
  }

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" style="text-align: center; padding: 3rem; color: var(--text-muted);">
          <i class="fa-solid fa-inbox" style="font-size: 1.8rem; margin-bottom: 0.5rem; display: block;"></i>
          Belum ada data penilaian yang masuk untuk kategori ini.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map((row, idx) => {
    const rank = idx + 1;
    let rankBadgeClass = 'badge-normal';
    if (rank === 1) rankBadgeClass = 'badge-gold';
    else if (rank === 2) rankBadgeClass = 'badge-silver';
    else if (rank === 3) rankBadgeClass = 'badge-bronze';

    const targetName = isPPL ? row.nama_ppl : row.nama_pml;
    const evaluatorName = isPPL ? row.nama_pml : row.nama_pegawai;

    return `
      <tr>
        <td>
          <span class="badge-rank-num ${rankBadgeClass}">${rank}</span>
        </td>
        <td>
          <strong style="color: var(--text-main); font-size: 0.92rem;">${targetName}</strong>
        </td>
        <td><i class="fa-solid fa-location-dot" style="color: var(--primary); font-size: 0.75rem;"></i> ${row.kecamatan}</td>
        <td>${evaluatorName}</td>
        <td>${Number(row.score_ind1).toFixed(2)}</td>
        <td>${Number(row.score_ind2).toFixed(2)}</td>
        <td>${Number(row.score_ind3).toFixed(2)}</td>
        <td>${Number(row.score_ind4).toFixed(2)}</td>
        <td style="color: #047857; font-weight: 800; font-size: 1.02rem;">
          ${Number(row.final_score).toFixed(2)}
        </td>
        <td>
          <span class="predikat-clean-badge">${row.predikat}</span>
        </td>
        <td style="text-align: center;">
          <button class="btn-clean-delete" title="Hapus Penilaian" onclick="deleteEvaluation(${row.id}, '${encodeURIComponent(targetName)}', '${isPPL ? 'PPL' : 'PML'}')">
            <i class="fa-solid fa-trash-can"></i> Hapus
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function deleteEvaluation(evalId, encodedTargetName, targetType) {
  const targetName = decodeURIComponent(encodedTargetName);
  
  const confirmDelete = confirm(
    `Apakah Anda yakin ingin menghapus penilaian untuk ${targetName} (${targetType})?\n\n` +
    `Setelah dihapus, status pada akun penilai akan otomatis berubah kembali menjadi 'Belum Dinilai' dan tombolnya menjadi 'Beri Nilai Sekarang'.`
  );

  if (!confirmDelete) return;

  try {
    const res = await fetch(`/api/admin/evaluations/${evalId}?userId=${currentUser.id}`, {
      method: 'DELETE'
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Gagal menghapus penilaian.');
    }

    showToast(`Penilaian untuk ${targetName} berhasil dihapus!`);
    
    // Refresh Leaderboard and Overview
    await loadAdminLeaderboard();
  } catch (err) {
    alert(err.message);
  }
}

function exportExcelReport() {
  if (!currentUser || currentUser.role !== 'Super Admin') return;
  window.open(`/api/admin/export?userId=${currentUser.id}`, '_blank');
}

// ----------------- TOAST UTILITY -----------------
let toastTimer = null;
function showToast(message, type = 'success') {
  const toast = document.getElementById('toastNotification');
  const msgEl = document.getElementById('toastMessage');
  const iconEl = document.getElementById('toastIcon');

  if (!toast) return;

  clearTimeout(toastTimer);
  msgEl.textContent = message;

  if (type === 'error') {
    iconEl.className = 'fa-solid fa-circle-exclamation';
    iconEl.style.color = 'var(--accent-rose)';
  } else if (type === 'info') {
    iconEl.className = 'fa-solid fa-circle-info';
    iconEl.style.color = 'var(--primary)';
  } else {
    iconEl.className = 'fa-solid fa-circle-check';
    iconEl.style.color = 'var(--accent-emerald)';
  }

  toast.classList.remove('hidden');
  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}
