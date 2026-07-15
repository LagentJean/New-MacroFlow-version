(() => {
  'use strict';

  const VERSION = 'MacroFlow-QuickAdd-v20';
  const DATABASE = { name: 'macroflow-local', version: 1, store: 'app-state', key: 'main' };
  const MEAL_LABELS = { breakfast: 'Déjeuner', lunch: 'Dîner', dinner: 'Souper', snack: 'Collation' };
  const STARTERS = {
    breakfast: ['Œuf entier', 'Yogourt grec 0 %', 'Gruau sec', 'Banane', 'Pain', 'Beurre d’arachide'],
    lunch: ['Poitrine de poulet', 'Riz blanc cuit', 'Légumes mélangés', 'Thon en conserve', 'Pomme de terre', 'Avocat'],
    dinner: ['Poitrine de poulet', 'Riz blanc cuit', 'Bœuf haché maigre', 'Saumon', 'Pomme de terre', 'Légumes mélangés'],
    snack: ['Yogourt grec 0 %', 'Banane', 'Poudre de protéines', 'Barre protéinée', 'Amandes', 'Pomme'],
  };
  const DEFAULT_GRAMS = {
    'œuf entier': 50, 'yogourt grec 0 %': 175, 'gruau sec': 50, banane: 118, pain: 35,
    'beurre d’arachide': 32, 'poitrine de poulet': 150, 'riz blanc cuit': 180,
    'riz brun cuit': 180, 'légumes mélangés': 150, 'thon en conserve': 120,
    'pomme de terre': 200, avocat: 75, 'bœuf haché maigre': 150, 'steak de bœuf': 170,
    saumon: 150, 'poudre de protéines': 30, 'barre protéinée': 60, amandes: 28,
    pomme: 182, 'lait 2 %': 250, 'fromage cottage': 175, 'fromage cheddar': 30,
    'huile d’olive': 14, beurre: 14, bagel: 95, tortilla: 60, céréales: 40, granola: 50,
  };
  const ui = {
    historyOptions: [], starterOptions: [], visibleOptions: [], optionMap: new Map(),
    selected: null, scale: 1, mealType: null, homeStateReceived: false,
  };

  const $ = (id) => document.getElementById(id);
  const round1 = (value) => Math.round((Number(value) || 0) * 10) / 10;
  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
  const escapeText = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));

  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-CA').trim();
  }

  function currentMealType(now = new Date()) {
    const hour = now.getHours();
    if (hour < 10) return 'breakfast';
    if (hour < 15) return 'lunch';
    if (hour < 20) return 'dinner';
    return 'snack';
  }

  function safeNumber(value, maximum = 100000) {
    const number = Number(value);
    return Number.isFinite(number) ? clamp(number, 0, maximum) : 0;
  }

  function cleanItem(item) {
    return {
      name: String(item?.name || item?.label || 'Aliment').trim().slice(0, 120) || 'Aliment',
      grams: safeNumber(item?.grams),
      calories: safeNumber(item?.calories, 20000),
      protein: safeNumber(item?.protein, 2000),
      carbs: safeNumber(item?.carbs, 3000),
      fat: safeNumber(item?.fat, 2000),
    };
  }

  function totals(items) {
    return items.reduce((sum, item) => ({
      grams: sum.grams + safeNumber(item.grams),
      calories: sum.calories + safeNumber(item.calories),
      protein: sum.protein + safeNumber(item.protein),
      carbs: sum.carbs + safeNumber(item.carbs),
      fat: sum.fat + safeNumber(item.fat),
    }), { grams: 0, calories: 0, protein: 0, carbs: 0, fat: 0 });
  }

  function optionFromItems(items, metadata = {}) {
    const cleaned = items.map(cleanItem).filter((item) => item.name);
    const names = [...new Set(cleaned.map((item) => item.name))];
    const label = metadata.label || (names.length <= 2 ? names.join(' + ') : `${names.slice(0, 2).join(' + ')} +${names.length - 2}`);
    const signature = names.map(normalize).sort().join('|') || normalize(label);
    return {
      id: metadata.id || `option:${signature}`,
      label,
      items: cleaned,
      signature,
      uses: Number(metadata.uses) || 1,
      lastUsed: metadata.lastUsed || '',
      tag: metadata.tag || (cleaned.length > 1 ? 'Repas récent' : 'Aliment récent'),
      originalMealType: metadata.mealType || null,
    };
  }

  function groupHistoricalMeals(meals) {
    const eventGroups = new Map();
    const safeMeals = (Array.isArray(meals) ? meals : []).filter((meal) => meal && typeof meal === 'object').slice(-5000);
    safeMeals.forEach((meal, index) => {
      const isLegacyScan = meal.source === 'smart-local-scan' && meal.createdAt;
      const key = meal.mealGroupId
        ? `group:${meal.mealGroupId}`
        : isLegacyScan ? `legacy-scan:${meal.createdAt}:${meal.mealType || ''}` : `single:${meal.id || index}`;
      if (!eventGroups.has(key)) eventGroups.set(key, []);
      eventGroups.get(key).push(meal);
    });
    return [...eventGroups.entries()].map(([key, items]) => {
      const latest = [...items].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0] || {};
      return optionFromItems(items, {
        id: `history-event:${key}`,
        lastUsed: latest.createdAt || '',
        mealType: latest.mealType,
      });
    });
  }

  function buildHistoryOptions(meals, limit = 8) {
    const aggregated = new Map();
    for (const event of groupHistoricalMeals(meals)) {
      const key = `${event.items.length > 1 ? 'meal' : 'food'}:${event.signature}`;
      const previous = aggregated.get(key);
      if (!previous) {
        aggregated.set(key, { ...event, id: `history:${key}`, uses: 1 });
        continue;
      }
      previous.uses += 1;
      if (String(event.lastUsed).localeCompare(String(previous.lastUsed)) > 0) {
        const uses = previous.uses;
        aggregated.set(key, { ...event, id: `history:${key}`, uses });
      }
    }
    return [...aggregated.values()]
      .map((option) => ({ ...option, tag: option.uses >= 2 ? `Fréquent · ${option.uses} fois` : (option.items.length > 1 ? 'Repas récent' : 'Aliment récent') }))
      .sort((a, b) => b.uses - a.uses || String(b.lastUsed).localeCompare(String(a.lastUsed)))
      .slice(0, Math.max(1, limit));
  }

  function defaultGramsFor(name) {
    return DEFAULT_GRAMS[normalize(name)] || 100;
  }

  function commonFoodOption(food) {
    const grams = defaultGramsFor(food?.name);
    const factor = grams / 100;
    return optionFromItems([{
      name: food?.name || 'Aliment', grams,
      calories: safeNumber(food?.values?.calories) * factor,
      protein: safeNumber(food?.values?.protein) * factor,
      carbs: safeNumber(food?.values?.carbs) * factor,
      fat: safeNumber(food?.values?.fat) * factor,
    }], { id: `common:${normalize(food?.name)}`, tag: 'Valeurs locales' });
  }

  function buildStarterOptions(commonFoods, mealType = currentMealType()) {
    const wanted = STARTERS[mealType] || STARTERS.snack;
    return wanted.map((name) => commonFoods.find((food) => normalize(food.name) === normalize(name)))
      .filter(Boolean).map(commonFoodOption);
  }

  function searchOptions(query, historyOptions, commonFoods, limit = 8) {
    const normalized = normalize(query);
    if (normalized.length < 2) return [];
    const terms = normalized.split(/\s+/).filter(Boolean);
    const candidates = [
      ...(historyOptions || []),
      ...(commonFoods || []).map(commonFoodOption),
    ];
    const seen = new Set();
    return candidates.map((option) => {
      const aliases = (commonFoods || []).find((food) => normalize(food.name) === normalize(option.label))?.aliases || [];
      const haystack = normalize([option.label, ...option.items.map((item) => item.name), ...aliases].join(' '));
      let score = 99;
      if (normalize(option.label).startsWith(normalized)) score = 0;
      else if (haystack.includes(normalized)) score = 1;
      else if (terms.every((term) => haystack.includes(term))) score = 2;
      return { option, score };
    }).filter((entry) => entry.score < 99)
      .sort((a, b) => a.score - b.score || b.option.uses - a.option.uses || a.option.label.localeCompare(b.option.label, 'fr-CA'))
      .map((entry) => entry.option)
      .filter((option) => {
        const key = `${normalize(option.label)}:${option.items.length}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, limit);
  }

  function scaleOption(option, scale) {
    const safeScale = clamp(Number(scale) || 1, 0.1, 5);
    return option.items.map((item) => ({
      ...item,
      grams: round1(item.grams * safeScale),
      calories: Math.round(item.calories * safeScale),
      protein: round1(item.protein * safeScale),
      carbs: round1(item.carbs * safeScale),
      fat: round1(item.fat * safeScale),
    }));
  }

  function optionButton(option) {
    const sum = totals(option.items);
    return `<button type="button" class="quick-option" data-quick-option="${escapeText(option.id)}"><span class="quick-option-icon">${option.items.length > 1 ? '🍽️' : '＋'}</span><span class="quick-option-copy"><b>${escapeText(option.label)}</b><small>${escapeText(option.tag)} · ${Math.round(sum.calories)} kcal</small></span><span class="quick-option-arrow">›</span></button>`;
  }

  function registerOptions(options) {
    options.forEach((option) => ui.optionMap.set(option.id, option));
    return options.map(optionButton).join('');
  }

  function renderSuggestions() {
    const history = ui.historyOptions;
    const options = history.length ? history.slice(0, 6) : ui.starterOptions;
    $('quickSuggestionTitle').textContent = history.length ? 'Tes raccourcis' : 'Pour commencer';
    $('quickSuggestionHint').textContent = history.length ? 'Fréquents et récents' : 'Portions courantes modifiables';
    $('quickAddSuggestions').innerHTML = options.length
      ? registerOptions(options)
      : '<div class="quick-empty">Ajoute un premier repas ou utilise la recherche ci-dessus.</div>';
  }

  function renderSearchResults() {
    const results = $('quickAddSearchResults');
    const query = $('quickAddSearch').value;
    ui.visibleOptions = searchOptions(query, ui.historyOptions, window.MACROFLOW_COMMON_FOODS || []);
    if (normalize(query).length < 2) {
      results.innerHTML = '';
      results.classList.add('hidden');
      return;
    }
    results.innerHTML = ui.visibleOptions.length
      ? registerOptions(ui.visibleOptions)
      : '<div class="quick-empty">Aucun aliment local trouvé. L’entrée manuelle reste disponible.</div>';
    results.classList.remove('hidden');
  }

  function renderEditor() {
    const editor = $('quickAddEditor');
    const option = ui.selected;
    if (!option) {
      editor.classList.add('hidden');
      editor.innerHTML = '';
      return;
    }
    const scaled = scaleOption(option, ui.scale);
    const sum = totals(scaled);
    const base = totals(option.items);
    const single = option.items.length === 1;
    editor.innerHTML = `
      <div class="quick-editor-head"><div><small>À confirmer</small><h3>${escapeText(option.label)}</h3></div><button type="button" data-quick-cancel aria-label="Fermer">×</button></div>
      <div class="quick-scale-row" aria-label="Quantité">
        <button type="button" data-quick-scale="0.5" class="${ui.scale === 0.5 ? 'active' : ''}">½ portion</button>
        <button type="button" data-quick-scale="1" class="${ui.scale === 1 ? 'active' : ''}">Habituelle</button>
        <button type="button" data-quick-scale="1.5" class="${ui.scale === 1.5 ? 'active' : ''}">1,5×</button>
      </div>
      <div class="quick-editor-fields">
        ${single ? `<label>Quantité (g)<input id="quickAddGrams" type="number" inputmode="decimal" min="1" max="100000" step="1" value="${round1(sum.grams)}" data-base-grams="${round1(base.grams)}"></label>` : `<div class="quick-group-size"><small>${option.items.length} aliments</small><b>${round1(sum.grams)} g au total</b></div>`}
        <label>Moment<select id="quickAddMealType">${Object.entries(MEAL_LABELS).map(([value, label]) => `<option value="${value}" ${ui.mealType === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      </div>
      <div class="quick-total-preview"><div><strong>${Math.round(sum.calories)}</strong><small>kcal</small></div><div><strong>${round1(sum.protein)} g</strong><small>protéines</small></div><div><strong>${round1(sum.carbs)} g</strong><small>glucides</small></div><div><strong>${round1(sum.fat)} g</strong><small>lipides</small></div></div>
      <button type="button" class="quick-confirm" data-quick-confirm>Ajouter maintenant</button>`;
    editor.classList.remove('hidden');
  }

  function selectOption(option) {
    if (!option?.items?.length) return;
    ui.selected = option;
    ui.scale = 1;
    ui.mealType = currentMealType();
    renderEditor();
    $('quickAddSearchResults').classList.add('hidden');
    setTimeout(() => $('quickAddEditor')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 30);
  }

  function confirmSelection() {
    if (!ui.selected) return;
    const items = scaleOption(ui.selected, ui.scale);
    window.dispatchEvent(new CustomEvent('macroflow:quick-add-confirm', {
      detail: { items, mealType: ui.mealType || currentMealType(), optionId: ui.selected.id },
    }));
  }

  function refreshWithMeals(meals) {
    ui.historyOptions = buildHistoryOptions(meals);
    ui.starterOptions = buildStarterOptions(window.MACROFLOW_COMMON_FOODS || [], currentMealType());
    renderSuggestions();
    if ($('quickAddSearch')?.value) renderSearchResults();
  }

  function readMeals() {
    if (typeof indexedDB === 'undefined') return Promise.resolve([]);
    return new Promise((resolve) => {
      const request = indexedDB.open(DATABASE.name, DATABASE.version);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(DATABASE.store)) request.result.createObjectStore(DATABASE.store);
      };
      request.onerror = () => resolve([]);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction(DATABASE.store, 'readonly');
        const getRequest = transaction.objectStore(DATABASE.store).get(DATABASE.key);
        getRequest.onsuccess = () => resolve(Array.isArray(getRequest.result?.meals) ? getRequest.result.meals : []);
        getRequest.onerror = () => resolve([]);
        transaction.oncomplete = () => database.close();
      };
    });
  }

  function openHub() {
    document.querySelector('[data-tab="home"]')?.click();
    const hub = $('quickAddHub');
    hub?.classList.add('attention');
    hub?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => {
      hub?.classList.remove('attention');
      $('quickAddSearch')?.focus({ preventScroll: true });
    }, 350);
  }

  function bind() {
    const hub = $('quickAddHub');
    if (!hub) return;
    $('quickAddSearch').addEventListener('input', renderSearchResults);
    $('quickAddManualBtn').addEventListener('click', () => window.dispatchEvent(new CustomEvent('macroflow:open-manual-meal')));
    hub.addEventListener('click', (event) => {
      const optionButtonElement = event.target.closest('[data-quick-option]');
      if (optionButtonElement) return selectOption(ui.optionMap.get(optionButtonElement.dataset.quickOption));
      const scaleButton = event.target.closest('[data-quick-scale]');
      if (scaleButton) {
        ui.scale = Number(scaleButton.dataset.quickScale);
        renderEditor();
        return;
      }
      if (event.target.closest('[data-quick-cancel]')) {
        ui.selected = null;
        renderEditor();
        return;
      }
      if (event.target.closest('[data-quick-confirm]')) confirmSelection();
    });
    hub.addEventListener('change', (event) => {
      if (event.target.id === 'quickAddMealType') {
        ui.mealType = event.target.value;
        return;
      }
      if (event.target.id !== 'quickAddGrams' || !ui.selected) return;
      const baseGrams = Number(event.target.dataset.baseGrams) || totals(ui.selected.items).grams || 100;
      ui.scale = clamp((Number(event.target.value) || baseGrams) / baseGrams, 0.1, 5);
      renderEditor();
    });
    window.addEventListener('macroflow:home-rendered', (event) => {
      ui.homeStateReceived = true;
      refreshWithMeals(event.detail?.meals || []);
    });
    window.addEventListener('macroflow:quick-add-select', (event) => {
      const items = Array.isArray(event.detail?.items) ? event.detail.items : [];
      selectOption(optionFromItems(items, { id: `direct:${Date.now()}`, label: event.detail?.label, tag: 'À répéter' }));
      openHub();
    });
    window.addEventListener('macroflow:quick-add-saved', () => {
      ui.selected = null;
      ui.scale = 1;
      $('quickAddSearch').value = '';
      $('quickAddSearchResults').classList.add('hidden');
      renderEditor();
    });
  }

  const publicApi = Object.freeze({
    version: VERSION,
    normalize,
    currentMealType,
    optionFromItems,
    groupHistoricalMeals,
    buildHistoryOptions,
    buildStarterOptions,
    searchOptions,
    scaleOption,
    open: openHub,
    refresh: () => readMeals().then(refreshWithMeals),
  });
  window.MacroFlowQuickAddV20 = publicApi;

  if (typeof document !== 'undefined' && $('quickAddHub')) {
    bind();
    refreshWithMeals([]);
    readMeals().then((meals) => {
      if (!ui.homeStateReceived) refreshWithMeals(meals);
    });
  }
})();
