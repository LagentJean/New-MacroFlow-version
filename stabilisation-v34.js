(() => {
  'use strict';
  const VERSION = 34;
  const KEY = 'macroflow-scanner-benchmark-v34';
  const $ = (id) => document.getElementById(id);

  function readEntries() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  function benchmarkSummary(entries = readEntries()) {
    const valid = entries.filter((entry) => Number.isFinite(Number(entry.percentError)) && Number(entry.actualGrams) > 0);
    if (!valid.length) return { count: 0, meanPercent: null, medianPercent: null, status: 'À commencer' };
    const values = valid.map((entry) => Number(entry.percentError)).sort((a, b) => a - b);
    const meanPercent = values.reduce((sum, value) => sum + value, 0) / values.length;
    const middle = Math.floor(values.length / 2);
    const medianPercent = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
    const enough = valid.length >= 20;
    const status = !enough ? 'Données en cours' : meanPercent <= 12 ? 'Très prometteur' : meanPercent <= 20 ? 'Utilisable avec vérification' : 'À améliorer';
    return { count: valid.length, meanPercent, medianPercent, status };
  }

  function renderBenchmark() {
    const summary = benchmarkSummary();
    if ($('scannerBenchmarkCount')) $('scannerBenchmarkCount').textContent = String(summary.count);
    if ($('scannerValidationBadge')) $('scannerValidationBadge').textContent = `${Math.min(summary.count, 20)}/20`;
    if ($('scannerBenchmarkMae')) $('scannerBenchmarkMae').textContent = summary.meanPercent == null ? '—' : `${summary.meanPercent.toLocaleString('fr-CA', { maximumFractionDigits: 1 })} %`;
    if ($('scannerBenchmarkStatus')) $('scannerBenchmarkStatus').textContent = summary.status;
    document.querySelector('.scanner-validation-card')?.style.setProperty('--validation-progress', `${Math.min(100, summary.count / 20 * 100)}%`);
  }

  function escapeCsv(value) {
    const text = String(value ?? '');
    return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function exportBenchmark() {
    const entries = readEntries();
    if (!entries.length) {
      window.MacroFlowDelight?.haptic?.('warning');
      window.alert('Aucune portion comparée pour le moment.');
      return;
    }
    const rows = [
      ['Date', 'Aliment', 'Estimation (g)', 'Poids réel (g)', 'Erreur absolue (g)', 'Erreur (%)', 'Source', 'Assiette'],
      ...entries.map((entry) => [entry.createdAt, entry.label, entry.estimatedGrams, entry.actualGrams, entry.absoluteError, entry.percentError, entry.estimateSource, entry.plateKey]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(escapeCsv).join(';')).join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `MacroFlow-validation-scanner-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    window.MacroFlowDelight?.haptic?.('success');
  }

  function resetBenchmark() {
    if (!readEntries().length) return;
    if (!window.confirm('Effacer uniquement les résultats de validation du scanner? Tes portions vérifiées resteront enregistrées.')) return;
    localStorage.removeItem(KEY);
    renderBenchmark();
  }

  function renderModelState(state) {
    const label = $('scannerModelState');
    if (!label) return;
    const labels = {
      idle: 'Chargé seulement à l’ouverture',
      loading: 'Préparation locale…',
      ready: 'Moteur prêt et mis en cache',
      error: 'Indisponible · ajout manuel actif',
    };
    label.textContent = labels[state] || labels.idle;
    label.dataset.state = state;
  }

  function boot() {
    renderBenchmark();
    $('exportScannerBenchmarkBtn')?.addEventListener('click', exportBenchmark);
    $('resetScannerBenchmarkBtn')?.addEventListener('click', resetBenchmark);
    window.addEventListener('macroflow:scanner-benchmark-updated', renderBenchmark);
    window.addEventListener('macroflow:view-change', (event) => {
      if (event.detail?.view === 'settings') renderBenchmark();
      if (event.detail?.view === 'scan') renderModelState('loading');
    });
    const frame = $('aiEngine');
    frame?.addEventListener('load', () => renderModelState('ready'));
    frame?.addEventListener('error', () => renderModelState('error'));
    window.MacroFlowV34 = Object.freeze({ version: VERSION, benchmarkSummary, renderBenchmark });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
