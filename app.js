/* ============================================================
   WeightTrack — app.js
   Toda a lógica de negócio, gráfico e persistência
   ============================================================ */

// ── Storage keys ──────────────────────────────────────────────
const KEY_CONFIG = 'wt_config';
const KEY_ENTRIES = 'wt_entries';

// ── State ─────────────────────────────────────────────────────
let config = loadJSON(KEY_CONFIG, { height: null, initialWeight: null, goalWeight: null });
let entries = loadJSON(KEY_ENTRIES, []);  // [{ date, weight, note }]
let chart = null;

// ── DOM refs ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setHeaderDate();
  setDefaultDate();
  loadConfigToForm();
  render();

  $('btnSaveConfig').addEventListener('click', saveConfig);
  $('btnAddEntry').addEventListener('click', addEntry);
  $('btnClearAll').addEventListener('click', clearAll);
});

// ── Date helpers ──────────────────────────────────────────────
function setHeaderDate() {
  const now = new Date();
  const opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  $('headerDate').textContent = now.toLocaleDateString('pt-BR', opts);
}

function setDefaultDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  $('inputDate').value = `${yyyy}-${mm}-${dd}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// ── Config ────────────────────────────────────────────────────
function loadConfigToForm() {
  if (config.height) $('inputHeight').value = config.height;
  if (config.initialWeight) $('inputInitialWeight').value = config.initialWeight;
  if (config.goalWeight) $('inputGoalWeight').value = config.goalWeight;
}

function saveConfig() {
  const h = parseFloat($('inputHeight').value);
  const iw = parseFloat($('inputInitialWeight').value);
  const gw = parseFloat($('inputGoalWeight').value);

  if (!h || h < 100 || h > 250) { showAlert('Altura inválida (100–250 cm)', 'error'); return; }
  if (!iw || iw < 30) { showAlert('Peso inicial inválido', 'error'); return; }
  if (!gw || gw < 30) { showAlert('Peso meta inválido', 'error'); return; }
  if (gw >= iw) { showAlert('O peso meta deve ser menor que o peso inicial 😅', 'error'); return; }

  config = { height: h, initialWeight: iw, goalWeight: gw };
  saveJSON(KEY_CONFIG, config);
  showAlert('✅ Configurações salvas!', 'success');
  render();
}

// ── Entries ───────────────────────────────────────────────────
function addEntry() {
  const weight = parseFloat($('inputWeight').value);
  const date = $('inputDate').value.trim();
  const note = $('inputNote').value.trim();

  if (!weight || weight < 30 || weight > 300) { showAlert('Peso inválido (30–300 kg)', 'error'); return; }
  if (!date) { showAlert('Selecione uma data', 'error'); return; }
  if (entries.some(e => e.date === date)) { showAlert('Já existe um registro para essa data. Delete o antigo primeiro.', 'error'); return; }

  entries.push({ date, weight, note });
  entries.sort((a, b) => a.date.localeCompare(b.date));
  saveJSON(KEY_ENTRIES, entries);

  $('inputWeight').value = '';
  $('inputNote').value = '';
  showAlert('✅ Registro adicionado!', 'success');
  render();
}

function deleteEntry(date) {
  entries = entries.filter(e => e.date !== date);
  saveJSON(KEY_ENTRIES, entries);
  render();
}

function clearAll() {
  if (!confirm('Tem certeza que quer apagar TODOS os registros?')) return;
  entries = [];
  saveJSON(KEY_ENTRIES, entries);
  render();
}

// ── BMI ───────────────────────────────────────────────────────
function calcBMI(weight) {
  if (!config.height) return null;
  const h = config.height / 100;
  return weight / (h * h);
}

function bmiLabel(bmi) {
  if (bmi < 18.5) return { label: 'Abaixo do peso', cls: 'bmi-under' };
  if (bmi < 25) return { label: 'Normal', cls: 'bmi-normal' };
  if (bmi < 30) return { label: 'Sobrepeso', cls: 'bmi-over' };
  return { label: 'Obesidade', cls: 'bmi-obese' };
}

// ── Render ────────────────────────────────────────────────────
function render() {
  const hasConfig = config.initialWeight && config.goalWeight && config.height;
  const hasEntries = entries.length > 0;

  updateStats(hasConfig, hasEntries);
  updateProgress(hasConfig, hasEntries);
  updateChart(hasEntries);
  updateHistory(hasEntries);
  $('emptyState').style.display = hasEntries ? 'none' : 'flex';
}

function updateStats(hasConfig, hasEntries) {
  const iw = config.initialWeight;
  const gw = config.goalWeight;
  const current = hasEntries ? entries[entries.length - 1].weight : null;

  $('statCurrentWeight').textContent = current !== null ? current.toFixed(1) : '—';
  $('statGoalWeight').textContent = hasConfig ? gw.toFixed(1) : '—';

  if (current !== null && iw) {
    const lost = iw - current;
    $('statLost').textContent = (lost >= 0 ? lost : 0).toFixed(1);
  } else {
    $('statLost').textContent = '—';
  }

  if (current !== null && config.height) {
    const bmi = calcBMI(current);
    const info = bmiLabel(bmi);
    $('statBMI').textContent = bmi.toFixed(1);
    $('statBMILabel').textContent = info.label;
    $('statBMI').className = 'card-value ' + info.cls;
  } else {
    $('statBMI').textContent = '—';
    $('statBMILabel').textContent = '';
    $('statBMI').className = 'card-value';
  }

  if (current !== null && hasConfig) {
    const remaining = current - gw;
    $('statRemaining').textContent = (remaining > 0 ? remaining : 0).toFixed(1);
    const total = iw - gw;
    const done = iw - current;
    const pct = Math.min(100, Math.max(0, (done / total) * 100));
    $('statProgress').textContent = pct.toFixed(0);
  } else {
    $('statRemaining').textContent = '—';
    $('statProgress').textContent = '—';
  }
}

function updateProgress(hasConfig, hasEntries) {
  const section = $('progressSection');
  if (!hasConfig || !hasEntries) { section.style.display = 'none'; return; }

  const iw = config.initialWeight;
  const gw = config.goalWeight;
  const current = entries[entries.length - 1].weight;

  const total = iw - gw;
  const done = iw - current;
  const pct = Math.min(100, Math.max(0, (done / total) * 100));

  section.style.display = '';
  $('progressPct').textContent = pct.toFixed(0) + '%';
  $('progressBarFill').style.width = pct.toFixed(1) + '%';
  $('progressStart').textContent = iw.toFixed(1) + ' kg';
  $('progressEnd').textContent = gw.toFixed(1) + ' kg';
}

function updateChart(hasEntries) {
  const section = $('chartSection');
  if (!hasEntries) { section.style.display = 'none'; chart && chart.destroy(); return; }
  section.style.display = '';

  const labels = entries.map(e => formatDate(e.date));
  const weights = entries.map(e => e.weight);

  const minW = Math.min(...weights) - 2;
  const maxW = Math.max(...weights) + 2;

  // Goal line dataset
  const datasets = [
    {
      label: 'Peso (kg)',
      data: weights,
      borderColor: '#3ecf8e',
      backgroundColor: ctx => {
        const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
        gradient.addColorStop(0, 'rgba(62,207,142,0.18)');
        gradient.addColorStop(1, 'rgba(62,207,142,0)');
        return gradient;
      },
      borderWidth: 2,
      pointBackgroundColor: '#3ecf8e',
      pointBorderColor: '#1c1c1c',
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
      fill: true,
      tension: 0.3,
    }
  ];

  if (config.goalWeight) {
    datasets.push({
      label: 'Meta',
      data: weights.map(() => config.goalWeight),
      borderColor: 'rgba(62,207,142,0.35)',
      borderDash: [6, 4],
      borderWidth: 1,
      pointRadius: 0,
      fill: false,
    });
  }

  if (chart) chart.destroy();

  chart = new Chart($('weightChart'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: {
          labels: { color: '#52525b', font: { family: 'Inter', size: 11 }, boxWidth: 12, boxHeight: 2 }
        },
        tooltip: {
          backgroundColor: '#1c1c1c',
          borderColor: '#3e3e3e',
          borderWidth: 1,
          titleColor: '#ededed',
          bodyColor: '#a1a1aa',
          padding: 10,
          cornerRadius: 4,
          callbacks: {
            label: ctx => ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(1) + ' kg'
          }
        }
      },
      scales: {
        x: {
          grid: { color: '#2a2a2a', drawBorder: false },
          ticks: { color: '#52525b', font: { family: 'Inter', size: 11 } }
        },
        y: {
          min: minW,
          max: maxW,
          grid: { color: '#2a2a2a', drawBorder: false },
          ticks: {
            color: '#52525b',
            font: { family: 'Inter', size: 11 },
            callback: v => v.toFixed(1) + ' kg'
          }
        }
      }
    }
  });
}

function updateHistory(hasEntries) {
  const section = $('historySection');
  if (!hasEntries) { section.style.display = 'none'; return; }
  section.style.display = '';

  const tbody = $('historyBody');
  tbody.innerHTML = '';

  const reversed = [...entries].reverse();

  reversed.forEach((entry, idx) => {
    const prev = reversed[idx + 1];
    const diff = prev ? entry.weight - prev.weight : null;

    let diffHtml = '<span class="badge-same">—</span>';
    if (diff !== null) {
      const sign = diff > 0 ? '+' : '';
      const cls = diff < 0 ? 'badge-loss' : diff > 0 ? 'badge-gain' : 'badge-same';
      diffHtml = `<span class="${cls}">${sign}${diff.toFixed(1)} kg</span>`;
    }

    let bmiHtml = '—';
    if (config.height) {
      const bmi = calcBMI(entry.weight);
      const info = bmiLabel(bmi);
      bmiHtml = `<span class="${info.cls}">${bmi.toFixed(1)}</span>`;
    }

    const noteHtml = entry.note
      ? `<span class="note-text" title="${escapeHtml(entry.note)}">${escapeHtml(entry.note)}</span>`
      : '<span style="color:var(--text-dim)">—</span>';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDate(entry.date)}</td>
      <td><strong>${entry.weight.toFixed(1)} kg</strong></td>
      <td>${diffHtml}</td>
      <td>${bmiHtml}</td>
      <td>${noteHtml}</td>
      <td>
        <button class="btn-icon" title="Apagar" onclick="deleteEntry('${entry.date}')">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Alert ─────────────────────────────────────────────────────
let alertTimer;
function showAlert(msg, type = 'success') {
  const el = $('alert');
  el.textContent = msg;
  el.className = `alert alert-${type}`;
  el.style.display = '';
  clearTimeout(alertTimer);
  alertTimer = setTimeout(() => { el.style.display = 'none'; }, 3500);
}

// ── Utilities ─────────────────────────────────────────────────
function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch { return fallback; }
}
function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
