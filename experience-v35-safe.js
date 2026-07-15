(() => {
  'use strict';
  const VERSION = '35-safe';
  const $ = (id) => document.getElementById(id);
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
  const todayKey = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const format = (value, digits = 0) => Number(value || 0).toLocaleString('fr-CA', { maximumFractionDigits: digits });
  const icon = (name, label = '') => {
    const paths = {
      home: '<path d="M3 10.8 12 3l9 7.8v8.4a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 19.2z"/><path d="M9 21v-7h6v7"/>',
      scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><circle cx="12" cy="12" r="3.5"/>',
      training: '<path d="M7 9v6M17 9v6M4 10.5v3M20 10.5v3M7 12h10"/><path d="M2.5 9v6M21.5 9v6"/>',
      progress: '<path d="M4 18 9 13l3 3 8-9"/><path d="M15 7h5v5"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09a1.7 1.7 0 0 0-1.1-1.58 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.67 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.5 4.67a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.12.38.33.72.6 1 .29.3.68.45 1.1.4h.09v4h-.09a1.7 1.7 0 0 0-1.7.6Z"/>',
      add: '<path d="M12 5v14M5 12h14"/>',
      lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
      bolt: '<path d="m13 2-8 12h6l-1 8 8-12h-6z"/>',
      chevron: '<path d="m9 18 6-6-6-6"/>',
      info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    };
    return `<svg class="mf-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"${label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true"'}>${paths[name] || paths.info}</svg>`;
  };

  let lastGeneral = null;
  let lastTraining = null;
  let booted = false;
  function safely(label, action) {
    try { return action(); }
    catch (error) {
      console.error(`[MacroFlow v35 safe] ${label}`, error);
      document.documentElement.dataset.v35SafeError = label;
      return undefined;
    }
  }

  function totalsFrom(detail) {
    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const today = todayKey();
    (detail?.meals || []).filter((meal) => meal.date === today).forEach((meal) => {
      for (const key of Object.keys(totals)) totals[key] += Number(meal[key]) || 0;
    });
    return totals;
  }

  function installFlowCore() {
    const card = document.querySelector('.score-card');
    if (!card || card.dataset.v35Core === '1') return;
    const previousTitle = card.querySelector('#scoreTitle')?.textContent || 'Commence ta journée';
    const previousHint = card.querySelector('#scoreHint')?.textContent || 'Ajoute ton premier repas pour lancer ton suivi.';
    card.dataset.v35Core = '1';
    card.className = 'score-card card macro-orbit-card flow-core-card';
    card.innerHTML = `
      <div class="flow-core-visual" aria-label="Progression énergétique quotidienne">
        <svg viewBox="0 0 240 240" aria-hidden="true">
          <defs>
            <linearGradient id="flowEnergyGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#66e3ff"/><stop offset=".48" stop-color="#a96cff"/><stop offset="1" stop-color="#51e88b"/>
            </linearGradient>
            <filter id="flowGlow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>
          <circle class="flow-core-track" cx="120" cy="120" r="96"/>
          <circle id="flowCoreProgress" class="flow-core-progress" cx="120" cy="120" r="96"/>
          <circle class="flow-core-ticks" cx="120" cy="120" r="108"/>
        </svg>
        <span id="flowCoreSpark" class="flow-core-spark"></span>
        <div class="flow-core-center">
          <span class="flow-core-kicker">Énergie du jour</span>
          <strong><span id="flowCaloriesNow">0</span><small> kcal</small></strong>
          <span id="flowCaloriesGoal">sur 0</span>
          <em id="flowCaloriesRemaining">Commence ta journée</em>
        </div>
        <span id="scoreRing" class="v35-legacy-score-ring" aria-hidden="true"></span><span id="scoreValue" class="v35-score-value" aria-hidden="true">0</span>
      </div>
      <div class="flow-core-copy score-copy">
        <span class="eyebrow">Vue en une seconde</span>
        <h2 id="scoreTitle">${previousTitle}</h2>
        <p id="scoreHint">${previousHint}</p>
        <div class="flow-macro-strip" aria-label="Progression des macronutriments">
          ${['protein','carbs','fat'].map((key) => {
            const labels = { protein: 'Protéines', carbs: 'Glucides', fat: 'Lipides' };
            const short = { protein: 'P', carbs: 'G', fat: 'L' };
            return `<div class="flow-macro flow-${key}"><span class="flow-macro-letter">${short[key]}</span><div><b>${labels[key]}</b><small id="flow-${key}-text">0 / 0 g</small><i><span id="flow-${key}-fill"></span></i></div></div>`;
          }).join('')}
        </div>
      </div>`;
  }

  function updateFlowCore(detail = lastGeneral) {
    installFlowCore();
    if (!detail) {
      const cards = [...document.querySelectorAll('#macroGrid .macro-card')];
      const keys = ['calories','protein','carbs','fat'];
      const totals = {}, goals = {};
      cards.forEach((card, index) => {
        const key = keys[index];
        const nums = String(card.textContent || '').replace(/\s/g, '').match(/\d+(?:[.,]\d+)?/g) || [];
        totals[key] = Number((nums[0] || '0').replace(',', '.'));
        goals[key] = Number((nums.at(-1) || '1').replace(',', '.'));
      });
      detail = { goals, meals: [] };
      detail.__totals = totals;
    }
    const totals = detail.__totals || totalsFrom(detail);
    const goals = detail.goals || { calories: 1, protein: 1, carbs: 1, fat: 1 };
    const ratio = clamp(totals.calories / Math.max(1, goals.calories));
    const circumference = 2 * Math.PI * 96;
    const progress = $('flowCoreProgress');
    if (progress) {
      progress.style.strokeDasharray = `${circumference}`;
      progress.style.strokeDashoffset = `${circumference * (1 - ratio)}`;
    }
    const spark = $('flowCoreSpark');
    if (spark) spark.style.setProperty('--flow-angle', `${ratio * 360 - 90}deg`);
    if ($('flowCaloriesNow')) $('flowCaloriesNow').textContent = format(Math.round(totals.calories));
    if ($('flowCaloriesGoal')) $('flowCaloriesGoal').textContent = `sur ${format(Math.round(goals.calories))} kcal`;
    const remaining = Math.round(goals.calories - totals.calories);
    if ($('flowCaloriesRemaining')) $('flowCaloriesRemaining').textContent = remaining > 0 ? `${format(remaining)} kcal restantes` : remaining === 0 ? 'Objectif atteint' : `${format(Math.abs(remaining))} kcal au-dessus`;
    for (const key of ['protein','carbs','fat']) {
      const pct = clamp(totals[key] / Math.max(1, goals[key]));
      const text = $(`flow-${key}-text`);
      const fill = $(`flow-${key}-fill`);
      if (text) text.textContent = `${format(totals[key], 1)} / ${format(goals[key])} g`;
      if (fill) fill.style.width = `${pct * 100}%`;
    }
  }

  function findSectionHead(home, title) {
    return [...home.querySelectorAll('.section-head')].find((head) => head.querySelector('h2')?.textContent.trim() === title);
  }

  function organizeHome() {
    const home = document.querySelector('[data-view="home"]');
    if (!home || home.dataset.v35Order === '1') return;
    const score = home.querySelector('.score-card');
    const quick = home.querySelector('.quick-actions');
    const today = $('todayTrainingCard');
    const mealHead = findSectionHead(home, 'Repas');
    const mealList = $('mealList');
    const macroHead = findSectionHead(home, 'Macros');
    const macroGrid = $('macroGrid');
    const quickHub = $('quickAddHub');
    const momentum = $('momentumCard');
    if (!score || !quick || !mealHead || !mealList || !macroHead || !macroGrid) return;

    const macroDetails = document.createElement('details');
    macroDetails.className = 'card v35-macro-details';
    macroDetails.innerHTML = `<summary><span><b>Détails des macros</b><small>Valeurs et objectifs précis</small></span>${icon('chevron')}</summary><div class="v35-details-body"></div>`;
    macroDetails.querySelector('.v35-details-body').append(macroHead, macroGrid);

    const actionsLabel = document.createElement('div');
    actionsLabel.className = 'v35-section-label';
    actionsLabel.innerHTML = '<span>Action rapide</span><small>Ajoute ton repas en quelques secondes</small>';

    const mealsLabel = document.createElement('div');
    mealsLabel.className = 'v35-section-label v35-meals-label';
    mealsLabel.innerHTML = '<span>Journal du jour</span><small>Ce que tu as réellement mangé</small>';

    home.replaceChildren();
    home.append(score, actionsLabel, quick);
    if (today) home.append(today);
    home.append(mealsLabel, mealHead, mealList, macroDetails);
    if (quickHub) home.append(quickHub);
    if (momentum) home.append(momentum);
    home.dataset.v35Order = '1';
  }

  function simplifyOnboarding() {
    const onboarding = $('trainingOnboarding');
    if (!onboarding || onboarding.dataset.v35Simple === '1') return;
    onboarding.dataset.v35Simple = '1';
    if (onboarding.parentElement !== document.body) document.body.append(onboarding);
    const readyModal = $('planReadyModal');
    if (readyModal && readyModal.parentElement !== document.body) document.body.append(readyModal);
    const meta = onboarding.querySelector('.onboarding-progress-meta');
    if (meta && !meta.querySelector('.v35-time-badge')) {
      const badge = document.createElement('span');
      badge.className = 'v35-time-badge';
      badge.textContent = 'Environ 4 min';
      meta.insertBefore(badge, meta.lastElementChild);
    }

    onboarding.querySelectorAll('.question-help:not(.imperial-height-help)').forEach((help, index) => {
      if (help.closest('details.v35-help')) return;
      const details = document.createElement('details');
      details.className = 'v35-help';
      const summary = document.createElement('summary');
      summary.innerHTML = `${icon('info')} Pourquoi cette question?`;
      const parent = help.parentElement;
      help.classList.add('v35-help-copy');
      if (parent?.tagName === 'LABEL' && parent.querySelector('input,select')) {
        help.remove();
        details.append(summary, help);
        parent.after(details);
      } else {
        help.replaceWith(details);
        details.append(summary, help);
      }
      details.dataset.helpIndex = String(index);
    });

    onboarding.querySelectorAll('.exercise-picker').forEach((picker) => {
      if (picker.querySelector(':scope > details.v35-optional-picker')) return;
      const details = document.createElement('details');
      details.className = 'v35-optional-picker';
      const summary = document.createElement('summary');
      summary.innerHTML = `<span>Choisir mes exercices</span><small>Facultatif</small>${icon('chevron')}`;
      const movable = [...picker.children].filter((child) => !['STRONG','DETAILS'].includes(child.tagName));
      const body = document.createElement('div');
      body.className = 'v35-picker-body';
      movable.forEach((child) => body.append(child));
      details.append(summary, body);
      picker.append(details);
    });

    const equipmentQuestion = [...onboarding.querySelectorAll('[data-onboarding-step="6"] .onboarding-question')].find((q) => q.querySelector('input[name="trainingEquipment"]'));
    if (equipmentQuestion && !equipmentQuestion.querySelector(':scope > details.v35-equipment-details')) {
      const details = document.createElement('details');
      details.className = 'v35-equipment-details';
      const summary = document.createElement('summary');
      summary.innerHTML = `<span>Ajuster la liste du matériel</span><small>Le choix recommandé est déjà appliqué</small>${icon('chevron')}`;
      const body = document.createElement('div');
      body.className = 'v35-equipment-body';
      const heading = equipmentQuestion.querySelector(':scope > strong');
      const firstHelp = equipmentQuestion.querySelector(':scope > details.v35-help');
      [...equipmentQuestion.children].filter((child) => child !== heading && child !== firstHelp && child !== details).forEach((child) => body.append(child));
      details.append(summary, body);
      equipmentQuestion.append(details);
    }
  }

  function compactProgram(program) {
    const container = $('programDays');
    if (!container || !program) return;
    const cards = [...container.querySelectorAll('.day-card')];
    cards.forEach((card, index) => {
      if (card.tagName === 'DETAILS') return;
      const details = document.createElement('details');
      details.className = 'day-card v35-day-card';
      if (index === 0) details.open = true;
      const head = card.querySelector('.day-head');
      const summary = document.createElement('summary');
      summary.innerHTML = `<div>${head?.innerHTML || `<b>Séance ${index + 1}</b>`}</div>${icon('chevron')}`;
      const body = document.createElement('div');
      body.className = 'v35-day-body';
      [...card.children].filter((child) => child !== head).forEach((child) => body.append(child));
      details.append(summary, body);
      card.replaceWith(details);
    });

    const summary = $('programSummary');
    if (summary && !summary.querySelector('.v35-science-details')) {
      const detailedNodes = [...summary.querySelectorAll('.volume-chips,.rationale-list,.evidence-note,.program-quality-note')];
      if (detailedNodes.length) {
        const details = document.createElement('details');
        details.className = 'v35-science-details';
        details.innerHTML = `<summary><span>Comprendre mon programme</span>${icon('chevron')}</summary><div></div>`;
        detailedNodes.forEach((node) => details.lastElementChild.append(node));
        summary.append(details);
      }
    }
  }

  function installProgramSpotlight(detail) {
    const program = detail?.program;
    if (!program?.days?.length) return;
    const panel = document.querySelector('[data-training-panel="program"]');
    const programSummary = $('programSummary');
    if (!panel || !programSummary) return;
    let spotlight = $('v35ProgramSpotlight');
    if (!spotlight) {
      spotlight = document.createElement('section');
      spotlight.id = 'v35ProgramSpotlight';
      spotlight.className = 'card v35-program-spotlight';
      panel.insertBefore(spotlight, programSummary.closest('.training-card') || panel.firstElementChild);
    }
    const jsDay = new Date().getDay();
    const today = program.days.find((day) => Number(day.weekday) === jsDay);
    const day = today || program.days[0];
    const setCount = (day.exercises || []).reduce((sum, ex) => sum + Number(ex.sets || 0), 0);
    const durationText = document.querySelector(`[data-start-day="${day.id}"]`)?.closest('.day-card')?.querySelector('.day-head span')?.textContent || 'Séance personnalisée';
    spotlight.innerHTML = `<div><span class="eyebrow">${today ? 'Aujourd’hui' : 'Prochaine séance'}</span><h2>${day.name}</h2><p>${durationText} · ${setCount} séries · ${(day.exercises || []).length} exercices</p></div><button type="button" data-v35-start-day="${day.id}">Commencer${icon('chevron')}</button>`;
    spotlight.querySelector('button')?.addEventListener('click', () => document.querySelector(`[data-start-day="${day.id}"]`)?.click());
    compactProgram(program);
  }

  function localizeInterface() {
    const replacements = [
      ['.tab[data-tab="scan"] small', 'Scanner'],
      ['.tab[data-tab="workout"] small', 'Entraînement'],
      ['.training-hero .eyebrow', 'Programme MacroFlow'],
    ];
    replacements.forEach(([selector, text]) => { const el = document.querySelector(selector); if (el && el.textContent !== text) el.textContent = text; });
    document.querySelectorAll('h2,h3,span,small,b,p,label,summary').forEach((el) => {
      if (el.children.length) return;
      const map = new Map([
        ['Bilan Training', 'Bilan d’entraînement'],
        ['Poids, Training et nutrition', 'Poids, entraînement et nutrition'],
        ['Training', 'Entraînement'],
      ]);
      if (map.has(el.textContent.trim())) el.textContent = map.get(el.textContent.trim());
    });
  }

  function setIconOnce(element, iconName) {
    if (!element || element.dataset.v35Icon === iconName) return;
    element.dataset.v35Icon = iconName;
    element.innerHTML = icon(iconName);
  }

  function installIconSystem() {
    const tabs = { home: 'home', scan: 'scan', workout: 'training', progress: 'progress', settings: 'settings' };
    Object.entries(tabs).forEach(([tab, iconName]) => setIconOnce(document.querySelector(`.tab[data-tab="${tab}"] > span`), iconName));
    setIconOnce(document.querySelector('.primary-action > span'), 'scan');
    setIconOnce(document.querySelector('.secondary-action > span'), 'add');
    setIconOnce(document.querySelector('.privacy-card > span'), 'lock');
    setIconOnce(document.querySelector('.level-pill > span'), 'bolt');
    setIconOnce(document.querySelector('.scan-primary-capture > span'), 'scan');
    document.querySelectorAll('.phase4-features div b').forEach((el, index) => setIconOnce(el, ['scan','training','lock'][index] || 'info'));
  }

  function addVersionStatus() {
    const status = document.querySelector('.app-status-list');
    if (!status || status.querySelector('[data-v35-version]')) return;
    const row = document.createElement('span');
    row.dataset.v35Version = '1';
    row.innerHTML = '<b>Version</b><small>MacroFlow v35 · expérience simplifiée</small>';
    status.append(row);
  }

  function refresh() {
    installFlowCore();
    organizeHome();
    simplifyOnboarding();
    localizeInterface();
    installIconSystem();
    addVersionStatus();
    updateFlowCore(lastGeneral);
    if (lastTraining) installProgramSpotlight(lastTraining);
  }

  function boot() {
    if (booted) return;
    booted = true;
    safely('initialisation', refresh);
    document.documentElement.dataset.v35Safe = 'ready';
    window.addEventListener('macroflow:general-state-rendered', (event) => {
      lastGeneral = event.detail || lastGeneral;
      requestAnimationFrame(() => safely('mise à jour nutrition', () => updateFlowCore(lastGeneral)));
    });
    window.addEventListener('macroflow:home-rendered', () => {
      requestAnimationFrame(() => safely('mise à jour accueil', () => updateFlowCore(lastGeneral)));
    });
    window.addEventListener('macroflow:training-state-rendered', (event) => {
      lastTraining = event.detail || lastTraining;
      requestAnimationFrame(() => safely('mise à jour programme', () => installProgramSpotlight(lastTraining)));
    });
    window.addEventListener('macroflow:view-change', (event) => {
      const view = event.detail?.view;
      if (view === 'home') requestAnimationFrame(() => safely('navigation accueil', () => updateFlowCore(lastGeneral)));
      if (view === 'workout' && lastTraining) requestAnimationFrame(() => safely('navigation entraînement', () => installProgramSpotlight(lastTraining)));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  const destroy = () => { booted = false; };
  window.MacroFlowExperienceV35 = Object.freeze({ version: VERSION, refresh, updateFlowCore, organizeHome, simplifyOnboarding, compactProgram, icon, destroy });
})();
